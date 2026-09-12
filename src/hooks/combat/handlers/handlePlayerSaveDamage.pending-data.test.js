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
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

const BASE_CONTEXT = {
    saveDc: 13,
    saveType: 'DEX',
    dcSuccess: 'half',
    damageType: 'Fire',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

function makeDeps(overrides = {}) {
    return {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
        ...overrides,
    };
}

function invokeHandler(handler, context = BASE_CONTEXT, combatSummary = BASE_COMBAT_SUMMARY, gwfBaseRolls, gwfDisplayRolls) {
    return handler({
        name: 'Fire Bolt',
        formula: '1d10',
        total: 5,
        rolls: [6],
        modifier: 0,
        context,
        adjustedTotal: 5,
        combatSummary,
        displayRolls: [6],
        gwfBaseRolls,
        gwfDisplayRolls,
    });
}

describe('handlePlayerSaveDamage - pending data structure', () => {
    const deps = makeDeps();

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
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

    it('stores core save fields in pending data', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toMatchObject({
            targetName: 'TestWizard',
            rawDamage: 5,
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'half',
            damageType: 'Fire',
            name: 'Fire Bolt',
            formula: '1d10',
            modifier: 0,
            rolls: [6],
            campaignName: 'test-campaign',
        });
    });

    it('defaults metamagicHeighten and saveAdvantage to false when no special sources apply', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('metamagicHeighten', false);
        expect(pending).toHaveProperty('saveAdvantage', false);
    });

    it('defaults isCantrip, overchannel, and autoDamage fields to falsy values', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('isCantrip', false);
        expect(pending).toHaveProperty('overchannelActive', false);
        expect(pending).toHaveProperty('overchannelUseCount', 0);
        expect(pending).toHaveProperty('overchannelSpellLevel', 1);
        expect(pending).toHaveProperty('autoDamageSecondaryFormula', null);
        expect(pending).toHaveProperty('autoDamageSecondaryName', null);
        expect(pending).toHaveProperty('autoDamageSecondaryDamageType', null);
    });

    it('passes context boolean flags through to pending data', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = {
            ...BASE_CONTEXT,
            metamagicHeighten: true,
            isCantrip: true,
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('metamagicHeighten', true);
        expect(pending).toHaveProperty('isCantrip', true);
        expect(pending).toHaveProperty('overchannelActive', true);
        expect(pending).toHaveProperty('overchannelUseCount', 2);
        expect(pending).toHaveProperty('overchannelSpellLevel', 3);
    });

    it('passes context autoDamage fields through to pending data', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = {
            ...BASE_CONTEXT,
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Radiant',
            autoDamageSecondaryDamageType: 'Radiant',
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('autoDamageSecondaryFormula', '2d6');
        expect(pending).toHaveProperty('autoDamageSecondaryName', 'Radiant');
        expect(pending).toHaveProperty('autoDamageSecondaryDamageType', 'Radiant');
    });

    it('passes context statusEffects and playerStats through to pending data', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = {
            ...BASE_CONTEXT,
            statusEffects: ['exhaustion', 'poisoned'],
            playerStats: { level: 10, class: { name: 'Wizard' } },
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('statusEffects', ['exhaustion', 'poisoned']);
        expect(pending).toHaveProperty('playerStats', { level: 10, class: { name: 'Wizard' } });
    });
});

describe('handlePlayerSaveDamage - attackerName resolution', () => {
    const deps = makeDeps();

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
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

    it('uses attackerName from context when provided', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { ...BASE_CONTEXT, attackerName: 'EnemyMage' };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('attackerName', 'EnemyMage');
    });

    it('defaults attackerName to characterName when context lacks attackerName', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('attackerName', 'TestWizard');
    });
});

describe('handlePlayerSaveDamage - GWF tracking in pending data', () => {
    const deps = makeDeps();

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
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

    it('sets gwfApplied false and gwfOriginalRolls null in popup when gwfBaseRolls and gwfDisplayRolls are both undefined', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, BASE_CONTEXT, BASE_COMBAT_SUMMARY, undefined, undefined);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                gwfApplied: false,
                gwfOriginalRolls: null,
            })
        );
    });

    it('sets gwfApplied true and gwfOriginalRolls set in popup when gwfBaseRolls and gwfDisplayRolls differ', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, BASE_CONTEXT, BASE_COMBAT_SUMMARY, [6, 6], [3, 3]);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                gwfApplied: true,
                gwfOriginalRolls: [6, 6],
            })
        );
    });
});

describe('handlePlayerSaveDamage - side effects', () => {
    const deps = makeDeps();

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
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

    it('registers pending save prompt with the registry', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith(
            'test-guid-1234',
            expect.objectContaining({
                targetName: 'TestWizard',
                rawDamage: 5,
                saveDc: 13,
                saveType: 'DEX',
            })
        );
    });

    it('registers pending popup setter with the registry', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(registerPendingPopupSetter).toHaveBeenCalledWith(
            'test-guid-1234',
            expect.any(Function)
        );
    });

    it('sends save prompt via savePromptService', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                promptId: 'test-guid-1234',
                targetName: 'TestWizard',
                saveType: 'DEX',
                saveDc: 13,
                dcSuccess: 'half',
                damageFormula: '1d10',
                damageType: 'Fire',
                sourceName: 'Fire Bolt',
                rawDamage: 5,
                disadvantage: false,
                advantage: false,
            })
        );
    });

    it('calls handleOverchannelSelfDamage at the end of the handler', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
            'TestWizard',
            'test-campaign',
            expect.any(Object),
            expect.any(Function),
            expect.any(Array)
        );
    });

    it('logs a save-prompt roll entry', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'roll',
                rollType: 'save-prompt',
                name: 'Fire Bolt',
                formula: '1d10',
                total: 5,
                damageType: 'Fire',
                targetName: 'TestWizard',
                saveType: 'DEX',
                saveDc: 13,
                dcSuccess: 'half',
                forcedMode: 'normal',
            })
        );
    });

    it('sets popup with waitingForPlayerSave and promptId', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                waitingForPlayerSave: true,
                promptId: 'test-guid-1234',
                rawDamage: 5,
                gwfApplied: false,
                gwfOriginalRolls: null,
                autoReroll: false,
                autoRerollBonus: null,
            })
        );
    });
});

describe('handlePlayerSaveDamage - forcedMode in logging', () => {
    const deps = makeDeps();

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
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

    it('logs forcedMode: disadvantage when metamagicHeighten is true', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...BASE_CONTEXT, metamagicHeighten: true });

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                forcedMode: 'disadvantage',
            })
        );
    });

    it('logs forcedMode: normal when metamagicHeighten is false', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                forcedMode: 'normal',
            })
        );
    });
});
