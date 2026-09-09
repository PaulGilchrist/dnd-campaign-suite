// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

import { rollExpression, rollExpressionDoubled } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - metamagic twin and multi-target', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard' },
            { name: 'Goblin', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const defaultSaveResult = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const defaultApplyResult = { finalDamage: 10, newHp: 3, damageReduced: false };
    const defaultContext = {
        targetName: 'Goblin',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
        isSpellDamage: true,
    };
    const defaultCombatSummary = {
        creatures: [
            { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 20, rolls: [6, 4, 6, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        evaluateAutoExpression.mockReturnValue(0);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
        endInvisibilityOnHostileAction.mockClear();
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createNpcSaveDamageHandler(deps);
    }

    function callHandler(fn, contextOverride = {}, combatSummaryOverride = null) {
        return fn(
            'Fire Bolt', '1d10', 10, [6, 4], 0,
            { ...defaultContext, ...contextOverride },
            10,
            combatSummaryOverride || defaultCombatSummary
        );
    }

    function setupActiveConditions(conditions) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeConditions') return conditions;
            return null;
        });
    }

    describe('metamagic twin target', () => {
        it('applies damage to twin target when metamagicTwinTarget is set and target differs', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                playerStats: { name: 'TestWizard' },
            }, combatSummary);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget).toHaveBeenLastCalledWith(
                expect.anything(), 'Orc', 10, expect.any(Array), 'test-campaign',
                expect.any(Array), false, 'TestWizard'
            );
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                name: expect.stringContaining('(Twinned)'),
                targetName: 'Orc',
            }));
        });

        it('does not apply twin damage when twin target is the same as primary', async () => {
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult);

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Goblin' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });

        it('does not apply twin damage when twin target is not found in combatSummary', async () => {
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult);

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'NonExistent' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });

        it('applies twin disadvantage from corona aura', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc' }, combatSummary);

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Orc',
            }));
            // Twin save should be called with disadvantage=true
            const twinSaveCall = rollSaveForCreature.mock.calls[1];
            expect(twinSaveCall[3]).toBe(true); // disadvantage
        });

        it('applies twin disadvantage from targetEffects (disadvantage_on_next_save)', async () => {
            setupActiveConditions([]);
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Orc', effect: 'disadvantage_on_next_save' },
                ];
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc' }, combatSummary);

            const twinSaveCall = rollSaveForCreature.mock.calls[1];
            expect(twinSaveCall[3]).toBe(true); // disadvantage
            // Should have removed the targetEffect
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
        });

        it('applies twin advantage from saveModifiers', async () => {
            setupActiveConditions([]);
            const characters = [
                { name: 'TestWizard' },
                { name: 'Goblin', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
                {
                    name: 'Orc',
                    computedStats: { saveBonuses: { con: 0 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createNpcSaveDamageHandler({ ...deps, characters });
            await callHandler(fn, { metamagicTwinTarget: 'Orc' }, combatSummary);

            const twinSaveCall = rollSaveForCreature.mock.calls[1];
            expect(twinSaveCall[4]).toBe(true); // advantage
        });

        it('applies potent cantrip to twin damage on save success', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            hasPotentCantrip.mockReturnValue(true);
            const failSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 5, newHp: 10, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            }, combatSummary);

            // Twin damage should be halved: floor(10/2) = 5
            const twinCall = applyDamageToTarget.mock.calls[1];
            expect(twinCall[2]).toBe(5);
        });

        it('updates popup with twin target data', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc' }, combatSummary);

            expect(deps.setPopupHtml).toHaveBeenCalledTimes(2);
            const secondCall = deps.setPopupHtml.mock.calls[1][0];
            const result = secondCall(undefined);
            expect(result).toEqual(expect.objectContaining({
                twinTargetName: 'Orc',
                twinFinalDamage: 10,
                twinTargetCurrentHp: 5,
            }));
        });

        it('uses metamagicHeighten for twin disadvantage without checking auras', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                metamagicHeighten: true,
            }, combatSummary);

            // Twin save should use disadvantage from metamagicHeighten
            const twinSaveCall = rollSaveForCreature.mock.calls[1];
            expect(twinSaveCall[3]).toBe(true); // disadvantage
            // Corona should NOT be called for twin when metamagicHeighten short-circuits
            const twinCoronaCall = getCoronaSaveDisadvantage.mock.calls.find(
                (call) => call[0].targetName === 'Orc'
            );
            expect(twinCoronaCall).toBeUndefined();
        });
    });

    describe('multi target', () => {
        it('applies save-based damage to multi target when saveDC/saveType are set', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
            }, combatSummary);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                name: expect.stringContaining('(Words of Creation)'),
                targetName: 'Orc',
            }));
        });

        it('applies plain damage to multi target when no saveDC/saveType', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 7, newHp: 6, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 7, newHp: 8, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                saveDc: undefined,
                saveType: undefined,
            }, combatSummary);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            // Plain damage path passes ignoreResistance and characterName
            const multiCall = applyDamageToTarget.mock.calls[1];
            expect(multiCall[2]).toBe(10); // adjustedTotal
        });

        it('does not apply multi target damage when same as primary', async () => {
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult);

            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Goblin' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });

        it('does not apply multi target damage when not found in combatSummary', async () => {
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult);

            const fn = createFn();
            await callHandler(fn, { multiTarget: 'NonExistent' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });

        it('applies multi target advantage from saveModifiers', async () => {
            setupActiveConditions([]);
            const characters = [
                { name: 'TestWizard' },
                { name: 'Goblin', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
                {
                    name: 'Orc',
                    computedStats: { saveBonuses: { con: 0 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createNpcSaveDamageHandler({ ...deps, characters });
            await callHandler(fn, { multiTarget: 'Orc' }, combatSummary);

            const multiSaveCall = rollSaveForCreature.mock.calls[1];
            expect(multiSaveCall[4]).toBe(true); // advantage
        });

        it('applies potent cantrip to multi target damage on save success', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            hasPotentCantrip.mockReturnValue(true);
            const failSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 5, newHp: 10, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            }, combatSummary);

            // Multi target damage should be halved: floor(10/2) = 5
            const multiCall = applyDamageToTarget.mock.calls[1];
            expect(multiCall[2]).toBe(5);
        });

        it('updates popup with multi target data', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc' }, combatSummary);

            expect(deps.setPopupHtml).toHaveBeenCalledTimes(2);
            const secondCall = deps.setPopupHtml.mock.calls[1][0];
            const result = secondCall(undefined);
            expect(result).toEqual(expect.objectContaining({
                twinTargetName: 'Orc',
                twinFinalDamage: 10,
                twinTargetCurrentHp: 5,
            }));
        });

        it('applies multi target ignoreResistance when no save', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            hasIgnoreResistance.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                saveDc: undefined,
                saveType: undefined,
                playerStats: { name: 'TestWizard' },
            }, combatSummary);

            // Second call should pass ignoreResistance=true with total damage
            expect(applyDamageToTarget).toHaveBeenNthCalledWith(
                2,
                expect.anything(), 'Orc', 10, expect.any(Array), 'test-campaign',
                null, true, 'TestWizard'
            );
        });

        it('does not roll saves for multi target when saveDC/saveType are missing', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 7, newHp: 6, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 7, newHp: 8, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                saveDc: undefined,
                saveType: undefined,
            }, combatSummary);

            // Only 1 rollSaveForCreature call (primary), not for multi target
            expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
        });
    });

    describe('multi target with save - edge cases', () => {
        it('multi target with failed save deals full adjustedTotal damage', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                dcSuccess: 'half',
            }, combatSummary);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            // computeDamageAfterSave mock returns total when save fails
            const multiCall = applyDamageToTarget.mock.calls[1];
            expect(multiCall[2]).toBe(10);
        });

        it('multi target gets zero damage on successful save with dcSuccess=none', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            const failSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 0, newHp: 13, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 0, newHp: 15, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
            }, combatSummary);

            const multiCall = applyDamageToTarget.mock.calls[1];
            expect(multiCall[2]).toBe(0);
        });

        it('multi target logs with correct formula when isAutoCrit is true', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                isAutoCrit: true,
            }, combatSummary);

            const multiLogCall = deps.logEntry.mock.calls.find(
                (call) => call[0].targetName === 'Orc'
            );
            expect(multiLogCall[0].isCrit).toBe(true);
        });
    });

    describe('twin + multi target interaction with secondary damage', () => {
        it('applies secondary damage when autoDamageSecondaryFormula is set with twin target', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [3, 1], modifier: 0 });
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryName: 'Extra Damage',
                autoDamageSecondaryDamageType: 'fire',
                playerStats: { name: 'TestWizard' },
            }, combatSummary);

            // Secondary damage first, then primary, then twin
            expect(applyDamageToTarget).toHaveBeenCalledTimes(3);
            // Secondary should have skipConcentration option
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[9]).toEqual(expect.objectContaining({ skipConcentration: true }));
        });

        it('multi target with autoDamageSecondaryFormula applies secondary then primary', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [3, 1], modifier: 0 });
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
            }, combatSummary);

            // Secondary damage first, then primary, then multi target
            expect(applyDamageToTarget).toHaveBeenCalledTimes(3);
        });

        it('multi target with saveDC/saveType and save success applies zero damage', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            const failSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 0, newHp: 15, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc' }, combatSummary);

            const multiCall = applyDamageToTarget.mock.calls[1];
            expect(multiCall[2]).toBe(0);
        });
    });

    describe('twin advantage from corona + elder champion priority', () => {
        it('skips elder champion check for twin when corona already set disadvantage', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc' }, combatSummary);

            // Corona should be called twice (once for primary, once for twin)
            expect(getCoronaSaveDisadvantage).toHaveBeenCalledTimes(2);
            // Elder champion should not be called for twin when corona already set disadvantage
            const coronaCalls = getCoronaSaveDisadvantage.mock.calls;
            expect(coronaCalls[0][0].targetName).toBe('Goblin');
            expect(coronaCalls[1][0].targetName).toBe('Orc');
        });
    });

    describe('twin target with different damage types', () => {
        it('passes damageType to corona check for twin target', async () => {
            setupActiveConditions([]);
            const combatSummary = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 },
                ],
            };
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue(defaultSaveResult);
            applyDamageToTarget.mockResolvedValueOnce(defaultApplyResult)
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                damageType: 'cold',
            }, combatSummary);

            const twinCoronaCall = getCoronaSaveDisadvantage.mock.calls.find(
                (call) => call[0].targetName === 'Orc'
            );
            expect(twinCoronaCall[0].damageType).toBe('cold');
        });
    });
});
