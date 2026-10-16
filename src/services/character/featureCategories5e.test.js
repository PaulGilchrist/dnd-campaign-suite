// Factory + 5e disk-anchor lane for featureCategories.js (categories5e half).
// featureCategories.js is DATA, not logic: getCategories(ruleset) is a
// same-reference ternary selector (featureCategories.js:241-243) consumed by
//   1. categorization engines (rules.js, classRules.js, classRules2024.js,
//      race-rules/5e.js, race-rules/2024.js) — reroute feature rows by EXACT
//      name match against actions/bonusActions/reactions/characterAdvancement.
//   2. display filters (CharActions/CharBonusActions/CharReactions/
//      CharSpecialActions/CharCharacterAdvancement) — featuresToIgnore hides
//      rows by EXACT name match.
// This file pins factory identity/selection and every categories5e row
// against the real 5e disk data (classes.json feature rows, races.json traits,
// feats.json names) so disk↔constant drift fails here, not silently on the
// character sheet. categories2024 row fidelity is owned by
// featureCategories2024.test.js (disk-anchor lane) — not duplicated here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { categories5e, getCategories } from './featureCategories.js';

const classes5e = JSON.parse(readFileSync('public/data/classes.json', 'utf8'))
const races5e = JSON.parse(readFileSync('public/data/races.json', 'utf8'))
const feats5e = JSON.parse(readFileSync('public/data/feats.json', 'utf8'))

// Every feature-row name the 5e engines can emit: class features, class_levels
// features (incl. class_specific), subclass headers + subclass level features,
// race/subrace traits, feat names.
const diskRowNames = new Set();
const addRows = (items) => {
    for (const item of (items || [])) {
        const name = typeof item === 'string' ? item : item?.name;
        if (typeof name === 'string' && name) diskRowNames.add(name);
    }
};
for (const cls of classes5e) {
    addRows(cls.features);
    for (const level of (cls.class_levels || [])) {
        addRows(level.features);
        addRows(level.class_specific?.features);
    }
    for (const sc of (cls.subclasses || [])) {
        addRows([sc]);
        addRows(sc.features);
        for (const level of (sc.class_levels || [])) {
            addRows(level.features);
            addRows(level.class_specific?.features);
        }
    }
}
for (const race of races5e) {
    addRows(race.traits);
    for (const sub of (race.subraces || [])) addRows(sub.traits);
}
for (const feat of feats5e) addRows([feat]);

// Documented dead ignore row: 5e ASI is the numeric ability_score_bonuses
// field on disk — no named "Ability Score Improvement" feature row exists in
// public/data/classes.json, and no 5e production lane synthesizes one (grep
// across src/ minus tests: only this constant). The row is an inert display
// filter for imported 5e sheets that may carry ASI text rows; if 5e disk or
// generation ever emits a real ASI row, remove this allowance. (2024 ASI rows
// are live and owned by featureCategories2024.test.js.)
const KNOWN_DEAD_IGNORE_ROWS = ['Ability Score Improvement'];

const LIST_NAMES = ['featuresToIgnore', 'actions', 'bonusActions', 'reactions', 'characterAdvancement'];

// 5e subclass-selection header naming convention (vs 2024's uniform
// "<Class> Subclass"): archetype-style proper nouns on class_levels rows.
const SELECTION_RE = /(Archetype|Circle|Tradition|Path|Oath|Origin|College|Patron|Domain|Order)$/;
const diskSelectionRows = new Set();
for (const name of diskRowNames) {
    if (SELECTION_RE.test(name)) diskSelectionRows.add(name);
}

describe('featureCategories5e', () => {
    describe('getCategories factory (same-reference selection)', () => {
        it('returns the categories5e module object itself for "5e" (no clone)', () => {
            expect(getCategories('5e')).toBe(categories5e);
            expect(getCategories('5e')).toBe(getCategories('5e'));
        });

        it('returns the categories2024 module object itself for "2024" (no clone)', () => {
            expect(getCategories('2024')).toBe(getCategories('2024'));
        });

        it('falls back to categories5e for any non-"2024" ruleset (source ternary)', () => {
            // featureCategories.js:242 — strict `ruleset === '2024'` ternary;
            // rules.js calls getCategories(playerStats.rules || '5e'), so a
            // missing/unknown rules field MUST land on the 5e constant.
            for (const ruleset of ['invalid', '', '2014', '2024e', '5E', undefined, null]) {
                expect(getCategories(ruleset), `ruleset=${JSON.stringify(ruleset)}`).toBe(categories5e);
            }
        });

        it('selects two distinct objects for the two rulesets (discrimination)', () => {
            expect(getCategories('2024')).not.toBe(getCategories('5e'));
            expect(getCategories('2024').featuresToIgnore).not.toEqual(getCategories('5e').featuresToIgnore);
        });

        it('the selected 5e object exposes exactly the five lane keys consumers index into', () => {
            expect(Object.keys(getCategories('5e')).sort()).toEqual([...LIST_NAMES].sort());
        });
    });

    describe('row shape fidelity', () => {
        it.each(LIST_NAMES)('%s is an array of non-empty trimmed strings with no duplicates', (key) => {
            const list = categories5e[key];
            expect(Array.isArray(list)).toBe(true);
            for (const entry of list) {
                expect(typeof entry).toBe('string');
                expect(entry.trim()).toBe(entry);
                expect(entry.length).toBeGreaterThan(0);
            }
            expect(list).toHaveLength(new Set(list).size);
        });
    });

    describe('constant → disk fidelity (no stale/typo rows)', () => {
        it.each(LIST_NAMES)('every %s name resolves to a real 5e disk row', (key) => {
            const deadAllowlist = key === 'featuresToIgnore' ? KNOWN_DEAD_IGNORE_ROWS : [];
            const orphans = categories5e[key].filter(name => !diskRowNames.has(name) && !deadAllowlist.includes(name));
            expect(orphans, `rows not found on disk (drift or typo): ${JSON.stringify(orphans)}`).toEqual([]);
        });

        it('the redirect lanes are exact disk-anchored sets', () => {
            // Avenging Angel: Paladin/Vengeance subclass L20 feature row (actions reroute).
            const vengeance = classes5e.find(c => c.name === 'Paladin').subclasses.find(sc => sc.name === 'Vengeance');
            expect(vengeance.class_levels.find(l => l.level === 20).features.some(f => f.name === 'Avenging Angel')).toBe(true);
            expect(categories5e.actions).toEqual(['Avenging Angel']);

            // Bend Luck: Sorcerer/Wild Magic subclass L6 feature row (reactions reroute,
            // dispatched by reactionBonusHandler automation type).
            const wildMagic = classes5e.find(c => c.name === 'Sorcerer').subclasses.find(sc => sc.name.includes('Wild Magic'));
            expect(wildMagic.class_levels.find(l => l.level === 6).features.some(f => f.name === 'Bend Luck')).toBe(true);
            expect(categories5e.reactions).toEqual(['Bend Luck']);

            // Mystic Arcanum: Warlock L11/13/15/17 class feature rows (advancement reroute).
            const warlockLevels = classes5e.find(c => c.name === 'Warlock').class_levels
                .filter(l => (l.features || []).some(f => f.name === 'Mystic Arcanum'))
                .map(l => l.level);
            expect(warlockLevels).toEqual([11, 13, 15, 17]);
            expect(categories5e.characterAdvancement).toEqual(['Mystic Arcanum']);

            // bonusActions is intentionally empty — every 2024-era bonus-action
            // reroute row in the constant is commented out (featureCategories.js:61-76).
            expect(categories5e.bonusActions).toEqual([]);
        });
    });

    describe('subclass-selection coverage (5e archetype naming lane)', () => {
        it('featuresToIgnore covers exactly the 9 disk selection headers it owns', () => {
            const covered = [...diskSelectionRows].filter(n => categories5e.featuresToIgnore.includes(n)).sort();
            expect(covered).toEqual([
                'Divine Domain', 'Druid Circle', 'Martial Archetype', 'Monastic Tradition',
                'Primal Path', 'Ranger Archetype', 'Roguish Archetype', 'Sacred Oath', 'Sorcerous Origin',
            ]);
        });

        it('disk selection rows left uncovered are exactly the 3 documented pass-throughs', () => {
            // Bard College / Arcane Tradition / Otherworldly Patron stay visible
            // (their characterAdvancement reroute rows are deliberately commented
            // out, featureCategories.js:91/93/119). A NEW selection row on disk
            // must be triaged here — ignored, rerouted, or added to this list.
            const uncovered = [...diskSelectionRows].filter(n => !categories5e.featuresToIgnore.includes(n)).sort();
            expect(uncovered).toEqual(['Arcane Tradition', 'Bard College', 'Otherworldly Patron']);
        });
    });

    describe('active rows stay visible', () => {
        it('does not hide active clickable class features (present on disk)', () => {
            const activeFeatures = ['Sneak Attack', 'Evasion', 'Uncanny Dodge', 'Second Wind', 'Action Surge', 'Martial Arts'];
            for (const name of activeFeatures) {
                expect(diskRowNames.has(name), `"${name}" should still exist on 5e disk`).toBe(true);
                expect(categories5e.featuresToIgnore).not.toContain(name);
            }
        });

        it('leaves passive class/race rows unhidden (commented reroutes stay visible)', () => {
            const visibleRows = ['Fighting Style', 'Favored Enemy', 'Natural Explorer', "Ranger's Companion"];
            for (const name of visibleRows) {
                expect(diskRowNames.has(name), `"${name}" should still exist on 5e disk`).toBe(true);
                expect(categories5e.featuresToIgnore).not.toContain(name);
            }
        });
    });

    describe('lane separation (exact-match engines assume disjoint sets)', () => {
        it('featuresToIgnore does not overlap the action-like lanes', () => {
            const actionLike = new Set([...categories5e.actions, ...categories5e.bonusActions, ...categories5e.reactions, ...categories5e.characterAdvancement]);
            const overlap = categories5e.featuresToIgnore.filter(name => actionLike.has(name));
            expect(overlap).toEqual([]);
        });

        it('the four action-like lanes are mutually disjoint', () => {
            const all = [...categories5e.actions, ...categories5e.bonusActions, ...categories5e.reactions, ...categories5e.characterAdvancement];
            expect(all).toHaveLength(new Set(all).size);
        });
    });
});
