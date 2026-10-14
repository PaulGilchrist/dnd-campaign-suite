// @maintained-by-ai: 2026-10-14
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
// automationService is consumed by the handler and by damageHandlerUtils (GWF helpers).
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
// loggedDiceRollUtils is consumed by the handler and by damageHandlerUtils (damage minimum).
vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(() => false),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));
vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));
vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));
vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
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
import { hasPotentCantrip } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - metamagic twin and multi-target', () => {
    const failSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
    const applyResult = { finalDamage: 10, newHp: 5, damageReduced: false };

    const goblin = { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 };
    const orc = { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 15 };
    const twoTargets = { creatures: [goblin, orc] };

    const baseCharacters = [
        { name: 'TestWizard' },
        { name: 'Goblin', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
    ];
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: baseCharacters,
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const defaultContext = {
        targetName: 'Goblin',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
        isSpellDamage: true,
    };

    // Orc carrying the against_spell save advantage used by the saveModifiers lanes.
    const orcWithSpellAdvantage = [
        ...baseCharacters,
        {
            name: 'Orc',
            computedStats: { saveBonuses: { con: 0 }, evasionEffects: [] },
            saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        rollSaveForCreature.mockReturnValue(failSave);
        applyDamageToTarget.mockResolvedValue(applyResult);
    });

    function callHandler(fn, contextOverride = {}) {
        return fn({
            name: 'Fire Bolt',
            formula: '1d10',
            total: 10,
            rolls: [6, 4],
            modifier: 0,
            adjustedTotal: 10,
            combatSummary: twoTargets,
            context: { ...defaultContext, ...contextOverride },
        });
    }

    const createFn = (overrides = {}) => createNpcSaveDamageHandler({ ...deps, ...overrides });

    // The popup patch both the twinned and multi-target legs merge into prev state.
    const twinPopupPatch = { twinTargetName: 'Orc', twinFinalDamage: 10, twinTargetCurrentHp: 5 };

    describe('metamagic twin target', () => {
        it('applies twin damage, logs a (Twinned) entry, and patches the popup', async () => {
            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc', playerStats: { name: 'TestWizard' } });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget).toHaveBeenLastCalledWith(expect.anything(), 'Orc', 10, expect.any(Array), { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                name: expect.stringContaining('(Twinned)'),
                targetName: 'Orc',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledTimes(2);
            expect(deps.setPopupHtml.mock.calls[1][0](undefined)).toEqual(expect.objectContaining(twinPopupPatch));
        });

        it('skips twin damage when twin target is the primary or not in combat', async () => {
            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Goblin' });
            await callHandler(fn, { metamagicTwinTarget: 'NonExistent' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });

        it('grants twin save disadvantage from corona aura with damageType and skips elder champion', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc', damageType: 'cold' });

            const coronaCalls = getCoronaSaveDisadvantage.mock.calls;
            expect(coronaCalls.map(c => c[0].targetName)).toEqual(['Goblin', 'Orc']);
            expect(coronaCalls[1][0].damageType).toBe('cold');
            expect(rollSaveForCreature.mock.calls[1][3]).toBe(true); // twin disadvantage
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });

        it('consumes disadvantage_on_next_save targetEffect for the twin target', async () => {
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Orc', effect: 'disadvantage_on_next_save' },
                ];
                return null;
            });

            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc' });

            expect(rollSaveForCreature.mock.calls[1][3]).toBe(true); // twin disadvantage
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        });

        it('grants twin save advantage from against_spell saveModifiers', async () => {
            rollSaveForCreature.mockReturnValue(failSave);

            const fn = createFn({ characters: orcWithSpellAdvantage });
            await callHandler(fn, { metamagicTwinTarget: 'Orc' });

            expect(rollSaveForCreature.mock.calls[1][4]).toBe(true); // twin advantage
        });

        it('short-circuits all aura checks when metamagicHeighten forces disadvantage', async () => {
            const fn = createFn();
            await callHandler(fn, { metamagicTwinTarget: 'Orc', metamagicHeighten: true });

            expect(rollSaveForCreature.mock.calls[1][3]).toBe(true); // twin disadvantage
            expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });

        it('halves twin damage with potent cantrip on save success', async () => {
            hasPotentCantrip.mockReturnValue(true);
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });

            // Potent cantrip on success: floor(adjustedTotal / 2) = 5
            expect(applyDamageToTarget.mock.calls[1][2]).toBe(5);
        });
    });

    describe('multi target', () => {
        it('applies save-based damage, logs a (Words of Creation) entry, and patches the popup', async () => {
            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget.mock.calls[1][2]).toBe(10); // failed save deals full damage
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                name: expect.stringContaining('(Words of Creation)'),
                targetName: 'Orc',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledTimes(2);
            expect(deps.setPopupHtml.mock.calls[1][0](undefined)).toEqual(expect.objectContaining(twinPopupPatch));
        });

        it('skips multi target damage when target is the primary or not in combat', async () => {
            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Goblin' });
            await callHandler(fn, { multiTarget: 'NonExistent' });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });

        it('falls back to plain damage without saveDC/saveType and skips the multi save roll', async () => {
            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc', saveDc: undefined, saveType: undefined });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget.mock.calls[1][2]).toBe(10); // adjustedTotal, undivided
            expect(rollSaveForCreature).toHaveBeenCalledTimes(1); // primary only
        });

        it('passes ignoreResistance through the plain multi-target apply options', async () => {
            hasIgnoreResistance.mockReturnValue(true);

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                saveDc: undefined,
                saveType: undefined,
                playerStats: { name: 'TestWizard' },
            });

            expect(applyDamageToTarget).toHaveBeenNthCalledWith(2, expect.anything(), 'Orc', 10, expect.any(Array), { campaignName: 'test-campaign', characters: null, ignoreResistance: true, attackerName: 'TestWizard' });
        });

        it('grants multi target save advantage from against_spell saveModifiers', async () => {
            const fn = createFn({ characters: orcWithSpellAdvantage });
            await callHandler(fn, { multiTarget: 'Orc' });

            expect(rollSaveForCreature.mock.calls[1][4]).toBe(true); // multi advantage
        });

        it('halves multi target damage with potent cantrip on save success', async () => {
            hasPotentCantrip.mockReturnValue(true);
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });

            // Potent cantrip on success: floor(adjustedTotal / 2) = 5
            expect(applyDamageToTarget.mock.calls[1][2]).toBe(5);
        });

        it('applies zero damage to multi target on successful save', async () => {
            rollSaveForCreature.mockReturnValueOnce(failSave).mockReturnValueOnce(successSave);

            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc' });

            expect(applyDamageToTarget.mock.calls[1][2]).toBe(0);
        });

        it('flags isCrit on the multi target log entry', async () => {
            const fn = createFn();
            await callHandler(fn, { multiTarget: 'Orc', isAutoCrit: true });

            const multiLogCall = deps.logEntry.mock.calls.find((call) => call[0].targetName === 'Orc');
            expect(multiLogCall[0].isCrit).toBe(true);
        });
    });

    describe('secondary damage with twin/multi targets', () => {
        it('applies secondary damage to the primary before primary and twin legs', async () => {
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [3, 1], modifier: 0 });

            const fn = createFn();
            await callHandler(fn, {
                metamagicTwinTarget: 'Orc',
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryName: 'Extra Damage',
                autoDamageSecondaryDamageType: 'fire',
                playerStats: { name: 'TestWizard' },
            });

            // Secondary, then primary, then twin
            expect(applyDamageToTarget.mock.calls.map(c => c[1])).toEqual(['Goblin', 'Goblin', 'Orc']);
            expect(applyDamageToTarget.mock.calls[0][4]).toEqual(expect.objectContaining({ skipConcentration: true }));
        });

        it('applies secondary damage to the primary before primary and multi legs', async () => {
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [3, 1], modifier: 0 });

            const fn = createFn();
            await callHandler(fn, {
                multiTarget: 'Orc',
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
            });

            expect(applyDamageToTarget.mock.calls.map(c => c[1])).toEqual(['Goblin', 'Goblin', 'Orc']);
        });
    });
});
