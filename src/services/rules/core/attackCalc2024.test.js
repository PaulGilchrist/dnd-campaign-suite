import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

// References to mocked functions (filled in beforeEach)
let findEquippedWeapons;
let buildWeaponAttack;

// Mock all dependencies from attackCalc.js
vi.mock('./attackCalc.js', () => {
  // Simple mock implementations — return predictable values
  const findEquippedWeapons = vi.fn();
  const buildWeaponAttack = vi.fn((opts) => ({
    name: opts.weaponName,
    damage: '1d8+3',
    damageType: 'Slashing',
    damageFormula: 'Formula',
    hitBonus: opts.abilityBonus + opts.proficiency + (opts.extraHitBonus || 0),
    hitBonusFormula: 'Formula',
    range: 5,
    type: opts.actionType,
  }));
  const buildMonkAttacks = vi.fn((opts) => ([
    {
      name: 'Unarmed Strike',
      damage: `${opts.diceStr}+${opts.dexterityBonus}`,
      damageType: 'Bludgeoning',
      damageFormula: 'Formula',
      hitBonus: opts.dexterityBonus + opts.proficiency,
      hitBonusFormula: 'Formula',
      range: 5,
      type: 'Action',
    },
    {
      name: 'Unarmed Strike',
      damage: `${opts.diceStr}+${opts.dexterityBonus}`,
      damageType: 'Bludgeoning',
      damageFormula: 'Formula',
      hitBonus: opts.dexterityBonus + opts.proficiency,
      hitBonusFormula: 'Formula',
      range: 5,
      type: 'Bonus Action',
    },
  ]));
  const buildSpellAttacks = vi.fn(() => ([
    {
      name: 'Fire Bolt',
      damage: '1d10',
      damageType: 'Fire',
      hitBonus: 0,
      range: '120 feet',
      type: 'Action',
    },
  ]));

  return {
    parseMagicItemName: vi.fn((name) => {
      if (!name) return { baseName: undefined, magicBonus: 0 };
      if (name.startsWith('+')) {
        const magicBonus = Number(name.charAt(1));
        return { baseName: name.substring(3), magicBonus: isNaN(magicBonus) ? 0 : magicBonus };
      }
      return { baseName: name, magicBonus: 0 };
    }),
    findEquippedWeapons,
    buildWeaponAttack,
    buildMonkAttacks,
    buildSpellAttacks,
  };
});

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getMartialArtsDie: vi.fn(() => 8),
  },
}));

describe('attackCalc2024', () => {
  beforeEach(async () => {
    const attackCalc = await import('./attackCalc.js');
    findEquippedWeapons = attackCalc.findEquippedWeapons;
    buildWeaponAttack = attackCalc.buildWeaponAttack;
    vi.clearAllMocks();
  });

  describe('getAttacks', () => {
    it('should return empty array when no equipment, no spells, non-Monk', () => {
      findEquippedWeapons.mockReturnValue([]);

      const result = getAttacks([], [], {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        inventory: { equipped: [] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      });

      expect(result).toEqual([]);
    });

    it('should add a ranged weapon attack using Dexterity', () => {
      // First call (Ranged) returns a weapon, second call (Melee) returns empty
      findEquippedWeapons
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce([]);

      const allEquipment = [{ name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } }];
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Shortbow'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shortbow');
      expect(buildWeaponAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityBonus: 3,
          abilityName: 'Dexterity',
          proficiency: 2,
          actionType: 'Action',
        })
      );
    });

    it('should add a melee weapon attack using max(Str, Dex) bonus', () => {
      findEquippedWeapons
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Longsword']);

      const allEquipment = [{ name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 } }];
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        inventory: { equipped: ['Longsword'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Longsword');
      expect(buildWeaponAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityBonus: 4,
          abilityName: 'Strength',
          proficiency: 2,
          actionType: 'Action',
        })
      );
    });

    it('should use Dexterity for melee when it is higher than Strength', () => {
      findEquippedWeapons
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Rapier']);

      const allEquipment = [{ name: 'Rapier', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Piercing' }, range: { normal: 5 } }];
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        inventory: { equipped: ['Rapier'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      expect(buildWeaponAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          abilityBonus: 4,
          abilityName: 'Dexterity',
        })
      );
    });

    it('should add off-hand attack without ability bonus in damage', () => {
      findEquippedWeapons
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['Shortsword', 'Dagger']);

      const allEquipment = [
        { name: 'Shortsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 5 } },
        { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 } },
      ];
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        inventory: { equipped: ['Shortsword', 'Dagger'] },
        automation: { passives: [], bonusActions: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);

      // Main hand: ability bonus included in damage (defaults to true)
      expect(buildWeaponAttack).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          weaponName: 'Shortsword',
          actionType: 'Action',
        })
      );

      // Off-hand: no ability bonus in damage
      expect(buildWeaponAttack).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          weaponName: 'Dagger',
          actionType: 'Bonus Action',
          includeAbilityBonusInDamage: false,
        })
      );
    });

    it('should add monk unarmed strikes when class is Monk', () => {
      findEquippedWeapons.mockReturnValue([]);

      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        inventory: { equipped: [] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Monk' },
      };

      const result = getAttacks([], [], playerStats);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].type).toBe('Action');
      expect(result[1].name).toBe('Unarmed Strike');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[0].damage).toContain('1d8');
    });

    it('should not add monk attacks for non-Monk classes', () => {
      findEquippedWeapons.mockReturnValue([]);

      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        inventory: { equipped: [] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks([], [], playerStats);

      // No monk attacks, no equipment, no spells → empty
      expect(result).toEqual([]);
    });

    it('should add spell attacks when spellAbilities are present', () => {
      findEquippedWeapons.mockReturnValue([]);

      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        inventory: { equipped: [] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Wizard' },
        spellAbilities: {
          modifier: 4,
          spells: [{ name: 'Fire Bolt', prepared: 'Prepared' }],
        },
      };

      const result = getAttacks([], [{ name: 'Fire Bolt', damage: { damage_dice: '1d10', damage_type: 'Fire' }, range: '120 feet', casting_time: '1 action' }], playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fire Bolt');
      expect(result[0].type).toBe('Action');
    });

    it('should compute proficiency correctly at level 9', () => {
      findEquippedWeapons
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce([]);

      const allEquipment = [{ name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } }];
      const playerStats = {
        level: 9,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        inventory: { equipped: ['Shortbow'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Ranger' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(1);
      // Proficiency at level 9 = Math.floor((9-1)/4+2) = Math.floor(2+2) = 4
      expect(buildWeaponAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          proficiency: 4,
          abilityBonus: 4,
        })
      );
    });

    it('should handle both ranged and melee weapons simultaneously', () => {
      findEquippedWeapons
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce(['Longsword']);

      const allEquipment = [
        { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } },
        { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 } },
      ];
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        inventory: { equipped: ['Shortbow', 'Longsword'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Fighter' },
      };

      const result = getAttacks(allEquipment, [], playerStats);

      expect(result).toHaveLength(2);
    });

    it('should handle all attack types combined (weapons + monk + spells)', () => {
      findEquippedWeapons
        .mockReturnValueOnce(['Shortbow'])
        .mockReturnValueOnce(['Quarterstaff']);

      const allEquipment = [
        { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } },
        { name: 'Quarterstaff', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Bludgeoning' }, range: { normal: 5 } },
      ];
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Dexterity', baseScore: 18, abilityImprovements: 0, miscBonus: 0, bonus: 4 },
        ],
        inventory: { equipped: ['Shortbow', 'Quarterstaff'] },
        automation: { passives: [] },
        activeBuffs: [],
        class: { name: 'Monk' },
        spellAbilities: {
          modifier: 3,
          spells: [{ name: 'Fire Bolt', prepared: 'Prepared' }],
        },
      };

      const result = getAttacks(allEquipment, [{ name: 'Fire Bolt', damage: { damage_dice: '1d10', damage_type: 'Fire' }, range: '120 feet', casting_time: '1 action' }], playerStats);

      // Ranged weapon (Shortbow) + Melee weapon (Quarterstaff) + 2 Monk attacks + 1 Spell attack = 5
      expect(result).toHaveLength(5);
    });
  });
});
