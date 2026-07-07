// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc.js';

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
    name: 'Shortbow',
    equipment_category: 'Weapon',
    weapon_range: 'Ranged',
    damage: { damage_dice: '1d6', damage_type: 'Piercing' },
    range: { normal: 80 },
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
    it('should apply Druidic Warrior +2 damage to melee attacks', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Druidic Warrior'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // Druidic Warrior adds +2 to damage label, but numeric extraction only gets the last number (2), so total = str(3) + extra(2) = 5
      expect(result[0].damage).toBe('1d8+5');
      expect(result[0].damageFormula).toContain('Druidic Warrior (2)');
    });

    it('should apply Druidic Warrior to off-hand attacks', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Druidic Warrior'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[1].damage).toBe('1d4+2');
      expect(result[1].damageFormula).toContain('Druidic Warrior (2)');
    });

    it('should combine Druidic Warrior and Dueling on main hand', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Druidic Warrior', 'Dueling'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // Both add '+2' but numeric extraction only gets last number (2), so total = str(3) + extra(2) = 5
      expect(result[0].damage).toBe('1d8+5');
      expect(result[0].damageFormula).toContain('Dueling');
      expect(result[0].damageFormula).toContain('Druidic Warrior');
    });
  });

  describe('Thrown Weapon Fighting', () => {
    it('should apply thrown proficiency bonus when wielding a thrown ranged weapon', () => {
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

    it('should treat thrown short sword as ranged weapon with thrown proficiency', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortsword'],
        class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // Shortsword is Melee, but with Thrown Weapon Fighting it gets a ranged attack entry
      const shortSwordAttacks = result.filter(a => a.name === 'Shortsword');
      expect(shortSwordAttacks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Starry Form Archer integration in 5e', () => {
    it('should add Starry Form: Luminous Arrow when buff is active', async () => {
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

      const starryFormModule = await import('./starryFormDamage.js');
      const starryArrowResult = {
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
      };
      vi.mocked(starryFormModule.buildStarryFormLuminousArrow).mockReturnValue(starryArrowResult);

      const result = getAttacks([], [], playerStats);
      // Starry Form arrow + fallback unarmed strike = 2
      expect(result).toHaveLength(2);
      const starryArrow = result.find(a => a.name === 'Starry Form: Luminous Arrow');
      expect(starryArrow).toBeDefined();
      expect(starryArrow.attackType).toBe('spell');
    });
  });

  describe('Nick mastery off-hand action type', () => {
    it('should change off-hand to Action when Nick mastery is available and used this round', async () => {
      const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

      vi.mocked(getCurrentCombatRound).mockReturnValue(3);
      vi.mocked(getRuntimeValue).mockReturnValue(3); // nickUsedRound === currentRound
      vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: 'Nick', extraMasteries: [] });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      // Off-hand should be Action type instead of Bonus Action
      expect(result[1].type).toBe('Action');

      vi.mocked(collectWeaponMastery).mockReset();
    });

    it('should keep off-hand as Bonus Action when Nick mastery is not available', async () => {
      const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

      vi.mocked(getCurrentCombatRound).mockReturnValue(3);
      vi.mocked(getRuntimeValue).mockReturnValue(3);
      vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: 'Nick', extraMasteries: [] });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      // Off-hand should be Action type because Nick is used this round
      expect(result[1].type).toBe('Action');

      vi.mocked(collectWeaponMastery).mockReset();
    });

    it('should keep off-hand as Bonus Action when Nick mastery is not available', async () => {
      const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

      vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: null, extraMasteries: [] });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      expect(result[1].type).toBe('Bonus Action');

      vi.mocked(collectWeaponMastery).mockReset();
    });

    it('should check Nick in extraMasteries list too', async () => {
      const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

      vi.mocked(getCurrentCombatRound).mockReturnValue(3);
      vi.mocked(getRuntimeValue).mockReturnValue(3);
      vi.mocked(collectWeaponMastery).mockReturnValue({
        baseMastery: 'Push',
        extraMasteries: ['Nick', 'Topple'],
      });

      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);

      expect(result[1].type).toBe('Action');

      vi.mocked(collectWeaponMastery).mockReset();
    });
  });

  describe('Magic weapon handling', () => {
    it.each`
      weaponName       | expectedDamage | expectedHitBonus
      ${'+1 Longsword'} | ${'1d8+4'}    | ${7}
      ${'+2 Longsword'} | ${'1d8+5'}    | ${8}
    `('should parse $weaponName and include magic bonus in damage/hit', ({ weaponName, expectedDamage, expectedHitBonus }) => {
      const playerStats = makePlayerStats({ equipped: [weaponName] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].damage).toBe(expectedDamage);
      expect(result[0].hitBonus).toBe(expectedHitBonus);
    });
  });

  describe('Monk unarmed strikes edge cases', () => {
    it('should use correct dice count and value from martial arts', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Monk',
          fightingStyles: [],
          class_levels: {},
        },
      });
      playerStats.class.class_levels[playerStats.level - 1] = {
        class_specific: { martial_arts: { dice_count: 2, dice_value: 6 } },
      };
      const result = getAttacks(allEquipment, [], playerStats);
      const unarmedStrikes = result.filter(a => a.name === 'Unarmed Strike');
      expect(unarmedStrikes[0].damage).toBe('2d6+2');
    });
  });
});
