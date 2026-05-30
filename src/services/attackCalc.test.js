import { describe, it, expect } from 'vitest';
import {
  parseMagicItemName,
  findEquippedWeapons,
  buildWeaponAttack,
  buildMonkAttacks,
  buildSpellAttacks,
  getAttacks,
} from './attackCalc.js';

describe('attackCalc', () => {
  describe('parseMagicItemName', () => {
    it('should parse +1 magic weapon', () => {
      const result = parseMagicItemName('+1 Longsword');
      expect(result).toEqual({ baseName: 'Longsword', magicBonus: 1 });
    });

    it('should parse +2 magic weapon', () => {
      const result = parseMagicItemName('+2 Shortbow');
      expect(result).toEqual({ baseName: 'Shortbow', magicBonus: 2 });
    });

    it('should parse +3 magic weapon', () => {
      const result = parseMagicItemName('+3 Greatsword');
      expect(result).toEqual({ baseName: 'Greatsword', magicBonus: 3 });
    });

    it('should handle non-magic weapon', () => {
      const result = parseMagicItemName('Longsword');
      expect(result).toEqual({ baseName: 'Longsword', magicBonus: 0 });
    });

    it('should handle item name starting with + but no number', () => {
      // charAt(1) is ' ', Number(' ') is NaN, so magicBonus = 0
      // baseName = itemName.substring(3) = 'ongsword'
      const result = parseMagicItemName('+ Longsword');
      expect(result).toEqual({ baseName: 'ongsword', magicBonus: 0 });
    });

    it('should handle empty string', () => {
      const result = parseMagicItemName('');
      expect(result).toEqual({ baseName: '', magicBonus: 0 });
    });

    it('should handle null/undefined', () => {
      expect(parseMagicItemName(null)).toEqual({ baseName: null, magicBonus: 0 });
      expect(parseMagicItemName(undefined)).toEqual({ baseName: undefined, magicBonus: 0 });
    });
  });

  describe('findEquippedWeapons', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee' },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged' },
      { name: 'Shield', equipment_category: 'Armor', weapon_range: null },
    ];

    it('should find melee weapons', () => {
      const equipped = ['Longsword', 'Shield'];
      const result = findEquippedWeapons(allEquipment, equipped, 'Melee');
      expect(result).toEqual(['Longsword']);
    });

    it('should find ranged weapons', () => {
      const equipped = ['Shortbow', 'Longsword'];
      const result = findEquippedWeapons(allEquipment, equipped, 'Ranged');
      expect(result).toEqual(['Shortbow']);
    });

    it('should return empty when no equipped weapons match', () => {
      const equipped = ['Shield'];
      const result = findEquippedWeapons(allEquipment, equipped, 'Melee');
      expect(result).toEqual([]);
    });

    it('should handle magic weapon names', () => {
      const equipped = ['+1 Longsword'];
      const result = findEquippedWeapons(allEquipment, equipped, 'Melee');
      expect(result).toEqual(['+1 Longsword']);
    });

    it('should handle null/undefined equipped', () => {
      const result = findEquippedWeapons(allEquipment, null, 'Melee');
      expect(result).toEqual([]);
    });
  });

  describe('buildWeaponAttack', () => {
    const weapon = {
      damage: { damage_dice: '1d8', damage_type: 'Slashing' },
      range: { normal: 5 },
    };

    it('should build basic melee attack', () => {
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
      expect(result.hitBonus).toBe(5);
      expect(result.range).toBe(5);
      expect(result.type).toBe('Action');
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

      expect(result.damage).toBe('1d8+5'); // 3 (str) + 2 (magic)
      expect(result.hitBonus).toBe(7); // 3 + 2 + 2
    });

    it('should include Dueling fighting style bonus', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: 'Longsword',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Action',
        extraDamage: '+2',
        extraDamageLabel: 'Dueling Fighting Style (2)',
      });

      expect(result.damage).toBe('1d8+3+2'); // 3 (str) then +2 (dueling) appended separately
    });

    it('should include Archery fighting style bonus to hit', () => {
      const result = buildWeaponAttack({
        weapon: { ...weapon, range: { normal: 80 } },
        weaponName: 'Shortbow',
        abilityBonus: 2,
        abilityName: 'Dexterity',
        proficiency: 2,
        actionType: 'Action',
        extraHitBonus: 2,
        extraHitBonusLabel: 'Archery Fighting Style (2)',
      });

      expect(result.hitBonus).toBe(6); // 2 + 2 + 2
    });

    it('should build off-hand attack without ability bonus in damage', () => {
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
      expect(result.type).toBe('Bonus Action');
    });

    it('should include Two-Weapon Fighting bonus damage', () => {
      const result = buildWeaponAttack({
        weapon,
        weaponName: 'Dagger',
        abilityBonus: 3,
        abilityName: 'Strength',
        proficiency: 2,
        actionType: 'Bonus Action',
        includeAbilityBonusInDamage: false,
        extraDamage: '+3',
        extraDamageLabel: 'Two-Weapon Fighting Style (3)',
      });

      expect(result.damage).toBe('1d8+3');
    });
  });

  describe('buildMonkAttacks', () => {
    it('should build two unarmed strikes', () => {
      const result = buildMonkAttacks({
        diceStr: '1d6',
        dexterityBonus: 4,
        proficiency: 2,
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe('1d6+4');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
      expect(result[0].hitBonus).toBe(6);
    });
  });

  describe('buildSpellAttacks', () => {
    const allSpells = [
      { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' }, range: '120 feet', casting_time: '1 action', level: 0, classes: ['Wizard'] },
      { name: 'Magic Missile', damage: { damage_at_slot_level: { '1': '1d4+1' }, damage_type: 'Force' }, range: '120 feet', casting_time: '1 action', level: 1, classes: ['Wizard'] },
      { name: 'Sacred Flame', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Radiant' }, range: '60 feet', casting_time: '1 action', level: 0, classes: ['Cleric'], dc: { dc_type: 'DEX', dc_success: 'none' } },
    ];

    it('should build spell attacks from prepared spells', () => {
      const playerSpells = [
        { name: 'Fire Bolt', prepared: 'Always' },
        { name: 'Magic Missile', prepared: 'Prepared' },
      ];
      const result = buildSpellAttacks(playerSpells, allSpells, { modifier: 4, saveDc: 13 });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Fire Bolt');
      expect(result[0].damage).toBe('1d10');
      expect(result[0].hitBonus).toBe(4);
    });

    it('should build save-based spell attacks with save info', () => {
      const playerSpells = [
        { name: 'Sacred Flame', prepared: 'Always' },
      ];
      const result = buildSpellAttacks(playerSpells, allSpells, { modifier: 4, saveDc: 13 });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sacred Flame');
      expect(result[0].damage).toBe('1d8');
      expect(result[0].saveDc).toBe(13);
      expect(result[0].saveType).toBe('DEX');
      expect(result[0].saveSuccess).toBe('none');
      expect(result[0].hitBonus).toBeUndefined();
    });

    it('should skip spells without damage', () => {
      const spellsWithNoDamage = [
        { name: 'Mage Hand', damage: null, range: '30 feet', casting_time: '1 action', level: 0, classes: ['Wizard'] },
      ];
      const playerSpells = [{ name: 'Mage Hand', prepared: 'Always' }];
      const result = buildSpellAttacks(playerSpells, spellsWithNoDamage, { modifier: 4 });
      expect(result).toHaveLength(0);
    });

    it('should skip unprepared spells', () => {
      const playerSpells = [{ name: 'Magic Missile', prepared: '' }];
      const result = buildSpellAttacks(playerSpells, allSpells, { modifier: 4 });
      expect(result).toHaveLength(0);
    });

    it('should handle empty spell list', () => {
      const result = buildSpellAttacks([], allSpells, { modifier: 4 });
      expect(result).toHaveLength(0);
    });
  });

  describe('getAttacks', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 } },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } },
      { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 } },
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
    });

    it('should build melee weapon attack', () => {
      const playerStats = makePlayerStats({ equipped: ['Longsword'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Longsword');
      expect(result[0].damage).toBe('1d8+3');
    });

    it('should build ranged weapon attack', () => {
      const playerStats = makePlayerStats({ equipped: ['Shortbow'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shortbow');
      expect(result[0].damage).toBe('1d6+2');
    });

    it('should apply Archery fighting style to ranged attacks', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortbow'],
        class: { name: 'Fighter', fightingStyles: ['Archery'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(7); // 2 (dex) + 3 (prof) + 2 (archery)
    });

    it('should apply Dueling fighting style when single melee weapon', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: ['Dueling'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].damage).toBe('1d8+3+2'); // 3 (str) then +2 (dueling) appended separately
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

    it('should apply Two-Weapon Fighting to off-hand', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword', 'Dagger'],
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // Off-hand with TWF: damage includes ability bonus
      expect(result[1].damage).toBe('1d4+3');
    });

    it('should build monk unarmed strikes', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Monk',
          fightingStyles: [],
          class_levels: {
            4: { class_specific: { martial_arts: { dice_count: 1, dice_value: 8 } } },
          },
        },
      });
      // Monk unarmed strikes require class_levels[level-1].class_specific.martial_arts
      playerStats.class.class_levels = [];
      playerStats.class.class_levels[4] = { class_specific: { martial_arts: { dice_count: 1, dice_value: 8 } } };
      const result = getAttacks(allEquipment, [], playerStats);
      const unarmedStrikes = result.filter(a => a.name === 'Unarmed Strike');
      expect(unarmedStrikes).toHaveLength(2);
      expect(unarmedStrikes[0].damage).toBe('1d8+2');
    });

    it('should build spell attacks when spellAbilities present', () => {
      const allSpells = [
        { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' }, range: '120 feet', casting_time: '1 action', level: 0, classes: ['Wizard'] },
      ];
      const playerStats = makePlayerStats({
        equipped: [],
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', prepared: 'Always' }],
          modifier: 4,
        },
      });
      const result = getAttacks(allEquipment, allSpells, playerStats);
      const spellAttacks = result.filter(a => a.name === 'Fire Bolt');
      expect(spellAttacks).toHaveLength(1);
      expect(spellAttacks[0].hitBonus).toBe(4);
    });

    it('should return empty when no weapons or spells', () => {
      const playerStats = makePlayerStats({ equipped: [] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toEqual([]);
    });
  });
});
