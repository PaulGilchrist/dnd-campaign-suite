// SP-096: PC initial heal computed negative (-82) from combatSummary placeholder maxHp=1.
// Pins: PC max-HP truth = runtime/change-data hitPoints, heal clamped to missing HP
// floored at 0, no negative hp_change log, rolled dice total surfaced in popup + logs,
// and the monster lane max-HP resolution byte-identical.
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

import { applyRegenerateEffect } from './regenerateHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
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

describe('regenerateHandler SP-096 PC initial heal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(csWithPlaceholder);
        applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount, oldHp: 83, newHp: 83 + amount, maxHp: 103 }));
    });

    it('resolves PC maxHp from runtime hitPoints (103) not the combatSummary placeholder (1)', async () => {
        evaluateAutoExpression.mockReturnValue(12);
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, victimName, 12, campaignName);
        expect(result.payload.description).toContain('Regained 12 HP');
        expect(result.payload.description).not.toContain('-');
    });

    it('clamps PC initial heal to missing HP (roll 21 vs 20 missing -> 20)', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        // Missing HP = 20 in this scenario variant: current 83, roll reaches 21.
        applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: Math.min(amount, 20), oldHp: 83, newHp: 103, maxHp: 103 }));
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        const hpEntry = addEntry.mock.calls.map(([, e]) => e).find(e => e && e.type === 'hp_change');
        expect(hpEntry.delta).toBe(20);
        expect(hpEntry.currentHp).toBe(103);
        expect(hpEntry.maxHp).toBe(103);
        expect(hpEntry.isHealing).toBe(true);
        expect(result.payload.description).toContain('Regained 20 HP');
    });

    it('never logs or applies a negative heal even with the 1/1 placeholder and no runtime hitPoints', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: null, currentHitPoints: 83 });
        // cs placeholder maxHp 1 < current 83 -> deficit is negative -> floored at 0.
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        expect(applyHealingToTarget).not.toHaveBeenCalled();
        const hpEntries = addEntry.mock.calls.map(([, e]) => e).filter(e => e && e.type === 'hp_change');
        expect(hpEntries.length).toBe(0);
        expect(JSON.stringify(addEntry.mock.calls)).not.toContain('-82');
        expect(result.payload.description).toContain('Already at full HP');
    });

    it('at-max PC gets an honest zero-heal message while the regenerate stamp still lands', async () => {
        evaluateAutoExpression.mockReturnValue(21);
        stampRuntime({ hitPoints: 103, currentHitPoints: 103 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('Already at full HP');
        expect(result.payload.description).toContain('rolled 4d8 + 15 = 21');
        expect(setRuntimeValue).toHaveBeenCalledWith(victimName, 'regenerateActive', true, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign', 'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: victimName, effect: 'regenerate' })]),
            campaignName,
        );
    });

    it('rolls un-rolled dice notation and surfaces the rolled total in popup and logs', async () => {
        // Live fingerprint: evaluateAutoExpression returns dice notation un-rolled.
        evaluateAutoExpression.mockImplementation(expr => expr);
        stampRuntime({ hitPoints: 103, currentHitPoints: 83 });
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, victimName);

        const rollArg = applyHealingToTarget.mock.calls[0][2];
        expect(rollArg).toBeGreaterThanOrEqual(19); // 4d8+15 min
        expect(rollArg).toBeLessThanOrEqual(20);     // clamped to missing HP (20)

        const healMatch = result.payload.description.match(/rolled 4d8 \+ 15 = (\d+)/);
        expect(healMatch).not.toBeNull();
        const rolledTotal = Number(healMatch[1]);
        expect(rolledTotal).toBeGreaterThanOrEqual(19);
        expect(rolledTotal).toBeLessThanOrEqual(47);

        const hpEntry = addEntry.mock.calls.map(([, e]) => e).find(e => e && e.type === 'hp_change');
        expect(hpEntry.rollTotal).toBe(rolledTotal);
        expect(hpEntry.rolls).toHaveLength(4);
        expect(hpEntry.delta).toBe(20);

        const spellEntry = addEntry.mock.calls.map(([, e]) => e).find(e => e && e.type === 'spell_effect');
        expect(spellEntry.effects[0]).toContain(`rolled 4d8 + 15 = ${rolledTotal}`);
    });

    it('monster victim lane keeps combatSummary maxHp precedence byte-identical', async () => {
        evaluateAutoExpression.mockReturnValue(25);
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return [];
            return null;
        });
        applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount, oldHp: 3, newHp: 3 + amount, maxHp: 7 }));
        const result = await applyRegenerateEffect(makeAction(), casterStats(), campaignName, null, 'Goblin');

        expect(applyHealingToTarget).toHaveBeenCalledWith(csWithPlaceholder, 'Goblin', 4, campaignName);
        expect(result.payload.description).toContain('Regained 4 HP');
        expect(result.payload.description).toContain('rolled 4d8 + 15 = 25');
    });
});
