// @maintained-by-ai
// Light-melee seam lane of 2024 getAttacks: row placement by the Light property
// (non-Light → Action; <2 Light → all Action; ≥2 Light → highest-dice (tie →
// first) is Action, the rest Bonus Action) plus two_weapon_fighting ability-in-
// damage on the off-hand row. Real builders end-to-end per the cla225 pattern
// (#1235/#1236/#1237 canon) — the wholesale attackCalc.js stubbing is retired:
// every expectation below is canonical buildWeaponAttack output bytes, so any
// miswired includeAbilityBonusInDamage, bonus fold, mastery, or row order fails
// a full toEqual. Only combatData is stubbed (SSE-backed, unavoidable;
// null = Swift Quiver concentration inactive). Fixtures copied from
// public/data/equipment.json (verified 2026-10-20) — Dagger/Sickle carry their
// real Nick mastery and Monk property; the retired stub fixtures dropped them.
// Lane splits (verified 2026-10-20):
// - Archery / Dueling / Thrown Weapon Fighting gates → attackCalc2024-fighting-styles.test.js (#1237)
//   (stub-echo legs deleted citing #1237: solo-Dueling fires, Dueling+Blessed
//   combine, Dueling+Druidic combine, Dueling-silent-with-ranged — that lane's
//   truth table already pins every gate face with full builder rows)
// - Blessed / Druidic Warrior & class features → attackCalc2024-class-features.test.js (#1235)
//   (stub-echo Blessed/Druidic weapon-row legs deleted citing #1235)
// - Nick promotion / Dual Wielder feat rows → attackCalc2024-nick-dual-wielder.test.js,
//   attackCalc2024.wm003-nick.test.js
// - Light ranged seam → attackCalc2024-light-ranged.test.js
// - MA gate & ladder → attackCalc2024.cla225-martial-arts-gate.test.js
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — copied from public/data/equipment.json (verified 2026-10-20)
// ---------------------------------------------------------------------------

const DAGGER = {
  name: 'Dagger',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d4', damage_type: 'Piercing' },
  range: { normal: 5, long: null },
  properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
  mastery: 'Nick',
};

const SICKLE = {
  name: 'Sickle',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d4', damage_type: 'Slashing' },
  range: { normal: 5, long: null },
  properties: ['Light', 'Monk'],
  mastery: 'Nick',
};

const HANDAXE = {
  name: 'Handaxe',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d6', damage_type: 'Slashing' },
  range: { normal: 5, long: null },
  properties: ['Light', 'Thrown', 'Monk'],
  mastery: 'Vex',
};

const CATALOG = [DAGGER, SICKLE, HANDAXE];

// lv1 Fighter, PB +2. DEX +3 > STR +0 → Dexterity drives every row.
// No campaignName → resolveOffHandActionType takes its pure 'Bonus Action'
// branch (Nick latch lives in the nick lanes), so no runtime mocks needed.
const TWF = [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }];
const char = (equipped, passives = []) => ({
  level: 1,
  abilities: [
    { name: 'Strength', bonus: 0 },
    { name: 'Dexterity', bonus: 3 },
  ],
  inventory: { equipped },
  automation: { passives, bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
});

// ---------------------------------------------------------------------------
// Truth-table: full getAttacks output per light-melee seam face.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - light melee weapons', () => {
  it.each([
    {
      label: 'single light Dagger → one Action row, clean ability-damage bytes',
      equipped: ['Dagger'], passives: [],
      rows: [{
        name: 'Dagger', damage: '1d4+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Nick',
        properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
      }],
    },
    {
      label: '<2-light gate falsifier: two_weapon_fighting with one Light weapon fabricates no off-hand row',
      equipped: ['Dagger'], passives: TWF,
      rows: [{
        name: 'Dagger', damage: '1d4+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Nick',
        properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
      }],
    },
    {
      label: 'two light melee: highest-dice Handaxe takes Action; off-hand Dagger stays dice-only (1d4)',
      equipped: ['Handaxe', 'Dagger'], passives: [],
      rows: [
        {
          name: 'Handaxe', damage: '1d6+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
          properties: ['Light', 'Thrown', 'Monk'],
        },
        {
          name: 'Dagger', damage: '1d4', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Bonus Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
      ],
    },
    {
      label: 'two_weapon_fighting passive adds DEX to off-hand damage: 1d4→1d4+3 with formula bytes',
      equipped: ['Handaxe', 'Dagger'], passives: TWF,
      rows: [
        {
          name: 'Handaxe', damage: '1d6+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
          properties: ['Light', 'Thrown', 'Monk'],
        },
        {
          name: 'Dagger', damage: '1d4+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Bonus Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
      ],
    },
    {
      label: '1d4 tie (Dagger+Sickle): first Light weapon takes Action, second is Bonus Action',
      equipped: ['Dagger', 'Sickle'], passives: [],
      rows: [
        {
          name: 'Dagger', damage: '1d4+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
        {
          name: 'Sickle', damage: '1d4', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d4)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 5, type: 'Bonus Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Light', 'Monk'],
        },
      ],
    },
  ])('$label', ({ equipped, passives, rows }) => {
    expect(getAttacks(CATALOG, [], char(equipped, passives))).toEqual(rows);
  });
});
