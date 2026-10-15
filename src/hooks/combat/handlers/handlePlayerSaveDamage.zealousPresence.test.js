// @maintained-by-ai: 2026-10-14
// CLA-394: Zealous Presence (2024 Barbarian, buffExpression advantage_attacks_and_saves
// stored on the target's activeBuffs by buffToggle.toggleBuff) must grant advantage on
// the player save-prompt path: handlePlayerSaveDamage computePlayerSaveAdvantage →
// pendingSaves.saveAdvantage + sendSavePrompt(advantage). buffToggle.js stays unmocked
// so the seam exercised is the real hasBuffEffect lookup. Absent-buff control lives in
// handlePlayerSaveDamage.advantage-disadvantage.test.js; NPC auto-save lane lives in
// handleNpcSaveDamage.zealousPresence.test.js — neither is duplicated here.
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

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

const BASE_CONTEXT = {
    saveDc: 12,
    saveType: 'DEX',
    dcSuccess: 'half',
    damageType: 'Cold',
    targetName: 'War_Cleric',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'War_Cleric', type: 'player' }],
};

function invokeHandler(handler, context = BASE_CONTEXT, combatSummary = BASE_COMBAT_SUMMARY) {
    return handler({ name: 'Frost Ray', formula: '3d6', total: 11, rolls: [4, 4, 3], modifier: 0, context: context, adjustedTotal: 11, combatSummary: combatSummary, displayRolls: [4, 4, 3] });
}

describe('handlePlayerSaveDamage — CLA-394 Zealous Presence save advantage', () => {
    const deps = {
        characterName: 'DraconicDragon',
        campaignName: 'test-campaign',
        characters: [{ name: 'War_Cleric' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        deps.pendingSaves = {};
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

    // Producer shape (zealousPresenceHandler → toggleBuff): name + effect +
    // duration + sourceCharacter = the buff-bearing Barbarian.
    function targetBuffs(buffs) {
        getRuntimeValue.mockImplementation((name, key) => (name === 'War_Cleric' && key === 'activeBuffs' ? buffs : null));
    }

    it('sends advantage:true when the target carries the Zealous Presence buff', async () => {
        targetBuffs([{
            name: 'Zealous Presence',
            effect: 'advantage_attacks_and_saves',
            duration: 'until_start_of_next_turn',
            sourceCharacter: 'DraconicDragon',
        }]);

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        // Pins the campaign arg through the unmocked buffToggle.hasBuffEffect lookup.
        expect(getRuntimeValue).toHaveBeenCalledWith('War_Cleric', 'activeBuffs', 'test-campaign');
        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: true, targetName: 'War_Cleric' })
        );
    });

    it('per-target gate: a buff on another creature grants this target no advantage', async () => {
        // CLA-394 live fix was per-target attribution — only chosen targets carry
        // the buff, so the consumer must read activeBuffs of the save target only.
        getRuntimeValue.mockImplementation((name, key) => (name === 'OtherPlayer' && key === 'activeBuffs'
            ? [{ name: 'Zealous Presence', effect: 'advantage_attacks_and_saves', duration: 'until_start_of_next_turn', sourceCharacter: 'DraconicDragon' }]
            : null));

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', false);
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ advantage: false, targetName: 'War_Cleric' })
        );
    });
});
