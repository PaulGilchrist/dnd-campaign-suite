// @maintained-by-ai
/**
 * FAMILY SEAM MAP — race-rules cluster (5e half; mirrors ./2024.js lane #2041).
 * Lane ownership by aspect (see 2024-immunities.test.js header, cited not edited):
 *  - 5e-immunities (THIS FILE): getImmunities — CONSTANT-DRIVEN channel only:
 *    race.name/class.name equality checks + level thresholds, custom
 *    playerSummary.immunities merge/dedup/sort.
 *  - 5e-race: getRace (lookup, subrace merge)        - 5e-racial-bonus: getRacialBonus
 *  - 5e-resistances: getResistances (Dwarf/Elf/Halfling/Tiefling constants,
 *    subrace.damage_resistance)   - 5e-senses: getSenses   - 5e-traits: addTraits/getTraits
 *  - index.test.js owns index.js. Do not re-pin another lane's behavior here.
 *
 * MIRROR DELTAS vs 2024-immunities (pinned, do not inherit the 2024 claims):
 *  - 5e lanes THROW on missing race/class (unchained playerSummary.race.name /
 *    .class.name access), unlike 2024 which returns [] on {}.
 *  - No traits regex here (no /immunity to X/i, no Trance name branch) and NO
 *    runtime lineage channel — getImmunities never calls getRuntimeValue.
 *  - DISK: verified public/data/races.json contains ZERO "immune"/"immunity"
 *    occurrences, so this lane reads no disk at all; Dwarven Resilience poison
 *    is a RESISTANCE owned by the 5e-resistances lane, never an immunity.
 *  - Comparator: BOTH 5e branches use the same default ASCII sort() (when
 *    custom immunities are present deduplicateAndSort is called WITHOUT a
 *    sortKey → unique.sort(); else the final immunities.sort() is a no-op on
 *    already-alphabetical constants) — no insertion-order-vs-localeCompare
 *    asymmetry here, unlike 2024's localeCompare final sort. Custom entries
 *    are strings-only; object immunities stringify via default sort and are
 *    NOT part of the contract, so they are deliberately not pinned.
 *  - Level thresholds pinned to CODE values (Monk >9, Paladin >2), which are
 *    the app's contract even where they differ from book values.
 *
 * CONSUMERS (liveness): rulesFactory.js:105 and rules-senses.js:21 assign
 * output to playerStats.immunities; combat consumers compare case-insensitively,
 * so exact strings + deterministic order are the contract. Fully deterministic:
 * no mocks, no timers, no console noise.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

describe('raceRules 5e - getImmunities', () => {
  it('input contract: throws on missing race/class (unchained access); empty objects grant nothing', () => {
    expect(() => raceRules.getImmunities({})).toThrow(TypeError);
    expect(() => raceRules.getImmunities({ race: {} })).toThrow(TypeError); // class access unchained
    expect(raceRules.getImmunities({ race: {}, class: {} })).toEqual([]);
  });

  it('grants Magical Sleep for exact case-sensitive Elf name only; other races grant nothing', () => {
    expect(raceRules.getImmunities({ race: { name: 'Elf' }, class: {} })).toEqual(['Magical Sleep']);
    expect(raceRules.getImmunities({ race: { name: 'elf' }, class: {} })).toEqual([]); // strict ===
    expect(raceRules.getImmunities({ race: { name: 'Human' }, class: {} })).toEqual([]);
    // Dwarf's poison benefit is a resistance (5e-resistances lane), never an immunity
    expect(raceRules.getImmunities({ race: { name: 'Dwarf' }, class: {} })).toEqual([]);
  });

  it('applies class level thresholds Monk >9 and Paladin >2 (exact set, both sides of boundary)', () => {
    const human = { name: 'Human' };
    expect(raceRules.getImmunities({ race: human, class: { name: 'Monk' }, level: 9 })).toEqual([]);
    expect(raceRules.getImmunities({ race: human, class: { name: 'Monk' }, level: 10 }))
      .toEqual(['Disease', 'Poison']);
    expect(raceRules.getImmunities({ race: human, class: { name: 'Paladin' }, level: 2 })).toEqual([]);
    expect(raceRules.getImmunities({ race: human, class: { name: 'Paladin' }, level: 3 }))
      .toEqual(['Disease']);
    // missing level compares falsy without throwing; unrelated classes grant nothing
    expect(raceRules.getImmunities({ race: human, class: { name: 'Monk' } })).toEqual([]);
    expect(raceRules.getImmunities({ race: human, class: { name: 'Fighter', level: 20 } })).toEqual([]);
  });

  it('combines sources and merges custom immunities: exact-string dedup, ASCII sort lowercase-last', () => {
    expect(raceRules.getImmunities({ race: { name: 'Elf' }, class: { name: 'Paladin' }, level: 3 }))
      .toEqual(['Disease', 'Magical Sleep']);
    // Custom 'Disease' dedups exactly; 'fire' survives as distinct from 'Poison' and
    // sorts LAST under default ASCII sort (localeCompare would place it before
    // 'Magical Sleep' — this lane has no localeCompare branch; that's the 2024 lane).
    const input = {
      race: { name: 'Elf' },
      class: { name: 'Monk' },
      level: 10,
      immunities: ['Disease', 'fire', 'Poison'] // synthetic; 'Disease'/'Poison' dup of class
    };
    expect(raceRules.getImmunities(input)).toEqual(['Disease', 'Magical Sleep', 'Poison', 'fire']);
  });
});
