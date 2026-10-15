// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, _rolls, isCrit) => (isCrit ? `${formula}*2` : formula)),
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
    evaluateAutoExpression: vi.fn(() => 0),
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

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? Math.floor(total / 2) : total)),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn().mockResolvedValue({ finalDamage: 10, newHp: 10, damageReduced: false }),
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
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';

// Contact Other Plane auto-save lane (INT save, psychic, half on "save" per
// rules data). Owns the createLogDamageAndShow-level contract of the forced
// success leg in handlePlayerSaveDamage: note, characters:null patron arg,
// contactPatron popup flag, invisibility end, and no save prompt.
describe('Contact Other Plane auto-save', () => {
    const warlock = { name: 'Warlock1', computedStats: { armorClass: 14 } };
    const contactPassiveStats = {
        automation: {
            passives: [{ type: 'passive_rule', effect: 'contact_patron_auto_save' }],
        },
    };

    const deps = {
        characterName: 'Warlock1',
        campaignName: 'test-campaign',
        characters: [warlock],
        charactersRef: { current: [warlock] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    // Spell casting data as autoDamageRoll would deliver it for the spell's
    // 5e/2024 rules entry (6d6 psychic, INT save).
    const rollData = { name: 'Contact Other Plane', formula: '6d6', total: 21, rolls: [6, 5, 4, 3, 2, 1], modifier: 0 };
    const autoSaveContext = {
        targetName: 'Warlock1',
        damageType: 'psychic',
        saveDc: 15,
        saveType: 'INT',
        dcSuccess: 'half',
        playerStats: contactPassiveStats,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        deps.pendingSaves = {};
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Warlock1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
    });

    it('auto-succeeds when the caster is the target: half damage, contactPatron popup, no prompt', async () => {
        await createLogDamageAndShow(deps)({ ...rollData, context: autoSaveContext });

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                name: 'Contact Other Plane',
                saveResult: 'success',
                saveRoll: 20,
                note: 'contact_patron_damage_roll_before_apply',
                targetName: 'Warlock1',
                damageType: 'psychic',
                formula: '6d6',
                total: 21,
            })
        );

        // Patron contract: characters:null so damage resolves via the runtime store.
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Warlock1',
            10,
            ['psychic'],
            { campaignName: 'test-campaign', characters: null, ignoreResistance: false, attackerName: 'Warlock1', suppressHpLog: false, isSpellDamage: true }
        );

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                name: 'Contact Other Plane',
                contactPatron: true,
                finalDamage: 10,
                total: 10,
                damageApplied: true,
                damageReduced: false,
                saveResult: expect.objectContaining({ success: true }),
            })
        );

        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('Warlock1', 'test-campaign');
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
    });

    it.each([
        {
            title: 'spell name mismatch',
            roll: { name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0 },
            context: { ...autoSaveContext, damageType: 'fire', saveType: 'DEX' },
        },
        {
            title: 'target is not the caster',
            roll: rollData,
            context: { ...autoSaveContext, targetName: 'Ally1' },
            summary: { creatures: [{ name: 'Ally1', type: 'player', ac: 16, currentHp: 30, maxHp: 30 }] },
        },
        {
            title: 'caster lacks the contact_patron_auto_save passive',
            roll: rollData,
            context: { ...autoSaveContext, playerStats: { automation: { passives: [] } } },
        },
    ])('falls through to a normal save prompt on $title', async ({ roll, context, summary }) => {
        if (summary) loadCombatSummary.mockResolvedValue(summary);

        await createLogDamageAndShow(deps)({ ...roll, context });

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ contactPatron: true })
        );

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt.mock.calls[0][1]).toEqual(
            expect.objectContaining({
                promptId: 'test-guid-1234',
                targetName: context.targetName,
                saveType: context.saveType,
                saveDc: context.saveDc,
                dcSuccess: context.dcSuccess,
                damageType: context.damageType,
            })
        );
        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
    });
});
