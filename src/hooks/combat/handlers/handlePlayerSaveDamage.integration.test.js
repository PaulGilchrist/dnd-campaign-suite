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
    rollSaveForSave: vi.fn(),
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
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

const DEFAULT_CONTEXT = {
    saveDc: 15,
    saveType: 'CON',
    dcSuccess: 'half',
    damageType: 'Poison',
    targetName: 'TestWizard',
};

const DEFAULT_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

const DEFAULT_CALL_ARGS = [
    'Acid Arrow',
    '4d4',
    10,
    [3, 4, 2, 1],
    0,
    DEFAULT_CONTEXT,
    10,
    DEFAULT_COMBAT_SUMMARY,
    [3, 4, 2, 1],
];

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

describe('handlePlayerSaveDamage - complete save prompt flow', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('emits all four side effects in the correct order for the main save prompt path', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        // Verify all four side effects fired
        expect(registerPendingSavePrompt).toHaveBeenCalledTimes(1);
        expect(registerPendingPopupSetter).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(handleOverchannelSelfDamage).toHaveBeenCalledTimes(1);

        // All registration happens before the prompt is sent
        expect(registerPendingSavePrompt.mock.invocationCallOrder[0]).toBeLessThan(
            sendSavePrompt.mock.invocationCallOrder[0]
        );
        expect(registerPendingPopupSetter.mock.invocationCallOrder[0]).toBeLessThan(
            sendSavePrompt.mock.invocationCallOrder[0]
        );
    });

    it('populates pendingSaves with all expected fields', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        const pendingData = deps.pendingSaves['test-guid-1234'];
        expect(pendingData).toBeDefined();
        expect(pendingData).toMatchObject({
            targetName: 'TestWizard',
            rawDamage: 10,
            saveDc: 15,
            saveType: 'CON',
            dcSuccess: 'half',
            damageType: 'Poison',
            attackerName: 'TestWizard',
            name: 'Acid Arrow',
            formula: '4d4',
            modifier: 0,
            rolls: [3, 4, 2, 1],
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

    it('sends save prompt with correct data to the UI', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
            promptId: 'test-guid-1234',
            targetName: 'TestWizard',
            saveType: 'CON',
            saveDc: 15,
            dcSuccess: 'half',
            damageFormula: '4d4',
            damageType: 'Poison',
            sourceName: 'Acid Arrow',
            sourceAttackerName: 'TestWizard',
            rawDamage: 10,
            disadvantage: false,
            advantage: false,
            isSpellDamage: true,
        });
    });

    it('registers pending save prompt with matching data', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith('test-guid-1234', expect.objectContaining({
            targetName: 'TestWizard',
            rawDamage: 10,
            saveDc: 15,
        }));
    });

    it('registers pending popup setter with the promptId', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(registerPendingPopupSetter).toHaveBeenCalledWith('test-guid-1234', deps.setPopupHtml);
    });

    it('logs the save-prompt event with roll details', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'roll',
                rollType: 'save-prompt',
                characterName: 'TestWizard',
                name: 'Acid Arrow',
                formula: '4d4',
                rolls: [3, 4, 2, 1],
                total: 10,
                modifier: 0,
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

    it('sets popup to waiting state with all required fields', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                name: 'Acid Arrow',
                formula: '4d4',
                rolls: [3, 4, 2, 1],
                total: 10,
                bonus: 0,
                modifier: 0,
                damageType: 'Poison',
                targetName: 'TestWizard',
                saveDc: 15,
                saveType: 'CON',
                dcSuccess: 'half',
                waitingForPlayerSave: true,
                promptId: 'test-guid-1234',
                rawDamage: 10,
                attackerName: 'TestWizard',
                gwfApplied: false,
                gwfOriginalRolls: null,
                autoReroll: false,
                autoRerollBonus: null,
            })
        );
    });

    it('calls handleOverchannelSelfDamage with correct arguments', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
            'TestWizard',
            'test-campaign',
            DEFAULT_CONTEXT,
            deps.logEntry,
            deps.characters
        );
    });

    it('returns true to indicate the handler completed successfully', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const result = await handler(...DEFAULT_CALL_ARGS);

        expect(result).toBe(true);
    });
});

describe('handlePlayerSaveDamage - save prompt with custom attacker', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('uses context attackerName as sourceAttackerName when provided', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { ...DEFAULT_CONTEXT, attackerName: 'Goblin' };

        await handler(
            'Acid Arrow',
            '4d4',
            10,
            [3, 4, 2, 1],
            0,
            context,
            10,
            DEFAULT_COMBAT_SUMMARY,
            [3, 4, 2, 1]
        );

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ sourceAttackerName: 'Goblin' })
        );
        expect(deps.pendingSaves['test-guid-1234']).toMatchObject({
            attackerName: 'Goblin',
        });
    });
});

describe('handlePlayerSaveDamage - save prompt with disadvantage/advantage', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('passes disadvantage:true when corona aura applies', async () => {
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: true })
        );
        expect(deps.pendingSaves['test-guid-1234']).toMatchObject({
            metamagicHeighten: true,
        });
    });

    it('passes advantage:true when circle of power grants advantage', async () => {
        isCircleOfPowerActive.mockReturnValue(true);

        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true })
        );
        expect(deps.pendingSaves['test-guid-1234']).toMatchObject({
            saveAdvantage: true,
        });
    });

    it('passes both advantage and disadvantage correctly when both apply', async () => {
        isCircleOfPowerActive.mockReturnValue(true);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true, disadvantage: true })
        );
    });
});

describe('handlePlayerSaveDamage - integration with registerPendingSavePrompt', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        setupCommonMocks();
    });

    it('passes campaignName to registerPendingSavePrompt via pendingData', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith(
            'test-guid-1234',
            expect.objectContaining({ campaignName: 'test-campaign' })
        );
    });

    it('passes setPopupHtml to registerPendingSavePrompt via pendingData', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler(...DEFAULT_CALL_ARGS);

        expect(registerPendingSavePrompt).toHaveBeenCalledWith(
            'test-guid-1234',
            expect.objectContaining({ setPopupHtml: deps.setPopupHtml })
        );
    });
});
