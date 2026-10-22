// @maintained-by-ai
import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { collectWeaponMastery } from '../../combat/automation/automationPassives.js';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';

// Lane ownership: this file covers ONLY getAttacks integration branches of the
// 5e attackCalc.js that attackCalc.test.js (unit lane: parseMagicItemName,
// findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, resolveSpellDamageAtLevel,
// core getAttacks wiring incl. magic weapons + monk martial arts) does not reach:
// Druidic Warrior, Thrown Weapon Fighting, Starry Form append, and the
// Nick-mastery off-hand action-type runtime seam. 2024 twins live in attackCalc2024-*.

// Stub the runtime module for getCurrentCombatRound and getRuntimeValue
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
}));

// Stub starryFormDamage
vi.mock('./starryFormDamage.js', () => ({
  buildStarryFormLuminousArrow: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allEquipment = [
  {
    name: 'Longsword',
    equipment_category: 'Weapon',
    weapon_range: 'Melee',
    damage: { damage_dice: '1d8', damage_type: 'Slashing' },
    range: { normal: 5 },
    properties: [],
    mastery: null,
  },
  {
    name: 'Dagger',
    equipment_category: 'Weapon',
    weapon_range: 'Melee',
    damage: { damage_dice: '1d4', damage_type: 'Piercing' },
    range: { normal: 5 },
    properties: ['Light'],
  },
  {
    name: 'Shortsword',
    equipment_category: 'Weapon',
    weapon_range: 'Melee',
    damage: { damage_dice: '1d6', damage_type: 'Piercing' },
    range: { normal: 5 },
    properties: ['Light', 'Finesse'],
  },
  {
    name: 'Hand Crossbow',
    equipment_category: 'Weapon',
    weapon_range: 'Ranged',
    damage: { damage_dice: '1d6', damage_type: 'Piercing' },
    range: { normal: 50 },
    properties: ['Light', 'Thrown'],
  },
];

const makePlayerStats = (overrides = {}) => ({
  level: 5,
  proficiency: 3,
  abilities: [
    { name: 'Strength', bonus: 3 },
    { name: 'Dexterity', bonus: 2 },
    { name: 'Constitution', bonus: 1 },
    { name: 'Intelligence', bonus: 0 },
    { name: 'Wisdom', bonus: 1 },
    { name: 'Charisma', bonus: -1 },
  ],
  class: {
    name: 'Fighter',
    fightingStyles: [],
    ...overrides.class,
  },
  inventory: {
    equipped: overrides.equipped || [],
  },
  campaignName: 'test-campaign',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attackCalc getAttacks edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Druidic Warrior fighting style', () => {
    // Production numeric extraction from extraDamage keeps only the trailing
    // number ('+2 + +2' → 2), so Druidic+Dueling still totals one +2.
    it.each`
      fightingStyles                    | expectedDamage | expectedFormulaContains
      ${['Druidic Warrior']}          | ${'1d8+5'}     | ${['Druidic Warrior (2)']}
      ${['Druidic Warrior', 'Dueling']} | ${'1d8+5'}  | ${['Dueling Fighting Style (2)', 'Druidic Warrior (2)']}
    `('should apply Druidic Warrior +2 damage on main hand with styles $fightingStyles', ({ fightingStyles, expectedDamage, expectedFormulaContains }) => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // str(3) + druidic extra(2) = 5
      expect(result[0].damage).toBe(expectedDamage);
      for (const part of expectedFormulaContains) {
        expect(result[0].damageFormula).toContain(part);
      }
    });

    it('should apply Druidic Warrior +2 to off-hand attacks without ability bonus', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Druidic Warrior'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[1].name).toBe('Dagger');
      expect(result[1].damage).toBe('1d4+2');
      expect(result[1].damageFormula).toContain('Druidic Warrior (2)');
    });
  });

  describe('Thrown Weapon Fighting', () => {
    it('should add thrown proficiency bonus to ranged attack to-hit', () => {
      const playerStats = makePlayerStats({
        equipped: ['Hand Crossbow'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Hand Crossbow');
      // dex(2) + prof(3) + thrownProfBonus(3) = 8
      expect(result[0].hitBonus).toBe(8);
      expect(result[0].hitBonusFormula).toContain('Thrown Weapon Fighting');
    });

    // #1233/#1234 disk law: public/data/equipment.json names the item 'Shortsword'
    // (one word, index 'shortsword'); the space spelling 'Short Sword' exists NOWHERE
    // on disk (also census-checked: no campaign/homebrew carries it). attackCalc's
    // buildThrownShortSwordAttacks used to match 'Short Sword', so the thrown-Shortsword
    // row was UNREACHABLE on real data. These pins extract the disk row at load and
    // throw on census drift rather than testing a stale name.
    const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
    const DISK_SHORTSWORD = diskEquipment.find(e => e.name === 'Shortsword');
    const thrownRows = rows => rows.filter(a => a.hitBonusFormula.includes('Thrown Weapon Fighting (Proficiency)'));

    it('disk lock (#1233): canonical name is "Shortsword", space variant "Short Sword" absent from equipment.json', () => {
      expect(DISK_SHORTSWORD, 'equipment.json must carry a "Shortsword" row').toBeDefined();
      expect(DISK_SHORTSWORD.name).toBe('Shortsword');
      expect(DISK_SHORTSWORD.weapon_range).toBe('Melee');
      expect(DISK_SHORTSWORD.damage.damage_dice).toBe('1d6');
      expect(DISK_SHORTSWORD.range.normal).toBe(5);
      expect(diskEquipment.some(e => e.name === 'Short Sword')).toBe(false);
    });

    it('real-disk-name leg (#1234): TWF + equipped disk Shortsword row builds the thrown attack', () => {
      // Pre-fix capture: with the 'Short Sword' match this fixture produced NO thrown
      // row — the space-name literal never appears on disk, so the builder was dead.
      const playerStats = makePlayerStats({
        equipped: ['Shortsword'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks([DISK_SHORTSWORD], [], playerStats);
      const thrown = thrownRows(result);
      expect(thrown).toHaveLength(1);
      expect(thrown[0].name).toBe('Shortsword');
      // dex(2) + prof(3) + thrownProfBonus(3) = 8; range from disk row (normal 5)
      expect(thrown[0].hitBonus).toBe(8);
      expect(thrown[0].range).toBe(5);
      expect(thrown[0].type).toBe('Action');
      expect(thrown[0].damage).toBe('1d6+2');
      // the plain melee Shortsword row coexists without the thrown bonus
      // (melee main-hand picks max(str 3, dex 2) = str 3 → 3+3)
      const melee = result.filter(a => a.name === 'Shortsword' && !thrownRows([a]).length);
      expect(melee).toHaveLength(1);
      expect(melee[0].hitBonus).toBe(6);
    });

    it('magical equip name "+1 Shortsword" reaches the thrown builder via magic-prefix strip', () => {
      const playerStats = makePlayerStats({
        equipped: ['+1 Shortsword'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks([DISK_SHORTSWORD], [], playerStats);
      const thrown = thrownRows(result);
      expect(thrown).toHaveLength(1);
      expect(thrown[0].name).toBe('+1 Shortsword');
      // dex(2) + prof(3) + magic(1) + thrownProfBonus(3) = 9
      expect(thrown[0].hitBonus).toBe(9);
    });

    it('legacy space-name fixture is REJECTED (#1233 match design): exact disk literal only', () => {
      // Sibling name-matches in attackCalc are exact ('Hand Crossbow', 'Shield'), so
      // the fix stays exact on 'Shortsword'; a fake homebrew 'Short Sword' row (which
      // production data never carries) must NOT build the thrown row.
      const fakeSpaceRow = { ...DISK_SHORTSWORD, name: 'Short Sword', index: 'short-sword' };
      const playerStats = makePlayerStats({
        equipped: ['Short Sword'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks([fakeSpaceRow], [], playerStats);
      expect(thrownRows(result)).toHaveLength(0);
    });

    it('#1348 arms: Longsword equipped never builds a thrown row', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(thrownRows(result)).toHaveLength(0);
      expect(result[0].name).toBe('Longsword');
    });
  });

  describe('Starry Form Archer integration in 5e', () => {
    it('should append Starry Form: Luminous Arrow spell attack when buff is active', () => {
      const playerStats = makePlayerStats({
        equipped: [],
        abilities: [
          { name: 'Strength', bonus: 0 },
          { name: 'Dexterity', bonus: 0 },
          { name: 'Wisdom', bonus: 3 },
        ],
        activeBuffs: [{ name: 'Starry Form', constellation: 'Archer' }],
        spellAbilities: { toHit: 5 },
      });

      vi.mocked(buildStarryFormLuminousArrow).mockReturnValue({
        name: 'Starry Form: Luminous Arrow',
        attackType: 'spell',
        isRanged: true,
        range: '120_ft',
        toHit: 5,
        hitBonusFormula: 'To Hit Bonus = Spell Attack Modifier (5)',
        damageFormula: 'Damage Formula = 1d8 + Wisdom Modifier (3)',
        damage: {
          damage_dice: '1d8',
          damage_type: 'Radiant',
          damage_at_character_level: { 5: '1d8 + 3' },
        },
        abilityName: 'Wisdom',
        actionType: 'Bonus Action',
      });

      const result = getAttacks([], [], playerStats);
      // Fallback unarmed strike + appended starry arrow = 2
      expect(result).toHaveLength(2);
      const starryArrow = result.find(a => a.name === 'Starry Form: Luminous Arrow');
      expect(starryArrow.attackType).toBe('spell');
    });
  });

  describe('Nick mastery off-hand action type', () => {
    // Off-hand 'Dagger' row type resolves via collectWeaponMastery +
    // _Nick_UsedRound runtime latch against getCurrentCombatRound().
    it.each`
      scenario                          | baseMastery | extraMasteries      | nickUsedRound | expected
      ${'Nick main mastery, latched'}   | ${'Nick'}   | ${[]}               | ${3}          | ${'Action'}
      ${'Nick main mastery, stale'}     | ${'Nick'}   | ${[]}               | ${2}          | ${'Bonus Action'}
      ${'Nick in extraMasteries'}       | ${'Push'}   | ${['Nick', 'Topple']} | ${3}      | ${'Action'}
      ${'no Nick anywhere'}             | ${'Push'}   | ${['Topple']}       | ${3}          | ${'Bonus Action'}
      ${'no masteries'}                 | ${null}     | ${[]}               | ${3}          | ${'Bonus Action'}
    `('$scenario → $expected', ({ baseMastery, extraMasteries, nickUsedRound, expected }) => {
      vi.mocked(getCurrentCombatRound).mockReturnValue(3);
      vi.mocked(getRuntimeValue).mockReturnValue(nickUsedRound);
      vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery, extraMasteries });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      expect(result[1].name).toBe('Dagger');
      expect(result[1].type).toBe(expected);
    });

    it('should skip the Nick runtime check when no campaign is active', () => {
      vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: 'Nick', extraMasteries: [] });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        campaignName: null,
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      expect(result[1].type).toBe('Bonus Action');
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
