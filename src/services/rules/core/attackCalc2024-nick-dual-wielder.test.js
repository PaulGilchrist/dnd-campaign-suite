// @maintained-by-ai
// Nick off-hand latch + Dual Wielder feat lanes of 2024 getAttacks, real builders
// end-to-end per the #1235-#1239 canon: the wholesale attackCalc.js builder stubbing
// and the collectWeaponMastery mock are retired — every expectation below is canonical
// buildWeaponAttack/buildDualWielderAttack output bytes, so any miswired latch, bonus
// fold, magic parse, mastery, or row order fails a full toEqual. Only combatData and
// useRuntimeState stay stubbed (SSE/runtime-backed, unavoidable; getCombatSummary null
// keeps Swift Quiver off). The real collectWeaponMastery kind gate (WM-008) requires a
// weapon_kind_mastery passive plus _Weapon_Kind_Mastery_chosenWeapons for any base
// mastery to survive, so the Nick cases supply exactly that (wm003 pattern).
// Fixtures transcribed from public/data/equipment.json (verified 2026-10-20): Dagger/
// Sickle Nick, Handaxe/Shortsword Vex, Club Slow, Longsword Sap, Greatsword Graze.
// The old custom 'Acidic Spear' (fake Light 1d6) fixture is retired — disk rows only.
// Lane splits (verified 2026-10-20):
// - Light-melee seam (no campaign) → attackCalc2024-light-melee.test.js (#1236)
// - Nick canonical mapping via kind-gate buckets → attackCalc2024.wm003-nick.test.js
//   (this file keeps only the genuinely distinct latch states: stale-round falsifier
//   per #1233 and the no-campaignName early-return branch)
// - Fighting-style gates → attackCalc2024-fighting-styles.test.js (#1237)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 3),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Fixtures — transcribed from public/data/equipment.json (verified 2026-10-20)
// ---------------------------------------------------------------------------

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
  weapon_range: 'Melee',
  weapon_category: 'Simple',
  damage: { damage_dice: '1d6', damage_type: 'Slashing' },
  range: { normal: 5, long: null },
  properties: ['Light', 'Thrown', 'Monk'],
  mastery: 'Vex',
};

const SHORTSWORD = {
  name: 'Shortsword',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  weapon_category: 'Martial',
  damage: { damage_dice: '1d6', damage_type: 'Piercing' },
  range: { normal: 5, long: null },
  properties: ['Finesse', 'Light', 'Monk'],
  mastery: 'Vex',
};

const CLUB = {
  name: 'Club',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  weapon_category: 'Simple',
  damage: { damage_dice: '1d4', damage_type: 'Bludgeoning' },
  range: { normal: 5, long: null },
  properties: ['Light', 'Monk'],
  mastery: 'Slow',
};

const DAGGER = {
  name: 'Dagger',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  weapon_category: 'Simple',
  damage: { damage_dice: '1d4', damage_type: 'Piercing' },
  range: { normal: 5, long: null },
  properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
  mastery: 'Nick',
};

const GREATSWORD = {
  name: 'Greatsword',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  weapon_category: 'Martial',
  damage: { damage_dice: '2d6', damage_type: 'Slashing' },
  range: { normal: 5, long: null },
  properties: ['Heavy', 'Two-Handed'],
  mastery: 'Graze',
};

const CATALOG = [LONGSWORD, HANDAXE, SHORTSWORD, CLUB, DAGGER, GREATSWORD];

const KIND_MASTERY = [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery', meleeOnly: false }];
const DUAL_WIELDER = [{ type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' }];

// lv5 Fighter, PB +3. Default STR +3 > DEX 0 → Strength drives every row.
const str = (bonus, score) => ({ name: 'Strength', baseScore: score, bonus });
const dex = (bonus, score) => ({ name: 'Dexterity', baseScore: score, bonus });
const char = ({ equipped, campaignName, abilities = [str(3, 16), dex(0, 10)], passives = [], bonusActions = [] }) => ({
  name: 'Test Character',
  level: 5,
  class: { name: 'Fighter' },
  abilities,
  inventory: { equipped },
  equipment: CATALOG,
  automation: { passives, bonusActions },
  activeBuffs: [],
  ...(campaignName ? { campaignName } : {}),
});

// Canonical builder rows used by more than one case.
const HANDAXE_ACTION = {
  name: 'Handaxe', damage: '1d6+3', damageType: 'Slashing',
  damageFormula: 'Damage Formula = Weapon (1d6) + Strength Bonus (3)',
  hitBonus: 6,
  hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
  range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
  properties: ['Light', 'Thrown', 'Monk'],
};
const LONGSWORD_ACTION = {
  name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
  damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3)',
  hitBonus: 6,
  hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
  range: 5, type: 'Action', weaponType: 'melee', mastery: 'Sap',
  properties: ['Versatile'],
};
const SHORTSWORD_ACTION = {
  name: 'Shortsword', damage: '1d6+3', damageType: 'Piercing',
  damageFormula: 'Damage Formula = Weapon (1d6) + Strength Bonus (3)',
  hitBonus: 6,
  hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
  range: 5, type: 'Action', weaponType: 'melee', mastery: 'Vex',
  properties: ['Finesse', 'Light', 'Monk'],
};
const daggerOffRow = (type) => ({
  name: 'Dagger', damage: '1d4', damageType: 'Piercing',
  damageFormula: 'Damage Formula = Weapon (1d4)',
  hitBonus: 6,
  hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
  range: 5, type, weaponType: 'melee', mastery: 'Nick',
  properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
});

describe('attackCalc2024 - Nick off-hand latch faces', () => {
  let getRuntimeValue;
  let getCurrentCombatRound;

  beforeEach(async () => {
    vi.clearAllMocks();
    getRuntimeValue = (await import('../../../hooks/runtime/useRuntimeState.js')).getRuntimeValue;
    getCurrentCombatRound = (await import('../../encounters/combatData.js')).getCurrentCombatRound;
    vi.mocked(getCurrentCombatRound).mockReturnValue(3);
  });

  // Handaxe (Vex 1d6, highest) is main-hand Action; the Nick off-hand row's
  // action type is decided solely by the round latch (and campaign presence).
  it.each([
    {
      label: 'latched this round (nickUsedRound 3 === round 3): Nick off-hand promoted to Action',
      campaignName: 'test-campaign',
      nickUsedRound: 3,
      rows: [HANDAXE_ACTION, daggerOffRow('Action')],
    },
    {
      label: 'stale latch falsifier (nickUsedRound 2 !== round 3): off-hand stays Bonus Action',
      campaignName: 'test-campaign',
      nickUsedRound: 2,
      rows: [HANDAXE_ACTION, daggerOffRow('Bonus Action')],
    },
    {
      label: 'localhost falsifier (no campaignName): latch never consulted, off-hand stays Bonus Action even with a latched round stored',
      campaignName: undefined,
      nickUsedRound: 3,
      rows: [HANDAXE_ACTION, daggerOffRow('Bonus Action')],
    },
  ])('$label', ({ campaignName, nickUsedRound, rows }) => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Handaxe', 'Dagger'];
      if (key === '_Nick_UsedRound') return nickUsedRound;
      return null;
    });

    expect(getAttacks(CATALOG, [], char({ equipped: ['Handaxe', 'Dagger'], campaignName, passives: KIND_MASTERY }))).toEqual(rows);
  });
});

describe('attackCalc2024 - Dual Wielder feat row faces (FT-104)', () => {
  // No campaignName: off-hand action types come from the pure light-melee seam;
  // these cases pin the feat-row gate, off-hand selection, and magic/negative folds.
  it.each([
    {
      label: 'non-holder gate falsifier: Longsword+Shortsword gets zero Dual Wielder rows',
      equipped: ['Longsword', 'Shortsword'],
      bonusActions: [],
      abilities: [str(3, 16), dex(0, 10)],
      rows: [LONGSWORD_ACTION, SHORTSWORD_ACTION],
    },
    {
      label: 'holder of Light+non-Light pair: exactly one off-hand Bonus row, dice-only damage (positive STR excluded)',
      equipped: ['Longsword', 'Shortsword'],
      bonusActions: DUAL_WIELDER,
      abilities: [str(3, 16), dex(0, 10)],
      rows: [
        LONGSWORD_ACTION,
        SHORTSWORD_ACTION,
        {
          name: 'Dual Wielder Extra Attack', weaponName: 'Shortsword',
          attackType: 'melee', isRanged: false, weaponType: 'melee', range: 5,
          toHit: 6, hitBonus: 6,
          hitBonusFormula: 'To Hit Bonus = Strength Modifier (3) + Proficiency (3)',
          damageFormula: 'Damage Formula = 1d6', damage: '1d6', damageType: 'Piercing',
          abilityName: 'Strength', type: 'Bonus Action', actionType: 'Bonus Action',
          mastery: 'Vex', properties: ['Finesse', 'Light', 'Monk'],
        },
      ],
    },
    {
      label: 'magic off-hand +2 Dagger: magic bonus folds into DW-row damage, hit, and both formula strings',
      equipped: ['Longsword', '+2 Dagger'],
      bonusActions: DUAL_WIELDER,
      abilities: [str(3, 16), dex(0, 10)],
      rows: [
        LONGSWORD_ACTION,
        {
          name: '+2 Dagger', damage: '1d4+5', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4) + Strength Bonus (3) + Weapon Magic Bonus (2)',
          hitBonus: 8,
          hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3) + Weapon Magic Bonus (2)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
        {
          name: 'Dual Wielder Extra Attack', weaponName: '+2 Dagger',
          attackType: 'melee', isRanged: false, weaponType: 'melee', range: 5,
          toHit: 8, hitBonus: 8,
          hitBonusFormula: 'To Hit Bonus = Strength Modifier (3) + Proficiency (3) + Weapon Magic Bonus (2)',
          damageFormula: 'Damage Formula = 1d4 + Weapon Magic Bonus (2)',
          damage: '1d4+2', damageType: 'Piercing',
          abilityName: 'Strength', type: 'Bonus Action', actionType: 'Bonus Action',
          mastery: 'Nick', properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
      ],
    },
    {
      label: 'FT-104 negative ability modifier IS added to DW-row damage: 1d4-1, hit 2, Dexterity label on -1/-1 tie',
      equipped: ['Club', 'Dagger'],
      bonusActions: DUAL_WIELDER,
      abilities: [str(-1, 8), dex(-1, 8)],
      rows: [
        {
          name: 'Club', damage: '1d4-1', damageType: 'Bludgeoning',
          damageFormula: 'Damage Formula = Weapon (1d4) + Dexterity Bonus (-1)',
          hitBonus: 2,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (-1) + Proficiency (3)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Slow',
          properties: ['Light', 'Monk'],
        },
        {
          name: 'Dagger', damage: '1d4', damageType: 'Piercing',
          damageFormula: 'Damage Formula = Weapon (1d4)',
          hitBonus: 2,
          hitBonusFormula: 'To Hit Bonus Formula = Dexterity Bonus (-1) + Proficiency (3)',
          range: 5, type: 'Bonus Action', weaponType: 'melee', mastery: 'Nick',
          properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
        {
          name: 'Dual Wielder Extra Attack', weaponName: 'Dagger',
          attackType: 'melee', isRanged: false, weaponType: 'melee', range: 5,
          toHit: 2, hitBonus: 2,
          hitBonusFormula: 'To Hit Bonus = Dexterity Modifier (-1) + Proficiency (3)',
          damageFormula: 'Damage Formula = 1d4 + Dexterity Modifier (-1)',
          damage: '1d4-1', damageType: 'Piercing',
          abilityName: 'Dexterity', type: 'Bonus Action', actionType: 'Bonus Action',
          mastery: 'Nick', properties: ['Finesse', 'Light', 'Thrown', 'Monk'],
        },
      ],
    },
    {
      label: 'Two-Handed falsifier: DW holder with Shortsword+Greatsword gets no DW row',
      equipped: ['Shortsword', 'Greatsword'],
      bonusActions: DUAL_WIELDER,
      abilities: [str(3, 16), dex(0, 10)],
      rows: [
        {
          name: 'Greatsword', damage: '2d6+3', damageType: 'Slashing',
          damageFormula: 'Damage Formula = Weapon (2d6) + Strength Bonus (3)',
          hitBonus: 6,
          hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (3)',
          range: 5, type: 'Action', weaponType: 'melee', mastery: 'Graze',
          properties: ['Heavy', 'Two-Handed'],
        },
        SHORTSWORD_ACTION,
      ],
    },
  ])('$label', ({ equipped, bonusActions, abilities, rows }) => {
    expect(getAttacks(CATALOG, [], char({ equipped, bonusActions, abilities }))).toEqual(rows);
  });
});
