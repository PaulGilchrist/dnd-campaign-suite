// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn(),
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
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

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
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

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
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

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    computeDamageAfterEvasion,
    rollSaveForCreature,
    applyDamageToTarget,
} from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';

// Circle of Power (aura membership owned by circleOfPowerHandler) injects the
// damage-lane bonuses in handleNpcSaveDamage: save advantage (resolveSaveAdvantage),
// half-damage-→-none evasion (computeEvasionFlags), and popup forcedMode.
describe('Circle of Power in the NPC save-damage lane', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', saveModifiers: [] }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const fireballContext = {
        targetName: 'Goblin',
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
        attackerName: 'TestWizard',
    };

    beforeEach(() => {
        getRuntimeValue.mockReturnValue(null);
        rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3, rawRolls: [8] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        computeDamageAfterEvasion.mockImplementation(
            (total, success, _dcSuccess, evasion) =>
                evasion && success ? 0 : success ? Math.floor(total / 2) : total,
        );
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function castFireball() {
        return createLogDamageAndShow(deps)({
            name: 'Fireball',
            formula: '8d6',
            total: 20,
            rolls: [3, 4, 5, 2, 3, 3],
            modifier: 0,
            context: fireballContext,
        });
    }

    it('active: grants save advantage, evasion damage treatment, evasion log, and advantage popup', async () => {
        isCircleOfPowerActive.mockReturnValue(true);

        await castFireball();

        expect(isCircleOfPowerActive).toHaveBeenCalledWith('Goblin', 'test-campaign');
        // Save rolled with advantage (5th arg) ...
        expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'DEX', 15, false, true);
        // ... failed save still takes full damage, but the evasion seam is armed ...
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', true);
        // ... the shared-evasion roll is logged ...
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ rollType: 'evasion', targetName: 'Goblin' }));
        // ... and the popup reports forced advantage.
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'save-damage', forcedMode: 'advantage' }),
        );
    });

    it('inactive: no advantage, no evasion flag, no evasion log, normal popup', async () => {
        await castFireball();

        expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'DEX', 15, false, false);
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', false);
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ rollType: 'evasion' }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'save-damage', forcedMode: 'normal' }),
        );
    });
});
