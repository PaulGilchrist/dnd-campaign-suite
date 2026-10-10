// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// ---------------------------------------------------------------------------
// Module-level stubs
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

describe('attackCalc2024 - special attacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Swift Quiver', () => {
    it('adds Swift Quiver attacks when concentration is active', async () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const combatData = await import('../../encounters/combatData.js');
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Test Character', concentration: { spell: 'Swift Quiver' } }],
      });

      const allEquipment = [
        {
          name: 'Longbow',
          equipment_category: 'Ranged',
          weapon_range: 'Ranged',
          properties: ['Ammunition'],
          damage: { damage_dice: '1d8', damage_type: 'Piercing' },
          range: { normal: '80_ft', long: '200_ft' },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 5,
        name: 'Test Character',
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Longbow'] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Swift Quiver (1st Attack)');
      expect(result[1].name).toBe('Swift Quiver (2nd Attack)');
      expect(result[0].isSwiftQuiver).toBe(true);
      expect(result[0].actionType).toBe('Bonus Action');
      expect(result[0].type).toBe('Bonus Action');
      expect(result[1].type).toBe('Bonus Action');
    });

    it('handles numeric weapon range from live equipment data (SP-129)', async () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const combatData = await import('../../encounters/combatData.js');
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Test Character', concentration: { spell: 'Swift Quiver' } }],
      });

      const allEquipment = [
        {
          name: 'Longbow',
          equipment_category: 'Weapon',
          weapon_range: 'Ranged',
          properties: ['Ammunition', 'Heavy', 'Two-Handed'],
          damage: { damage_dice: '1d8', damage_type: 'Piercing' },
          range: { normal: 150, long: 600 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 17,
        name: 'Test Character',
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 20, abilityImprovements: 0, miscBonus: 0, bonus: 5 },
        ],
        inventory: { equipped: ['Longbow'] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].range).toBe(600);
      expect(result[0].type).toBe('Bonus Action');
      expect(result[0].hitBonus).toBe(11);
      expect(result[0].damage).toBe('1d8+5');
    });

    it('threads playerStats.campaignName into getCombatSummary for the concentration gate (SP-129)', async () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const combatData = await import('../../encounters/combatData.js');
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Test Character', concentration: { spell: 'Swift Quiver' } }],
      });

      const allEquipment = [
        {
          name: 'Longbow',
          equipment_category: 'Weapon',
          weapon_range: 'Ranged',
          properties: ['Ammunition', 'Heavy', 'Two-Handed'],
          damage: { damage_dice: '1d8', damage_type: 'Piercing' },
          range: { normal: 150, long: 600 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 5,
        name: 'Test Character',
        campaignName: 'test-campaign',
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Longbow'] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
      expect(combatData.getCombatSummary).toHaveBeenCalledWith('test-campaign');
    });

    it('does not add Swift Quiver attacks when concentration is not active', async () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const combatData = await import('../../encounters/combatData.js');
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Test Character' }],
      });

      const allEquipment = [
        {
          name: 'Longbow',
          equipment_category: 'Ranged',
          weapon_range: 'Ranged',
          properties: ['Ammunition'],
          damage: { damage_dice: '1d8', damage_type: 'Piercing' },
          range: { normal: '80_ft', long: '200_ft' },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 5,
        name: 'Test Character',
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Longbow'] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      // No Swift Quiver, no weapons found via findEquippedWeapons, so fallback unarmed strike
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });

  describe('Starry Form', () => {
    it('adds Starry Form Archer attack when the buff is active', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        activeBuffs: [{ name: 'Starry Form', constellation: 'Archer' }],
        spellAbilities: { toHit: 5 },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Starry Form: Luminous Arrow');
      expect(result[0].attackType).toBe('spell');
      expect(result[0].damage).toBe('1d8+3');
      expect(result[0].damageType).toBe('Radiant');
      expect(result[0].actionType).toBe('Bonus Action');
    });

    it('uses 2d8 damage for Starry Form Archer at level 10+ (Twinkled)', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 10,
        abilities: [
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        activeBuffs: [{ name: 'Starry Form', constellation: 'Archer' }],
        spellAbilities: { toHit: 5 },
      });

      const result = getAttacks([], [], playerStats);

      expect(result[0].damage).toBe('2d8+3');
    });

    it('does not add Starry Form attack when the buff is not active', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        activeBuffs: [],
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });
  });
});
