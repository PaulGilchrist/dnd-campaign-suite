// @maintained-by-ai: 2026-10-14
// Composite coverage only: registration-before-prompt ordering (race guard),
// the CLA-324 isSpellDamage prompt marker, and simultaneous advantage +
// disadvantage with a custom attacker. Per-field payload, logging, popup,
// pending-data, adv/dis and overchannel coverage lives in the lane siblings
// (.test.js, .logging, .pending-data, .advantage-disadvantage, .targetEffects).
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

function invokeHandler(handler, context = DEFAULT_CONTEXT) {
    return handler({
        name: 'Acid Arrow',
        formula: '4d4',
        total: 10,
        rolls: [3, 4, 2, 1],
        modifier: 0,
        context,
        adjustedTotal: 10,
        combatSummary: DEFAULT_COMBAT_SUMMARY,
        displayRolls: [3, 4, 2, 1],
    });
}

describe('handlePlayerSaveDamage - composite save prompt flows', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: 'TestWizard',
            campaignName: 'test-campaign',
            characters: [{ name: 'TestWizard' }],
            charactersRef: { current: [] },
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
            pendingSaves: {},
        };
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

    it('registers pending prompt and popup setter before sending, marks the prompt spell-origin, and returns true', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const result = await invokeHandler(handler);

        expect(result).toBe(true);
        // Race guard: a player response must never arrive before registration.
        expect(registerPendingSavePrompt.mock.invocationCallOrder[0]).toBeLessThan(
            sendSavePrompt.mock.invocationCallOrder[0]
        );
        expect(registerPendingPopupSetter.mock.invocationCallOrder[0]).toBeLessThan(
            sendSavePrompt.mock.invocationCallOrder[0]
        );
        // CLA-324: player-cast save-spell damage carries the spell-origin marker.
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ promptId: 'test-guid-1234', isSpellDamage: true })
        );
    });

    it('sends advantage and disadvantage together with a custom attacker name when both sources apply', async () => {
        isCircleOfPowerActive.mockReturnValue(true);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...DEFAULT_CONTEXT, attackerName: 'Goblin' });

        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                advantage: true,
                disadvantage: true,
                sourceAttackerName: 'Goblin',
            })
        );
        expect(deps.pendingSaves['test-guid-1234']).toMatchObject({
            saveAdvantage: true,
            metamagicHeighten: true,
            attackerName: 'Goblin',
        });
    });
});
