// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? Math.floor(total / 2) : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { hasSoulstitchProtection, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';

describe('createLogDamageAndShow - NPC save damage with evasion', () => {
    const defaultSaveResult = { success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] };
    const defaultApplyResult = { finalDamage: 10, newHp: 3, damageReduced: false };

    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'Goblin',
                computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12, evasionEffects: [{ saveType: 'DEX' }] },
                saveModifiers: [],
            },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    const defaultContext = {
        targetName: 'Goblin',
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
        attackerName: 'TestWizard',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function callDamageHandler(fn, contextOverride = {}) {
        return fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            ...defaultContext,
            ...contextOverride,
        });
    }

    describe('save resolution', () => {
        it('rolls a save for the target creature', async () => {
            await callDamageHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                false,
                false
            );
        });

        it('passes disadvantage when corona aura applies', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            await callDamageHandler(createFn());

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true,
                false
            );
        });

        it('uses save result to determine success', async () => {
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });

            await callDamageHandler(createFn());

            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(
                20,
                false,
                'half',
                expect.any(Boolean)
            );
        });
    });

    describe('evasion behavior', () => {
        it('applies zero damage when save succeeds with evasion', async () => {
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });
            computeDamageAfterEvasion.mockReturnValue(0);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callDamageHandler(createFn());

            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(
                20,
                true,
                'half',
                true
            );
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                0,
                expect.any(Array),
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard',
                true
            );
        });

        it('applies half damage when save fails with evasion', async () => {
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
            computeDamageAfterEvasion.mockReturnValue(10);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            await callDamageHandler(createFn());

            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(
                20,
                false,
                'half',
                true
            );
        });

        it('does not apply evasion when target is incapacitated', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['incapacitated'];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });
            computeDamageAfterEvasion.mockReturnValue(10);

            await callDamageHandler(createFn());

            // hasEvasion will be undefined (falsy) when incapacitated prevents own/shared evasion
            // and circle of power mock returns undefined
            const evasionArg = computeDamageAfterEvasion.mock.calls[0][3];
            expect(evasionArg).toBeFalsy();
        });

        it('does not apply evasion when dcSuccess is not half', async () => {
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });
            computeDamageAfterEvasion.mockReturnValue(10);

            await callDamageHandler(createFn(), { dcSuccess: 'none' });

            // With dcSuccess='none', evasion check is false because the handler only applies
            // evasion when dcSuccess === 'half'
            const evasionArg = computeDamageAfterEvasion.mock.calls[0][3];
            expect(evasionArg).toBeFalsy();
        });
    });

    describe('damage application', () => {
        it('calls applyDamageToTarget with the computed damage', async () => {
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            await callDamageHandler(createFn());

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                expect.any(Number),
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard',
                true
            );
        });

        it('does not apply damage when soulstitch protection is active', async () => {
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callDamageHandler(createFn());

            const damageCall = applyDamageToTarget.mock.calls[0];
            expect(damageCall[2]).toBe(0);
        });

        it('handles target not found in combat summary', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            const fn = createFn();
            const result = await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'NonExistent',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                attackerName: 'TestWizard',
            });

            expect(result).toBeUndefined();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('logging', () => {
        it('logs the save-damage result with roll details', async () => {
            await callDamageHandler(createFn());

            // First log entry is the evasion entry, second is the save-damage entry
            const saveDamageLog = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(saveDamageLog).toBeDefined();
            expect(saveDamageLog[0]).toEqual(expect.objectContaining({
                type: 'roll',
                characterName: 'TestWizard',
                rollType: 'save-damage',
                name: 'Fireball',
                formula: '8d6',
                total: 20,
                damageType: 'fire',
                targetName: 'Goblin',
                saveType: 'DEX',
                saveDc: 15,
                saveResult: 'success',
                saveRoll: 18,
                saveBonus: 3,
                saveRawRolls: [18],
                note: 'combined_save_damage_roll',
            }));
        });

        it('marks saveResult as failure when save fails', async () => {
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });

            await callDamageHandler(createFn());

            const saveDamageLog = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(saveDamageLog[0].saveResult).toBe('failure');
        });

        it('logs evasion entry before save-damage entry when evasion is active', async () => {
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });
            computeDamageAfterEvasion.mockReturnValue(0);

            await callDamageHandler(createFn());

            const evasionLog = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'evasion'
            );
            expect(evasionLog).toBeDefined();
            expect(evasionLog[0]).toEqual(expect.objectContaining({
                rollType: 'evasion',
                name: 'Evasion',
                targetName: 'Goblin',
                saveResult: 'success',
            }));
        });

        it('logs evasion entry with failure result when save fails but evasion is active', async () => {
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
            computeDamageAfterEvasion.mockReturnValue(10);

            await callDamageHandler(createFn());

            const evasionLog = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'evasion'
            );
            expect(evasionLog).toBeDefined();
            expect(evasionLog[0].saveResult).toBe('failure');
        });

        it('does not log evasion entry when evasion is not active', async () => {
            // Create a fresh deps object to avoid contamination from previous calls
            const noEvasionDeps = {
                ...deps,
                characters: [
                    {
                        name: 'Goblin',
                        computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12, evasionEffects: [] },
                        saveModifiers: [],
                    },
                ],
                logEntry: vi.fn(),
                setPopupHtml: vi.fn(),
            };

            const fn = createLogDamageAndShow(noEvasionDeps);
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            const evasionLog = noEvasionDeps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'evasion'
            );
            expect(evasionLog).toBeUndefined();
        });
    });

    describe('popup data', () => {
        it('calls setPopupHtml with save-damage popup data', async () => {
            await callDamageHandler(createFn());

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                formula: '8d6',
                targetName: 'Goblin',
                saveDc: 15,
                saveType: 'DEX',
                finalDamage: 10,
                damageApplied: true,
                forcedMode: 'normal',
            }));
        });

        it('sets targetCurrentHp in popup', async () => {
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            await callDamageHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.targetCurrentHp).toBe(3);
        });

        it('marks forcedMode as normal when no disadvantage sources', async () => {
            await callDamageHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('normal');
        });
    });

    describe('integration with main handler', () => {
        it('routes NPC save damage through handleNpcSaveDamage', async () => {
            // Verify the full flow: no auto-miss, no overlay target, saveDc + saveType present,
            // target is npc -> goes to npcSaveDamageHandler
            await callDamageHandler(createFn());

            // The handler should have called rollSaveForCreature, meaning it went through
            // the NPC save damage path (not plain damage or auto miss)
            expect(rollSaveForCreature).toHaveBeenCalled();
            expect(applyDamageToTarget).toHaveBeenCalled();
            // Plain damage handler would not call rollSaveForCreature
        });

        it('does not trigger auto-miss path when isAutoMiss is not set', async () => {
            await callDamageHandler(createFn());

            // If auto-miss path was taken, the handler would return before reaching save logic
            // Since we see rollSaveForCreature called, auto-miss was not triggered
            expect(rollSaveForCreature).toHaveBeenCalled();
        });

        it('does not trigger overlay AOE path for non-overlay targets', async () => {
            await callDamageHandler(createFn());

            // Overlay targets start with 'overlay-' prefix
            // Since our target is 'Goblin', it should not go through AOE path
            expect(rollSaveForCreature).toHaveBeenCalled();
        });
    });
});
