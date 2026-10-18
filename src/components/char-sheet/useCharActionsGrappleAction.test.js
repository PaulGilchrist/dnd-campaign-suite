// @maintained-by-ai
// Grapple ACTION lane of useCharActionsBaseActions: enforcement/selection gates
// (cannotAct, no-target, already-grappled), adv/dis check-context resolution,
// target contest-modifier fallback CHANNELS with byte-exact popup pins (including
// popup sign formatting), and grappled-condition stamping on the success leg.
// Attacker bonus math (skill channels, Jack of All Trades, exhaustion), the
// higher-of-Athletics-or-Acrobatics contest resolution, and the outcome boundary
// (tie/loss) are owned byte-exact by
// useCharActionsBaseActions.grapple-contest-math.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import {
    createHooks,
    mockRollAbilityCheck,
    mockSetPopupHtml,
    mockLoadCombatSummary,
    campaignName,
    basePlayerStats,
} from './useCharActionsBaseActions.test-utils.js';

// Fighter (TestFighter lv5, STR +4, no Athletics proficiency): grapple check
// bonus 4. Monk swaps to Dexterity (+2 from basePlayerStats abilities).
const monkStats = { ...basePlayerStats, class: { name: 'Monk' } };

function grv(total, d20, storedConditions) {
    return vi.fn((charKey, key) => {
        if (key === 'lastAttack') return { total, d20 };
        if (charKey === 'TargetCreature') return storedConditions;
        return undefined;
    });
}

function targetWith(overrides) {
    return { name: 'TargetCreature', conditions: [], ...overrides };
}

function csWith(target) {
    return { creatures: [{ name: 'TestFighter', targetName: target.name }, target] };
}

// Runs one grapple. Default target resolves its contest from
// computedStats.abilities (+2); every row overrides what its lane owns.
// getMonsterData is passed straight through: undefined falls back to the
// shared test-utils mock (used only by fallback rows that truly reach it).
function useGrappleRun({ playerStats = basePlayerStats, target, total = 18, d20 = 12, storedConditions = [], conditionEffects = {}, getMonsterData } = {}) {
    const setRuntimeValue = vi.fn().mockResolvedValue(undefined);
    const deps = createHooks({
        playerStats,
        conditionEffects,
        loadCombatSummary: () => Promise.resolve(csWith(target ?? targetWith({ computedStats: { abilities: [{ name: 'Strength', bonus: 2 }] } }))),
        getRuntimeValue: grv(total, d20, storedConditions),
        setRuntimeValue,
        getMonsterData,
    });
    return { hooks: useCharActionsBaseActions(deps), setRuntimeValue };
}

describe('useCharActionsBaseActions — handleGrappleAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('gates', () => {
        it('cannotAct silently blocks before anything loads', async () => {
            const hooks = createHooks({ cannotAct: true });
            await useCharActionsBaseActions(hooks).handleGrappleAction();

            expect(mockLoadCombatSummary).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
            expect(mockRollAbilityCheck).not.toHaveBeenCalled();
        });

        it.each([
            { label: 'combat summary is null', cs: null },
            { label: 'combat summary has no creatures', cs: { creatures: [] } },
            { label: 'attacker has no selected target', cs: { creatures: [{ name: 'TestFighter', conditions: [] }] } },
        ])('no-target gate: $label', async ({ cs }) => {
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            await useCharActionsBaseActions(hooks).handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'No target selected. Select a target in combat first.',
            });
            expect(mockRollAbilityCheck).not.toHaveBeenCalled();
        });

        it('already-grappled gate refuses before rolling', async () => {
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(csWith(targetWith({ conditions: ['grappled'] }))),
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            await useCharActionsBaseActions(hooks).handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'Target is already grappled.',
            });
            expect(mockRollAbilityCheck).not.toHaveBeenCalled();
        });
    });

    describe('advantage/disadvantage check-context resolution', () => {
        it.each([
            {
                label: 'strCheckDisadvantage forces disadvantage',
                stats: basePlayerStats,
                ce: { strCheckDisadvantage: true },
                ability: 'Strength',
                bonus: 4,
                ctx: { forcedMode: 'disadvantage' },
            },
            {
                label: 'hex weakness on Strength forces disadvantage',
                stats: basePlayerStats,
                ce: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'Strength' },
                ability: 'Strength',
                bonus: 4,
                ctx: { forcedMode: 'disadvantage' },
            },
            {
                label: 'blanket abilityCheckAdvantage cancels strCheckDisadvantage',
                stats: basePlayerStats,
                ce: { strCheckDisadvantage: true, abilityCheckAdvantage: true },
                ability: 'Strength',
                bonus: 4,
                ctx: { forcedMode: undefined },
            },
            {
                label: 'monk grapples with Dexterity instead of Strength',
                stats: monkStats,
                ce: {},
                ability: 'Dexterity',
                bonus: 2,
                ctx: {},
            },
            {
                label: 'monk Peerless Athlete forces advantage on Dexterity',
                stats: monkStats,
                ce: { peerlessAthleteAdvantageSkills: ['Dexterity'] },
                ability: 'Dexterity',
                bonus: 2,
                ctx: { forcedMode: 'advantage' },
            },
            {
                label: 'hex weakness on Strength is inert for a monk Dexterity grapple',
                stats: monkStats,
                ce: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'Strength' },
                ability: 'Dexterity',
                bonus: 2,
                ctx: {},
            },
        ])('$label', async ({ stats, ce, ability, bonus, ctx }) => {
            const { hooks } = useGrappleRun({ playerStats: stats, conditionEffects: ce });
            await hooks.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(ability, bonus, ctx);
        });
    });

    describe('target contest-modifier fallback channels', () => {
        it.each([
            {
                label: 'computedStats.abilities is the first channel (+ sign formatting)',
                target: targetWith({ computedStats: { abilities: [{ name: 'Strength', bonus: 2 }] } }),
                popup: 'Grapple successful! (d20: 12 + 4 = 18) vs TargetCreature Athletics (+2). Target is now grappled.',
            },
            {
                label: 'target.abilities entries when computedStats is absent',
                target: targetWith({ abilities: [{ name: 'Strength', bonus: 3 }] }),
                popup: 'Grapple successful! (d20: 12 + 4 = 18) vs TargetCreature Athletics (+3). Target is now grappled.',
            },
            {
                label: 'inline ability_score_modifiers on an npc target',
                target: targetWith({ type: 'npc', ability_score_modifiers: { str: 4 } }),
                popup: 'Grapple successful! (d20: 12 + 4 = 18) vs TargetCreature Athletics (+4). Target is now grappled.',
            },
            {
                label: 'negative modifier formats with a minus sign',
                target: targetWith({ computedStats: { abilities: [{ name: 'Strength', bonus: -2 }] } }),
                popup: 'Grapple successful! (d20: 12 + 4 = 18) vs TargetCreature Athletics (-2). Target is now grappled.',
            },
        ])('$label', async ({ target, popup }) => {
            const { hooks } = useGrappleRun({ target });
            await hooks.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Grapple', description: popup });
        });

        it('bestiary lookup backs a monster target with no local ability data', async () => {
            const gmd = vi.fn().mockResolvedValue({ ability_score_modifiers: { str: 7 } });
            const { hooks, setRuntimeValue } = useGrappleRun({
                target: targetWith({ type: 'monster' }),
                total: 5,
                d20: 1,
                getMonsterData: gmd,
            });
            await hooks.handleGrappleAction();

            expect(gmd).toHaveBeenCalledWith('TargetCreature', expect.any(Array));
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'Grapple failed! (d20: 1 + 4 = 5) vs TargetCreature Athletics (+7). Target is not grappled.',
            });
            // Failure leg pinned in the popup above — nothing may be stamped.
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('player targets resolve locally and never hit the bestiary', async () => {
            // Bestiary would answer +99 if the player lane ever mis-routed there.
            const gmd = vi.fn().mockResolvedValue({ ability_score_modifiers: { str: 99 } });
            const { hooks, setRuntimeValue } = useGrappleRun({
                target: { name: 'ElfTest', conditions: [], type: 'player' },
                getMonsterData: gmd,
            });
            await hooks.handleGrappleAction();

            expect(gmd).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'Grapple successful! (d20: 12 + 4 = 18) vs ElfTest Athletics (+0). Target is now grappled.',
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('ElfTest', 'activeConditions', ['grappled'], campaignName);
        });
    });

    describe('grappled condition stamping (success leg)', () => {
        it.each([
            { label: 'fresh target gets grappled appended', stored: [], expected: ['grappled'] },
            { label: 'existing grappled is deduplicated, other conditions keep order', stored: ['grappled', 'poisoned'], expected: ['poisoned', 'grappled'] },
            { label: 'capitalised Grappled variant is replaced by canonical grappled', stored: ['Grappled'], expected: ['grappled'] },
            { label: 'undefined stored conditions are treated as empty', stored: undefined, expected: ['grappled'] },
        ])('$label', async ({ stored, expected }) => {
            const { hooks, setRuntimeValue } = useGrappleRun({ storedConditions: stored });
            await hooks.handleGrappleAction();

            expect(setRuntimeValue).toHaveBeenCalledWith('TargetCreature', 'activeConditions', expected, campaignName);
        });
    });
});
