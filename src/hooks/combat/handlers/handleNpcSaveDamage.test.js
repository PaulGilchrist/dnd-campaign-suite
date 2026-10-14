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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasSoulstitchProtection, clearSoulstitchStamp } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - core save damage flow', () => {
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

    const saveFail = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const saveSuccess = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
    const defaultContext = {
        targetName: 'Goblin',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
        isSpellDamage: true,
    };
    const goblin = { name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 };
    const defaultCombatSummary = { creatures: [goblin] };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        hasSoulstitchProtection.mockReturnValue(false);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(saveFail);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });
    });

    function createFn(characters = deps.characters) {
        return createNpcSaveDamageHandler({ ...deps, characters });
    }

    function callHandler(fn, contextOverride = {}, combatSummaryOverride = defaultCombatSummary) {
        return fn({
            name: 'Fire Bolt',
            formula: '1d10',
            total: 10,
            rolls: [6, 4],
            modifier: 0,
            context: { ...defaultContext, ...contextOverride },
            adjustedTotal: 10,
            combatSummary: combatSummaryOverride,
        });
    }

    // Route getRuntimeValue lookups by `key.prop`; everything else stays null.
    function mockRuntime(patches) {
        getRuntimeValue.mockImplementation((key, prop) => patches[`${key}.${prop}`] ?? null);
    }

    function goblinWith(extra) {
        return [deps.characters[0], { ...deps.characters[1], ...extra }];
    }

    describe('early return - no target', () => {
        it('returns early when target not found in combatSummary', async () => {
            const result = await callHandler(createFn(), { targetName: 'NonExistent' }, { creatures: [] });

            expect(result).toBeUndefined();
            expect(rollSaveForCreature).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('save disadvantage', () => {
        it('metamagicHeighten forces disadvantage and short-circuits all aura checks', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await callHandler(createFn(), { metamagicHeighten: true });

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, true, false
            );
            expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });

        it('consumes a disadvantage_on_next_save targetEffect as disadvantage', async () => {
            mockRuntime({ 'campaign.targetEffects': [{ target: 'Goblin', effect: 'disadvantage_on_next_save' }] });

            await callHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, true, false
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        });

        it('corona aura grants disadvantage and takes priority over elder champion', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await callHandler(createFn());

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin',
                damageType: 'fire',
            }));
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, true, false
            );
        });

        it('elder champion aura grants disadvantage', async () => {
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await callHandler(createFn(), { playerStats: { name: 'TestWizard' } });

            expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'Goblin',
            }));
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, true, false
            );
        });
    });

    describe('save advantage', () => {
        it('circle of power grants save advantage', async () => {
            isCircleOfPowerActive.mockReturnValue(true);

            await callHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, false, true
            );
        });

        it('passes both flags when advantage and disadvantage apply together (disadvantage wins)', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            const characters = goblinWith({
                saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
            });

            await callHandler(createFn(characters));

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }), 'dex', 12, true, true
            );
        });
    });

    describe('soulstitch protection', () => {
        it('forces zero damage and logs soulstitch_auto_success even on a failed save', async () => {
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 0, expect.any(Array), { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard', suppressHpLog: true });
            expect(deps.logEntry.mock.calls[0][0].saveResult).toBe('soulstitch_auto_success');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('CLA-321: popup save roll matches the log save roll on the enforced path', async () => {
            hasSoulstitchProtection.mockReturnValue(true);
            rollSaveForCreature.mockReturnValue({ roll: 5, total: 5, bonus: 0, success: false, rawRolls: [5] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls.find(c => c[0].rollType === 'save-damage')[0];
            const popupData = deps.setPopupHtml.mock.calls[0][0];
            expect(logCall.saveRoll).toBe(5);
            expect(popupData.saveResult).toEqual({ success: true, roll: 5, total: 5, bonus: 0 });
            expect(popupData.finalDamage).toBe(0);
        });

        it('CLA-321: clears the caster stamp only for casts flagged soulstitchCast', async () => {
            await callHandler(createFn());
            expect(clearSoulstitchStamp).not.toHaveBeenCalled();

            await callHandler(createFn(), { soulstitchCast: true });
            expect(clearSoulstitchStamp).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });
    });

    describe('evasion', () => {
        const evasionStats = { saveBonuses: { con: 2 }, evasionEffects: [{ saveType: 'dex' }] };

        it('halves damage via evasion on a failed dcSuccess=half save and logs an Evasion entry', async () => {
            await callHandler(createFn(goblinWith({ computedStats: evasionStats })), { dcSuccess: 'half' });

            expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
            expect(deps.logEntry.mock.calls[0][0]).toEqual(expect.objectContaining({
                rollType: 'evasion',
                name: 'Evasion',
                targetName: 'Goblin',
                saveResult: 'failure',
            }));
        });

        it('denies evasion and logs nothing while the target is incapacitated', async () => {
            mockRuntime({ 'Goblin.activeConditions': ['Incapacitated'] });

            await callHandler(createFn(goblinWith({ computedStats: evasionStats })), { dcSuccess: 'half' });

            expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
            expect(deps.logEntry.mock.calls.some(c => c[0].rollType === 'evasion')).toBe(false);
        });
    });

    describe('popup and log output', () => {
        it('calls setPopupHtml with save-damage popup data', async () => {
            await callHandler(createFn());

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                targetName: 'Goblin',
                targetCurrentHp: 3,
                saveDc: 12,
                saveType: 'dex',
                finalDamage: 10,
                forcedMode: 'normal',
            }));
        });

        it('logs the combined save-damage roll with the save outcome fields', async () => {
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
                saveRoll: 12,
                saveBonus: 2,
                saveRawRolls: [12],
                finalDamage: 10,
                note: 'combined_save_damage_roll',
            }));
        });
    });

    describe('hp tracking', () => {
        it('creates hp_change log entry when damage is dealt', async () => {
            await callHandler(createFn());

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: -10,
                currentHp: 3,
                maxHp: 13,
                isUnconscious: false,
            }));
        });

        it('logs success with zero damage and skips hp_change when the save succeeds', async () => {
            rollSaveForCreature.mockReturnValue(saveSuccess);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls.find(c => c[0].rollType === 'save-damage')[0];
            expect(logCall.saveResult).toBe('success');
            expect(logCall.finalDamage).toBe(0);
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
