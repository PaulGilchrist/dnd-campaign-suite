// @maintained-by-ai
// Base lane of 2024 getAttacks: the unique orchestration seams and ability-select
// byte contracts NOT owned by topic lanes. Real builders end-to-end per the
// #1235-#1242 canon — the wholesale ./attackCalc.js stub, the classRules2024
// stub, and every builder-stub echo assertion are retired: each expectation
// below is canonical buildWeaponAttack / buildFallbackUnarmedAttacks output
// bytes, so any miswired ability select, bonus fold, or row order fails a
// full toEqual. Only combatData is stubbed (SSE-backed, unavoidable — the
// Swift Quiver gate reads getCombatSummary on every getAttacks call;
// null = concentration inactive). No campaignName on the test characters, so
// the Nick runtime latch (collectWeaponMastery / getRuntimeValue) is never
// entered, and every character is a non-Monk, so classRules2024 and the
// CLA-225 Martial Arts lane are never entered — no mocks needed for them.
// Fixtures transcribed verbatim from public/data/equipment.json
// (Shortbow/Longsword/Rapier/Shortsword, verified against disk 2026-10-20).
//
// Deleted here, with their owning lanes cited (accumulated queue via
// light-ranged #1239, nick-dual-wielder #1240, cla225 #1242):
// - light-melee seam placement + two_weapon_fighting off-hand damage legs
//   (old 'places all non-light melee weapons in CharActions...' :255-292 and
//   'includes ability bonus in damage...' :294-329, stub echoes over
//   fabricated no-Properties fixtures) →
//   attackCalc2024-light-melee.test.js:91-186 full-row toEqual truth tables.
// - Crossbow Expert lane → attackCalc2024-light-ranged.test.js:106-144
//   truth-table faces 2/4. The old :466 test was a mislabeled melee-lane
//   TWF case: its fixture fabricated a 'Melee' Hand Crossbow (disk: Ranged)
//   and its automation.passives crossbow fixture never reached the real
//   feats[] gate at attackCalc2024.js:64.
// - Dual Wielder feat holder/non-holder legs (old :366-418 / :420-449,
//   non-disk fixtures without mastery fields) →
//   attackCalc2024-nick-dual-wielder.test.js:199-310 FT-104 byte pair.
// - fallback unarmed degenerate faces (empty abilities, negative STR) →
//   attackCalc2024-edge-cases.test.js:112-160; this lane keeps only the
//   positive-STR baseline that file's :108 cites it for.
//
// Incoming citations — test names preserved, line ranges shifted by rewrite:
// - attackCalc2024-edge-cases.test.js:20 & :108 cite the no-weapon baseline
//   ('no weapons or spells...') below at :121-131.
// - attackCalc2024-light-ranged.test.js:12 cites 'selects Dexterity for
//   ranged weapon attacks' below at :133-146.
// - attackCalc2024-edge-cases.test.js:21 cites
//   'includes both ranged and melee weapon attacks when both are equipped'
//   below at :194-216.
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// Unavoidable mock only: SSE/runtime-backed combat summary.
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — copied from public/data/equipment.json (verified 2026-10-20)
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

const RAPIER = {
  name: 'Rapier',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d8', damage_type: 'Piercing' },
  range: { normal: 5, long: null },
  properties: ['Finesse'],
  mastery: 'Vex',
};

const SHORTSWORD = {
  name: 'Shortsword',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d6', damage_type: 'Piercing' },
  range: { normal: 5, long: null },
  properties: ['Finesse', 'Light', 'Monk'],
  mastery: 'Vex',
};

const CATALOG = [SHORTBOW, LONGSWORD, RAPIER, SHORTSWORD];

// lv1 Fighter, PB +2 (proficiency ladder owned by attackCalc2024-edge-cases.test.js:76-101).
const char = ({ level = 1, str = 0, dex = 0, equipped = [] } = {}) => ({
  level,
  abilities: [
    { name: 'Strength', bonus: str },
    { name: 'Dexterity', bonus: dex },
  ],
  inventory: { equipped },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attackCalc2024 - getAttacks base seams', () => {
  it('no weapons or spells — positive-STR fallback Unarmed Strike baseline (cited by attackCalc2024-edge-cases.test.js:108)', () => {
    expect(getAttacks([], [], char({ str: 2 }))).toEqual([
      {
        name: 'Unarmed Strike', damage: '1d4+2', damageType: 'Bludgeoning',
        damageFormula: 'Damage Formula = Unarmed Strike (1d4) + Strength Bonus (2)',
        hitBonus: 4,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (2) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'unarmed',
      },
    ]);
  });

  it('selects Dexterity for ranged weapon attacks (cited by attackCalc2024-light-ranged.test.js:12)', () => {
    // STR -1 falsifier: if the ranged lane ever used Strength the row would
    // read 1d6-1 / hitBonus 1 — the builder forces Dexterity (attackCalc2024.js:29-30).
    expect(getAttacks(CATALOG, [], char({ str: -1, dex: 3, equipped: ['Shortbow'] }))).toEqual([
      {
        name: 'Shortbow', damage: '1d6+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 80, type: 'Action', weaponType: 'ranged', mastery: 'Vex',
        properties: ['Ammunition', 'Two-Handed'],
      },
    ]);
  });

  // fix#350(c) consumer-behavior arms — twin of fix#348(d) in attackCalc.test.js:274-308.
  // The filters below are copied byte-for-byte from the live consumers of the sheet row's
  // weaponType — contextBuilder-sync.js:547-548 (isSneakAttackWeapon:
  // `hasFinesse || attack.weaponType === 'ranged'`), combatSuperiorityQueries.js:20
  // (isWeaponAttack), bonusActionAttackHandler.js:24-26 (War Priest pick),
  // damageReductionHandler.js:68 (ranged_weapon_attack_hit trigger reads
  // lastAttack.attackEvent?.weaponType), executeActionManeuvers.js:471 and
  // reactionDamageHandler.js:151 (melee-only reaction ranged refusals).
  // Pre-fix the 2024 main-hand bow row carried weaponType:'' — sneak dice and weapon-attack
  // maneuvers failed CLOSED on bows; the Riposte / adjacent-reaction refusals failed OPEN.
  it('fix#350(c): 2024 main-hand ranged row satisfies the ranged consumers that previously saw empty weaponType', () => {
    const row = getAttacks(CATALOG, [], char({ str: -1, dex: 3, equipped: ['Shortbow'] }))[0];

    // contextBuilder-sync.js:547-548 shape — Shortbow is not finesse, so eligibility
    // rides entirely on the weaponType stamp.
    const weaponProperties = row.properties || [];
    const hasFinesse = weaponProperties.some(p => p.toLowerCase() === 'finesse');
    expect(hasFinesse).toBe(false);
    expect(hasFinesse || row.weaponType === 'ranged').toBe(true);

    // combatSuperiorityQueries.js:20 shape — maneuver context sees a weapon attack.
    const isWeaponAttack = row.weaponType === 'melee' || row.weaponType === 'ranged' || row.isUnarmedStrike;
    expect(isWeaponAttack).toBe(true);

    // bonusActionAttackHandler.js:24-26 shape — War Priest can pick the loaded bow
    // (no 'melee' row equipped, so the ranged branch must match).
    const isLoadedRanged = a => a.weaponType === 'ranged' && !(a.properties || []).some(p => /loading/i.test(String(p)));
    expect(row.weaponType === 'melee' || isLoadedRanged(row)).toBe(true);

    // damageReductionHandler.js:68 shape — the ranged-hit reduction trigger fires.
    expect({ attackEvent: row }.attackEvent?.weaponType === 'ranged').toBe(true);

    // executeActionManeuvers.js:471 / reactionDamageHandler.js:151 shape — a bow
    // attackEvent now trips the melee-only-reaction refusal instead of slipping past it.
    expect(row.weaponType === 'ranged').toBe(true);

    // Melee sibling untouched: the Longsword row still reports 'melee'.
    const meleeRow = getAttacks(CATALOG, [], char({ str: 3, dex: 0, equipped: ['Longsword'] }))[0];
    expect(meleeRow.weaponType).toBe('melee');
  });

  // Melee ability select (attackCalc2024.js:241-242): max(STR, DEX), tie →
  // Dexterity. This is the base lane's owned axis — topic lanes pin other intents.
  it.each([
    {
      label: 'STR +4 > DEX +0 → Strength drives hit and damage',
      abilities: { str: 4, dex: 0 },
      equipped: ['Longsword'],
      row: {
        name: 'Longsword', damage: '1d8+4', damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (4)',
        hitBonus: 6,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (4) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
        properties: ['Versatile'],
      },
    },
    {
      label: 'DEX +4 > STR +0 → Dexterity drives hit and damage',
      abilities: { str: 0, dex: 4 },
      equipped: ['Rapier'],
      row: {
        name: 'Rapier', damage: '1d8+4', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Dexterity Bonus (4)',
        hitBonus: 6,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (4) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
        properties: ['Finesse'],
      },
    },
    {
      label: 'tie STR +2 = DEX +2 → Dexterity wins the tie',
      abilities: { str: 2, dex: 2 },
      equipped: ['Shortsword'],
      row: {
        name: 'Shortsword', damage: '1d6+2', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (2)',
        hitBonus: 4,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (2) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
        properties: ['Finesse', 'Light', 'Monk'],
      },
    },
  ])('melee ability select: $label', ({ abilities, equipped, row }) => {
    expect(getAttacks(CATALOG, [], char({ ...abilities, equipped }))).toEqual([row]);
  });

  it('includes both ranged and melee weapon attacks when both are equipped', () => {
    // Orchestration seam: ranged rows build first (attackCalc2024.js:568-571),
    // and each lane picks its own ability — DEX (+3) for the bow, STR (+4) for
    // the sword, in one pass.
    expect(getAttacks(CATALOG, [], char({ str: 4, dex: 3, equipped: ['Shortbow', 'Longsword'] }))).toEqual([
      {
        name: 'Shortbow', damage: '1d6+3', damageType: 'Piercing',
        damageFormula: 'Damage Formula = Weapon (1d6) + Dexterity Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (3) + Proficiency (2)',
        range: 80, type: 'Action', weaponType: 'ranged', mastery: 'Vex',
        properties: ['Ammunition', 'Two-Handed'],
      },
      {
        name: 'Longsword', damage: '1d8+4', damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (4)',
        hitBonus: 6,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (4) + Proficiency (2)',
        range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
        properties: ['Versatile'],
      },
    ]);
  });
});
