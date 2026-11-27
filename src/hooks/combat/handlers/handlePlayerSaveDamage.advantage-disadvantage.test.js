// @maintained-by-ai 2026-11-26
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

    it.each([
        ['corona aura', () => getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true }), {}],
        ['elder champion aura', () => getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true }), {}],
        ['metamagic Heightened Spell', () => {}, { metamagicHeighten: true }],
    ])('a single disadvantage source (%s) rides the pending data and the save prompt', async (_source, enable, contextOverrides) => {
        enable();

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...BASE_CONTEXT, ...contextOverrides });

        // buildPendingData maps the resolved disadvantage onto metamagicHeighten.
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

    it('wires the aura and circle-of-power checks with the save target, damage type, and handler characterName', async () => {
        const handler = createPlayerSaveDamageHandler({ ...deps, characterName: 'CasterA' });
        await invokeHandler(handler, { ...BASE_CONTEXT, attackerName: 'CasterB' });

        // CLA-063 + 2026-11-04 range fix: the caller checks the save target and
        // damage type and must NOT force-skip the 60 ft aura measurement — the
        // util forks measured/map vs lenient/gridless itself.
        expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(
            expect.objectContaining({ targetName: 'TestWizard', damageType: 'Fire' })
        );
        expect(getCoronaSaveDisadvantage).not.toHaveBeenCalledWith(
            expect.objectContaining({ skipRangeCheck: expect.anything() })
        );
        // The elder champion attacker is the handler's own characterName, never
        // the context attackerName (the aura belongs to the caster).
        expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(
            expect.objectContaining({ attackerName: 'CasterA', targetName: 'TestWizard' })
        );
        expect(isCircleOfPowerActive).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it.each([
        ['circle of power', () => isCircleOfPowerActive.mockReturnValue(true)],
        ['condition-effect saveAdvantageCount', () => mockConditionEffects({ saveAdvantageCount: 1 })],
    ])('grants save advantage when %s is active', async (_source, enable) => {
        enable();

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true, disadvantage: false })
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

    it('restoreBalance keeps disadvantage when two disadvantage sources stack', async () => {
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
