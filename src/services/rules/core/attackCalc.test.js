// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  parseMagicItemName,
  findEquippedWeapons,
  buildWeaponAttack,
  buildMonkAttacks,
  resolveSpellDamageAtLevel,
  getAttacks,
} from './attackCalc.js';

describe('attackCalc', () => {
  describe('parseMagicItemName', () => {
    it('should parse +1 magic weapon', () => {
      const result = parseMagicItemName('+1 Longsword');
      expect(result).toEqual({ baseName: 'Longsword', magicBonus: 1 });
    });

    it('should handle non-magic weapon', () => {
      const result = parseMagicItemName('Longsword');
      expect(result).toEqual({ baseName: 'Longsword', magicBonus: 0 });
    });

    it('should handle empty string', () => {
      const result = parseMagicItemName('');
      expect(result).toEqual({ baseName: '', magicBonus: 0 });
    });

    it('should return null/undefined as-is with zero bonus', () => {
      expect(parseMagicItemName(null)).toEqual({ baseName: null, magicBonus: 0 });
      expect(parseMagicItemName(undefined)).toEqual({ baseName: undefined, magicBonus: 0 });
    });

    it('should treat non-digit after + as 0 bonus and strip + prefix', () => {
      const result = parseMagicItemName('+ Longsword');
      expect(result.magicBonus).toBe(0);
      expect(result.baseName).toBe('ongsword');
    });
  });

  describe('findEquippedWeapons', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee' },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged' },
      { name: 'Shield', equipment_category: 'Armor', weapon_range: null },
    ];

    it('should find melee weapons', () => {
      const result = findEquippedWeapons(allEquipment, ['Longsword', 'Shield'], 'Melee');
      expect(result).toEqual(['Longsword']);
    });

    it('should find ranged weapons', () => {
      const result = findEquippedWeapons(allEquipment, ['Shortbow', 'Longsword'], 'Ranged');
      expect(result).toEqual(['Shortbow']);
    });

    it('should match weapons by base name when equipped has magic prefix', () => {
      const result = findEquippedWeapons(allEquipment, ['+1 Longsword'], 'Melee');
      expect(result).toEqual(['+1 Longsword']);
    });

    it('should skip non-string entries in equipped array', () => {
      const result = findEquippedWeapons(allEquipment, ['Longsword', null, 'Shortbow'], 'Melee');
      expect(result).toEqual(['Longsword']);
    });

    it('should throw when equipped is null or undefined', () => {
      expect(() => findEquippedWeapons(allEquipment, null, 'Melee'))
        .toThrow('Expected array, got null');
      expect(() => findEquippedWeapons(allEquipment, undefined, 'Melee'))
        .toThrow('Expected array, got undefined');
    });

    it('should return empty array when no equipped weapons match', () => {
      const result = findEquippedWeapons(allEquipment, ['Shield'], 'Melee');
      expect(result).toEqual([]);
    });
  });

  describe('buildWeaponAttack', () => {
    const weapon = {
      damage: { damage_dice: '1d8', damage_type: 'Slashing' },
      range: { normal: 5 },
    };

    it('should build basic melee attack with all fields', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: 'Longsword',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Action',
      });

      expect(result.name).toBe('Longsword');
      expect(result.damage).toBe('1d8+3');
      expect(result.damageType).toBe('Slashing');
      expect(result.damageFormula).toBe('Damage Formula = Weapon (1d8) + Strength Bonus (3)');
      expect(result.hitBonus).toBe(5);
      expect(result.hitBonusFormula).toBe('To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)');
      expect(result.range).toBe(5);
      expect(result.type).toBe('Action');
      expect(result.weaponType).toBe('');
      expect(result.mastery).toBeNull();
    });

    it('should include magic bonus in damage and to-hit', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: '+2 Longsword',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Action',
      });

      expect(result.damage).toBe('1d8+5');
      expect(result.hitBonus).toBe(7);
      expect(result.damageFormula).toContain('Weapon Magic Bonus (2)');
      expect(result.hitBonusFormula).toContain('Weapon Magic Bonus (2)');
    });

    it('should append extra damage and hit bonus from fighting styles', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: 'Longsword',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Action',
        extraDamage: '+2',
        extraDamageLabel: 'Dueling Fighting Style (2)',
        extraHitBonus: 2,
        extraHitBonusLabel: 'Archery Fighting Style (2)',
      });

      expect(result.damage).toBe('1d8+5');
      expect(result.hitBonus).toBe(7);
      expect(result.damageFormula).toContain('Dueling Fighting Style (2)');
      expect(result.hitBonusFormula).toContain('Archery Fighting Style (2)');
    });

    it('should omit ability bonus from off-hand damage', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: 'Dagger',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Bonus Action',
        includeAbilityBonusInDamage: false,
      });

      expect(result.damage).toBe('1d8');
      expect(result.hitBonus).toBe(5);
    });

    it('should combine magic bonus and extra damage on off-hand attack', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: '+1 Dagger',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Bonus Action',
        includeAbilityBonusInDamage: false,
        extraDamage: '+3',
        extraDamageLabel: 'Two-Weapon Fighting Style (3)',
      });

      expect(result.damage).toBe('1d8+4');
      expect(result.hitBonus).toBe(6);
    });
  });

  describe('buildMonkAttacks', () => {
    it('should build two unarmed strikes with correct properties', () => {
      const result = buildMonkAttacks({
        diceStr: '1d6',
        dexterityBonus: 4,
        proficiency: 2,
      });

      expect(result).toHaveLength(2);

      // Both should be Unarmed Strike
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[1].name).toBe('Unarmed Strike');

      // Both should have same damage and hit bonus
      expect(result[0].damage).toBe('1d6+4');
      expect(result[1].damage).toBe('1d6+4');
      expect(result[0].hitBonus).toBe(6);
      expect(result[1].hitBonus).toBe(6);
      expect(result[0].damageType).toBe('Bludgeoning');
      expect(result[1].damageType).toBe('Bludgeoning');
      expect(result[0].range).toBe(5);
      expect(result[1].range).toBe(5);
      expect(result[0].weaponType).toBe('unarmed');
      expect(result[1].weaponType).toBe('unarmed');

      // First is Action, second is Bonus Action
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');

      // Verify formula fields are present and correct
      expect(result[0].damageFormula).toContain('1d6');
      expect(result[0].hitBonusFormula).toContain('Dexterity Bonus (4)');
    });
  });

  describe('resolveSpellDamageAtLevel', () => {
    const cantripSpell = { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10', '5': '2d10', '9': '3d10' }, damage_type: 'Fire' }, level: 0 };
    const leveledSpell = { name: 'Magic Missile', damage: { damage_at_slot_level: { '1': '1d4+1' }, damage_type: 'Force' }, level: 1 };
    const spellWithCharLevel = { name: 'Charm Spell', damage: { damage_at_character_level: { '1': '2d6' }, damage_at_slot_level: {} }, damage_type: 'Psychic', level: 1 };
    const noDamageSpell = { name: 'Mage Hand', damage: null, level: 0 };

    it('should resolve cantrip damage at low character level', () => {
      expect(resolveSpellDamageAtLevel(cantripSpell, 1)).toBe('1d10');
    });

    it('should resolve cantrip damage at tier boundaries', () => {
      expect(resolveSpellDamageAtLevel(cantripSpell, 5)).toBe('2d10');
      expect(resolveSpellDamageAtLevel(cantripSpell, 9)).toBe('3d10');
      expect(resolveSpellDamageAtLevel(cantripSpell, 17)).toBe('3d10');
    });

    it('should resolve leveled spell base damage', () => {
      expect(resolveSpellDamageAtLevel(leveledSpell, 5)).toBe('1d4+1');
    });

    it('should use character-level damage when slot-level is empty', () => {
      expect(resolveSpellDamageAtLevel(spellWithCharLevel, 5)).toBe('2d6');
    });

    it('should return empty string when spell has no damage or is null', () => {
      expect(resolveSpellDamageAtLevel(noDamageSpell, 5)).toBe('');
      expect(resolveSpellDamageAtLevel(null, 5)).toBe('');
    });
  });

  describe('getAttacks', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 }, properties: [] },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } },
      { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Light'] },
      { name: 'Shortsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Light', 'Finesse'] },
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
      spellAbilities: overrides.spellAbilities || null,
      activeBuffs: overrides.activeBuffs || [],
    });

    it('should build melee weapon attack with correct fields', () => {
      const playerStats = makePlayerStats({ equipped: ['Longsword'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Longsword');
      expect(result[0].damage).toBe('1d8+3');
      expect(result[0].hitBonus).toBe(6);
      expect(result[0].weaponType).toBe('melee');
    });

    it('should build ranged weapon attack using dexterity', () => {
      const playerStats = makePlayerStats({ equipped: ['Shortbow'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shortbow');
      expect(result[0].damage).toBe('1d6+2');
      expect(result[0].hitBonus).toBe(5);
    });

    it('should apply fighting styles to attacks', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortbow'],
        class: { name: 'Fighter', fightingStyles: ['Archery'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(7);
    });

    it('should apply Blessed Warrior fighting style to hit bonus', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Blessed Warrior'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(8);
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
    });

    it('should apply both Blessed Warrior and Dueling to melee attacks', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Blessed Warrior', 'Dueling'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(8);
      expect(result[0].damage).toBe('1d8+5');
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
      expect(result[0].damageFormula).toContain('Dueling');
    });

    it('should not apply Dueling when two melee weapons or a ranged weapon are equipped', () => {
      const stats1 = makePlayerStats({
        equipped: ['Longsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Dueling'] },
      });
      const result1 = getAttacks(allEquipment, [], stats1);
      expect(result1[0].damage).toBe('1d8+3');
      expect(result1[1].damage).toBe('1d4');

      const stats2 = makePlayerStats({
        equipped: ['Longsword', 'Shortbow'],
        class: { name: 'Fighter', fightingStyles: ['Dueling'] },
      });
      const result2 = getAttacks(allEquipment, [], stats2);
      expect(result2.find(a => a.name === 'Longsword').damage).toBe('1d8+3');
      expect(result2.find(a => a.name === 'Shortbow').damage).toBe('1d6+2');
    });

    it('should build off-hand attack when two melee weapons equipped', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: [] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(2);
      expect(result[1].name).toBe('Dagger');
      expect(result[1].type).toBe('Bonus Action');
    });

    it('should apply Two-Weapon Fighting bonus when both weapons are light and no shield', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[1].damage).toBe('1d4+3');
    });

    it('should not apply Two-Weapon Fighting when main hand is not light or shield is equipped', () => {
      const stats1 = makePlayerStats({
        equipped: ['Longsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result1 = getAttacks(allEquipment, [], stats1);
      expect(result1[1].damage).toBe('1d4');

      const stats2 = makePlayerStats({
        equipped: ['Shortsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      stats2.inventory.equipped = ['Shortsword', 'Dagger', 'Shield'];
      const result2 = getAttacks(allEquipment, [], stats2);
      expect(result2[1].damage).toBe('1d4');
    });

    it('should prefer strength over dexterity for melee when strength is higher', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: [] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].damage).toBe('1d8+3');
      expect(result[0].hitBonus).toBe(6);
    });

    it('should use dexterity for melee when dexterity is higher', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: [] },
      });
      playerStats.abilities[0].bonus = 1;
      playerStats.abilities[1].bonus = 4;
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].damage).toBe('1d8+4');
      expect(result[0].hitBonus).toBe(7);
    });

    it('should support monk unarmed strikes', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Monk',
          fightingStyles: [],
          class_levels: {},
        },
      });
      playerStats.class.class_levels[playerStats.level - 1] = {
        class_specific: { martial_arts: { dice_count: 1, dice_value: 8 } },
      };
      const result = getAttacks(allEquipment, [], playerStats);
      const unarmedStrikes = result.filter(a => a.name === 'Unarmed Strike');
      expect(unarmedStrikes).toHaveLength(2);
      expect(unarmedStrikes[0].damage).toBe('1d8+2');
      expect(unarmedStrikes[0].type).toBe('Action');
      expect(unarmedStrikes[1].type).toBe('Bonus Action');
    });

    it('should not build spell attacks from spellAbilities', () => {
      const allSpells = [
        { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' }, range: '120 feet', casting_time: '1 action', level: 0, classes: ['Wizard'] },
      ];
      const playerStats = makePlayerStats({
        equipped: [],
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', prepared: 'Always' }],
          modifier: 4,
          toHit: 7,
        },
      });
      const result = getAttacks(allEquipment, allSpells, playerStats);
      const spellAttacks = result.filter(a => a.name === 'Fire Bolt');
      expect(spellAttacks).toHaveLength(0);
    });

    it('should return unarmed strike as fallback when no weapons equipped', () => {
      const playerStats = makePlayerStats({ equipped: [] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe('1d4+3');
      expect(result[0].hitBonus).toBe(6);
      expect(result[0].range).toBe(5);
      expect(result[0].type).toBe('Action');
      expect(result[0].weaponType).toBe('unarmed');
    });

    it('should build both ranged and melee attacks when both equipped', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortbow', 'Longsword'],
        class: { name: 'Fighter', fightingStyles: [] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(2);
      expect(result.find(a => a.name === 'Shortbow')).toBeDefined();
      expect(result.find(a => a.name === 'Longsword')).toBeDefined();
    });

    it('should handle null or missing fightingStyles gracefully', () => {
      const stats1 = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter' },
      });
      const result1 = getAttacks(allEquipment, [], stats1);
      expect(result1).toHaveLength(1);
      expect(result1[0].damage).toBe('1d8+3');

      const stats2 = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: null },
      });
      const result2 = getAttacks(allEquipment, [], stats2);
      expect(result2).toHaveLength(1);
    });
  });
});
