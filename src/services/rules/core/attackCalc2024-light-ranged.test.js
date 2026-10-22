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
import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

// Unavoidable mock only: SSE/runtime-backed combat summary (the Swift Quiver
// gate reads it on every getAttacks call; null = concentration inactive).
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — DISK-imported rows (never-retype law #1362). The retired
// retyped copies pinned the disk defect at 2026-10-20 state: Heavy Crossbow
// carried a fabricated 'Light' property on disk which wrongly made it
// eligible for the light dual-wield seam (#1239); the row was corrected
// (fix#90) and the truth-table flipped to lawful here. PHB law (every
// edition): Heavy Crossbow is Ammunition/Heavy/Loading/Two-Handed — never
// Light. The disk catalog's Light Ranged weapon is Hand Crossbow only.
// ---------------------------------------------------------------------------

const diskRow = (name) => DISK_EQUIPMENT.find(e => e.name === name);

const HAND_CROSSBOW = diskRow('Hand Crossbow');
const HEAVY_CROSSBOW = diskRow('Heavy Crossbow');
const LIGHT_CROSSBOW = diskRow('Light Crossbow');

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
// Disk law pins (#1239 / fix#90): guards the corrected rows against a
// re-typed 'Light' ever returning to the Heavy Crossbow disk row.
// ---------------------------------------------------------------------------

describe('light ranged seam - disk law pins (#1239)', () => {
  it('Heavy Crossbow is NOT Light on disk; Hand Crossbow stays Light; Light Crossbow stays non-Light', () => {
    expect(HEAVY_CROSSBOW).toBeDefined();
    expect(HEAVY_CROSSBOW.properties).not.toContain('Light');
    expect(HAND_CROSSBOW.properties).toContain('Light');
    expect(LIGHT_CROSSBOW.properties).not.toContain('Light');
  });
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
      label: 'Light + non-Light: Hand Crossbow lone Light (<2 Light gate) and Heavy Crossbow (NOT Light, #1239) both take Action rows',
      equipped: ['Hand Crossbow', 'Heavy Crossbow'], feats: [],
      rows: [
        {
          name: 'Heavy Crossbow', damage: '1d10+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Action', weaponType: '', mastery: 'Push',
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
      label: 'two Heavy Crossbows: both non-Light → both Action rows; the light seam refuses Heavy Crossbow, Crossbow Expert fabricates no Bonus row',
      equipped: ['Heavy Crossbow', 'Heavy Crossbow'], feats: ['Crossbow Expert'],
      rows: [
        {
          name: 'Heavy Crossbow', damage: '1d10+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Action', weaponType: '', mastery: 'Push',
          properties: ['Ammunition', 'Loading', 'Two-Handed'],
        },
        {
          name: 'Heavy Crossbow', damage: '1d10+3', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d10) + Dexterity Bonus (3)',
          hitBonus: 5,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
          range: 100, type: 'Action', weaponType: '', mastery: 'Push',
          properties: ['Ammunition', 'Loading', 'Two-Handed'],
        },
      ],
    },
  ])('$label', ({ equipped, feats, rows }) => {
    expect(getAttacks(CATALOG, [], char(equipped, feats))).toEqual(rows);
  });
});
