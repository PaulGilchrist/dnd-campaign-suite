// SP-096: PC initial heal computed negative (-82) from combatSummary placeholder maxHp=1.
// FIX-SPECIFIC lock lane (#1948) — pins ONLY what commit d6e630823 changed or guarded:
// PC max-HP truth = runtime/change-data hitPoints, heal floored at 0, hp_change log
// skipped when nothing restored, rolled-dice-total surfaced (rollInitialHeal), honest
// zero-heal message, monster-lane max-HP resolution byte-identical (no-side-effect guard).
//
// Overlap verdict vs closed #1947 .apply (per test-suite-trim handoff):
//   • regenerateActive one-write pin — NOT touched by the fix; #1947's exact one-write
//     table is the load-bearing forward contract → shed from here (was a loose dupe).
//   • targetEffects stamp — NOT touched by the fix; #1947 owns exact badge tables → shed.
//   • monster-lane tests here are fix guards with runtime decoys #1947 lacks → kept.
// Mutation kills (mutant = fix reverted / element removed):
//   T1 exact-call+popup kills pre-fix (apply skipped, '-82' in popup);
//   T2 identity-mock + exact-call(20) kills un-clamped pass-through and pre-fix maxHp 1;
//   T3 no-entries + '-82' guard + full-string popup kills pre-fix always-log branch;
//   T4 full-string zero-heal popup + hp_change-skip kills pre-fix popup & log-always;
//   T5 deterministic rollExpression + rollTotal/rolls pins kill no-roll pre-fix;
//   T6 Goblin runtime hitPoints decoy kills any runtime-first leak into the monster lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// Deterministic roller: the FIX (d6e630823) added rollInitialHeal → rollExpression
// for un-rolled notation. A live roller made the delta pin flaky (4d8 total 19 once
// per ~4096 rolls). Mock pins the exact call site and keeps every total fixed.
vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

import { applyRegenerateEffect } from './regenerateHandler.js';
// setRuntimeValue stays mocked (handler writes through it) but is no longer asserted
// here — its exact-write contract lives in #1947 (see header overlap verdict).
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'Wild_Sage_Druid';
const victimName = 'HexWarlock';

// Live fingerprint: combatSummary player entries are 1/1 placeholders.
const csWithPlaceholder = {
    creatures: [
        { name: victimName, type: 'player', maxHp: 1, currentHp: 1 },
        { name: 'Goblin', type: 'monster', maxHp: 7, currentHp: 3 },
    ],
};

function makeAction() {
    return {
        name: 'Regenerate',
        automation: { type: 'regenerate', range: 'Touch' },
        spell: { name: 'Regenerate', range: 'Touch', level: 7, heal_at_slot_level: { '7': '4d8 + 15' } },
    };
}

function casterStats() {
    return { name: casterName, level: 20, proficiency: 6, abilities: [{ name: 'Wisdom', bonus: 7 }], hitPoints: 135 };
}

function stampRuntime({ hitPoints = null, currentHitPoints = null } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [];
        if (name === victimName && key === 'hitPoints') return hitPoints;
        if (name === victimName && key === 'currentHitPoints') return currentHitPoints;
        return null;
    });
}

function hpChangeEntries() {
    return addEntry.mock.calls.map(([, e]) => e).filter(e => e && e.type === 'hp_change');
}

describe('regenerateHandler SP-096 PC initial heal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(csWithPlaceholder);
        // Identity mock: reports back exactly what the handler asked to heal, so any
        // un-clamped or placeholder-driven amount flows straight into the assertions.
        applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount, oldHp: 83, newHp: 83 + amount, maxHp: 103 }));
    });

    it('resolves PC maxHp from runtime hitPoints (103) not the combatSummary placeholder (1)', async () => {
        evaluateAutoExpression.mockReturnValue(12);
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        // Pre-fix mutant: maxHp 1 - current 83 -> actualHeal -82 -> this call never happens.
        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, victimName, 12, campaignName);
        expect(result.payload.description).toContain('Regained 12 HP');
        expect(result.payload.description).not.toContain('-');
    });

    it('clamps PC initial heal to missing HP (roll 21 vs 20 missing -> 20)', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        // Exact-call pin on the identity mock: a mutant handing the raw 21 to the
        // heal path now shows up as a wrong amount instead of being self-clamped.
        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, victimName, 20, campaignName);
        const hpEntry = hpChangeEntries()[0];
        expect(hpEntry.delta).toBe(20);
        expect(hpEntry.currentHp).toBe(103);
        expect(hpEntry.maxHp).toBe(103); // pre-fix mutant logged maxHp 1 here
        expect(hpEntry.isHealing).toBe(true);
        expect(result.payload.description).toContain('Regained 20 HP');
    });

    it('never logs or applies a negative heal even with the 1/1 placeholder and no runtime hitPoints', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: null, currentHitPoints: 83 });
        // cs placeholder maxHp 1 < current 83 -> deficit is negative -> floored at 0.
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(hpChangeEntries().length).toBe(0);
        expect(JSON.stringify(addEntry.mock.calls)).not.toContain('-82');
        // Full-string own-composition pin of the post-fix honest zero-heal popup.
        expect(result.payload.description).toBe(
            'Regenerate on HexWarlock: Already at full HP (rolled 4d8 + 15 = 21, no HP restored). ' +
            'Target gains 1 HP per turn and is restored to full HP when the effect ends.'
        );
    });

    it('at-max PC gets an honest zero-heal message and no hp_change log', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: 103, currentHitPoints: 103 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toBe(
            'Regenerate on HexWarlock: Already at full HP (rolled 4d8 + 15 = 21, no HP restored). ' +
            'Target gains 1 HP per turn and is restored to full HP when the effect ends.'
        );
        // Fix added the appliedHeal>0 log skip: pre-fix logged a delta-0 hp_change here.
        // (regenerateActive + targetEffects stamp pins live in #1947's exact tables — shed here.)
        expect(hpChangeEntries().length).toBe(0);
    });

    it('rolls un-rolled dice notation and surfaces the rolled total in popup and logs', async () => {
        // Live fingerprint: evaluateAutoExpression returns dice notation un-rolled.
        evaluateAutoExpression.mockImplementation(expr => expr);
        rollExpression.mockReturnValue({ total: 29, rolls: [7, 8, 6, 8] });
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        // Pre-fix never rolled: it resolved the notation to the 33 fallback.
        expect(rollExpression).toHaveBeenCalledWith('4d8 + 15');
        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, victimName, 20, campaignName);

        expect(result.payload.description).toContain('rolled 4d8 + 15 = 29');

        const hpEntry = hpChangeEntries()[0];
        expect(hpEntry.rollTotal).toBe(29);
        expect(hpEntry.rolls).toEqual([7, 8, 6, 8]);
        expect(hpEntry.delta).toBe(20);

        const spellEntry = addEntry.mock.calls.map(([, e]) => e).find(e => e && e.type === 'spell_effect');
        expect(spellEntry.effects[0]).toBe('Initial heal: 20 HP (rolled 4d8 + 15 = 29), Ongoing: 1 HP/turn');
    });

    it('monster victim lane keeps combatSummary maxHp precedence byte-identical', async () => {
        evaluateAutoExpression.mockReturnValue(25);
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return [];
            // Decoy: monsters must NEVER resolve maxHp from runtime hitPoints —
            // a runtime-first leak into the monster lane heals 25, not 4.
            if (name === 'Goblin' && key === 'hitPoints') return 999;
            return null;
        });
        applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount, oldHp: 3, newHp: 3 + amount, maxHp: 7 }));
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, 'Goblin');

        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, 'Goblin', 4, campaignName);
        expect(result.payload.description).toContain('Regained 4 HP');
        expect(result.payload.description).toContain('rolled 4d8 + 15 = 25');
    });
});
