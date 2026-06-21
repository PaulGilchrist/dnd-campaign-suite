// @improved-by-ai
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
const buildSpellAttacksStub = vi.fn((_spells) => {
  if (!_spells || _spells.length === 0) return [];
  return [
    {
      name: _spells[0].name,
      damage: '1d10',
      damageType: 'Fire',
      type: 'Action',
    },
  ];
});

vi.mock('./attackCalc.js', () => ({
  parseMagicItemName: (name) =>
    name && name.charAt(0) === '+'
      ? { baseName: name.substring(3), magicBonus: Number(name.charAt(1)) || 0 }
      : { baseName: name, magicBonus: 0 },
  findEquippedWeapons: (...args) => findEquippedWeaponsStub(...args),
  buildWeaponAttack: (...args) => buildWeaponAttackStub(...args),
  buildMonkAttacks: (...args) => buildMonkAttacksStub(...args),
  buildSpellAttacks: (...args) => buildSpellAttacksStub(...args),
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
    it('returns an empty array when the character has no weapons, spells, or special features', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const result = getAttacks([], [], defaultPlayerStats());

      expect(result).toEqual([]);
    });

    it('returns an empty array when allEquipment and allSpells are empty and no class features apply', () => {
      const result = getAttacks([], [], defaultPlayerStats());
      expect(result).toEqual([]);
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

    it('adds an off-hand bonus action attack when two melee weapons are equipped', () => {
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
      expect(result[1].type).toBe('Bonus Action');
      expect(result[1].name).toBe('Dagger');
    });

    it('includes ability bonus in damage for main-hand but not for off-hand by default', () => {
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

      // Main hand: ability bonus is included in damage
      expect(result[0].damage).toContain('+2');
      // Off-hand: stub receives includeAbilityBonusInDamage: false so no ability bonus
      expect(buildWeaponAttackStub).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ includeAbilityBonusInDamage: false })
      );
    });

    it('provides two unarmed strike attacks for a Monk', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Monk' },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[1].name).toBe('Unarmed Strike');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(buildMonkAttacksStub).toHaveBeenCalledWith(
        expect.objectContaining({
          dexterityBonus: 4,
          proficiency: 3,
        })
      );
    });

    it('does not add monk attacks for non-Monk classes', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const result = getAttacks([], [], defaultPlayerStats({ class: { name: 'Fighter' } }));

      expect(result).toEqual([]);
    });

    it('adds spell attacks when spellAbilities are present', () => {
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

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fire Bolt');
      expect(result[0].type).toBe('Action');
    });

    it('does not add spell attacks when spellAbilities is absent', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        class: { name: 'Fighter' },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toEqual([]);
    });

    it('computes proficiency correctly at level 9', () => {
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
        level: 9,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Ranger' },
      });

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({ proficiency: 4 })
      );
    });

    it('computes proficiency correctly at level 17', () => {
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
        level: 17,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: { name: 'Ranger' },
      });

      const getAttacksResult = getAttacks(allEquipment, [], playerStats);

      expect(getAttacksResult).toHaveLength(1);
      expect(buildWeaponAttackStub).toHaveBeenCalledWith(
        expect.objectContaining({ proficiency: 6 })
      );
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

    it('includes tavern brawler unarmed strike for non-Monk characters with the feat', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: { name: 'Fighter' },
        automation: {
          passives: [
            { effect: 'tavern_brawler_push', name: 'Tavern Brawler' },
          ],
          bonusActions: [],
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike (Tavern Brawler)');
      expect(result[0].damage).toBe('1d4+3');
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(result[0].type).toBe('Action');
    });

    it('does not add tavern brawler attack for Monk characters', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        class: { name: 'Monk' },
        automation: {
          passives: [
            { effect: 'tavern_brawler_push', name: 'Tavern Brawler' },
          ],
          bonusActions: [],
        },
      });

      const result = getAttacks([], [], playerStats);

      // Monk gets unarmed strikes but not tavern brawler
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
    });

    it('adds College of Dance Dazzling Footwork attacks for Bard level 3+', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        class: {
          name: 'Bard',
          subclass: { name: 'College of Dance' },
          class_levels: [{ level: 5, bardic_die: 6 }],
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike (Dance)');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
    });

    it('does not add College of Dance attacks for Bard below level 3', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 2,
        class: {
          name: 'Bard',
          subclass: { name: 'College of Dance' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toEqual([]);
    });

    it('adds Soulknife Psychic Blade attacks for Rogue level 3+', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
          { name: 'Intelligence', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: {
          name: 'Rogue',
          major: { name: 'Soulknife' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Psychic Blade');
      expect(result[1].name).toBe('Psychic Blade (Ranged)');
      expect(result[2].name).toBe('Psychic Blade (Bonus Action)');
      expect(result[0].damageType).toBe('Psychic');
      expect(result[1].isRanged).toBe(true);
      expect(result[2].isBonusActionBlade).toBe(true);
    });

    it('does not add Soulknife attacks for Rogue below level 3', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 2,
        class: {
          name: 'Rogue',
          major: { name: 'Soulknife' },
        },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toEqual([]);
    });

    it('does not add Soulknife attacks for non-Rogue classes', () => {
      findEquippedWeaponsStub.mockReturnValue([]);

      const playerStats = defaultPlayerStats({
        level: 5,
        class: { name: 'Fighter' },
      });

      const result = getAttacks([], [], playerStats);

      expect(result).toEqual([]);
    });

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

      // No Swift Quiver, no weapons found via findEquippedWeapons, so empty
      expect(result).toEqual([]);
    });

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
      expect(result[0].damage.damage_dice).toBe('1d8');
      expect(result[0].damage.damage_type).toBe('Radiant');
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

      expect(result[0].damage.damage_dice).toBe('2d8');
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

      expect(result).toEqual([]);
    });

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

      // Ranged weapon (Shortbow) + Melee weapon (Quarterstaff) + 2 Monk attacks + 1 Spell attack = 5
      expect(result).toHaveLength(5);
    });

    it('handles off-hand with Dual Wielder feat bonus action attack', () => {
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

      // Main hand + off-hand + Dual Wielder extra = 3
      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('Dual Wielder Extra Attack');
    });

    it('does not add Dual Wielder extra without the feat', () => {
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

      // Main hand + off-hand only = 2
      expect(result).toHaveLength(2);
    });

    it('includes ability bonus on off-hand for Light Crossbow with Crossbow Expert Dual Wielding passive', () => {
      findEquippedWeaponsStub
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Hand Crossbow']);

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

      expect(result).toHaveLength(2);
      // Off-hand should have ability bonus because of crossbow expert dual wielding
      expect(buildWeaponAttackStub).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ includeAbilityBonusInDamage: true })
      );
    });

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
      expect(attack).toHaveProperty('actionType');
      expect(attack).toHaveProperty('properties');
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
