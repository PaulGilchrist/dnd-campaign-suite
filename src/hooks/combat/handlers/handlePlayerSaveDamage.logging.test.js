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

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
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

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';

const BASE_CONTEXT = {
    saveDc: 15,
    saveType: 'CON',
    dcSuccess: 'half',
    damageType: 'Poison',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

function invokeHandler(handler, context = BASE_CONTEXT, combatSummary = BASE_COMBAT_SUMMARY) {
    return handler({ name: 'Acid Arrow', formula: '4d4', total: 10, rolls: [3, 4, 2, 1], modifier: 5, context: context, adjustedTotal: 10, combatSummary: combatSummary, displayRolls: [3, 4, 2, 1] });
}

describe('handlePlayerSaveDamage - logging and popups', () => {
    const makeDeps = (overrides = {}) => ({
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    describe('logEntry calls', () => {
        it('logs a save-prompt roll entry with correct fields', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.logEntry).toHaveBeenCalledTimes(1);
            expect(testDeps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roll',
                    characterName: 'TestWizard',
                    rollType: 'save-prompt',
                    name: 'Acid Arrow',
                    formula: '4d4',
                    total: 10,
                    modifier: 5,
                    bonus: 5,
                    damageType: 'Poison',
                    targetName: 'TestWizard',
                    saveType: 'CON',
                    saveDc: 15,
                    dcSuccess: 'half',
                    gwfApplied: false,
                    gwfOriginalRolls: null,
                })
            );
        });

        it('logs forcedMode: disadvantage when metamagicHeighten is true', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler, { ...BASE_CONTEXT, metamagicHeighten: true });

            expect(testDeps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    forcedMode: 'disadvantage',
                })
            );
        });

        it('logs forcedMode: normal when metamagicHeighten is false', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    forcedMode: 'normal',
                })
            );
        });
    });

    describe('setPopupHtml calls', () => {
        it('sets popup with waitingForPlayerSave and promptId', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.setPopupHtml).toHaveBeenCalledTimes(1);
            expect(testDeps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'save-damage',
                    waitingForPlayerSave: true,
                    promptId: 'test-guid-1234',
                    rawDamage: 10,
                    name: 'Acid Arrow',
                    formula: '4d4',
                    rolls: [3, 4, 2, 1],
                    total: 10,
                    bonus: 0,
                    modifier: 5,
                    damageType: 'Poison',
                    targetName: 'TestWizard',
                    saveDc: 15,
                    saveType: 'CON',
                    dcSuccess: 'half',
                    gwfApplied: false,
                    gwfOriginalRolls: null,
                })
            );
        });

        it('sets attackerName from context when provided', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler, { ...BASE_CONTEXT, attackerName: 'EnemyMage' });

            expect(testDeps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    attackerName: 'EnemyMage',
                })
            );
        });

        it('defaults attackerName to characterName when context lacks attackerName', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    attackerName: 'TestWizard',
                })
            );
        });

        it('sets autoReroll based on autoRerollForSaves from condition effects', async () => {
            const testDeps = makeDeps();
            computeConditionEffects.mockReturnValue({
                restoreBalance: false,
                autoRerollForSaves: true,
                autoRerollBonus: null,
                saveAdvantageCount: 0,
                saveAdvantageAbilities: null,
            });

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    autoReroll: true,
                })
            );
        });

        it('sets autoRerollBonus when evaluateAutoExpression returns a value', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'TestWizard' && subKey === 'fanaticalFocusUsed') return false;
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                if (key === 'TestWizard' && subKey === 'indomitableUses') return 0;
                return null;
            });
            computeConditionEffects.mockReturnValue({
                restoreBalance: false,
                autoRerollForSaves: false,
                autoRerollBonus: '1d4',
                saveAdvantageCount: 0,
                saveAdvantageAbilities: null,
            });
            evaluateAutoExpression.mockReturnValue(3);
            const testDeps = makeDeps({
                characters: [{ name: 'TestWizard', computedStats: { level: 10 } }],
                charactersRef: { current: [{ name: 'TestWizard', computedStats: { level: 10 } }] },
            });

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('1d4', { level: 10 });
            expect(testDeps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    autoRerollBonus: 3,
                })
            );
        });
    });

    describe('sendSavePrompt calls', () => {
        it('sends save prompt with disadvantage when corona aura applies', async () => {
            const testDeps = makeDeps();
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    promptId: 'test-guid-1234',
                    targetName: 'TestWizard',
                    saveType: 'CON',
                    saveDc: 15,
                    disadvantage: true,
                })
            );
        });

        it('sends save prompt with advantage when circle of power applies', async () => {
            const testDeps = makeDeps();
            isCircleOfPowerActive.mockReturnValue(true);

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    advantage: true,
                    disadvantage: false,
                })
            );
        });
    });

    describe('restoreBalance disadvantage resolution', () => {
        it('cancels disadvantage to false when a single source applies with restoreBalance', async () => {
            const testDeps = makeDeps();
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'TestWizard' && subKey === 'fanaticalFocusUsed') return false;
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                if (key === 'TestWizard' && subKey === 'indomitableUses') return 0;
                return null;
            });
            computeConditionEffects.mockReturnValue({
                restoreBalance: true,
                autoRerollForSaves: false,
                autoRerollBonus: null,
                saveAdvantageCount: 0,
                saveAdvantageAbilities: null,
            });
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    disadvantage: false,
                })
            );
        });

        it('keeps disadvantage when multiple sources apply with restoreBalance', async () => {
            const testDeps = makeDeps();
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'TestWizard' && subKey === 'fanaticalFocusUsed') return false;
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                if (key === 'TestWizard' && subKey === 'indomitableUses') return 0;
                return null;
            });
            computeConditionEffects.mockReturnValue({
                restoreBalance: true,
                autoRerollForSaves: false,
                autoRerollBonus: null,
                saveAdvantageCount: 0,
                saveAdvantageAbilities: null,
            });
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(sendSavePrompt).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    disadvantage: true,
                })
            );
        });
    });

    describe('integration: pending saves and registry calls', () => {
        it('registers pending save prompt and popup setter', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(registerPendingSavePrompt).toHaveBeenCalledWith(
                'test-guid-1234',
                expect.objectContaining({
                    targetName: 'TestWizard',
                    rawDamage: 10,
                    saveDc: 15,
                    saveType: 'CON',
                })
            );
            expect(registerPendingPopupSetter).toHaveBeenCalledWith(
                'test-guid-1234',
                expect.any(Function)
            );
        });

        it('stores pending save data in deps.pendingSaves', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(testDeps.pendingSaves).toHaveProperty('test-guid-1234');
            expect(testDeps.pendingSaves['test-guid-1234']).toMatchObject({
                targetName: 'TestWizard',
                rawDamage: 10,
                saveDc: 15,
                saveType: 'CON',
                dcSuccess: 'half',
                damageType: 'Poison',
                name: 'Acid Arrow',
                formula: '4d4',
                modifier: 5,
                rolls: [3, 4, 2, 1],
                campaignName: 'test-campaign',
            });
        });

        it('calls handleOverchannelSelfDamage at the end', async () => {
            const testDeps = makeDeps();
            const handler = createPlayerSaveDamageHandler(testDeps);
            await invokeHandler(handler);

            expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
                'TestWizard',
                'test-campaign',
                expect.any(Object),
                expect.any(Function),
                expect.any(Array)
            );
        });
    });
});
