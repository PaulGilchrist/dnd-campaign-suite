// @maintained-by-ai
// ── regenerate QUARTET lane #1947 .apply — applyRegenerateEffect application ─────
// Seam map lives in regenerateHandler.active.test.js header (#1946). Lanes:
//   #1946 .active — load guard (isRegenerateActive DEAD export removed there).
//   #1947 .apply  (this) — expression resolution, HP source resolution (runtime vs
//                          combatSummary), max-HP clamp, applyHealingToTarget
//                          delegation, logs, regenerate stamp, regenerateActive pin.
//   #1948 .sp096  — PC 1/1-placeholder fix locks incl. applyResult consumption
//                          (mock returns {actualHeal,newHp} there; this lane keeps
//                          the undefined-applyResult fallback path — no overlap).
//   #1949 .test   — handle() orchestration only.
//
// Export liveness re-verified 2026-10-16 (grep incl. string dispatch):
//   applyRegenerateEffect — LIVE: index.js imports L14 + re-exports L647; sole
//   production consumer is regenerateService.js confirmRegenerate L27 (the
//   regenerate_target_selection popup confirm). isRegenerateActive — dead, per
//   #1946 header; every live 'regenerateActive' reader (turnStartEffects,
//   restRules short/long, useInitiativeEffects, clearExpirationEffects) reads the
//   runtime key directly, so THIS file's flag-write pin is the subject's only
//   forward-contract pin for the key. Strengthened to an exact one-write table.
//
// abilities-ARRAY audit: honest verdict — no bug class in this subject.
//   applyRegenerateEffect reads only playerStats.name and playerStats.hitPoints
//   (resolveRegenerateMaxHp fallback) and forwards the object untouched to the
//   mocked evaluateAutoExpression; the array fixture is inert here.
// diceRoller is un-mocked but unreachable: every evaluateAutoExpression mock in
// this file returns a number, so rollInitialHeal never calls rollExpression.
//
// Trims applied this pass (33 -> 21 its):
//   • 3x input-validation its -> 1 (single falsy-guard branch; table loop).
//   • 2x loose 'default to 33' its -> 1 exact '= 33' popup pin (the only surface
//     where the un-clamped default is visible; old version passed with any >=2).
//   • 'use evaluated result as heal amount' — misnomer, amount was clamped (2);
//     same min() path as the healing-cap block.
//   • Orc no-runtime cap — same storedHp-null branch as Goblin null-fallback.
//   • 'fall back to playerStats.hitPoints when creature has no currentHp' —
//     did not test its name (maxHp resolved from creature.maxHp); outcome
//     (zero-heal at full) pinned by the at-max test.
//   • actualHeal-0 return-value dup of at-max test (popup assert folded in).
//   • 'popup description contains' x2 — substrings of the full-string popupText
//     pinned via EXPECTED_POPUP_TEXT in the automation_info test.
//   • self-heal source test — zero discriminating power (entry.sourceName is
//     undefined on ability_use, so the || fell back to characterName, which holds
//     for every target).
//   • dedupe + other-target badge filters -> one exact-output-table test pinning
//     both operands of the filter predicate.
//   • null targetEffects — same '|| [] || isArray' one-liner as non-array case.
// ──────────────────────────────────────────────────────────────────────────────
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
const casterName = 'Cleric1';

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'monster', maxHp: 7, currentHp: 3 },
        { name: 'Orc', type: 'monster', maxHp: 15, currentHp: 10 },
        { name: casterName, type: 'player', maxHp: 50, currentHp: 25 },
    ],
};

function makeAction(overrides = {}) {
    return {
        name: 'Regenerate',
        automation: overrides.automation || {},
        spell: { name: 'Regenerate', range: 'Touch', level: 7, ...overrides.spell },
    };
}

function makeCaster() {
    return { name: casterName, level: 7, proficiency: 4, abilities: [{ name: 'Wisdom', bonus: 3 }], hitPoints: 50 };
}

function applyEffect(targetName, actionOverrides = {}, runtimeOverrides = {}) {
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockImplementation((scope, key) => {
        if (key === 'targetEffects') return runtimeOverrides.targetEffects ?? [];
        if (key === 'currentHitPoints') return runtimeOverrides.currentHitPoints ?? null;
        return null;
    });
    return applyRegenerateEffect(makeAction(actionOverrides), makeCaster(), campaignName, null, targetName);
}

// Handler-composed popupText for the standard scenario: roll 10, Goblin 3/7
// runtime-HP-missing -> clamped heal 4. Reused across popup + log full-string pins.
const heal10Text = 'Regained 4 HP (rolled 4d8 + 15 = 10)';
const EXPECTED_POPUP_TEXT = `Regenerate on Goblin: ${heal10Text}. Target gains 1 HP per turn and is restored to full HP when the effect ends.`;

describe('applyRegenerateEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        evaluateAutoExpression.mockReturnValue(18);
    });

    describe('input validation', () => {
        it('should return null for any falsy targetName (guard runs before any roll or write)', async () => {
            for (const targetName of [null, undefined, '']) {
                const result = await applyRegenerateEffect(makeAction(), { name: casterName }, campaignName, null, targetName);
                expect(result).toBeNull();
            }
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('healing calculation', () => {
        it('should use default expression 4d8+15 when no heal_at_slot_level', async () => {
            await applyEffect('Goblin', { spell: { name: 'Regenerate' } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('4d8 + 15', expect.any(Object));
        });

        it('should use heal_at_slot_level expression when available at current slot', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '7': '6d8 + 20' } } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('6d8 + 20', expect.any(Object));
        });

        it('should fall back to highest slot level when current slot not in heal_at_slot_level', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '5': '3d8 + 10' } } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('3d8 + 10', expect.any(Object));
        });

        it('should default the heal to exactly 33 when evaluation returns non-positive (0 or negative)', async () => {
            // Popup text carries the un-clamped rolled amount, so '= 33' is the
            // only honest surface for the resolveRegenerateHealAmount default.
            evaluateAutoExpression.mockReturnValue(0);
            let result = await applyEffect('Goblin', {}, { currentHitPoints: 5 });
            expect(result.payload.description).toContain('rolled 4d8 + 15 = 33');
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 2, campaignName);

            evaluateAutoExpression.mockReturnValue(-5);
            result = await applyEffect('Goblin', {}, { currentHitPoints: 5 });
            expect(result.payload.description).toContain('rolled 4d8 + 15 = 33');
        });
    });

    describe('healing cap at max HP', () => {
        it('should cap healing so target does not exceed maxHp', async () => {
            evaluateAutoExpression.mockReturnValue(25);
            await applyEffect('Goblin', {}, { currentHitPoints: 6 });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 1, campaignName);
        });

        it('should skip applyHealingToTarget and still return popup when target is already at max HP', async () => {
            evaluateAutoExpression.mockReturnValue(25);
            const result = await applyEffect('Goblin', {}, { currentHitPoints: 7 });
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });
    });

    describe('HP source resolution', () => {
        it('should use runtime currentHitPoints when stored', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: 2 });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 5, campaignName);
        });

        it('should fall back to creature.currentHp when runtime is null', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: null });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 4, campaignName);
        });

        it('should fall back to creature.currentHp when runtime is empty string', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: '' });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 4, campaignName);
        });
    });

    describe('regenerateActive flag', () => {
        // ONLY flag-write pin in the subject (isRegenerateActive predicate was
        // removed as dead in #1946). Exact one-write table — the runtime key's
        // forward contract for turnStartEffects/restRules/clearExpiration readers.
        it('should write regenerateActive=true to the target exactly once', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const flagWrites = setRuntimeValue.mock.calls.filter(([, key]) => key === 'regenerateActive');
            expect(flagWrites).toEqual([['Goblin', 'regenerateActive', true, campaignName]]);
        });
    });

    describe('targetEffects badge registration', () => {
        it('should stamp exactly one {target, effect, source} regenerate entry on a clean registry', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                [{ target: 'Goblin', effect: 'regenerate', source: casterName }],
                campaignName,
            );
        });

        it('should preserve other effect entries in order and append the regenerate entry', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: [{ target: 'Goblin', effect: 'faerie_fire', source: 'Wizard' }] });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                [
                    { target: 'Goblin', effect: 'faerie_fire', source: 'Wizard' },
                    { target: 'Goblin', effect: 'regenerate', source: casterName },
                ],
                campaignName,
            );
        });

        it('should replace a stale regenerate on this target only — other targets regenerate survives untouched', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: [
                { target: 'Goblin', effect: 'regenerate', source: 'OldCleric' },
                { target: 'Orc', effect: 'regenerate', source: 'OtherCleric' },
            ] });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                [
                    { target: 'Orc', effect: 'regenerate', source: 'OtherCleric' },
                    { target: 'Goblin', effect: 'regenerate', source: casterName },
                ],
                campaignName,
            );
        });

        it('should recover from a non-array targetEffects store', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: 'not-an-array' });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                [{ target: 'Goblin', effect: 'regenerate', source: casterName }],
                campaignName,
            );
        });
    });

    describe('logging', () => {
        it('should log an hp_change entry with exact heal fields', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const hpCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'hp_change');
            expect(hpCalls).toHaveLength(1);
            const entry = hpCalls[0][1];
            expect(entry).toMatchObject({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: 4,
                currentHp: 7,
                maxHp: 7,
                isHealing: true,
                sourceName: casterName,
                note: 'Regenerate',
                formula: '4d8 + 15',
                rollTotal: 10,
            });
            // Numeric-eval lane produces no individual dice (rolls surfaced in #1948 notation lane).
            expect(entry.rolls).toBeUndefined();
            expect(hpCalls[0][0]).toBe(campaignName);
        });

        it('should log an ability_use entry with the full composed popup text', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const abilityCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'ability_use');
            expect(abilityCalls).toHaveLength(1);
            expect(abilityCalls[0][1]).toMatchObject({
                characterName: casterName,
                abilityName: 'Regenerate',
                targetName: 'Goblin',
                description: EXPECTED_POPUP_TEXT,
            });
        });

        it('should log a spell_effect entry with the exact effects string', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const spellCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'spell_effect');
            expect(spellCalls).toHaveLength(1);
            expect(spellCalls[0][1]).toMatchObject({
                characterName: casterName,
                spellName: 'Regenerate',
                targetName: 'Goblin',
                effects: ['Initial heal: 4 HP (rolled 4d8 + 15 = 10), Ongoing: 1 HP/turn'],
            });
        });

        it('should use the resolved slot expression as formula in hp_change log', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '7': '6d8 + 20' } } });
            const hpCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'hp_change');
            expect(hpCalls[0][1].formula).toBe('6d8 + 20');
        });
    });

    describe('return value', () => {
        it('should return automation_info popup with the handler-composed description', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            const result = await applyEffect('Goblin');
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Regenerate');
            expect(result.payload.description).toBe(EXPECTED_POPUP_TEXT);
        });

        it('should not call applyHealingToTarget when combatSummary is null', async () => {
            getCombatSummary.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(10);
            const result = await applyRegenerateEffect(makeAction(), makeCaster(), campaignName, null, 'Goblin');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });
    });
});
