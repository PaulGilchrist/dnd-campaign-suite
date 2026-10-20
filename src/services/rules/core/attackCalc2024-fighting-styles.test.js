// @maintained-by-ai
// 2024 fighting-styles axis of getAttacks: Archery, Dueling, Thrown Weapon
// Fighting (FS-011). One it.each truth-table pins the FULL builder row for
// every gate face (style fires / other style / fightingStyles undefined per
// attackCalc2024.js:545 / property & weapon_range silences / stacking).
// Real builders end-to-end per the cla225 pattern (#1235/#1236) — the old
// wholesale attackCalc.js stub echoes are retired: every expectation below is
// canonical buildWeaponAttack output bytes, so any miswired extraBonus,
// label, or numeric fold fails a full toEqual. Only combatData is stubbed
// (SSE-backed, unavoidable; null = Swift Quiver concentration inactive).
// Lane splits (verified 2026-10-20):
// - 5e Archery/Dueling/TWF math → attackCalc.test.js (#1234), 5e thrown
//   integration → attackCalc-5e-attacks.test.js
// - Clean Shortbow proficiency ladder (PB 2-6, dex +4) + fallback unarmed →
//   attackCalc2024-edge-cases.test.js (#1236) — this table's no-style
//   Shortbow rows use dex +3 so no byte collides with that ladder
// - Light-seam row placement → attackCalc2024-light-melee/-light-ranged
//   (their stub-echo Archery/Dueling cases → fold-rec into this lane)
// - Nick / Dual Wielder off-hand → attackCalc2024-nick-dual-wielder.test.js,
//   attackCalc2024.wm003-nick.test.js (no Nick legs live here)
// - Blessed/Druidic Warrior & class features → attackCalc2024-class-features.test.js
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — copied from public/data/equipment.json (Dart, Shortbow,
// Longsword, Handaxe entries; verified against disk 2026-10-20)
// ---------------------------------------------------------------------------

const DART = {
  name: 'Dart',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d4', damage_type: 'Piercing' },
  range: { normal: 20, long: 60 },
  properties: ['Finesse', 'Thrown'],
  mastery: 'Vex',
};

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

const LONGSWORD = {
  name: 'Longsword',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d8', damage_type: 'Slashing' },
  range: { normal: 5, long: null },
  properties: ['Versatile'],
  mastery: 'Sap',
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

// lv1 Fighter, PB +2. styles: null omits fightingStyles entirely (exercises
// the :545 `!= null` guard); array is forwarded verbatim.
const char = ({ str = 0, dex = 0, styles = [] } = {}) => ({
  level: 1,
  abilities: [
    { name: 'Strength', bonus: str },
    { name: 'Dexterity', bonus: dex },
  ],
  inventory: { equipped: [] },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter', ...(styles === null ? {} : { fightingStyles: styles }) },
});

// ---------------------------------------------------------------------------
// Truth-table: full getAttacks output per gate face. Ranged rows build first
// (buildRangedAttacks), then melee (buildMeleeAttacks).
// ---------------------------------------------------------------------------

describe('attackCalc2024 - fighting styles', () => {
  it.each([
    {
      label: 'Archery fires: Shortbow to-hit 5→7 with label',
      equipment: [SHORTBOW], equipped: ['Shortbow'], styles: ['Archery'], str: 0, dex: 3,
      rows: [{
        name: 'Shortbow', damage: '1d6+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
        hitBonus: 7,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2) + Archery Fighting Style (2)',
        range: 80, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Ammunition', 'Two-Handed'],
      }],
    },
    {
      label: 'Archery silent: Defense style → clean Shortbow to-hit 5',
      equipment: [SHORTBOW], equipped: ['Shortbow'], styles: ['Defense'], str: 0, dex: 3,
      rows: [{
        name: 'Shortbow', damage: '1d6+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 80, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Ammunition', 'Two-Handed'],
      }],
    },
    {
      label: 'fightingStyles undefined (:545 guard): clean Longsword, no throw',
      equipment: [LONGSWORD], equipped: ['Longsword'], styles: null, str: 3, dex: 0,
      rows: [{
        name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
        properties: ['Versatile'],
      }],
    },
    {
      label: 'Dueling fires: lone Longsword damage 1d8+3→1d8+5 with label',
      equipment: [LONGSWORD], equipped: ['Longsword'], styles: ['Dueling'], str: 3, dex: 0,
      rows: [{
        name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3) + Dueling Fighting Style (2)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
        properties: ['Versatile'],
      }],
    },
    {
      label: 'Dueling silent: ranged also equipped → both rows clean',
      equipment: [SHORTBOW, LONGSWORD], equipped: ['Shortbow', 'Longsword'], styles: ['Dueling'], str: 3, dex: 2,
      rows: [
        {
          name: 'Shortbow', damage: '1d6+2', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (2)',
          hitBonus: 4,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (2) + Proficiency (2)',
          range: 80, type: 'Action', weaponType: '', mastery: 'Vex',
          properties: ['Ammunition', 'Two-Handed'],
        },
        {
          name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
          properties: ['Versatile'],
        },
      ],
    },
    {
      label: 'Dueling silent: two melee weapons → neither row gets +2',
      equipment: [LONGSWORD, HANDAXE], equipped: ['Longsword', 'Handaxe'], styles: ['Dueling'], str: 3, dex: 0,
      rows: [
        {
          name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
          properties: ['Versatile'],
        },
        {
          name: 'Handaxe', damage: '1d6+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Strength Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
          properties: ['Light', 'Thrown', 'Monk'],
        },
      ],
    },
    {
      label: 'FS-011 fires: Dart +2 damage; to-hit stays DEX+PB (no 5e double-proficiency port)',
      equipment: [DART], equipped: ['Dart'], styles: ['Thrown Weapon Fighting'], str: 0, dex: 3,
      rows: [{
        name: 'Dart', damage: '1d4+5', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3) + Thrown Weapon Fighting (2)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 20, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Finesse', 'Thrown'],
      }],
    },
    {
      label: 'FS-011 silent: Defense style → clean Dart row',
      equipment: [DART], equipped: ['Dart'], styles: ['Defense'], str: 0, dex: 3,
      rows: [{
        name: 'Dart', damage: '1d4+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 20, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Finesse', 'Thrown'],
      }],
    },
    {
      label: 'FS-011 silent: Shortbow is Ammunition, no Thrown property → clean row',
      equipment: [SHORTBOW], equipped: ['Shortbow'], styles: ['Thrown Weapon Fighting'], str: 0, dex: 3,
      rows: [{
        name: 'Shortbow', damage: '1d6+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 80, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Ammunition', 'Two-Handed'],
      }],
    },
    {
      label: 'FS-011 silent: Handaxe Thrown property but melee lane → no +2',
      equipment: [HANDAXE], equipped: ['Handaxe'], styles: ['Thrown Weapon Fighting'], str: 3, dex: 0,
      rows: [{
        name: 'Handaxe', damage: '1d6+3', damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Strength Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
        properties: ['Light', 'Thrown', 'Monk'],
      }],
    },
    {
      label: 'FS-011 + Archery stack: separate buckets on one Dart row (+2 dmg, +2 to-hit)',
      equipment: [DART], equipped: ['Dart'], styles: ['Archery', 'Thrown Weapon Fighting'], str: 0, dex: 3,
      rows: [{
        name: 'Dart', damage: '1d4+5', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3) + Thrown Weapon Fighting (2)',
        hitBonus: 7,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2) + Archery Fighting Style (2)',
        range: 20, type: 'Action', weaponType: '', mastery: 'Vex',
        properties: ['Finesse', 'Thrown'],
      }],
    },
    {
      label: 'FS-011 applies to every thrown row — two darts both get +2',
      equipment: [DART], equipped: ['Dart', 'Dart'], styles: ['Thrown Weapon Fighting'], str: 0, dex: 3,
      rows: [
        {
          name: 'Dart', damage: '1d4+5', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3) + Thrown Weapon Fighting (2)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 20, type: 'Action', weaponType: '', mastery: 'Vex',
          properties: ['Finesse', 'Thrown'],
        },
        {
          name: 'Dart', damage: '1d4+5', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (3) + Thrown Weapon Fighting (2)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 20, type: 'Action', weaponType: '', mastery: 'Vex',
          properties: ['Finesse', 'Thrown'],
        },
      ],
    },
  ])('$label', ({ equipment, equipped, styles, str, dex, rows }) => {
    const playerStats = char({ str, dex, styles });
    playerStats.inventory.equipped = equipped;

    expect(getAttacks(equipment, [], playerStats)).toEqual(rows);
  });
});
