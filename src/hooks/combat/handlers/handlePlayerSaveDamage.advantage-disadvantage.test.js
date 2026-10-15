// @maintained-by-ai: 2026-10-14
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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

import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

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

function invokeHandler(handler, context = BASE_CONTEXT, combatSummary = BASE_COMBAT_SUMMARY) {
    return handler({ name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [6], modifier: 0, context: context, adjustedTotal: 5, combatSummary: combatSummary, displayRolls: [6] });
}

function mockConditionEffects(overrides = {}) {
    computeConditionEffects.mockReturnValue({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: null,
        ...overrides,
    });
}

describe('handlePlayerSaveDamage - advantage/disadvantage calculation', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        mockConditionEffects();
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    it('corona aura disadvantage rides the pending data and the save prompt', async () => {
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(
            expect.objectContaining({
                targetName: 'TestWizard',
                damageType: 'Fire',
                skipRangeCheck: true,
            })
        );
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                targetName: 'TestWizard',
                saveType: 'DEX',
                saveDc: 13,
                disadvantage: true,
                advantage: false,
            })
        );
    });

    it('elder champion aura disadvantage rides the pending data and the save prompt', async () => {
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(
            expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'TestWizard',
            })
        );
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: true })
        );
    });

    it('uses handler characterName (not context attackerName) for the elder champion check', async () => {
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler({ ...deps, characterName: 'CasterA' });
        await invokeHandler(handler, { ...BASE_CONTEXT, attackerName: 'CasterB' });

        // The handler passes `characterName` (from deps) to getElderChampionSaveDisadvantage,
        // not the effectiveAttackerName which would use context attackerName
        expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(
            expect.objectContaining({ attackerName: 'CasterA' })
        );
    });

    it('grants advantage when circle of power is active', async () => {
        isCircleOfPowerActive.mockReturnValue(true);

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(isCircleOfPowerActive).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true, disadvantage: false })
        );
    });

    it('grants advantage from condition-effect saveAdvantageCount without circle of power', async () => {
        mockConditionEffects({ saveAdvantageCount: 1 });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true })
        );
    });

    it('defaults to no advantage or disadvantage when no sources apply', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.pendingSaves['test-guid-1234']).toMatchObject({
            metamagicHeighten: false,
            saveAdvantage: false,
        });
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: false, advantage: false })
        );
    });

    it('context metamagicHeighten alone forces disadvantage and forcedMode in the log', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...BASE_CONTEXT, metamagicHeighten: true });

        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: true })
        );
        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({ rollType: 'save-prompt', forcedMode: 'disadvantage' })
        );
    });

    it('restoreBalance keeps disadvantage when two aura sources stack', async () => {
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });
        mockConditionEffects({ restoreBalance: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        // sources (2) > 1, so disadvantage survives restoreBalance
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: true })
        );
    });

    it('restoreBalance cancels disadvantage from a single aura source', async () => {
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
        mockConditionEffects({ restoreBalance: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        // sources (1) > 1 is false, so disadvantage becomes false
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', false);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ disadvantage: false })
        );
    });
});
