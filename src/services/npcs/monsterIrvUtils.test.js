// @maintained-by-ai 2026-10-20
// Lane: CANON owner of IRV (immunities/resistances/vulnerabilities/condition
// immunities) resolution. Single-schema since the no-legacy sweep
// (2026-11-16): every monsters.json row carries the canonical split keys
// (damage_immunities / damage_resistances / damage_vulnerabilities /
// condition_immunities); the CLA-207 mixed-`immunities` shape and its
// runtime split were retired with the in-disk migration.
// Consumers prove only their own seams, never resolution:
//   encounterToInitiative.test.js #1078 — wiring of resolved IRV onto assembled bytes
//   initiativeService.test.js #1079 — initiative roll/order wiring
//   knowEnemyHandler.test.js — Know Your Enemy popup display glue
//   npcStatBlockUtils.test.js #1159 — custom-NPC statblock invariant
//   monsterUtils.test.js — monster lookup/filter
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { resolveMonsterIRV } from './monsterIrvUtils.js';

const monsters = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/data/monsters.json'), 'utf-8'),
);

describe('resolveMonsterIRV — canonical split-key read', () => {
  // Fixtures are IRV fields verbatim from real public/data/monsters.json entries.
  it.each([
    {
      name: 'Apep',
      expected: {
        immunities: ['Poison'],
        resistances: ['Acid', 'Cold', 'Lightning'],
        vulnerabilities: [],
        conditionImmunities: ['charmed', 'frightened', 'poisoned'],
      },
    },
    {
      name: 'Dust Mephit',
      expected: {
        immunities: ['poison'],
        resistances: [],
        vulnerabilities: ['fire'],
        conditionImmunities: ['poisoned'],
      },
    },
    {
      name: 'Shadow',
      expected: {
        immunities: ['Necrotic', 'Poison'],
        resistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        vulnerabilities: ['Radiant'],
        conditionImmunities: ['Exhaustion', 'Frightened', 'Grappled', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
      },
    },
  ])('reads the split keys verbatim — $name', ({ name, expected }) => {
    const monster = monsters.find(m => m.name === name);
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

  it('every monsters.json row is canonical: no mixed `immunities`/`resistances`/`vulnerabilities` keys survive', () => {
    for (const monster of monsters) {
      expect(monster.immunities).toBeUndefined();
      expect(monster.resistances).toBeUndefined();
      expect(monster.vulnerabilities).toBeUndefined();
    }
  });
});
