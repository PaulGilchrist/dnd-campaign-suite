// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
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
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { isMagicMissileImmune, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterSave, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getAllyList } from '../../hooks/useAllySelection.js';

describe('Careful Spell — player save damage with ally protection', () => {
    const deps = {
        characterName: 'Wizard1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        charactersRef: { current: [{ name: 'Ally1', computedStats: { armorClass: 14 } }] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        isMagicMissileImmune.mockReturnValue(false);
        computeDamageAfterSave.mockImplementation((total, success) => (success ? Math.floor(total / 2) : total));
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 10, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('applies half damage, logs carefully, and shows popup when ally is protected', async () => {
        getAllyList.mockReturnValue(['Ally1']);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: true,
        });

        expect(computeDamageAfterSave).toHaveBeenCalledWith(20, true, 'half');
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 10, ['fire'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'Wizard1', suppressHpLog: false, ...{ isSpellDamage: true } });
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Wizard1', 'test-campaign');
        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                rollType: 'save-damage',
                saveResult: 'success',
                note: 'careful_spell_damage_roll_before_apply',
                total: 20,
            })
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                carefulSpell: true,
                finalDamage: 10,
                damageApplied: true,
                damageReduced: false,
            })
        );
    });

    it('does not take careful spell path when metamagicCareful is false', async () => {
        getAllyList.mockReturnValue(['Ally1']);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: false,
        });

        expect(computeDamageAfterSave).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(
            expect.objectContaining({ note: 'careful_spell_damage_roll_before_apply' })
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ waitingForPlayerSave: true })
        );
    });

    it('falls through to normal save path when target is not in ally list', async () => {
        getAllyList.mockReturnValue(['OtherAlly']);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: true,
        });

        expect(computeDamageAfterSave).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(
            expect.objectContaining({ note: 'careful_spell_damage_roll_before_apply' })
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'damage', damageApplied: true })
        );
    });

    it('does not call endInvisibility when careful spell applies zero damage', async () => {
        getAllyList.mockReturnValue(['Ally1']);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 20, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 0, [], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: true,
        });

        expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                carefulSpell: true,
                finalDamage: 0,
            })
        );
    });

    it('does not call endInvisibility when applyDamageToTarget returns null', async () => {
        getAllyList.mockReturnValue(['Ally1']);
        applyDamageToTarget.mockResolvedValue(null);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: true,
        });

        expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                carefulSpell: true,
            })
        );
    });

    it('passes ignoreResistance=true when playerStats has it for the damage type', async () => {
        getAllyList.mockReturnValue(['Ally1']);
        hasIgnoreResistance.mockReturnValue(true);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicCareful: true,
            playerStats: { automation: { passives: [] } },
        });

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 10, ['fire'], 'test-campaign', expect.any(Array), { ignoreResistance: true, attackerName: 'Wizard1', suppressHpLog: false, ...{ isSpellDamage: true } });
    });
});
