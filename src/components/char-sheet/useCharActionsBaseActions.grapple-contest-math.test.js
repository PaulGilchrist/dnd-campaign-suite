// @maintained-by-ai
// BA-002 regression lane: grapple CONTEST MATH at the hook seam — the attacker's
// check-bonus channels (listed skill bonus vs STR+PB derivation, Jack of All Trades
// half-bonus rules, exhaustion penalty) and the target's higher-of-Athletics-or-
// Acrobatics contest resolution across each combat-summary data shape, with byte-exact
// popup/log pins. Gate, adv/disadv context, condition-stamping and popup-format lanes
// are owned by useCharActionsGrappleAction.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import {
    createHooks,
    mockRollAbilityCheck,
    mockSetPopupHtml,
    mockAddEntry,
    campaignName,
    basePlayerStats,
} from './useCharActionsBaseActions.test-utils.js';

// lv20 Barbarian: STR +5 + PB +6 = +11 (was bare +5 before the BA-002 fix).
const lv20AthleticsBarbarian = {
    ...basePlayerStats,
    name: 'DraconicDragon',
    level: 20,
    class: { name: 'Barbarian' },
    skillProficiencies: ['Athletics'],
    abilities: [
        { name: 'Strength', bonus: 5, skills: [{ name: 'Athletics', bonus: 11 }] },
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Acrobatics', bonus: 2 }] },
        { name: 'Wisdom', bonus: 1, skills: [] },
        { name: 'Constitution', bonus: 3, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
    ],
};

const noListedSkills = {
    ...lv20AthleticsBarbarian,
    abilities: lv20AthleticsBarbarian.abilities.map(a => ({ ...a, skills: [] })),
    skills: [],
};

function grv(total, d20) {
    return vi.fn((charKey, key) => {
        if (key === 'lastAttack') return { total, d20 };
        return undefined;
    });
}

function banditTarget(overrides = {}) {
    return {
        name: 'Bandit 1',
        conditions: [],
        type: 'monster',
        ability_score_modifiers: { str: 0, dex: 1 },
        ...overrides,
    };
}

function csWith(attackerName, target) {
    return {
        creatures: [
            { name: attackerName, targetName: target.name },
            target,
        ],
    };
}

// Builds hook deps for a grapple run, exposing setRuntimeValue so callers can
// pin (or positively gate) condition-stamp behavior on the outcome leg.
// Note: targets carrying ability_score_modifiers/skills inline never hit
// getMonsterData (resolveTargetAbilityMod short-circuits on target-local data),
// so no dead getMonsterData mocks are supplied below.
function grappleHarness({ playerStats, target, total = 28, d20 = 17, exhaustionPenalty = 0 }) {
    const setRuntimeValue = vi.fn().mockResolvedValue(undefined);
    return {
        setRuntimeValue,
        ...createHooks({
            playerStats,
            loadCombatSummary: () => Promise.resolve(csWith(playerStats.name, target ?? banditTarget())),
            getRuntimeValue: grv(total, d20),
            setRuntimeValue,
            exhaustionPenalty,
        }),
    };
}

describe('BA-002 grapple contest math', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('attacker check-bonus channels', () => {
        it.each([
            {
                name: 'listed Athletics skill bonus channel wins over the ability-mod fallback',
                stats: { ...lv20AthleticsBarbarian, skillProficiencies: [] },
                expected: 11,
            },
            {
                name: 'STR + PB derived from skillProficiencies when no listed skill bonus exists',
                stats: noListedSkills,
                expected: 11,
            },
            {
                name: 'Jack of All Trades half bonus does not stack on top of Athletics proficiency',
                stats: { ...lv20AthleticsBarbarian, automation: { passives: [{ type: 'jack_of_all_trades' }] } },
                expected: 11,
            },
            {
                name: 'Jack of All Trades adds half PB when not proficient (lv5: STR 4 + floor(3/2))',
                stats: { ...basePlayerStats, automation: { passives: [{ type: 'jack_of_all_trades' }] } },
                expected: 5,
            },
            {
                name: 'bare STR modifier when neither proficient nor Jack of All Trades (lv5 STR +4)',
                stats: basePlayerStats,
                expected: 4,
            },
            {
                name: 'exhaustion penalty subtracts from the contest bonus (11 - 2)',
                stats: lv20AthleticsBarbarian,
                exhaustionPenalty: 2,
                expected: 9,
            },
        ])('$name', async ({ stats, exhaustionPenalty = 0, expected }) => {
            const hooks = grappleHarness({ playerStats: stats, exhaustionPenalty });
            await useCharActionsBaseActions(hooks).handleGrappleAction();

            // No conditionEffects in these fixtures: context must stay empty.
            expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', expected, {});
        });
    });

    describe('target contest resolution — higher of Athletics-or-Acrobatics per data shape', () => {
        it.each([
            {
                name: 'raw monster ability_score_modifiers picks the higher Acrobatics (+1) over Athletics (+0), not static STR',
                target: banditTarget(),
                popup: 'Grapple successful! (d20: 17 + 11 = 28) vs Bandit 1 Acrobatics (+1). Target is now grappled.',
                log: 'Strength (Athletics) check: 28 (d20: 17 + 11) vs Bandit 1 Acrobatics (+1) contest — Success. Target is now grappled.',
            },
            {
                name: 'listed monster skills dict beats raw ability modifiers',
                target: {
                    name: 'Ogre 1',
                    conditions: [],
                    type: 'monster',
                    skills: { Athletics: { modifier: 7 }, Acrobatics: { modifier: -1 } },
                },
                popup: 'Grapple successful! (d20: 17 + 11 = 28) vs Ogre 1 Athletics (+7). Target is now grappled.',
                log: 'Strength (Athletics) check: 28 (d20: 17 + 11) vs Ogre 1 Athletics (+7) contest — Success. Target is now grappled.',
            },
            {
                name: 'player target resolves contest from computedStats skills array',
                target: {
                    name: 'ElfTest',
                    conditions: [],
                    type: 'player',
                    computedStats: {
                        skills: [{ name: 'Acrobatics', bonus: 7 }],
                        abilities: [{ name: 'Strength', bonus: 1 }],
                    },
                },
                popup: 'Grapple successful! (d20: 17 + 11 = 28) vs ElfTest Acrobatics (+7). Target is now grappled.',
                log: 'Strength (Athletics) check: 28 (d20: 17 + 11) vs ElfTest Acrobatics (+7) contest — Success. Target is now grappled.',
            },
        ])('$name', async ({ target, popup, log }) => {
            const hooks = grappleHarness({ playerStats: lv20AthleticsBarbarian, target });
            await useCharActionsBaseActions(hooks).handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Grapple', description: popup });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'DraconicDragon',
                abilityName: 'Grapple',
                description: log,
            });
        });
    });

    describe('outcome boundary — the grappler must strictly exceed the contest total', () => {
        it.each([
            {
                name: 'tie (roll 12 vs contest 12) resolves as failure and stamps nothing',
                target: {
                    name: 'Ogre 1',
                    conditions: [],
                    type: 'monster',
                    skills: { Athletics: { modifier: 12 } },
                },
                popup: 'Grapple failed! (d20: 1 + 11 = 12) vs Ogre 1 Athletics (+12). Target is not grappled.',
                log: 'Strength (Athletics) check: 12 (d20: 1 + 11) vs Ogre 1 Athletics (+12) contest — Failure. Target is not grappled.',
            },
            {
                name: 'loss (roll 12 vs contest +15) resolves as failure and stamps nothing',
                target: banditTarget({ ability_score_modifiers: { str: 15, dex: 1 } }),
                popup: 'Grapple failed! (d20: 1 + 11 = 12) vs Bandit 1 Athletics (+15). Target is not grappled.',
                log: 'Strength (Athletics) check: 12 (d20: 1 + 11) vs Bandit 1 Athletics (+15) contest — Failure. Target is not grappled.',
            },
        ])('$name', async ({ target, popup, log }) => {
            const hooks = grappleHarness({ playerStats: lv20AthleticsBarbarian, target, total: 12, d20: 1 });
            await useCharActionsBaseActions(hooks).handleGrappleAction();
            const setRuntimeValue = hooks.setRuntimeValue;

            expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Grapple', description: popup });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'DraconicDragon',
                abilityName: 'Grapple',
                description: log,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
