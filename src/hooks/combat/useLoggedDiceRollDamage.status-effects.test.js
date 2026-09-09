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

vi.mock('./loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
    isMagicMissileImmune: vi.fn(),
    readAoeContext: vi.fn(),
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
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
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
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

vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Status effects application through logDamageAndShow', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: {}, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultSaveResult = { roll: 5, total: 8, bonus: 3, success: false, rawRolls: [5] };
    const defaultApplyResult = { finalDamage: 10, newHp: 3, damageReduced: false };
    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        playerIsImmuneToCondition.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function callHandler(contextOverride = {}) {
        return createFn()('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            attackerName: 'TestWizard',
            ...contextOverride,
        });
    }

    describe('status effects on failed saves', () => {
        it('applies status effects when save fails on an npc target', async () => {
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                statusEffects: ['poisoned'],
                attackerName: 'TestWizard',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });

        it('applies multiple status effects on a single failed save', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler({ statusEffects: ['poisoned', 'benumbed'] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBeGreaterThanOrEqual(2);
            const allConditions = conditionCalls.flatMap((call) => call[2]);
            expect(allConditions).toContain('poisoned');
            expect(allConditions).toContain('benumbed');
        });

        it('skips status effects when target is immune', async () => {
            playerIsImmuneToCondition.mockReturnValue(true);

            await callHandler({ statusEffects: ['poisoned'] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            for (const call of conditionCalls) {
                expect(call[2]).not.toContain('poisoned');
            }
        });

        it('does not apply status effects when save succeeds', async () => {
            rollSaveForCreature.mockReturnValue({
                roll: 18, total: 21, bonus: 3, success: true, rawRolls: [18],
            });
            applyDamageToTarget.mockResolvedValue({
                finalDamage: 0, newHp: 13, damageReduced: false,
            });

            await callHandler({ statusEffects: ['poisoned'] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            for (const call of conditionCalls) {
                expect(call[2]).not.toContain('poisoned');
            }
        });

        it('normalizes status effect keys to lowercase before applying', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['Poisoned'];
                return null;
            });

            await callHandler({ statusEffects: ['POISONED'] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            const lastConditions = conditionCalls[conditionCalls.length - 1][2];
            expect(lastConditions).toContain('poisoned');
        });
    });

    describe('status effects on player targets', () => {
        it('passes status effects to pending saves queue for player targets', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 15, currentHp: 20, maxHp: 20 }],
            });
            deps.charactersRef = { current: [{ name: 'Ally', computedStats: {}, saveModifiers: [] }] };

            await createFn()('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Ally',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                statusEffects: ['poisoned', 'benumbed'],
                attackerName: 'TestWizard',
            });

            expect(sendSavePrompt).toHaveBeenCalled();
            const pendingKeys = Object.keys(deps.pendingSaves);
            expect(pendingKeys.length).toBeGreaterThan(0);
            const pendingData = deps.pendingSaves[pendingKeys[0]];
            expect(pendingData.statusEffects).toEqual(['poisoned', 'benumbed']);
        });

        it('passes empty statusEffects when none are defined for player targets', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 15, currentHp: 20, maxHp: 20 }],
            });
            deps.charactersRef = { current: [{ name: 'Ally', computedStats: {}, saveModifiers: [] }] };

            await createFn()('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Ally',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                attackerName: 'TestWizard',
            });

            const pendingKeys = Object.keys(deps.pendingSaves);
            expect(pendingKeys.length).toBeGreaterThan(0);
            const pendingData = deps.pendingSaves[pendingKeys[0]];
            expect(pendingData.statusEffects).toEqual([]);
        });
    });

    describe('deduplication of status effects', () => {
        it('removes duplicate status effects before re-applying', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['poisoned'];
                return null;
            });

            await callHandler({ statusEffects: ['poisoned'] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            const lastConditions = conditionCalls[conditionCalls.length - 1][2];
            expect(lastConditions.filter((c) => c === 'poisoned').length).toBe(1);
        });
    });

    describe('status effects with no effects defined', () => {
        it('does not call setRuntimeValue for activeConditions when statusEffects is empty', async () => {
            await callHandler({ statusEffects: [] });

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('does not call setRuntimeValue for activeConditions when statusEffects is undefined', async () => {
            await callHandler({});

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });
    });

    describe('status effects with immunity check', () => {
        it('passes target stats to immunity check', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler({ statusEffects: ['poisoned'] });

            expect(playerIsImmuneToCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    conditionKey: 'poisoned',
                    playerStats: {},
                })
            );
        });
    });
});
