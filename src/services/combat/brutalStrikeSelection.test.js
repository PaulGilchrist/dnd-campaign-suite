// @maintained-by-ai
// CANON selection-priority lane for selectBrutalStrikeRiders (2024 Barbarian
// Brutal Strike riders): pure filter + sort, zero RNG — fixed candidate arrays
// in, exact output-name order pinned by hand ONCE per row (never re-run the
// comparator as oracle). Rule: keep attack_riders carrying a damageExpression on
// the 'strength_attack_hit_after_reckless' trigger; rank by dice count desc,
// then featureLevel desc (missing = 0); full ties keep input order (ES2019 sort
// stability). CLA-182 tie-break regression lives here as a sort-table row.
//
// Consumers (application is owned there, not re-driven here):
//   attackRollBonuses.js:230 — takes [0] and applies rider/options
//     → owned by steps/attackRollBonuses-brutalStrike.test.js (real selector)
//   automation/contextBuilder-sync.js:371 — offer builder ([0])
//     → owned by automation/contextBuilder-sync.brutal-strike.test.js (mocked here-side)
//   char-sheet/useCharActionsAttackHandlers.js:16 — full array as passives;
//     lv9→lv13 chooser payload bytes
//     → owned by useCharActionsAttackHandlers.improvedBrutalStrike.test.js
//
// old→new map: old t1+t2 (tie-break, order-insensitive) → sort rows 1-2;
// old t3 (dice>level) → sort rows 1 + 3-4; old t4 (filter) → filter row 1-2;
// old t5 (empty input) → filter rows 3-4.
import { describe, it, expect } from 'vitest';
import { selectBrutalStrikeRiders } from './brutalStrikeSelection.js';

const lv9Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike',
    featureLevel: 9,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' },
    ],
};

const lv13Rider = {
    type: 'attack_rider',
    name: 'Improved Brutal Strike',
    featureLevel: 13,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' },
        { name: 'Staggering Blow', effect: 'disadvantage_on_next_save', noOpportunityAttacks: true },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
};

const lv17Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike (Level 17)',
    featureLevel: 17,
    damageExpression: '2d10',
    trigger: 'strength_attack_hit_after_reckless',
    maxEffects: 2,
    options: lv13Rider.options,
};

function brutalRider(name, damageExpression, featureLevel) {
    return { type: 'attack_rider', name, damageExpression, featureLevel, trigger: 'strength_attack_hit_after_reckless' };
}

describe('selectBrutalStrikeRiders ordering', () => {
    it.each([
        // Full trio: dice count primary, featureLevel breaks the 1d10 tie (CLA-182);
        // same output pinned for both input orderings — order-insensitivity is falsifiable.
        {
            title: 'ranks 2d10 first, then lv13 over lv9 on the 1d10 tie',
            input: [lv9Rider, lv13Rider, lv17Rider],
            expected: ['Brutal Strike (Level 17)', 'Improved Brutal Strike', 'Brutal Strike'],
        },
        {
            title: 're-sorts a reverse-ordered trio to the same rank',
            input: [lv17Rider, lv13Rider, lv9Rider],
            expected: ['Brutal Strike (Level 17)', 'Improved Brutal Strike', 'Brutal Strike'],
        },
        // Dice count is parsed numerically: a string compare would wrongly rank
        // '2d10' above '10d6'; more dice wins even with no featureLevel at all.
        {
            title: 'numeric dice count beats string order and a higher featureLevel',
            input: [brutalRider('Heavy Blow', '10d6', undefined), brutalRider('Skilled Blow', '2d10', 20)],
            expected: ['Heavy Blow', 'Skilled Blow'],
        },
        // featureLevel defaults to 0 on a dice tie (a missing level sinks last).
        {
            title: 'missing featureLevel sinks below present level on a dice tie',
            input: [brutalRider('No Level', '1d10', undefined), brutalRider('Level 1', '1d10', 1)],
            expected: ['Level 1', 'No Level'],
        },
        // Perfect ties (same dice, same level) keep input order — sort stability,
        // both permutations pinned so the tie contract is falsifiable.
        {
            title: 'perfect tie keeps input order',
            input: [brutalRider('Rider A', '2d6', 9), brutalRider('Rider B', '2d6', 9)],
            expected: ['Rider A', 'Rider B'],
        },
        {
            title: 'perfect tie keeps reversed input order too',
            input: [brutalRider('Rider B', '2d6', 9), brutalRider('Rider A', '2d6', 9)],
            expected: ['Rider B', 'Rider A'],
        },
    ])('$title', ({ input, expected }) => {
        expect(selectBrutalStrikeRiders(input).map(r => r.name)).toEqual(expected);
    });
});

describe('selectBrutalStrikeRiders candidate filtering', () => {
    it.each([
        [
            'keeps only attack_riders with dice on the Brutal Strike trigger',
            [
                { type: 'attack_rider', name: 'Wrong Trigger', damageExpression: '1d10', trigger: 'hit' },
                { type: 'damage_bonus', name: 'Wrong Type', damageExpression: '1d10', trigger: 'strength_attack_hit_after_reckless' },
                { type: 'attack_rider', name: 'No Dice', trigger: 'strength_attack_hit_after_reckless' },
                lv9Rider,
            ],
            ['Brutal Strike'],
        ],
        ['skips null and undefined entries', [null, undefined, lv9Rider], ['Brutal Strike']],
        ['returns [] for undefined input', undefined, []],
        ['returns [] for empty input', [], []],
    ])('%s', (_title, input, expected) => {
        expect(selectBrutalStrikeRiders(input).map(r => r.name)).toEqual(expected);
    });
});
