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

function setupCommonMocks() {
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
}

describe('handlePlayerSaveDamage - main save prompt happy path', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('returns true and triggers all four side effects when no special paths apply', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const result = await invokeHandler(handler);

        expect(result).toBe(true);
        expect(registerPendingSavePrompt).toHaveBeenCalledTimes(1);
        expect(registerPendingPopupSetter).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(handleOverchannelSelfDamage).toHaveBeenCalledTimes(1);
    });

    it('uses the utils.guid output as the promptId across all side effects', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith('test-guid-1234', expect.any(Object));
        expect(registerPendingPopupSetter).toHaveBeenCalledWith('test-guid-1234', expect.any(Function));
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ promptId: 'test-guid-1234' }));
        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
    });

    it('sets popup to waiting state with promptId and core fields', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                rolls: [6],
                total: 5,
                bonus: 0,
                modifier: 0,
                damageType: 'Fire',
                targetName: 'TestWizard',
                saveDc: 13,
                saveType: 'DEX',
                dcSuccess: 'half',
                waitingForPlayerSave: true,
                promptId: 'test-guid-1234',
                rawDamage: 5,
                attackerName: 'TestWizard',
                gwfApplied: false,
                gwfOriginalRolls: null,
                autoReroll: false,
                autoRerollBonus: null,
            })
        );
    });

    it('sends save prompt with disadvantage:false and advantage:false when no sources apply', async () => {
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
                sourceAttackerName: 'TestWizard',
                rawDamage: 5,
                disadvantage: false,
                advantage: false,
            })
        );
    });

    it('logs a save-prompt roll entry with all roll details', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'roll',
                characterName: 'TestWizard',
                rollType: 'save-prompt',
                name: 'Fire Bolt',
                formula: '1d10',
                rolls: [6],
                total: 5,
                modifier: 0,
                bonus: 0,
                damageType: 'Fire',
                targetName: 'TestWizard',
                saveType: 'DEX',
                saveDc: 13,
                dcSuccess: 'half',
                forcedMode: 'normal',
                gwfApplied: false,
                gwfOriginalRolls: null,
            })
        );
    });

    it('stores pending save data with all core fields', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toMatchObject({
            targetName: 'TestWizard',
            rawDamage: 5,
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'half',
            damageType: 'Fire',
            attackerName: 'TestWizard',
            name: 'Fire Bolt',
            formula: '1d10',
            modifier: 0,
            rolls: [6],
            campaignName: 'test-campaign',
            metamagicHeighten: false,
            saveAdvantage: false,
            isCantrip: false,
            overchannelActive: false,
            overchannelUseCount: 0,
            overchannelSpellLevel: 1,
            statusEffects: [],
        });
    });

    it('passes setPopupHtml into pendingData for the registries', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith(
            'test-guid-1234',
            expect.objectContaining({ setPopupHtml: deps.setPopupHtml })
        );
    });

    it('calls handleOverchannelSelfDamage with correct arguments at the end', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
            'TestWizard',
            'test-campaign',
            BASE_CONTEXT,
            deps.logEntry,
            deps.characters
        );
    });
});

describe('handlePlayerSaveDamage - context flags propagate to pending data', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('propagates metamagicHeighten, isCantrip, overchannel, and autoDamage fields from context', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = {
            ...BASE_CONTEXT,
            metamagicHeighten: true,
            isCantrip: true,
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Radiant',
            autoDamageSecondaryDamageType: 'Radiant',
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toMatchObject({
            metamagicHeighten: true,
            isCantrip: true,
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Radiant',
            autoDamageSecondaryDamageType: 'Radiant',
        });
    });

    it('propagates statusEffects and playerStats from context', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = {
            ...BASE_CONTEXT,
            statusEffects: ['exhaustion', 'poisoned'],
            playerStats: { level: 10, class: { name: 'Wizard' } },
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toMatchObject({
            statusEffects: ['exhaustion', 'poisoned'],
            playerStats: { level: 10, class: { name: 'Wizard' } },
        });
    });

    it('uses context attackerName when provided, falling back to characterName', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { ...BASE_CONTEXT, attackerName: 'EnemyMage' };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toHaveProperty('attackerName', 'EnemyMage');

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ sourceAttackerName: 'EnemyMage' })
        );

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ attackerName: 'EnemyMage' })
        );
    });
});

describe('handlePlayerSaveDamage - GWF tracking in popup', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('sets gwfApplied:false and gwfOriginalRolls:null when GWF rolls are not provided', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, BASE_CONTEXT, BASE_COMBAT_SUMMARY);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                gwfApplied: false,
                gwfOriginalRolls: null,
            })
        );
    });

    it('sets gwfApplied:true and gwfOriginalRolls when base and display rolls differ', async () => {
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
