// @maintained-by-ai
// Owns: unit canon for the two pure helpers in buffApplier.js — applyAbilityScoreIncreases
// (additive featIncrease accumulation, case-insensitive name match, 'any'/unnamed skip) and
// mergeDeduplicated (case-insensitive dedupe, append-not-replace, create-key-on-missing).
// Delegated here by consumers: raceBuffService.test.js ("dedup/append/create semantics live
// canonically in buffApplier.test.js"), useWizardFeatBuffs.test.js:8/110, and
// featBuffService.applyFeatBuffsToFormData.test.js:33/57 (real mergeDeduplicated through wiring).
// Input provenance: increase objects come from featBuffService pushAnyAbilityIncrease/ASI parse
// (featBuffService.js:33-41/147-169), which emits the sentinel lowercase 'any' verbatim —
// that is why the guard's case-sensitive `!== 'any'` is safe in production; the unit test
// pins both the sentinel skip AND the uppercase-'ANY' quirk (passes guard, matches via the
// case-insensitive find). Language fixtures are REAL names from public/data/languages.json.
// No targetEffects written here: outputs are ability.featIncrease:number and string[] only —
// byte-identical to the inline twin at featBuffService.js:638-646 (shape cross-validated).
// #1534 RESOLVED (2026-10-23): this export was a DEAD-EXPORT with a drift-risk inline twin at
// featBuffService.js:638-646; the twin was deleted and the LIVE writer now imports THIS canonical
// home (no cycle: buffApplier.js imports nothing; featBuffService already depended on mergeDeduplicated).
// No timers, no mocks: pure module, nothing to mock (never mock the unit under test).
// Kill matrix (analytic; mutants of buffApplier.js vs tests below):
//   drop !abilities||!increases guard -> T1 TypeError | &&-flip -> T1 TypeError
//   drop inc.name&& guard -> T2 undefined.toLowerCase TypeError
//   drop !=='any' -> T3 'Any' gets bumped | drop either .toLowerCase (match side) -> T4 misses
//   '=' not '+(||0)' -> T4 Strength/Wisdom wrong | drop ||0 -> T4 NaN | sign flip -> T4 Wisdom
//   drop !newItems guard -> T5 TypeError | drop existing.add -> T5/T6 dup appends
//   drop toLowerCase (target-map or item-has side) -> T5 appends cased dup
//   replace-not-push / drop target[key]||[] -> T6 crash or lost sibling
//   drop length===0 guard -> semantically equivalent no-op (forEach over []); declared unkillable.
import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
} from './buffApplier.js';

describe('applyAbilityScoreIncreases', () => {
  it('returns undefined and mutates nothing when either argument is falsy', () => {
    expect(applyAbilityScoreIncreases).toHaveLength(2);
    const inc = [{ name: 'Strength', amount: 2 }];
    for (const abilities of [null, undefined]) {
      // null/undefined abilities with VALID increases: kills guard removal and &&-flip
      expect(applyAbilityScoreIncreases(abilities, inc)).toBeUndefined();
    }
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    expect(applyAbilityScoreIncreases(abilities, null)).toBeUndefined();
    expect(applyAbilityScoreIncreases(abilities, undefined)).toBeUndefined();
    expect(abilities).toStrictEqual([{ name: 'Strength', featIncrease: 0 }]);
  });

  it('skips the "any" sentinel and unnamed increases; pins case-sensitive sentinel quirk', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Any', featIncrease: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'any', amount: 5 },   // sentinel: guard-skipped (without the guard it would
                                     // match ability 'Any' via the case-insensitive find)
      { amount: 5 },                // missing name === undefined name at runtime (redundant
                                     // twin folded): without inc.name&& -> TypeError
      { name: '', amount: 5 },     // falsy name, skipped by same guard
      { name: 'ANY', amount: 3 },  // QUIRK: guard is case-sensitive so 'ANY' passes it and
                                     // matches 'Any' case-insensitively. Upstream emits lowercase
                                     // 'any' only (featBuffService.js:35), so prod is safe.
    ]);
    expect(abilities).toStrictEqual([
      { name: 'Strength', featIncrease: 0 },
      { name: 'Any', featIncrease: 3 },
    ]);
  });

  it('accumulates additively into featIncrease, case-insensitive, defaulting missing to 0, skipping unmatched', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Intelligence', featIncrease: 4 },
      { name: 'Wisdom' },
    ];
    const originalRef = abilities;
    const result = applyAbilityScoreIncreases(abilities, [
      { name: 'strength', amount: 2 },    // lowercase match
      { name: 'Strength', amount: 3 },    // second hit accumulates: 2+3=5 (kills replace)
      { name: 'DEXTERITY', amount: 1 },   // uppercase trail matches
      { name: 'intelligence', amount: 1 }, // 4+1=5
      { name: 'Wisdom', amount: 2 },      // absent featIncrease -> (||0)+2 (kills NaN mutant)
      { name: 'WISDOM', amount: -1 },     // negatives sum: 2-1=1 (kills sign flips)
      { name: 'Constitution', amount: 5 }, // no such ability in table -> silently skipped
    ]);
    expect(result).toBeUndefined();
    expect(abilities).toBe(originalRef); // mutated in place, never replaced
    expect(abilities).toStrictEqual([
      { name: 'Strength', featIncrease: 5 },
      { name: 'Dexterity', featIncrease: 1 },
      { name: 'Intelligence', featIncrease: 5 },
      { name: 'Wisdom', featIncrease: 1 },
    ]);
  });
});

describe('mergeDeduplicated', () => {
  it('returns undefined and leaves target untouched when newItems is null, undefined, or empty', () => {
    expect(mergeDeduplicated).toHaveLength(3);
    const target = { languages: ['Common'], name: 'Thorndar' };
    for (const newItems of [null, undefined, []]) {
      expect(mergeDeduplicated(target, 'languages', newItems)).toBeUndefined();
      expect(target).toStrictEqual({ languages: ['Common'], name: 'Thorndar' });
    }
  });

  it('appends only unseen items, case-insensitively, keeping existing casing and mutating in place', () => {
    const target = { languages: ['Common', 'elvish'] };
    const arrRef = target.languages;
    const result = mergeDeduplicated(target, 'languages', [
      'Common',   // dup of existing, differing casing -> skipped (existing casing wins)
      'Elvish',   // dup of lowercase existing -> skipped
      'Dwarvish', // new -> appended
      'ELVISH',   // dup within newItems vs 'Elvish' above -> skipped (kills missing toLowerCase)
      'giant',    // new -> appended with its own casing
      '',         // empty string is a DISTINCT value -> appended once
      '',         // deduped against the first '' via per-push existing.add
    ]);
    expect(result).toBeUndefined();
    expect(target.languages).toBe(arrRef); // push-in-place, array never replaced
    expect(target.languages).toStrictEqual(['Common', 'elvish', 'Dwarvish', 'giant', '']);
  });

  it('creates the key array when absent, deduping within newItems, touching no sibling keys', () => {
    const target = { name: 'Thorndar' };
    mergeDeduplicated(target, 'languages', ['Elvish', 'elvish', 'Common', 'Elvish']);
    expect(target).toStrictEqual({
      name: 'Thorndar',
      languages: ['Elvish', 'Common'], // first-occurrence casing kept; no fabricated keys
    });
  });
});
