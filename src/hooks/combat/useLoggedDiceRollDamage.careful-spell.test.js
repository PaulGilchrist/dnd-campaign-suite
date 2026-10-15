// @maintained-by-ai: 2026-10-14
// Wrapper-level careful-spell lane: owns the createLogDamageAndShow dispatch
// contract for metamagicCareful on a player save target — forced save success
// (auto-succeed per 2024 Careful Spell), half damage via dcSuccess 'half',
// careful spell note/popup, no save prompt, and the ignoreResistance pass-through
// (the only lane exercising it true). What each gate falls through to at the
// wrapper seam (waiting save prompt vs plain damage) is asserted here; the
// handler seam itself (ally-list bail-out side-effect freedom, invisibility
// zero-damage/null-result legs, log-row shape) lives in
// handlers/handlePlayerSaveDamage.{early-paths,endInvisibility,logging}.test.js.

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
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
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
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Mirrors real computeDamageAfterSave: a forced save success with dcSuccess
// 'half' still pays half damage — Careful Spell mitigation, not immunity.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? Math.floor(total / 2) : total)),
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
    isCircleOfPowerActive: vi.fn(() => false),
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

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { computeDamageAfterSave, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
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

    const fireball = { name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0 };
    const baseContext = { targetName: 'Ally1', damageType: 'fire', saveDc: 15, saveType: 'DEX', dcSuccess: 'half' };

    beforeEach(() => {
        vi.clearAllMocks();
        // mockClear preserves factory implementations; reset per-test overrides.
        hasIgnoreResistance.mockReturnValue(false);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 10, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
    });

    it('forces a save success for a listed ally: half damage applied, careful note and popup, no prompt', async () => {
        getAllyList.mockReturnValue(['Ally1']);

        await createLogDamageAndShow(deps)({ ...fireball, context: { ...baseContext, metamagicCareful: true } });

        expect(computeDamageAfterSave).toHaveBeenCalledWith(20, true, 'half');
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 10, ['fire'], {
            campaignName: 'test-campaign',
            characters: expect.any(Array),
            ignoreResistance: false,
            attackerName: 'Wizard1',
            suppressHpLog: false,
            isSpellDamage: true,
        });
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
        // Careful Spell auto-succeeds — the player is never prompted.
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
    });

    it.each([
        {
            title: 'metamagicCareful is false',
            allyList: ['Ally1'],
            context: { ...baseContext, metamagicCareful: false },
            fallThrough: expect.objectContaining({ waitingForPlayerSave: true }),
        },
        {
            title: 'the target is outside the ally list',
            allyList: ['OtherAlly'],
            context: { ...baseContext, metamagicCareful: true },
            fallThrough: expect.objectContaining({ type: 'damage', damageApplied: true }),
        },
    ])('skips the careful forced-success leg when $title', async ({ allyList, context, fallThrough }) => {
        getAllyList.mockReturnValue(allyList);

        await createLogDamageAndShow(deps)({ ...fireball, context });

        expect(computeDamageAfterSave).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(
            expect.objectContaining({ note: 'careful_spell_damage_roll_before_apply' })
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(fallThrough);
    });

    it('passes ignoreResistance=true when playerStats has it for the damage type', async () => {
        getAllyList.mockReturnValue(['Ally1']);
        hasIgnoreResistance.mockReturnValue(true);

        await createLogDamageAndShow(deps)({ ...fireball, context: { ...baseContext, metamagicCareful: true, playerStats: { automation: { passives: [] } } } });

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 10, ['fire'], {
            campaignName: 'test-campaign',
            characters: expect.any(Array),
            ignoreResistance: true,
            attackerName: 'Wizard1',
            suppressHpLog: false,
            isSpellDamage: true,
        });
    });
});
