// @maintained-by-ai
// Lane: CANONICAL owner of IRV (immunities/resistances/vulnerabilities) dual-schema
// resolution (CLA-173). Consumers prove only their own seams, never resolution:
//   encounterToInitiative.test.js #1078 — wiring of resolved IRV onto assembled bytes
//   initiativeService.test.js #1079 — initiative roll/order wiring
//   knowEnemyHandler.test.js — Know Your Enemy popup display glue
//   npcStatBlockUtils.test.js #1159 — custom-NPC statblock invariant
//   monsterUtils.test.js — monster lookup/filter
// Old->new map: #1 Shadow + #2 Skeleton + new lowercase-split -> it.each legacy
// schema; #3 2024-preference -> it.each verbatim real entries (Apep pins
// damage_resistances preference, Dust Mephit pins damage_immunities/vulnerabilities/
// condition_immunities preference); #4 present-but-empty fallback + new
// condition_immunities-fallback branch (#967 untested before) -> it.each fallback;
// #5 no-data empty golden kept.
import { describe, it, expect } from 'vitest';

import { resolveMonsterIRV } from './monsterIrvUtils.js';

// Fixtures are IRV fields verbatim from real public/data/monsters.json entries (#977);
// only the CLA-207 hybrid is synthetic (historical corrupt shape cited in source).
const APEP = {
  name: 'Apep',
  damage_resistances: ['Acid', 'Cold', 'Lightning'],
  damage_immunities: ['Poison'],
  damage_vulnerabilities: [],
  condition_immunities: ['charmed', 'frightened', 'poisoned'],
  immunities: ['Poison'],
};

const DUST_MEPHIT = {
  name: 'Dust Mephit',
  damage_resistances: [],
  damage_immunities: ['poison'],
  damage_vulnerabilities: ['fire'],
  condition_immunities: ['poisoned'],
  immunities: [],
};

const CTHULHU = {
  name: 'Cthulhu',
  damage_resistances: ['Cold'],
  damage_immunities: [],
  damage_vulnerabilities: [],
  condition_immunities: ['charmed', 'frightened', 'poisoned'],
  immunities: [],
};

describe('resolveMonsterIRV', () => {
  // Legacy 2014 schema: no damage_* keys; condition names mixed into `immunities`.
  // Animated Object pins case-insensitive splitting (real lowercase statblock).
  it.each([
    {
      monster: {
        name: 'Shadow',
        resistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        immunities: ['Necrotic', 'Poison', 'Exhaustion', 'Frightened', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
        vulnerabilities: ['Radiant'],
      },
      expected: {
        immunities: ['Necrotic', 'Poison'],
        resistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        vulnerabilities: ['Radiant'],
        conditionImmunities: ['Exhaustion', 'Frightened', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
      },
    },
    {
      monster: {
        name: 'Skeleton',
        resistances: [],
        immunities: ['Poison', 'Exhaustion', 'Poisoned'],
        vulnerabilities: ['Bludgeoning'],
      },
      expected: {
        immunities: ['Poison'],
        resistances: [],
        vulnerabilities: ['Bludgeoning'],
        conditionImmunities: ['Exhaustion', 'Poisoned'],
      },
    },
    {
      monster: {
        name: 'Animated Object (Huge)',
        immunities: ['poison', 'psychic', 'charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
      },
      expected: {
        immunities: ['poison', 'psychic'],
        resistances: [],
        vulnerabilities: [],
        conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
      },
    },
  ])('splits legacy mixed immunities into damage vs condition lists — $name', ({ monster, expected }) => {
    expect(resolveMonsterIRV(monster)).toEqual(expected);
  });

  // 2024 schema: populated damage_* keys win; decoy/absent legacy values must not leak.
  it.each([
    {
      monster: APEP,
      expected: {
        immunities: ['Poison'],
        resistances: ['Acid', 'Cold', 'Lightning'],
        vulnerabilities: [],
        conditionImmunities: ['charmed', 'frightened', 'poisoned'],
      },
    },
    {
      monster: DUST_MEPHIT,
      expected: {
        immunities: ['poison'],
        resistances: [],
        vulnerabilities: ['fire'],
        conditionImmunities: ['poisoned'],
      },
    },
  ])('prefers populated damage_* keys over legacy keys — $name', ({ monster, expected }) => {
    expect(resolveMonsterIRV(monster)).toEqual(expected);
  });

  // Empty damage_* arrays are NOT data (CLA-207 shape): fall back to legacy split.
  // Cthulhu pins the second-tier fallback: legacy split yields no conditions AND
  // condition_immunities is populated -> condition_immunities is used.
  it.each([
    {
      monster: {
        name: 'CLA-207 hybrid',
        damage_immunities: [],
        damage_resistances: [],
        damage_vulnerabilities: [],
        immunities: ['Poison', 'Exhaustion'],
        resistances: ['Cold'],
        vulnerabilities: ['Radiant'],
      },
      expected: {
        immunities: ['Poison'],
        resistances: ['Cold'],
        vulnerabilities: ['Radiant'],
        conditionImmunities: ['Exhaustion'],
      },
    },
    {
      monster: CTHULHU,
      expected: {
        immunities: [],
        resistances: ['Cold'],
        vulnerabilities: [],
        conditionImmunities: ['charmed', 'frightened', 'poisoned'],
      },
    },
  ])('falls back to legacy split when damage_* present-but-empty — $name', ({ monster, expected }) => {
    expect(resolveMonsterIRV(monster)).toEqual(expected);
  });

  it('returns empty lists for a monster with no IRV data', () => {
    expect(resolveMonsterIRV({ name: 'Beast' })).toEqual({
      immunities: [],
      resistances: [],
      vulnerabilities: [],
      conditionImmunities: [],
    });
  });
});
