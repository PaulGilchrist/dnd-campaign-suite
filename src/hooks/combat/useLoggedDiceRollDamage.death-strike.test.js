// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Death Strike handling', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        sendSavePrompt.mockClear();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function dispatchSaveResult(promptId, options) {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId,
                success: options.success || false,
                roll: options.roll || 10,
                bonus: options.bonus || 0,
                rawRolls: options.rawRolls || [10],
            },
        }));
    }

    function setupDeathStrikeRuntime(saveDc = 15, saveType = 'CON') {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign') {
                return [
                    {
                        effect: 'death_strike',
                        target: 'Goblin',
                        saveDc,
                        saveType,
                    },
                ];
            }
            if (key === 'Goblin' && prop === 'currentHitPoints') return 5;
            if (key === 'Goblin' && prop === 'hitPoints') return 10;
            return null;
        });
    }

    describe('death strike save failure', () => {
        it('sends a save prompt with correct parameters', async () => {
            setupDeathStrikeRuntime(15, 'CON');

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 3, rawRolls: [5] });

            await promise.catch(() => { });

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    promptId: 'test-guid-1234',
                    targetName: 'Goblin',
                    saveType: 'CON',
                    saveDc: 15,
                    dcSuccess: false,
                })
            );
        });

        it('applies doubled damage after save failure', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 3, rawRolls: [5] });

            await promise.catch(() => { });

            // adjustedTotal = 10, doubledTotal = 10 * 2 = 20
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 20, ['slashing'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestFighter' });
        });

        it('logs save-damage entry with full death strike context', async () => {
            setupDeathStrikeRuntime(15, 'CON');

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 3, rawRolls: [5] });

            await promise.catch(() => { });

            expect(deps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roll',
                    rollType: 'save-damage',
                    name: 'Death Strike',
                    formula: '2× 2d6+3',
                    total: 20,
                    damageType: 'slashing',
                    targetName: 'Goblin',
                    saveType: 'CON',
                    saveDc: 15,
                    saveResult: 'failure',
                    saveRoll: 5,
                    saveBonus: 3,
                    saveRawRolls: [5],
                    finalDamage: null,
                    note: 'death_strike_damage_roll_before_apply',
                })
            );
        });

        it('sets popup html with death strike details on failure', async () => {
            setupDeathStrikeRuntime();
            applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: -7, damageReduced: false });

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 3, rawRolls: [5] });

            await promise.catch(() => { });

            const popupCalls = deps.setPopupHtml.mock.calls;
            const deathStrikeCall = popupCalls.find(
                (call) => typeof call[0] === 'function'
            );
            expect(deathStrikeCall).toBeDefined();
            const result = deathStrikeCall[0]({});
            expect(result).toMatchObject({
                deathStrikeDoubled: true,
                deathStrikeSaveRoll: 5,
                deathStrikeSaveBonus: 3,
                deathStrikeSaveDc: 15,
                deathStrikeFinalDamage: 20,
            });
        });

        it('removes death strike effect from targetEffects after processing', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 3, rawRolls: [5] });

            await promise.catch(() => { });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'test-campaign'
            );

            const cleanupCall = setRuntimeValue.mock.calls.find(
                (call) => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(cleanupCall).toBeDefined();
            const cleanedEffects = cleanupCall[2];
            const hasDeathStrike = cleanedEffects.some((te) => te.effect === 'death_strike');
            expect(hasDeathStrike).toBe(false);
        });
    });

    describe('death strike save success', () => {
        it('does not apply doubled damage when save succeeds', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 18, bonus: 3, rawRolls: [15] });

            await promise.catch(() => { });

            // Verify the death strike doubled damage was NOT applied
            const deathStrikeCalls = applyDamageToTarget.mock.calls.filter(
                (call) => call[1] === 'Goblin' && call[2] === 20
            );
            expect(deathStrikeCalls).toHaveLength(0);
        });

        it('does not set deathStrikeDoubled flag on popup when save succeeds', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 18, bonus: 3, rawRolls: [15] });

            await promise.catch(() => { });

            const popupCalls = deps.setPopupHtml.mock.calls;
            const deathStrikeCall = popupCalls.find(
                (call) => typeof call[0] === 'function'
            );
            if (deathStrikeCall) {
                const result = deathStrikeCall[0]({});
                expect(result.deathStrikeDoubled).toBeUndefined();
            }
        });

        it('logs no save-damage entry when save succeeds', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 18, bonus: 3, rawRolls: [15] });

            await promise.catch(() => { });

            const saveDamageLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0]?.rollType === 'save-damage'
            );
            expect(saveDamageLogs).toHaveLength(0);
        });

        it('still removes death strike effect after save success', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 18, bonus: 3, rawRolls: [15] });

            await promise.catch(() => { });

            const cleanupCall = setRuntimeValue.mock.calls.find(
                (call) => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(cleanupCall).toBeDefined();
            const cleanedEffects = cleanupCall[2];
            const hasDeathStrike = cleanedEffects.some((te) => te.effect === 'death_strike');
            expect(hasDeathStrike).toBe(false);
        });
    });

    describe('death strike with missing fields', () => {
        it('does not send save prompt when death strike effect is missing saveDc', async () => {
            getRuntimeValue.mockReset().mockImplementation((key) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'death_strike',
                            target: 'Goblin',
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();
            await fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('does not send save prompt when death strike effect is missing saveType', async () => {
            getRuntimeValue.mockReset().mockImplementation((key) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'death_strike',
                            target: 'Goblin',
                            saveDc: 15,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();
            await fn('Greatsword', '2d6+3', 10, [4, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(sendSavePrompt).not.toHaveBeenCalled();
        });
    });
});
