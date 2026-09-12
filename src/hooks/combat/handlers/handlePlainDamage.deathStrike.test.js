// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
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

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSends: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage death strike', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
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

    describe('death strike effect', () => {
        function setupDeathStrikeRuntime(saveDc = 15, saveType = 'strength') {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [
                    {
                        effect: 'death_strike',
                        target: 'Goblin',
                        saveDc,
                        saveType,
                    },
                ];
                if (key === 'Goblin' && prop === 'currentHitPoints') return 5;
                if (key === 'Goblin' && prop === 'hitPoints') return 10;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 5, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 10, maxHp: 10 }],
            });
        }

        it('sends save prompt when death strike effect is present and save fails', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            // Wait for the save prompt to be sent, then dispatch failure
            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 10, bonus: 2, rawRolls: [10] });

            await promise.catch(() => { });

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    promptId: 'test-guid-1234',
                    targetName: 'Goblin',
                    saveType: 'strength',
                    saveDc: 15,
                    dcSuccess: false,
                })
            );
        });

        it('removes death strike effect after processing regardless of save result', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 15, bonus: 3, rawRolls: [12] });

            await promise.catch(() => { });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([]),
                'test-campaign'
            );
        });

        it('applies doubled damage when save fails', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 5, bonus: 2, rawRolls: [5] });

            await promise.catch(() => { });

            // On save failure, doubledTotal = adjustedTotal * 2 = 8 * 2 = 16
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 16, ['slashing'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestFighter' });
        });

        it('does not apply doubled damage when save succeeds', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: true, roll: 18, bonus: 3, rawRolls: [15] });

            await promise.catch(() => { });

            // On save success, doubled damage should NOT be applied
            expect(applyDamageToTarget).not.toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                expect.any(Number),
                ['slashing'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestFighter'
            );

            // Verify the popup was NOT updated with death strike doubled flag
            const popupCalls = deps.setPopupHtml.mock.calls;
            const deathStrikePopup = popupCalls.find(
                (call) => call[0]?.deathStrikeDoubled === true
            );
            expect(deathStrikePopup).toBeUndefined();
        });

        it('sets popup html with death strike details on save failure', async () => {
            setupDeathStrikeRuntime();
            applyDamageToTarget.mockReturnValue({ finalDamage: 14, newHp: -4, damageReduced: false });

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 7, bonus: 2, rawRolls: [7] });

            await promise.catch(() => { });

            // setPopupHtml is called with a function (prev => {...}) in the death strike path
            const popupCalls = deps.setPopupHtml.mock.calls;
            const deathStrikeCall = popupCalls.find(
                (call) => typeof call[0] === 'function'
            );
            expect(deathStrikeCall).toBeDefined();
            const result = deathStrikeCall[0]({});
            expect(result).toMatchObject({
                deathStrikeDoubled: true,
                deathStrikeSaveRoll: 7,
                deathStrikeSaveBonus: 2,
                deathStrikeSaveDc: 15,
                deathStrikeFinalDamage: 14,
            });
        });

        it('logs save-damage entry when death strike save fails', async () => {
            setupDeathStrikeRuntime();

            const fn = createFn();
            const promise = fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            await new Promise((resolve) => setTimeout(resolve, 10));
            dispatchSaveResult('test-guid-1234', { success: false, roll: 8, bonus: 2, rawRolls: [8] });

            await promise.catch(() => { });

            expect(deps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roll',
                    rollType: 'save-damage',
                    name: 'Death Strike',
                    formula: '2× 1d8+3',
                    total: 16,
                    saveType: 'strength',
                    saveDc: 15,
                    saveResult: 'failure',
                    saveRoll: 8,
                    saveBonus: 2,
                    note: 'death_strike_damage_roll_before_apply',
                })
            );
        });
    });

    describe('death strike with missing saveDc/saveType', () => {
        it('does not send save prompt when death strike effect is missing saveDc', async () => {
            getRuntimeValue.mockReset().mockImplementation((key) => {
                if (key === 'campaign') return [
                    {
                        effect: 'death_strike',
                        target: 'Goblin',
                    },
                ];
                return null;
            });
            applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
            sendSavePrompt.mockClear();
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('does not send save prompt when death strike effect is missing saveType', async () => {
            getRuntimeValue.mockReset().mockImplementation((key) => {
                if (key === 'campaign') return [
                    {
                        effect: 'death_strike',
                        target: 'Goblin',
                        saveDc: 15,
                    },
                ];
                return null;
            });
            applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
            sendSavePrompt.mockClear();
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(sendSavePrompt).not.toHaveBeenCalled();
        });
    });
});
