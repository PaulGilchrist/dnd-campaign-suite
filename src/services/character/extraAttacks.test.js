// @maintained-by-ai 2026-11-23
// Regression pins for bug-extra-attack-display-only-never-rolls: the press
// lane must consume the SAME Extra Attack count the sheet summary advertises,
// read from the canonical tables (public/data/classes.json — value nested
// under class_specific; public/data/2024/classes.json — top-level column).
// Fighter scales 1 extra @lv5, 2 @lv11, 3 @lv20 in BOTH rulesets — the app's
// canonical data puts the fourth attack at lv20, NOT lv17. Column-less
// single-Extra-Attack classes (5e Barbarian/Monk/Paladin/Ranger) keep the
// flat lv5 threshold.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getExtraAttacks, isExtraAttackEligibleRow } from './extraAttacks.js';

const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));

const table = (allClasses, name) => allClasses.find(c => c.name === name).class_levels;

/** Runtime-shape stats: getClass merges the full canonical class_levels table. */
const statsAt = (level, className, classLevels, rules) => ({
    name: `Test${className}`,
    level,
    ...(rules ? { rules } : {}),
    class: { name: className, class_levels: classLevels },
});

describe('getExtraAttacks — canonical Extra Attack count', () => {
    describe.each([
        ['5e', classes5e, (lv) => statsAt(lv, 'Fighter', table(classes5e, 'Fighter'))],
        ['2024', classes2024, (lv) => statsAt(lv, 'Fighter', table(classes2024, 'Fighter'), '2024')],
    ])('%s Fighter scales per table (1 extra @5, 2 @11, 3 @20)', (_ruleset, allClasses, makeStats) => {
        it.each([
            [1, 0], [4, 0], [5, 1], [10, 1], [11, 2], [17, 2], [18, 2], [19, 2], [20, 3],
        ])('level %i → %i extra', (level, expected) => {
            expect(getExtraAttacks(makeStats(level))).toBe(expected);
        });

        it('every level row of the canonical table round-trips exactly', () => {
            const rows = table(allClasses, 'Fighter');
            for (const row of rows) {
                const tableValue = row.extra_attacks ?? row.class_specific?.extra_attacks;
                expect(getExtraAttacks(makeStats(row.level))).toBe(tableValue ?? 0);
            }
        });
    });

    describe('single Extra Attack classes without a table column (5e)', () => {
        it.each([
            'Barbarian', 'Monk', 'Paladin', 'Ranger',
        ])('%s: 0 at lv4, 1 at lv5, still 1 at lv11/17/20', (className) => {
            const levels = table(classes5e, className);
            expect(getExtraAttacks(statsAt(4, className, levels))).toBe(0);
            expect(getExtraAttacks(statsAt(5, className, levels))).toBe(1);
            expect(getExtraAttacks(statsAt(11, className, levels))).toBe(1);
            expect(getExtraAttacks(statsAt(20, className, levels))).toBe(1);
        });

        it('lv6 5e paladin fixture (bug-file display) reads 1, matching the sheet', () => {
            expect(getExtraAttacks(statsAt(6, 'Paladin', table(classes5e, 'Paladin')))).toBe(1);
        });
    });

    describe('2024 table-backed classes', () => {
        it('lv18 2024 Battle Master (EvasiveFighter fixture) → 2 extra (3 attacks per press)', () => {
            expect(getExtraAttacks(statsAt(18, 'Fighter', table(classes2024, 'Fighter'), '2024'))).toBe(2);
        });

        it('2024 paladin lv20 (table row lacks the column) falls back to the flat rule', () => {
            expect(getExtraAttacks(statsAt(20, 'Paladin', table(classes2024, 'Paladin'), '2024'))).toBe(1);
        });

        it('2024 monk lv5 reads the table column (1)', () => {
            expect(getExtraAttacks(statsAt(5, 'Monk', table(classes2024, 'Monk'), '2024'))).toBe(1);
        });
    });

    describe('classes with no Extra Attack', () => {
        it.each([
            ['Wizard', classes5e, undefined],
            ['Sorcerer', classes5e, undefined],
            ['Wizard', classes2024, '2024'],
            ['Cleric', classes2024, '2024'],
        ])('%s lv10 (%s ruleset) → 0', (className, allClasses, rules) => {
            expect(getExtraAttacks(statsAt(10, className, table(allClasses, className), rules))).toBe(0);
        });

        it('missing class_levels on a Fighter reads 0 rather than fabricating swings', () => {
            expect(getExtraAttacks({ level: 6, class: { name: 'Fighter' } })).toBe(0);
        });

        it('empty playerStats reads 0', () => {
            expect(getExtraAttacks({})).toBe(0);
        });
    });
});

describe('isExtraAttackEligibleRow — Attack-action weapon rows only', () => {
    it('accepts melee/ranged/unarmed Action weapon rows', () => {
        expect(isExtraAttackEligibleRow({ name: 'Longsword', type: 'Action', weaponType: 'melee', damage: '1d8+3' })).toBe(true);
        expect(isExtraAttackEligibleRow({ name: 'Shortbow', type: 'Action', weaponType: 'ranged', damage: '1d6+2' })).toBe(true);
        expect(isExtraAttackEligibleRow({ name: 'Unarmed Strike', type: 'Action', weaponType: 'unarmed', damage: '1d4+3' })).toBe(true);
    });

    it('excludes Bonus Action rows (Flurry/off-hand carry their own bonus_attacks automation)', () => {
        expect(isExtraAttackEligibleRow({ name: 'Dagger', type: 'Bonus Action', weaponType: 'melee' })).toBe(false);
        expect(isExtraAttackEligibleRow({ name: 'Unarmed Strike', type: 'Bonus Action', weaponType: 'unarmed' })).toBe(false);
    });

    it('excludes save-based rows (no attack roll to repeat)', () => {
        expect(isExtraAttackEligibleRow({ name: 'Breath', type: 'Action', weaponType: 'melee', saveDc: 15 })).toBe(false);
    });

    it('excludes Psychic Blade rows (CLA-274 owns its action economy)', () => {
        expect(isExtraAttackEligibleRow({ name: 'Psychic Blade', type: 'Action', weaponType: 'melee', isPsychicBlade: true })).toBe(false);
    });

    it('excludes spell/action rows without a weapon type and garbage input', () => {
        expect(isExtraAttackEligibleRow({ name: 'Fire Bolt', type: 'Action', damage: '1d10+3' })).toBe(false);
        expect(isExtraAttackEligibleRow({ name: 'Hide', type: 'Action' })).toBe(false);
        expect(isExtraAttackEligibleRow(null)).toBe(false);
        expect(isExtraAttackEligibleRow(undefined)).toBe(false);
    });
});
