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

describe('attackCalc2024 - proficiency & edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Proficiency scaling', () => {
    it.each([
      [1, 2],
      [5, 3],
      [9, 4],
      [13, 5],
      [17, 6],
    ])('computes proficiency correctly at level %s (expected: %d)', (level, expectedProf) => {
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
        level,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Ranger' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({ proficiency: expectedProf })
      );
    });
  });

  describe('Spell attacks', () => {
    it('does not add spell attacks when spellAbilities are present', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        class: { name: 'Wizard' },
        spellAbilities: {
          modifier: 4,
          spells: [{ name: 'Fire Bolt', prepared: 'Prepared' }],
        },
      });
      const allSpells = [
        {
          name: 'Fire Bolt',
          damage: { damage_dice: '1d10', damage_type: 'Fire' },
          range: '120 feet',
          casting_time: '1 action',
        },
      ];

      const result = getAttacks([], allSpells, playerStats);

      // Spells no longer create attack objects; only the fallback unarmed strike
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
    });

    it('formats unarmed strike damage correctly with negative strength modifier', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 3,
        class: { name: 'Cleric' },
        abilities: [
          { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0, bonus: -1 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        proficiency: 2,
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe('1d4-1');
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(result[0].hitBonus).toBe(1);
    });
  });

  describe('Combined attacks', () => {
    it('combines multiple attack sources into one result array', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce(['Quarterstaff']);

      const allEquipment = [
        {
          name: 'Shortbow',
          equipment_category: 'Weapon',
          weapon_range: 'Ranged',
          damage: { damage_dice: '1d6', damage_type: 'Piercing' },
          range: { normal: 80 },
        },
        {
          name: 'Quarterstaff',
          equipment_category: 'Weapon',
          weapon_range: 'Melee',
          damage: { damage_dice: '1d6', damage_type: 'Bludgeoning' },
          range: { normal: 5 },
        },
      ];
      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Monk' },
        spellAbilities: {
          modifier: 3,
          spells: [{ name: 'Fire Bolt', prepared: 'Prepared' }],
        },
      });
      const allSpells = [
        {
          name: 'Fire Bolt',
          damage: { damage_dice: '1d10', damage_type: 'Fire' },
          range: '120 feet',
          casting_time: '1 action',
        },
      ];

      const result = getAttacks(allEquipment, allSpells, playerStats);

      // Ranged weapon (Shortbow) + Melee weapon (Quarterstaff) + 2 Monk attacks = 4 (no spell attacks)
      expect(result).toHaveLength(4);
    });
  });

  describe('Attack object shape', () => {
    it('returns attack objects with consistent shape for weapon attacks', () => {
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
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        class: { name: 'Fighter' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      const attack = result[0];
      expect(attack).toHaveProperty('name');
      expect(attack).toHaveProperty('damage');
      expect(attack).toHaveProperty('damageType');
      expect(attack).toHaveProperty('damageFormula');
      expect(attack).toHaveProperty('hitBonus');
      expect(attack).toHaveProperty('hitBonusFormula');
      expect(attack).toHaveProperty('range');
      expect(attack).toHaveProperty('type');
      expect(typeof attack.hitBonus).toBe('number');
      expect(typeof attack.range).toBe('number');
    });

    it('returns attack objects with consistent shape for Soulknife attacks', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        class: {
          name: 'Rogue',
          major: { name: 'Soulknife' },
        },
      });

      const result = getAttacks([], [], playerStats);

      const attack = result[0];
      expect(attack).toHaveProperty('name');
      expect(attack).toHaveProperty('attackType');
      expect(attack).toHaveProperty('isRanged');
      expect(attack).toHaveProperty('range');
      expect(attack).toHaveProperty('toHit');
      expect(attack).toHaveProperty('hitBonusFormula');
      expect(attack).toHaveProperty('damageFormula');
      expect(attack).toHaveProperty('damage');
      expect(attack).toHaveProperty('damageType');
      expect(attack).toHaveProperty('abilityName');
      expect(attack).toHaveProperty('type');
      expect(attack).toHaveProperty('properties');
      expect(attack).toHaveProperty('mastery');
      expect(attack).toHaveProperty('isPsychicBlade');
    });

    it('returns attack objects with consistent shape for Swift Quiver attacks', async () => {
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
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Longbow'] },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      const attack = result[0];
      expect(attack).toHaveProperty('name');
      expect(attack).toHaveProperty('attackType');
      expect(attack).toHaveProperty('isRanged');
      expect(attack).toHaveProperty('range');
      expect(attack).toHaveProperty('toHit');
      expect(attack).toHaveProperty('hitBonusFormula');
      expect(attack).toHaveProperty('damageFormula');
      expect(attack).toHaveProperty('damage');
      expect(attack).toHaveProperty('damageType');
      expect(attack).toHaveProperty('isSwiftQuiver');
    });
  });

  describe('Edge cases', () => {
    it('handles missing abilities gracefully without throwing', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [],
        class: { name: 'Fighter' },
      });

      expect(() => getAttacks([], [], playerStats)).not.toThrow();
    });
  });
});
