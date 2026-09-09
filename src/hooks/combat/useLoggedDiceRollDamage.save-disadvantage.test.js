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
    computeDamageAfterSave: vi.fn((total, success) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterSave, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';

describe('createLogDamageAndShow - NPC save disadvantage integration', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12 }, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultSaveResult = { roll: 8, total: 11, bonus: 3, success: false, rawRolls: [8] };
    const defaultApplyResult = { finalDamage: 10, newHp: 3, damageReduced: false };
    const defaultContext = {
        targetName: 'Goblin',
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
        attackerName: 'TestWizard',
    };
    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    function setupActiveConditions(conditions) {
        getRuntimeValue.mockImplementation((key, prop, cn) => {
            if (key === 'Goblin' && prop === 'activeConditions') return conditions;
            if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return null;
            return null;
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        playerIsImmuneToCondition.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockImplementation((total, success) => success ? Math.floor(total / 2) : total);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function callHandler(fn, contextOverride = {}) {
        return fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            ...defaultContext,
            ...contextOverride,
        });
    }

    describe('corona save disadvantage', () => {
        it('rolls save with disadvantage when corona aura applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true, source: 'CoronaCaster' });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            isCircleOfPowerActive.mockReturnValue(false);

            const fn = createFn();
            await callHandler(fn);

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin',
                damageType: 'fire',
                skipRangeCheck: true,
            }));
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true, // disadvantage
                false
            );
        });

        it('logs save-damage entry with forcedMode disadvantage when corona applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'save-damage',
                name: 'Fireball',
                targetName: 'Goblin',
                saveType: 'DEX',
                saveDc: 15,
                saveResult: 'failure',
                forcedMode: 'disadvantage',
            }));
        });

        it('shows save-damage popup with forcedMode disadvantage when corona applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                forcedMode: 'disadvantage',
                targetName: 'Goblin',
                saveDc: 15,
                saveType: 'DEX',
            }));
        });

        it('does not apply corona disadvantage when corona returns false', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                false, // no disadvantage
                false
            );
        });
    });

    describe('elder champion save disadvantage', () => {
        it('rolls save with disadvantage when elder champion aura applies and corona does not', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'ElderChampion' });

            const fn = createFn();
            await callHandler(fn, {
                playerStats: { automation: { actions: [], passives: [] } },
            });

            expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'Goblin',
            }));
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true, // disadvantage
                false
            );
        });

        it('logs save-damage entry with forcedMode disadvantage when elder champion applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            const fn = createFn();
            await callHandler(fn, {
                playerStats: { automation: { actions: [], passives: [] } },
            });

            const logCall = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(logCall[0].forcedMode).toBe('disadvantage');
        });

        it('does not roll elder champion when corona already set disadvantage', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            const fn = createFn();
            await callHandler(fn, {
                playerStats: { automation: { actions: [], passives: [] } },
            });

            expect(getCoronaSaveDisadvantage).toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });
    });

    describe('disadvantage priority and short-circuiting', () => {
        it('prioritizes corona over elder champion for disadvantage', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            const fn = createFn();
            await callHandler(fn, {
                playerStats: { automation: { actions: [], passives: [] } },
            });

            expect(getCoronaSaveDisadvantage).toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
        });

        it('rolls with normal mode when no disadvantage sources apply', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                false, // no disadvantage
                false  // no advantage
            );
        });
    });

    describe('circle of power advantage interaction', () => {
        it('rolls with both disadvantage (corona) and advantage (circle of power)', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            isCircleOfPowerActive.mockReturnValue(true);

            const fn = createFn();
            await callHandler(fn);

            // Disadvantage takes priority but advantage is still passed
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true,  // disadvantage from corona
                true   // advantage from circle of power
            );
        });

        it('rolls with advantage when only circle of power applies (no disadvantage)', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            isCircleOfPowerActive.mockReturnValue(true);

            const fn = createFn();
            await callHandler(fn);

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                false, // no disadvantage
                true   // advantage from circle of power
            );
        });

        it('shows advantage in popup forcedMode when only circle of power applies', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            isCircleOfPowerActive.mockReturnValue(true);

            const fn = createFn();
            await callHandler(fn);

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('advantage');
        });
    });

    describe('targetEffects disadvantage_on_next_save', () => {
        it('rolls with disadvantage when targetEffect has disadvantage_on_next_save', async () => {
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Goblin', effect: 'disadvantage_on_next_save' },
                ];
                return null;
            });
            isCircleOfPowerActive.mockReturnValue(false);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true, // disadvantage from targetEffect
                false
            );
        });

        it('logs forcedMode as disadvantage when targetEffect applies', async () => {
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Goblin', effect: 'disadvantage_on_next_save' },
                ];
                return null;
            });
            isCircleOfPowerActive.mockReturnValue(false);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            const logCall = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(logCall[0].forcedMode).toBe('disadvantage');
        });
    });

    describe('successful save behavior', () => {
        it('rolls save and deals reduced damage on success with dcSuccess=half', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 21, bonus: 3, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(rollSaveForCreature).toHaveBeenCalled();
            const logCall = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(logCall[0].saveResult).toBe('success');
            expect(logCall[0].finalDamage).toBe(0);
        });

        it('logs saveResult as success when save succeeds', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 21, bonus: 3, success: true, rawRolls: [18] });

            const fn = createFn();
            await callHandler(fn);

            const logCall = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(logCall[0].saveResult).toBe('success');
        });
    });

    describe('endInvisibilityOnHostileAction', () => {
        it('calls endInvisibilityOnHostileAction when damage is applied', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });

        it('does not call endInvisibilityOnHostileAction when no damage applied', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 21, bonus: 3, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });
    });

    describe('hp_change tracking', () => {
        it('creates hp_change log entry when damage is dealt', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const fn = createFn();
            await callHandler(fn);

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
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 21, bonus: 3, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('soulstitch protection', () => {
        it('auto-succeeds save and deals zero damage when soulstitch protected', async () => {
            setupActiveConditions([]);
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            const logCall = deps.logEntry.mock.calls.find(
                (call) => call[0].rollType === 'save-damage'
            );
            expect(logCall[0].saveResult).toBe('soulstitch_auto_success');
        });
    });
});
