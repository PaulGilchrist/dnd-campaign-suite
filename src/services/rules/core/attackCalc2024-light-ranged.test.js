// @maintained-by-ai
// 2024 light-ranged seam lane of getAttacks (attackCalc2024.js buildRangedAttacks):
// row placement by the Light property on Ranged weapons (non-Light → Action;
// <2 Light → all Action; ≥2 Light → highest average damage, tie → first, takes
// Action, the rest Bonus Action with damage dice-only) plus the Crossbow Expert
// feat gate (feats[] string match, :64) which adds the DEX bonus to the damage
// of Bonus Action Hand Crossbow rows ONLY (:86-87).
// Real builders end-to-end per the cla225 pattern (#1235/#1236/#1237 canon) —
// the wholesale attackCalc.js stubbing is retired: the old stub-echo legs asserted
// the mock's own output (buildWeaponAttackStub call args and echoed bytes) and are
// deleted citing their owners:
// - base ability select & ranged+melee combination → attackCalc2024.test.js:110-149
//   ('selects Dexterity for ranged weapon attacks' pins Dexterity/abilityBonus/Action)
// - Archery on light ranged → attackCalc2024-fighting-styles.test.js:98-123 and
//   :241-251 (full-row toEqual truth table; Archery is applied by the SAME
//   buildRangedActionAttack used by both ranged branches, so the Light
//   property cannot change its output)
// - light-seam placement pattern twin → attackCalc2024-light-melee.test.js:91-186
// Only combatData is stubbed (SSE-backed, unavoidable; null = Swift Quiver
// concentration inactive). No campaignName on the test characters, so the Nick
// runtime lane (collectWeaponMastery / getRuntimeValue) and classRules2024
// (Monk-only) are never entered — no mocks needed for them.
// Lane splits (verified 2026-10-20):
// - Thrown Weapon Fighting / fighting-style gates → attackCalc2024-fighting-styles.test.js
// - Swift Quiver / Starry Form ranged specials → attackCalc2024-special-attacks.test.js
// - Nick / Dual Wielder off-hand → attackCalc2024-nick-dual-wielder.test.js
// - MA gate & proficiency ladder → attackCalc2024-edge-cases.test.js,
//   attackCalc2024.cla225-martial-arts-gate.test.js
// - Light melee seam → attackCalc2024-light-melee.test.js
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// Unavoidable mock only: SSE/runtime-backed combat summary (the Swift Quiver
// gate reads it on every getAttacks call; null = concentration inactive).
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — copied from public/data/equipment.json (Hand Crossbow, Heavy
// Crossbow, Light Crossbow entries; verified against disk 2026-10-20). The
// disk catalog's ONLY Light Ranged weapons are Hand Crossbow and Heavy
// Crossbow (Heavy Crossbow carries 'Light' + 'Two-Handed' on disk — pinned
// as-authored). The retired stub fixtures fabricated bytes: Dart carried a
// 'Light' property (disk: ['Finesse','Thrown'] — Dart never enters this
// seam), Sling was listed 'Light' (disk: ['Ammunition']), and Dart 1d8
// (disk: 1d4).
// ---------------------------------------------------------------------------

const HAND_CROSSBOW = {
  name: 'Hand Crossbow',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d6', damage_type: 'Piercing' },
  range: { normal: 30, long: 120 },
  properties: ['Ammunition', 'Light', 'Loading'],
  mastery: 'Vex',
};

const HEAVY_CROSSBOW = {
  name: 'Heavy Crossbow',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d10', damage_type: 'Piercing' },
  range: { normal: 100, long: 400 },
  properties: ['Ammunition', 'Light', 'Loading', 'Two-Handed'],
  mastery: 'Push',
};

const LIGHT_CROSSBOW = {
  name: 'Light Crossbow',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d8', damage_type: 'Piercing' },
  range: { normal: 80, long: 320 },
  properties: ['Ammunition', 'Loading', 'Two-Handed'],
  mastery: 'Slow',
};

const CATALOG = [HAND_CROSSBOW, HEAVY_CROSSBOW, LIGHT_CROSSBOW];

// lv1 Fighter, PB +2. DEX +3 > STR +0 → Dexterity drives every row.
// feats is the channel buildRangedAttacks actually reads (:64); the retired
// lane's automation.passives crossbow_expert fixture was inert decoration.
const char = (equipped, feats = []) => ({
  level: 1,
  abilities: [
    { name: 'Strength', bonus: 0 },
    { name: 'Dexterity', bonus: 3 },
  ],
  inventory: { equipped },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
  feats,
});

// ---------------------------------------------------------------------------
// Truth-table: full getAttacks output per light-ranged seam face.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - light ranged weapons', () => {
  it.each([
    {
      label: 'non-Light + single Light: both Action rows; Crossbow Expert fabricates no Bonus row below the 2-Light gate',
      equipped: ['Light Crossbow', 'Hand Crossbow'], feats: ['Crossbow Expert'],
      rows: [
        {
          name: 'Light Crossbow', damage: '1d8+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d8) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 80, type: 'Action', weaponType: '', mastery: 'Slow',
          properties: ['Ammunition', 'Loading', 'Two-Handed'],
        },
        {
          name: 'Hand Crossbow', damage: '1d6+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 30, type: 'Action', weaponType: '', mastery: 'Vex',
          properties: ['Ammunition', 'Light', 'Loading'],
        },
      ],
    },
    {
      label: 'two Light Hand Crossbows (1d6 tie → first takes Action): Crossbow Expert adds DEX to the Bonus row: 1d6→1d6+3',
      equipped: ['Hand Crossbow', 'Hand Crossbow'], feats: ['Crossbow Expert'],
      rows: [
        {
          name: 'Hand Crossbow', damage: '1d6+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 30, type: 'Action', weaponType: '', mastery: 'Vex',
          properties: ['Ammunition', 'Light', 'Loading'],
        },
        {
          name: 'Hand Crossbow', damage: '1d6+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 30, type: 'Bonus Action', weaponType: 'ranged', mastery: 'Vex',
          properties: ['Ammunition', 'Light', 'Loading'],
        },
      ],
    },
    {
      label: 'two Light, different dice: Heavy Crossbow 1d10 outranks equipped-order-first Hand Crossbow for Action; off-hand row default dice-only 1d6',
      equipped: ['Hand Crossbow', 'Heavy Crossbow'], feats: [],
      rows: [
        {
          name: 'Heavy Crossbow', damage: '1d10+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Action', weaponType: '', mastery: 'Push',
          properties: ['Ammunition', 'Light', 'Loading', 'Two-Handed'],
        },
        {
          name: 'Hand Crossbow', damage: '1d6', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d6)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 30, type: 'Bonus Action', weaponType: 'ranged', mastery: 'Vex',
          properties: ['Ammunition', 'Light', 'Loading'],
        },
      ],
    },
    {
      label: 'Crossbow Expert is Hand Crossbow ONLY: two Heavy Crossbows leave the Bonus row dice-only 1d10',
      equipped: ['Heavy Crossbow', 'Heavy Crossbow'], feats: ['Crossbow Expert'],
      rows: [
        {
          name: 'Heavy Crossbow', damage: '1d10+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Action', weaponType: '', mastery: 'Push',
          properties: ['Ammunition', 'Light', 'Loading', 'Two-Handed'],
        },
        {
          name: 'Heavy Crossbow', damage: '1d10', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Bonus Action', weaponType: 'ranged', mastery: 'Push',
          properties: ['Ammunition', 'Light', 'Loading', 'Two-Handed'],
        },
      ],
    },
  ])('$label', ({ equipped, feats, rows }) => {
    expect(getAttacks(CATALOG, [], char(equipped, feats))).toEqual(rows);
  });
});
