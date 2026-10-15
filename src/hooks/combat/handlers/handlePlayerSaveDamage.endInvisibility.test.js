// @maintained-by-ai: 2026-10-14
// Owner file for the forced-success-save invisibility seam in handlePlayerSaveDamage:
// the careful-spell and contact-patron routes both converge on applyForcedSuccessSave,
// where endInvisibilityOnHostileAction fires iff applyDamageToTarget reports
// finalDamage > 0. A forced save success with dcSuccess 'half' still deals HALF
// damage (real computeDamageAfterSave semantics — careful-spell targets take half
// on a successful save), so the invisibility-breaking leg is live in production
// even on these auto-success lanes. Bail-outs live in handlePlayerSaveDamage.
// early-paths.test.js; the main save-prompt path lives in the other sibling files.

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    // Real buffToggle/deathWardHandler modules import setRuntimeValue from here.
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// Consumers: handlePlayerSaveDamage + damageHandlerUtils — keep every named export.
vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    evaluateAutoExpression: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

// Consumer: damageHandlerUtils (applyMinDamageAdjustment only).
vi.mock('../../loggedDiceRollUtils.js', () => ({
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
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

// Consumer: real deathWardHandler/combatData modules.
vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Mirrors the real computeDamageAfterSave: save success with dcSuccess 'half'
// still pays half damage — the mock must not zero it out or these invisibility
// seams would assert against fiction.
vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((rawDamage, saveSuccess, dcSuccess) => {
        if (!saveSuccess) return rawDamage;
        if (dcSuccess === 'half') return Math.floor(rawDamage / 2);
        if (dcSuccess === 'full') return rawDamage;
        return 0;
    }),
    applyDamageToTarget: vi.fn(),
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
    getAllyList: vi.fn(() => ['Ally1']),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';

const makeDeps = () => ({
    characterName: 'TestWizard',
    campaignName: 'test-campaign',
    characters: [{ name: 'TestWizard' }],
    charactersRef: { current: [] },
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
});

// The two auto-success routes converge on the same applyForcedSuccessSave seam;
// the table keeps the invisibility assertions identical while each route keeps
// its own dispatch shape (careful: ally-list gate, characters forwarded;
// contact patron: self-target only, characters suppressed to null).
const ROUTES = [
    {
        label: 'careful spell',
        spell: { name: 'Fire Bolt', formula: '1d10', rolls: [6] },
        context: { saveDc: 11, saveType: 'DEX', dcSuccess: 'half', damageType: 'Fire', targetName: 'Ally1', metamagicCareful: true },
        targetName: 'Ally1',
        characters: expect.any(Array),
        note: 'careful_spell_damage_roll_before_apply',
        popupFlag: 'carefulSpell',
    },
    {
        label: 'contact patron',
        spell: { name: 'Contact Other Plane', formula: '4d6', rolls: [3, 5, 2, 4] },
        context: {
            saveDc: 13,
            saveType: 'INT',
            dcSuccess: 'half',
            damageType: 'Psychic',
            targetName: 'TestWizard',
            playerStats: {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'contact_patron_auto_save' }],
                },
            },
        },
        targetName: 'TestWizard',
        characters: null,
        note: 'contact_patron_damage_roll_before_apply',
        popupFlag: 'contactPatron',
    },
];

const invoke = (handler, route, adjustedTotal) => handler({
    name: route.spell.name,
    formula: route.spell.formula,
    total: adjustedTotal,
    rolls: route.spell.rolls,
    modifier: 0,
    context: route.context,
    adjustedTotal,
    combatSummary: { creatures: [{ name: route.targetName, type: 'player' }] },
    displayRolls: route.spell.rolls,
});

describe('handlePlayerSaveDamage - endInvisibilityOnHostileAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        // Must return an object — resolveTargetSaveContext reads its fields before the routes dispatch.
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            autoRerollCondition: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        applyDamageToTarget.mockResolvedValue({ newHp: 15, finalDamage: 2 });
    });

    describe.each(ROUTES)('$label forced-success save', (route) => {
        it('ends invisibility when applied damage > 0', async () => {
            const deps = makeDeps();
            const handler = createPlayerSaveDamageHandler(deps);

            // adjustedTotal 5 with dcSuccess 'half' → floor(5/2) = 2 lands on the target.
            const result = await invoke(handler, route, 5);

            expect(result).toBe(true);
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object), route.targetName, 2, [route.context.damageType],
                {
                    campaignName: 'test-campaign',
                    characters: route.characters,
                    ignoreResistance: false,
                    attackerName: 'TestWizard',
                    suppressHpLog: false,
                    isSpellDamage: true,
                }
            );
            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
            expect(deps.logEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roll',
                    rollType: 'save-damage',
                    saveResult: 'success',
                    note: route.note,
                })
            );
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'save-damage',
                    [route.popupFlag]: true,
                    finalDamage: 2,
                    damageApplied: true,
                })
            );
        });

        it('leaves invisibility intact when nothing lands (zero damage, or null apply result)', async () => {
            const handler = createPlayerSaveDamageHandler(makeDeps());

            // adjustedTotal 1 → floor(1/2) = 0 applied damage; a null apply result
            // is guarded defensively by applyResult?.finalDamage > 0.
            for (const [adjustedTotal, applyResult] of [[1, { newHp: 20, finalDamage: 0 }], [5, null]]) {
                applyDamageToTarget.mockResolvedValue(applyResult);

                const result = await invoke(handler, route, adjustedTotal);

                expect(result).toBe(true);
                expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
            }
        });
    });
});
