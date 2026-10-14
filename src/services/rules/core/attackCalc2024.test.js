import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// ---------------------------------------------------------------------------
// Module-level stubs for functions that getAttacks calls internally.
// We replace the real implementations with controlled stubs so that
// getAttacks' branching logic (ranged vs melee, monk, spells, etc.) is
// exercised while keeping each test focused on one path.
// ---------------------------------------------------------------------------

const findEquippedWeaponsStub = vi.fn();
const buildWeaponAttackStub = vi.fn((opts) => ({
  name: opts.weaponName,
  damage: opts.includeAbilityBonusInDamage !== false
    ? `${opts.weapon.damage.damage_dice}+${opts.abilityBonus}`
    : opts.weapon.damage.damage_dice,
  damageType: opts.weapon.damage.damage_type,
  damageFormula: 'Damage Formula',
  hitBonus: opts.abilityBonus + opts.proficiency,
  hitBonusFormula: 'Hit Bonus Formula',
  range: opts.weapon.range?.normal ?? 5,
  type: opts.actionType,
  weaponType: opts.weaponType,
}));
const buildMonkAttacksStub = vi.fn((_opts) => [
  {
    name: 'Unarmed Strike',
    damage: `${_opts.diceStr}+${_opts.dexterityBonus}`,
    damageType: 'Bludgeoning',
    damageFormula: 'Damage Formula',
    hitBonus: _opts.dexterityBonus + _opts.proficiency,
    hitBonusFormula: 'Hit Bonus Formula',
    range: 5,
    type: 'Action',
  },
  {
    name: 'Unarmed Strike',
    damage: `${_opts.diceStr}+${_opts.dexterityBonus}`,
    damageType: 'Bludgeoning',
    damageFormula: 'Damage Formula',
    hitBonus: _opts.dexterityBonus + _opts.proficiency,
    hitBonusFormula: 'Hit Bonus Formula',
    range: 5,
    type: 'Bonus Action',
  },
]);

vi.mock('./attackCalc.js', () => ({
  parseMagicItemName: (name) =>
    name && name.charAt(0) === '+'
      ? { baseName: name.substring(3), magicBonus: Number(name.charAt(1)) || 0 }
      : { baseName: name, magicBonus: 0 },
  findEquippedWeapons: (...args) => findEquippedWeaponsStub(...args),
  buildWeaponAttack: (...args) => buildWeaponAttackStub(...args),
  buildMonkAttacks: (...args) => buildMonkAttacksStub(...args),
  parseDamageDice: (diceStr) => {
    const match = String(diceStr).match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const [, count, sides] = match;
    return parseInt(count, 10) * (parseInt(sides, 10) + 1) / 2;
  },
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getMartialArtsDie: vi.fn(() => 8),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultPlayerStats = (overrides = {}) => ({
  level: 1,
  abilities: [
    { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
    { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
  ],
  inventory: { equipped: [] },
  automation: { passives: [], bonusActions: [] },
  activeBuffs: [],
  class: { name: 'Fighter' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attackCalc2024', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAttacks', () => {
    it('returns unarmed strike when the character has no weapons, spells, or special features', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const result = getAttacks([], [], defaultPlayerStats());

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });

    it('selects Dexterity for ranged weapon attacks', () => {
      // Ranged returns Shortbow, melee returns empty
      findEquippedWeaponsStub
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce([]);

      const allEquipment = [
        {
          name: 'Shortbow',
          equipment_category: 'Weapon',
          weapon_range: 'Ranged',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 80 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0, bonus: -1 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shortbow');
      expect(result[0].type).toBe('Action');
      expect(result[0].range).toBe(80);
      expect(result[0].damageType).toBe('Piercing');
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityName: 'Dexterity',
          abilityBonus: 3,
          proficiency: 2,
          actionType: 'Action',
        })
      );
    });

    it('selects Strength for melee weapon attacks when Strength > Dexterity', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Longsword']);

      const allEquipment = [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d8', damage_type: 'Slashing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Longsword');
      expect(result[0].damageType).toBe('Slashing');
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityName: 'Strength',
          abilityBonus: 4,
        })
      );
    });

    it('selects Dexterity for melee weapon attacks when Dexterity > Strength', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Rapier']);

      const allEquipment = [
        {
          name: 'Rapier',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d8', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityName: 'Dexterity',
          abilityBonus: 4,
        })
      );
    });

    it('ties to Dexterity when Strength and Dexterity bonuses are equal for melee', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityName: 'Dexterity',
          abilityBonus: 2,
        })
      );
    });

    it('places all non-light melee weapons in CharActions when <2 light weapons', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Dagger']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
        {
          name: 'Dagger',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d4', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Action');
      expect(result[0].name).toBe('Shortsword');
      expect(result[1].name).toBe('Dagger');
    });

    it('includes ability bonus in damage for all melee weapons in CharActions', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Dagger']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
        {
          name: 'Dagger',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d4', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      // Both weapons in Action, both with ability bonus
      expect(result[0].damage).toContain('+2');
      expect(result[1].damage).toContain('+2');
    });

    it('includes both ranged and melee weapon attacks when both are equipped', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce(['Longsword']);

      const allEquipment = [
        {
          name: 'Shortbow',
          equipment_category: 'Weapon',
          weapon_range: 'Ranged',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 80 },
        },
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d8', damage_type: 'Slashing' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
    });

    it('handles off-hand with Dual Wielder feat bonus action attack', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Dagger', 'Sickle']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
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
          name: 'Sickle',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d4', damage_type: 'Slashing' },
          range: { normal: 5 },
          properties: ['Light'],
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
        automation: {
          passives: [],
          bonusActions: [
            { type: 'bonus_attacks', trigger: 'attack_action_with_light_weapon' },
          ],
        },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      // Shortsword (non-light) Action + Dagger (light, highest damage) Action + Sickle (light, Bonus Action) + Dual Wielder extra = 4
      expect(result).toHaveLength(4);
      expect(result[2].name).toBe('Sickle');
      expect(result[2].type).toBe('Bonus Action');
      expect(result[3].name).toBe('Dual Wielder Extra Attack');
    });

    it('does not add Dual Wielder extra without the feat', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Dagger', 'Sickle']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
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
          name: 'Sickle',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d4', damage_type: 'Slashing' },
          range: { normal: 5 },
          properties: ['Light'],
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
        automation: { passives: [], bonusActions: [] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      // Shortsword (non-light) Action + Dagger (light, highest) Action + Sickle (light, Bonus Action) = 3
      expect(result).toHaveLength(3);
    });

    it('includes ability bonus on off-hand for Light Crossbow with Crossbow Expert Dual Wielding passive', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Hand Crossbow', 'Dagger']);

      const allEquipment = [
        {
          name: 'Shortsword',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
        },
        {
          name: 'Hand Crossbow',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 5 },
          properties: ['Light'],
        },
        {
          name: 'Dagger',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d4', damage_type: 'Piercing' },
          range: { normal: 5 },
          properties: ['Light'],
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: { name: 'Fighter' },
        automation: {
          passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
          bonusActions: [],
        },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      // Shortsword (non-light) Action + Hand Crossbow (light, highest damage) Action + Dagger (light, Bonus Action with TWF) = 3
      expect(result).toHaveLength(3);
      // Dagger in Bonus Action should have ability bonus from two_weapon_fighting passive
      expect(result[2].name).toBe('Dagger');
      expect(result[2].type).toBe('Bonus Action');
      expect(result[2].damage).toContain('+2');
    });
  });
});
