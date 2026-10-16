// @maintained-by-ai
/**
 * Lane: getResistances (5e.js) per FAMILY SEAM MAP in 2024-immunities.test.js
 * and 5e-immunities.test.js headers (cited, not edited) — CONSTANT-driven channel
 * (Dwarf/Elf/Halfling/Tiefling name equality), subrace.damage_resistance verbatim
 * push, nested Scout Halfling name check, custom playerSummary.resistances
 * merge/dedup/sort. Do not re-pin other lanes here.
 *
 * MIRROR DELTAS vs 2024-resistances (pinned from THIS lane's 5e.js:75-96,
 * do not inherit the 2024 claims):
 *  - 5e lane THROWS on missing race (unchained playerSummary.race.name); 2024
 *    returns [] on {}. No traits regex here ("Resistance to X" is 2024-only)
 *    and NO runtime lineage channel — getResistances never calls
 *    getRuntimeValue, so no mocks, no spies, no afterEach needed.
 *  - else-if chain order is the contract: Dwarf constant beats any
 *    subrace.damage_resistance, and subrace.damage_resistance shadows the
 *    Elf/Halfling/Tiefling constants (proven below, synthetic shadows).
 *  - Comparator: BOTH branches end in default ASCII sort() — deduplicateAndSort
 *    without a sortKey is unique.sort() (shared/deduplicateAndSort.js:11), so
 *    'Zebra' < 'apple'. No localeCompare here (unlike 2024's final sort).
 *
 * DISK ANCHOR: public/data/races.json (verified verbatim):
 *  - Dwarf race-level "damage_resistance": "Poison" is IGNORED (code reads
 *    subrace.damage_resistance only); the constant Dwarf→'Poison' matches the
 *    disk trait intent "resistance against poison damage" (lowercase 'against'
 *    wording — 5e differs from 2024 'Resistance to', and no regex reads it).
 *  - Dragonborn subraces (e.g. Black Dragonborn 'Acid') and Genasi subraces
 *    are the disk population of subrace.damage_resistance; Water Genasi's is
 *    an ARRAY ['Acid','Cold'] pushed VERBATIM (no flatten) — pinned.
 *  - Disk Halfling subraces are 'Lightfoot'/'Stout'; the code's poison grant
 *    name 'Scout Halfling' never appears on disk, so disk 'Stout Halfling'
 *    gets Frightened only (its poison trait text contributes nothing).
 *
 * CONSUMERS (liveness): rulesFactory.js:106 and rules-senses.js:22 assign the
 * output to playerStats.resistances; damage pipeline consumes it, so exact
 * strings + deterministic order are the contract (exact-set toEqual).
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

// public/data/races.json:169-170 — Dwarf trait, verbatim. This lane has no
// traits regex, so it must contribute nothing even when present on a summary.
const DWARVEN_RESILIENCE_5E = {
  name: 'Dwarven Resilience',
  description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.'
};

describe('raceRules 5e - getResistances', () => {
  it('input contract: throws on missing race (unchained access); nameless race and null subrace grant nothing', () => {
    expect(() => raceRules.getResistances({})).toThrow(TypeError);
    expect(() => raceRules.getResistances({ race: null })).toThrow(TypeError);
    expect(raceRules.getResistances({ race: {} })).toEqual([]);
    expect(raceRules.getResistances({ race: { name: 'Human', subrace: null } })).toEqual([]);
    // no traits-regex channel in this lane: disk-verbatim trait text grants nothing
    expect(raceRules.getResistances({ race: { name: 'Human', traits: [DWARVEN_RESILIENCE_5E] } })).toEqual([]);
  });

  it('grants constant resistances for exact case-sensitive race names only (exact set)', () => {
    expect(raceRules.getResistances({ race: { name: 'Dwarf' } })).toEqual(['Poison']);
    expect(raceRules.getResistances({ race: { name: 'Elf' } })).toEqual(['Charm']);
    expect(raceRules.getResistances({ race: { name: 'Halfling' } })).toEqual(['Frightened']);
    expect(raceRules.getResistances({ race: { name: 'Tiefling' } })).toEqual(['Fire']);
    // strict === : lowercase and disk subrace-style names fall through
    expect(raceRules.getResistances({ race: { name: 'elf' } })).toEqual([]);
    expect(raceRules.getResistances({ race: { name: 'High Elf' } })).toEqual([]);
    expect(raceRules.getResistances({ race: { name: 'Human' } })).toEqual([]);
  });

  it('Halfling nested subrace check: code-only name "Scout Halfling" adds Poison; disk Lightfoot/Stout do not', () => {
    expect(raceRules.getResistances({ race: { name: 'Halfling', subrace: { name: 'Scout Halfling' } } }))
      .toEqual(['Frightened', 'Poison']);
    // disk subraces verbatim: Stout's "some resistance to poison" trait grants
    // nothing here (name constant only, no trait parsing)
    expect(raceRules.getResistances({ race: { name: 'Halfling', subrace: { name: 'Stout Halfling' } } }))
      .toEqual(['Frightened']);
    expect(raceRules.getResistances({ race: { name: 'Halfling', subrace: { name: 'Lightfoot Halfling' } } }))
      .toEqual(['Frightened']);
  });

  it('subrace.damage_resistance: verbatim push, beats Dwarf constant, shadows Elf constant; race-level field ignored', () => {
    // branch 1 precedence: Dwarf constant wins over any subrace value
    expect(raceRules.getResistances({ race: { name: 'Dwarf', subrace: { damage_resistance: 'Fire' } } }))
      .toEqual(['Poison']);
    // race-level damage_resistance (disk Dwarf:253, Tiefling:1119) is never read
    expect(raceRules.getResistances({ race: { name: 'Human', damage_resistance: 'Poison' } })).toEqual([]);
    // else-if chain reality: subrace value shadows the Elf constant (synthetic shadow)
    expect(raceRules.getResistances({ race: { name: 'Elf', subrace: { damage_resistance: 'Fire' } } }))
      .toEqual(['Fire']);
    // disk subrace rows: Dragonborn/Genasi ride this channel verbatim
    expect(raceRules.getResistances({ race: { name: 'Dragonborn', subrace: { name: 'Black Dragonborn', damage_resistance: 'Acid' } } }))
      .toEqual(['Acid']);
    // disk array (Water Genasi) is pushed as-is — NOT flattened
    expect(raceRules.getResistances({ race: { name: 'Genasi', subrace: { name: 'Water Genasi', damage_resistance: ['Acid', 'Cold'] } } }))
      .toEqual([['Acid', 'Cold']]);
    // subrace present without damage_resistance falls through to the race constant
    expect(raceRules.getResistances({ race: { name: 'Elf', subrace: { name: 'High Elf' } } }))
      .toEqual(['Charm']);
  });

  it('merges custom playerSummary.resistances with dedup and default ASCII sort; empty/undefined keeps constants', () => {
    expect(raceRules.getResistances({ race: { name: 'Elf' }, resistances: ['Charm', 'Lightning'] }))
      .toEqual(['Charm', 'Lightning']); // Charm deduplicated to one
    // ASCII sort(), not localeCompare: uppercase precedes lowercase
    expect(raceRules.getResistances({ race: { name: 'Dwarf' }, resistances: ['apple', 'Zebra'] }))
      .toEqual(['Poison', 'Zebra', 'apple']);
    expect(raceRules.getResistances({ race: { name: 'Elf' }, resistances: [] })).toEqual(['Charm']);
    expect(raceRules.getResistances({ race: { name: 'Elf' }, resistances: undefined })).toEqual(['Charm']);
  });
});
