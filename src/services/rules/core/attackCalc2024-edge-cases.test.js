// @maintained-by-ai
// Degenerate-input lane for 2024 getAttacks: the proficiency ladder and the
// fallback unarmed strike (no weapons / spells-array ignored / missing ability).
// Real builders end-to-end per the cla225 pattern — ONLY combatData is stubbed
// (SSE-backed, unavoidable); attackCalc.js stub echoes are retired per #1235.
// Lane splits (verified 2026-10-20):
// - Soulknife Psychic Blade rows → attackCalc2024-class-features.test.js:113-157
//   ('Psychic Blade pair' it.each pins name, type, range, damage, damageFormula,
//   hitBonus, hitBonusFormula, damageType, mastery, properties, abilityName,
//   isPsychicBlade on both rows — byte pins replacing the deleted
//   :276 toHaveProperty key-check, folded into #1235)
// - Swift Quiver rows → attackCalc2024-special-attacks.test.js:98-172
//   (name/isSwiftQuiver/actionType/type pins :128-135; SP-129 numeric-range
//   hitBonus/damage byte pins :167-171)
// - Tavern Brawler / College of Dance / Blessed Warrior → class-features :37-178
// - MA gate & ladder → attackCalc2024.cla225-martial-arts-gate.test.js
// - Light melee/ranged seams → attackCalc2024-light-melee/-light-ranged.test.js
// - Nick / Dual Wielder → attackCalc2024-nick-dual-wielder.test.js, .wm003-nick.test.js
// - Archery / Dueling / Thrown Weapon Fighting → attackCalc2024-fighting-styles.test.js
// - Ability select & ranged+melee combination → attackCalc2024.test.js
//   ('includes both ranged and melee weapon attacks when both are equipped' :331
//   subsumes the retired stub-echo 'combines multiple attack sources' count)
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// Unavoidable mock only: SSE/runtime-backed combat summary (Swift Quiver gate
// reads it on every getAttacks call; null = concentration inactive).
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — Shortbow copied from public/data/equipment.json (index: shortbow)
// ---------------------------------------------------------------------------

const SHORTBOW = {
  name: 'Shortbow',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d6', damage_type: 'Piercing' },
  range: { normal: 80, long: 320 },
  properties: ['Ammunition', 'Two-Handed'],
  mastery: 'Vex',
};

const FIRE_BOLT = {
  name: 'Fire Bolt',
  level: 0,
  damage: { damage_dice: '1d10', damage_type: 'Fire' },
  range: '120 feet',
  casting_time: '1 action',
};

const char = ({ level = 1, abilities, equipped = [] } = {}) => ({
  level,
  abilities,
  inventory: { equipped },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
});

const dex = (bonus) => ({ name: 'Dexterity', bonus });
const str = (bonus) => ({ name: 'Strength', bonus });

// ---------------------------------------------------------------------------
// Proficiency ladder — floor((level-1)/4)+2 (attackCalc2024.js:543), pinned
// as REAL Shortbow row hit bonuses via real buildWeaponAttack (not a stub
// echo). Fallback-unarmed guard falsifier, silent side: the only row is the
// Shortbow, never an Unarmed Strike. Ladder steps PB 4/PB 5 are owned here —
// other lanes only exercise PB 2/3/6 (class-features :38-61, special :156-170).
// ---------------------------------------------------------------------------

describe('attackCalc2024 - proficiency ladder (real builder output)', () => {
  it.each([
    [1, 2],
    [5, 3],
    [9, 4],
    [13, 5],
    [17, 6],
  ])('lv%s Shortbow row: DEX +4 + PB(+%s) = to-hit %s', (level, prof) => {
    const result = getAttacks(
      [SHORTBOW],
      [],
      char({ level, abilities: [str(0), dex(4)], equipped: ['Shortbow'] })
    );

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.name).toBe('Shortbow');
    expect(row.type).toBe('Action');
    expect(row.range).toBe(80);
    expect(row.damage).toBe('1d6+4');
    expect(row.hitBonus).toBe(4 + prof);
    expect(row.hitBonusFormula).toBe(
      `To Hit Bonus Formula = Dexterity Bonus (4) + Proficiency (${prof})`
    );
  });
});

// ---------------------------------------------------------------------------
// Fallback unarmed strike — degenerate inputs to the 2024 builder:
// spells passed but ignored (no spell rows in 2024), empty abilities array,
// negative STR formatting. Guard falsifier fire side: EVERY row below is the
// zero/negative-mod fallback row — any throw or wrong byte fails the pin.
// Positive-STR no-weapon baseline lives in attackCalc2024.test.js:101-108;
// Blessed Warrior + negative STR lives in class-features :159-178.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - fallback unarmed strike degenerate inputs', () => {
  it.each([
    {
      label: 'spells present but ignored; STR +0 → 1d4+0',
      level: 5,
      abilities: [str(0), dex(2)],
      damage: '1d4+0',
      strMod: 0,
      prof: 3,
      hitBonus: 3,
    },
    {
      label: 'empty abilities array → zero-mod row, no throw',
      level: 5,
      abilities: [],
      damage: '1d4+0',
      strMod: 0,
      prof: 3,
      hitBonus: 3,
    },
    {
      label: 'negative STR lv3 → 1d4-1, to-hit folds -1 + PB(2)',
      level: 3,
      abilities: [str(-1), dex(2)],
      damage: '1d4-1',
      strMod: -1,
      prof: 2,
      hitBonus: 1,
    },
  ])('no equipped weapons — $label', ({ level, abilities, damage, strMod, prof, hitBonus }) => {
    const result = getAttacks([], [FIRE_BOLT], char({ level, abilities }));

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.name).toBe('Unarmed Strike');
    expect(row.type).toBe('Action');
    expect(row.weaponType).toBe('unarmed');
    expect(row.damage).toBe(damage);
    expect(row.damageType).toBe('Bludgeoning');
    expect(row.range).toBe(5);
    expect(row.hitBonus).toBe(hitBonus);
    expect(row.hitBonusFormula).toBe(
      `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${prof})`
    );
    expect(row.damageFormula).toBe(
      `Damage Formula = Unarmed Strike (1d4) + Strength Bonus (${strMod})`
    );
  });
});
