// MA-0298: combo attack+save crit doubling — the player save-damage handler
// must carry the attack popup's crit flag (and the Soul Tome trap arms) into
// the pending prompt so computeSecondaryRoll doubles the secondary dice via
// the SAME rollExpressionDoubled consumer plain attacks use, and so the save
// trap clause parse routes through the MA-0104 te key. Full-path unit lock:
// nat-20 combo → dice-doubled rawDamage + doubled secondary roll.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 2], modifier: 5 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 2, 3, 2], modifier: 5 })),
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
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, dcSuccess) => (dcSuccess === 'none' ? total : (success ? 0 : total))),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess) => (dcSuccess === 'none' ? total : (success ? 0 : total))),
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
    getAllyList: vi.fn(() => []),
}));

import { rollExpressionDoubled } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeDamageAfterEvasion } from '../../../services/rules/combat/applyDamage.js';

const COMBAT_SUMMARY = { creatures: [{ name: 'Wild_Sage_Druid', type: 'player' }] };

function makeDeps() {
    return {
        characterName: 'Arcanaloth',
        campaignName: 'test-campaign',
        characters: [{ name: 'Wild_Sage_Druid' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };
}

// The live combo attack context (Banishing Claw nat-20): primary rolled
// pre-doubled by the plain handleAttack crit consumer (rollExpressionDoubled),
// secondary formula rides the combo context un-rolled.
function comboCritContext() {
    return {
        saveDc: 17,
        saveType: 'CHA',
        dcSuccess: 'none',
        damageType: 'Slashing',
        targetName: 'Wild_Sage_Druid',
        attackerName: 'Arcanaloth',
        isAutoCrit: true,
        autoDamageSecondaryFormula: '3d12',
        autoDamageSecondaryName: 'Banishing Claw (Requires Soul Tome)',
        autoDamageSecondaryDamageType: 'Psychic',
        saveConditions: ['incapacitated'],
        soulTomeTrap: { effect: 'banished_demiplane', soulTome: true },
        repeatSave: { save_type: 'Charisma' },
    };
}

describe('MA-0298 combo crit + trap arms ride the pending save prompt', () => {
    let deps;
    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        getRuntimeValue.mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
    });

    it('carries isAutoCrit into pending so the secondary crit doubling consumer fires', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await handler({
            name: 'Banishing Claw (Requires Soul Tome)',
            formula: '4d4 + 5',
            total: 20,
            rolls: [3, 2, 3, 2],
            modifier: 5,
            context: comboCritContext(),
            adjustedTotal: 20,
            combatSummary: COMBAT_SUMMARY,
            displayRolls: [3, 2, 3, 2],
        });

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending.isAutoCrit).toBe(true);
        expect(pending.rawDamage).toBe(20);
        expect(pending.autoDamageSecondaryFormula).toBe('3d12');
        expect(pending.soulTomeTrap).toEqual({ effect: 'banished_demiplane', soulTome: true });
        expect(pending.repeatSave).toEqual({ save_type: 'Charisma' });
        expect(pending.saveConditions).toEqual(['incapacitated']);
    });

    it('dc_success none pending computes FULL damage on a save success (MV-20 half-leak stays fixed)', async () => {
        expect(computeDamageAfterEvasion(30, true, 'none', false)).toBe(30);
        expect(computeDamageAfterEvasion(30, false, 'none', false)).toBe(30);
    });

    it('non-crit combo defaults isAutoCrit false and keeps the secondary dice base (regression)', async () => {
        const context = { ...comboCritContext(), isAutoCrit: false };
        const handler = createPlayerSaveDamageHandler(deps);
        await handler({
            name: 'Banishing Claw (Requires Soul Tome)',
            formula: '2d4 + 5',
            total: 10,
            rolls: [3, 2],
            modifier: 5,
            context,
            adjustedTotal: 10,
            combatSummary: COMBAT_SUMMARY,
            displayRolls: [3, 2],
        });

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending.isAutoCrit).toBe(false);
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
    });
});
