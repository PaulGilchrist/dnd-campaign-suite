// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment, clearSoulstitchStamp } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - basic save damage flow', () => {
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
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
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

    describe('early return - no target', () => {
        it('returns early when target not found in combatSummary', async () => {
            const fn = createFn();
            const result = await fn('Fire Bolt', '1d10', 10, [6, 4], 0, {
                targetName: 'NonExistent',
                saveDc: 12,
                saveType: 'dex',
                dcSuccess: 'none',
                damageType: 'fire',
            }, 10, { creatures: [] });

            expect(result).toBeUndefined();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(rollSaveForCreature).not.toHaveBeenCalled();
        });
    });

    describe('disadvantage sources', () => {
        it('uses metamagicHeighten for disadvantage', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(), { metamagicHeighten: true });

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                true, // disadvantage
                false
            );
        });

        it('uses disadvantage_on_next_save targetEffect for disadvantage', async () => {
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Goblin', effect: 'disadvantage_on_next_save' },
                ];
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                true, // disadvantage
                false
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'test-campaign'
            );
        });

        it('uses corona aura for disadvantage', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true, source: 'CoronaCaster' });

            await callHandler(createFn());

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin',
                damageType: 'fire',
            }));
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                true,
                false
            );
        });

        it('uses elder champion aura for disadvantage', async () => {
            setupActiveConditions([]);
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'ElderChampion' });

            await callHandler(createFn(), { playerStats: { name: 'TestWizard' } });

            expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'Goblin',
            }));
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                true,
                false
            );
        });

        it('prioritizes corona over elder champion for disadvantage', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await callHandler(createFn());

            expect(getCoronaSaveDisadvantage).toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });

        it('short-circuits all disadvantage checks when metamagicHeighten is set', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await callHandler(createFn(), { metamagicHeighten: true });

            expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });
    });

    describe('save advantage', () => {
        it('applies advantage from saveModifiers', async () => {
            setupActiveConditions([]);
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];

            await callHandler(createNpcSaveDamageHandler({ ...deps, characters }));

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                false,
                true // advantage
            );
        });

        it('applies advantage from circle of power', async () => {
            setupActiveConditions([]);
            isCircleOfPowerActive.mockReturnValue(true);

            await callHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                false,
                true // advantage
            );
        });

        it('prioritizes disadvantage over advantage in roll call', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];

            await callHandler(createNpcSaveDamageHandler({ ...deps, characters }));

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'dex',
                12,
                true,  // disadvantage
                true   // advantage (disadvantage wins in the roll)
            );
        });
    });

    describe('soulstitch protection', () => {
        it('auto-succeeds save and deals zero damage when soulstitch protected', async () => {
            setupActiveConditions([]);
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.anything(), 'Goblin', 0, expect.any(Array), 'test-campaign',
                expect.any(Array), false, 'TestWizard', true
            );
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveResult).toBe('soulstitch_auto_success');
        });

        it('does not apply damage when soulstitch protected even if save fails', async () => {
            setupActiveConditions([]);
            hasSoulstitchProtection.mockReturnValue(true);

            await callHandler(createFn());

            // Save is still rolled, but damage is forced to 0
            const damageCall = applyDamageToTarget.mock.calls[0];
            expect(damageCall[2]).toBe(0);
        });

        it('CLA-321: consumes (clears) the caster stamp when the context flags a soulstitch cast', async () => {
            setupActiveConditions([]);
            hasSoulstitchProtection.mockReturnValue(true);

            await callHandler(createFn(), { soulstitchCast: true });

            expect(clearSoulstitchStamp).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });

        it('CLA-321: does not clear the stamp for a non-soulstitch cast', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(clearSoulstitchStamp).not.toHaveBeenCalled();
        });

        it('CLA-321: popup save roll matches the log save roll on the enforced path', async () => {
            setupActiveConditions([]);
            hasSoulstitchProtection.mockReturnValue(true);
            rollSaveForCreature.mockReturnValue({ roll: 5, total: 5, bonus: 0, success: false, rawRolls: [5] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            const popupData = deps.setPopupHtml.mock.calls[0][0];
            const logCall = deps.logEntry.mock.calls.find(c => c[0].rollType === 'save-damage')[0];
            expect(logCall.saveRoll).toBe(5);
            expect(popupData.saveResult.success).toBe(true);
            expect(popupData.saveResult.roll).toBe(5);
            expect(popupData.finalDamage).toBe(0);
        });
    });

    describe('evasion', () => {
        it('applies evasion damage reduction when target has evasion for save type', async () => {
            setupActiveConditions([]);
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: {
                        saveBonuses: { con: 2 },
                        evasionEffects: [{ saveType: 'dex' }],
                    },
                },
            ];
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createNpcSaveDamageHandler({ ...deps, characters });
            await callHandler(fn, { dcSuccess: 'half' });

            // With evasion on failed save and dcSuccess='half', damage should be halved
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.anything(), 'Goblin', 5, expect.any(Array), 'test-campaign',
                expect.any(Array), false, 'TestWizard', true
            );
        });

        it('prevents evasion when target is incapacitated', async () => {
            setupActiveConditions(['Incapacitated']);
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: {
                        saveBonuses: { con: 2 },
                        evasionEffects: [{ saveType: 'dex' }],
                    },
                },
            ];
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createNpcSaveDamageHandler({ ...deps, characters });
            await callHandler(fn, { dcSuccess: 'half' });

            // Without evasion, full damage should apply
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.anything(), 'Goblin', 10, expect.any(Array), 'test-campaign',
                expect.any(Array), false, 'TestWizard', true
            );
        });

        it('logs evasion entry when evasion is active', async () => {
            setupActiveConditions([]);
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: {
                        saveBonuses: { con: 2 },
                        evasionEffects: [{ saveType: 'dex' }],
                    },
                },
            ];
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createNpcSaveDamageHandler({ ...deps, characters });
            await callHandler(fn, { dcSuccess: 'half' });

            // First log entry should be the evasion entry
            const evasionLog = deps.logEntry.mock.calls[0][0];
            expect(evasionLog).toEqual(expect.objectContaining({
                rollType: 'evasion',
                name: 'Evasion',
                targetName: 'Goblin',
                saveResult: 'failure',
            }));
        });
    });

    describe('popup and log output', () => {
        it('calls setPopupHtml with save-damage popup data', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                targetName: 'Goblin',
                saveDc: 12,
                saveType: 'dex',
                finalDamage: 10,
                forcedMode: 'normal',
            }));
        });

        it('calls logEntry with save-damage log data', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                characterName: 'TestWizard',
                rollType: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                total: 10,
                damageType: 'fire',
                targetName: 'Goblin',
                saveType: 'dex',
                saveDc: 12,
                saveResult: 'failure',
                finalDamage: 10,
                note: 'combined_save_damage_roll',
            }));
        });

        it('includes saveRoll, saveBonus, and saveRawRolls in log', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveRoll).toBe(12);
            expect(logCall.saveBonus).toBe(2);
            expect(logCall.saveRawRolls).toEqual([12]);
        });

        it('marks saveResult as success when save succeeds', async () => {
            setupActiveConditions([]);
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveResult).toBe('success');
            expect(logCall.finalDamage).toBe(0);
        });

        it('marks forcedMode as disadvantage when corona aura applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('disadvantage');
        });
    });

    describe('hp tracking', () => {
        it('creates hp_change log entry when damage is dealt', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: -10,
                currentHp: 3,
                isUnconscious: false,
            }));
        });

        it('does not create hp_change log entry when no damage is dealt', async () => {
            setupActiveConditions([]);
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    // CLA-109: multi-target (Words of Creation) disadvantage_on_next_save regression
    describe('multi-target disadvantage_on_next_save', () => {
        it('applies disadvantage for multi-target when target has disadvantage_on_next_save', async () => {
            const multiTarget = { name: 'Orc', type: 'npc', currentHp: 20, maxHp: 20 };
            const combatSummaryWithMulti = {
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 },
                    multiTarget,
                ],
            };

            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Orc', effect: 'disadvantage_on_next_save' },
                ];
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            rollSaveForCreature
                .mockReturnValueOnce({ roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] })
                .mockReturnValueOnce({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8] });

            const context = {
                ...defaultContext,
                multiTarget: 'Orc',
            };

            await callHandler(createFn(), context, combatSummaryWithMulti);

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                multiTarget, 'dex', 12, true, false
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
        });
    });
});
