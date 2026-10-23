// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import {
  parseMagicItemName,
  findEquippedWeapons,
  buildWeaponAttack,
  buildMonkAttacks,
  resolveSpellDamageAtLevel,
  getAttacks,
} from './attackCalc.js';

// Lane ownership (base unit lane): parseMagicItemName, findEquippedWeapons
// magic-prefix matching, buildWeaponAttack magic bonus, buildMonkAttacks /
// getAttacks monk unarmed, resolveSpellDamageAtLevel, and core getAttacks
// wiring (incl. magic weapons). Integration branches — Druidic Warrior,
// Thrown Weapon Fighting, Starry Form, Nick runtime seam — are owned by
// attackCalc-5e-attacks.test.js; 2024 twins live in attackCalc2024-*.

describe('attackCalc', () => {
  describe('parseMagicItemName', () => {
    // Grammar: '+N Name' — the full digit run is the enhancement (+1..+3 is the
    // canonical authored range, 2-digit runs parse honestly too, #1348 arm).
    // A digit-less '+' prefix ('+ Longsword') is read as a plain name: the '+'
    // marker is dropped, nothing is eaten from the name (#1234, was 'ongsword').
    it.each([
      { input: '+1 Longsword', baseName: 'Longsword', magicBonus: 1 },
      { input: '+2 Longsword', baseName: 'Longsword', magicBonus: 2 },
      { input: '+3 Longsword', baseName: 'Longsword', magicBonus: 3 },
      { input: '+10 Scimitar', baseName: 'Scimitar', magicBonus: 10 },
      { input: '+10 Sword', baseName: 'Sword', magicBonus: 10 },
      { input: '+3', baseName: '', magicBonus: 3 },
      { input: '+', baseName: '', magicBonus: 0 },
      { input: '+ Longsword', baseName: 'Longsword', magicBonus: 0 },
      { input: 'Longsword', baseName: 'Longsword', magicBonus: 0 },
      { input: 'Rusty Longsword', baseName: 'Rusty Longsword', magicBonus: 0 },
      { input: '- Longsword', baseName: '- Longsword', magicBonus: 0 },
      { input: '', baseName: '', magicBonus: 0 },
      { input: null, baseName: null, magicBonus: 0 },
      { input: undefined, baseName: undefined, magicBonus: 0 },
    ])('parseMagicItemName($input)', ({ input, baseName, magicBonus }) => {
      expect(parseMagicItemName(input)).toEqual({ baseName, magicBonus });
    });
  });

  describe('findEquippedWeapons', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee' },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged' },
      { name: 'Shield', equipment_category: 'Armor', weapon_range: null },
    ];

    it.each([
      { label: 'melee filter', equipped: ['Longsword', 'Shield'], range: 'Melee', expected: ['Longsword'] },
      { label: 'ranged filter', equipped: ['Shortbow', 'Longsword'], range: 'Ranged', expected: ['Shortbow'] },
      { label: 'magic prefix matches base name (melee)', equipped: ['+1 Longsword'], range: 'Melee', expected: ['+1 Longsword'] },
      { label: 'magic prefix matches base name (ranged)', equipped: ['+2 Shortbow'], range: 'Ranged', expected: ['+2 Shortbow'] },
      { label: 'skips non-string entries', equipped: ['Longsword', null, 'Shortbow'], range: 'Melee', expected: ['Longsword'] },
      { label: 'no match returns empty', equipped: ['Shield'], range: 'Melee', expected: [] },
    ])('$label', ({ equipped, range, expected }) => {
      expect(findEquippedWeapons(allEquipment, equipped, range)).toEqual(expected);
    });

    it('throws when equipped is null or undefined', () => {
      expect(() => findEquippedWeapons(allEquipment, null, 'Melee'))
        .toThrow('Expected array, got null');
      expect(() => findEquippedWeapons(allEquipment, undefined, 'Melee'))
        .toThrow('Expected array, got undefined');
    });
  });

  describe('buildWeaponAttack', () => {
    const weapon = {
      damage: { damage_dice: '1d8', damage_type: 'Slashing' },
      range: { normal: 5 },
    };
    const baseOpts = {
      weapon,
      abilityBonus: 3,
      abilityName: 'Strength',
      proficiency: 2,
      actionType: 'Action',
    };

    it('builds a basic melee attack with exact verbatim shape', () => {
      const result = buildWeaponAttack({ ...baseOpts, weaponName: 'Longsword' });

      expect(result).toEqual({
        name: 'Longsword',
        damage: '1d8+3',
        damageType: 'Slashing',
        damageFormula: 'Damage Formula = Weapon (1d8) + Strength Bonus (3)',
        hitBonus: 5,
        hitBonusFormula: 'To Hit Bonus Formula = Strength Bonus (3) + Proficiency (2)',
        range: 5,
        type: 'Action',
        weaponType: '',
        mastery: null,
        properties: [],
      });
    });

    // Numeric combination table: magic, fighting-style extras, off-hand
    // omission, negative modifier sign, trailing-number extraction.
    it.each([
      {
        label: 'magic bonus in damage and to-hit',
        opts: { weaponName: '+2 Longsword' },
        damage: '1d8+5', hitBonus: 7,
        damageFormulaContains: 'Weapon Magic Bonus (2)',
        hitBonusFormulaContains: 'Weapon Magic Bonus (2)',
      },
      {
        label: 'canonical max +3 bonus',
        opts: { weaponName: '+3 Longsword' },
        damage: '1d8+6', hitBonus: 8,
        damageFormulaContains: 'Weapon Magic Bonus (3)',
        hitBonusFormulaContains: undefined,
      },
      {
        label: 'fighting style extras append',
        opts: {
          weaponName: 'Longsword',
          extraDamage: '+2', extraDamageLabel: 'Dueling Fighting Style (2)',
          extraHitBonus: 2, extraHitBonusLabel: 'Archery Fighting Style (2)',
        },
        damage: '1d8+5', hitBonus: 7,
        damageFormulaContains: 'Dueling Fighting Style (2)',
        hitBonusFormulaContains: 'Archery Fighting Style (2)',
      },
      {
        label: 'off-hand omits ability bonus (no suffix at all)',
        opts: { weaponName: 'Dagger', includeAbilityBonusInDamage: false },
        damage: '1d8', hitBonus: 5,
        damageFormulaContains: undefined,
        hitBonusFormulaContains: undefined,
      },
      {
        label: 'off-hand combines magic and TWF extras',
        opts: {
          weaponName: '+1 Dagger', includeAbilityBonusInDamage: false,
          extraDamage: '+3', extraDamageLabel: 'Two-Weapon Fighting Style (3)',
        },
        damage: '1d8+4', hitBonus: 6,
        damageFormulaContains: 'Two-Weapon Fighting Style (3)',
        hitBonusFormulaContains: undefined,
      },
      {
        label: 'negative modifier renders without plus sign',
        opts: { weaponName: 'Longsword', abilityBonus: -2 },
        damage: '1d8-2', hitBonus: 0,
        damageFormulaContains: 'Strength Bonus (-2)',
        hitBonusFormulaContains: undefined,
      },
      {
        label: 'extraDamage keeps only trailing number ("+1 + +2" → 2)',
        opts: { weaponName: 'Longsword', extraDamage: '+1 + +2', extraDamageLabel: 'Combined (2)' },
        damage: '1d8+5', hitBonus: 5,
        damageFormulaContains: 'Combined (2)',
        hitBonusFormulaContains: undefined,
      },
    ])('$label', ({ opts, damage, hitBonus, damageFormulaContains, hitBonusFormulaContains }) => {
      const result = buildWeaponAttack({ ...baseOpts, ...opts });
      expect(result.damage).toBe(damage);
      expect(result.hitBonus).toBe(hitBonus);
      if (damageFormulaContains) expect(result.damageFormula).toContain(damageFormulaContains);
      if (hitBonusFormulaContains) expect(result.hitBonusFormula).toContain(hitBonusFormulaContains);
    });
  });

  describe('buildMonkAttacks', () => {
    it.each([
      { diceStr: '1d6', dexterityBonus: 4, expectedDamage: '1d6+4', expectedHit: 6 },
      { diceStr: '1d4', dexterityBonus: -1, expectedDamage: '1d4-1', expectedHit: 1 },
    ])('two Unarmed Strikes (dex $dexterityBonus) → $expectedDamage', ({ diceStr, dexterityBonus, expectedDamage, expectedHit }) => {
      const result = buildMonkAttacks({ diceStr, dexterityBonus, proficiency: 2 });

      expect(result).toHaveLength(2);
      for (const attack of result) {
        expect(attack.name).toBe('Unarmed Strike');
        expect(attack.damage).toBe(expectedDamage);
        expect(attack.damageType).toBe('Bludgeoning');
        expect(attack.hitBonus).toBe(expectedHit);
        expect(attack.range).toBe(5);
        expect(attack.weaponType).toBe('unarmed');
        expect(attack.damageFormula).toContain(`Monk Open Hand (${diceStr})`);
        expect(attack.hitBonusFormula).toContain(`Dexterity Bonus (${dexterityBonus})`);
      }
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
    });
  });

  describe('resolveSpellDamageAtLevel', () => {
    const cantripSpell = { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10', '5': '2d10', '9': '3d10' }, damage_type: 'Fire' }, level: 0 };
    const leveledSpell = { name: 'Magic Missile', damage: { damage_at_slot_level: { '1': '1d4+1' }, damage_type: 'Force' }, level: 1 };
    const spellWithCharLevel = { name: 'Charm Spell', damage: { damage_at_character_level: { '1': '2d6' }, damage_at_slot_level: {} }, damage_type: 'Psychic', level: 1 };

    it.each([
      { label: 'cantrip low level', spell: cantripSpell, level: 1, expected: '1d10' },
      { label: 'cantrip mid-tier gap (falls back to highest ≤ level)', spell: cantripSpell, level: 4, expected: '1d10' },
      { label: 'cantrip tier boundary 5', spell: cantripSpell, level: 5, expected: '2d10' },
      { label: 'cantrip tier boundary 9', spell: cantripSpell, level: 9, expected: '3d10' },
      { label: 'cantrip beyond last tier', spell: cantripSpell, level: 17, expected: '3d10' },
      { label: 'leveled spell uses base tier', spell: leveledSpell, level: 5, expected: '1d4+1' },
      { label: 'empty slot-level falls back to character-level', spell: spellWithCharLevel, level: 5, expected: '2d6' },
      { label: 'spell with damage:null', spell: { name: 'Mage Hand', damage: null, level: 0 }, level: 5, expected: '' },
      { label: 'damage object with no tiers', spell: { name: 'Broken', damage: { damage_at_slot_level: {} }, level: 1 }, level: 5, expected: '' },
      { label: 'null spell', spell: null, level: 5, expected: '' },
    ])('$label', ({ spell, level, expected }) => {
      expect(resolveSpellDamageAtLevel(spell, level)).toBe(expected);
    });
  });

  describe('getAttacks', () => {
    const allEquipment = [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 }, properties: [] },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 80 } },
      { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Light'] },
      { name: 'Shortsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Light', 'Finesse'] },
    ];

    // NOTE: getAttacks derives proficiency from level
    // (level 5 → floor((5-1)/4+2) = 3); there is no proficiency input.
    const makePlayerStats = (overrides = {}) => ({
      level: 5,
      abilities: overrides.abilities || [
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

    it('builds melee main-hand attack on the higher STR with verbatim row', () => {
      const playerStats = makePlayerStats({ equipped: ['Longsword'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      // STR(3) beats DEX(2); proficiency derived from level 5 → 3
      expect(result[0].name).toBe('Longsword');
      expect(result[0].damage).toBe('1d8+3');
      expect(result[0].damageType).toBe('Slashing');
      expect(result[0].hitBonus).toBe(6);
      expect(result[0].range).toBe(5);
      expect(result[0].type).toBe('Action');
      expect(result[0].weaponType).toBe('melee');
    });

    it('builds ranged main-hand attack on DEX', () => {
      const playerStats = makePlayerStats({ equipped: ['Shortbow'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shortbow');
      expect(result[0].damage).toBe('1d6+2');
      expect(result[0].hitBonus).toBe(5);
      expect(result[0].range).toBe(80);
      expect(result[0].type).toBe('Action');
      // Quirk pinned as-is: ranged main-hand builder does not tag weaponType
      // (only light-ranged off-hand entries get 'ranged').
      expect(result[0].weaponType).toBe('');
    });

    it('threads magic prefix through findEquippedWeapons into damage and to-hit', () => {
      const playerStats = makePlayerStats({ equipped: ['+1 Longsword'] });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('+1 Longsword');
      expect(result[0].damage).toBe('1d8+4');
      expect(result[0].hitBonus).toBe(7);
      expect(result[0].damageFormula).toContain('Weapon Magic Bonus (1)');
      expect(result[0].hitBonusFormula).toContain('Weapon Magic Bonus (1)');
    });

    it('applies Archery fighting style to ranged to-hit', () => {
      const playerStats = makePlayerStats({
        equipped: ['Shortbow'],
        class: { name: 'Fighter', fightingStyles: ['Archery'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(7);
      expect(result[0].hitBonusFormula).toContain('Archery Fighting Style (2)');
    });

    it.each([
      { styles: ['Blessed Warrior'], damage: '1d8+3', damageFormulaContains: undefined },
      { styles: ['Blessed Warrior', 'Dueling'], damage: '1d8+5', damageFormulaContains: 'Dueling' },
    ])('Blessed Warrior (+2 hit) with styles $styles', ({ styles, damage, damageFormulaContains }) => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        class: { name: 'Fighter', fightingStyles: styles },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].hitBonus).toBe(8); // str(3) + prof(3) + blessed(2)
      expect(result[0].hitBonusFormula).toContain('Blessed Warrior (2)');
      expect(result[0].damage).toBe(damage);
      if (damageFormulaContains) expect(result[0].damageFormula).toContain(damageFormulaContains);
    });

    it.each([
      {
        label: 'two melee weapons disable Dueling; single light stays Action',
        equipped: ['Longsword', 'Dagger'],
        expected: [
          { name: 'Longsword', damage: '1d8+3', type: 'Action' },
          { name: 'Dagger', damage: '1d4+3', type: 'Action' },
        ],
      },
      {
        label: 'melee + ranged disables Dueling; both builders emit',
        equipped: ['Longsword', 'Shortbow'],
        expected: [
          { name: 'Shortbow', damage: '1d6+2', type: 'Action' },
          { name: 'Longsword', damage: '1d8+3', type: 'Action' },
        ],
      },
    ])('$label', ({ equipped, expected }) => {
      const playerStats = makePlayerStats({
        equipped,
        class: { name: 'Fighter', fightingStyles: ['Dueling'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(2);
      for (const exp of expected) {
        const attack = result.find(a => a.name === exp.name);
        expect(attack.damage).toBe(exp.damage);
        expect(attack.type).toBe(exp.type);
      }
    });

    it.each([
      {
        label: 'two light weapons enable TWF off-hand bonus',
        equipped: ['Shortsword', 'Dagger'],
        main: { name: 'Shortsword', damage: '1d6+3', type: 'Action' },
        off: { name: 'Dagger', damage: '1d4+3', type: 'Bonus Action' },
      },
      {
        label: 'non-light main hand: all Actions with ability bonus',
        equipped: ['Longsword', 'Dagger'],
        main: { name: 'Longsword', damage: '1d8+3', type: 'Action' },
        off: { name: 'Dagger', damage: '1d4+3', type: 'Action' },
      },
      {
        label: 'shield blocks TWF bonus on off-hand',
        equipped: ['Shortsword', 'Dagger', 'Shield'],
        main: { name: 'Shortsword', damage: '1d6+3', type: 'Action' },
        off: { name: 'Dagger', damage: '1d4', type: 'Bonus Action' },
      },
    ])('Two-Weapon Fighting — $label', ({ equipped, main, off }) => {
      const playerStats = makePlayerStats({
        equipped,
        class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result.find(a => a.name === main.name).type).toBe(main.type);
      expect(result.find(a => a.name === main.name).damage).toBe(main.damage);
      const offAttack = result.find(a => a.name === off.name && a.type === off.type);
      expect(offAttack).toBeDefined();
      expect(offAttack.damage).toBe(off.damage);
    });

    it('uses Dexterity for non-finesse melee when DEX is higher than STR', () => {
      const playerStats = makePlayerStats({
        equipped: ['Longsword'],
        abilities: [
          { name: 'Strength', bonus: 1 },
          { name: 'Dexterity', bonus: 4 },
        ],
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result[0].damage).toBe('1d8+4');
      expect(result[0].hitBonus).toBe(7);
      expect(result[0].hitBonusFormula).toContain('Dexterity Bonus (4)');
    });

    it('adds monk martial-arts unarmed strikes (Action + Bonus Action)', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Monk',
          fightingStyles: [],
          class_levels: {
            4: { class_specific: { martial_arts: { dice_count: 1, dice_value: 8 } } },
          },
        },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      // No weapons equipped → only the two monk strikes.
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe('1d8+2'); // dex(2)
      expect(result[0].hitBonus).toBe(5);
      expect(result[0].weaponType).toBe('unarmed');
      expect(result[0].type).toBe('Action');
      expect(result[1].type).toBe('Bonus Action');
    });

    it('does not build spell attacks from spellAbilities', () => {
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
      expect(result.filter(a => a.name === 'Fire Bolt')).toHaveLength(0);
    });

    it.each([
      {
        label: 'plain fallback strike',
        styles: [],
        length: 1,
        damage: '1d4+3',
        hitBonus: 6,
        hitBonusFormulaContains: undefined,
        secondType: undefined,
      },
      {
        label: 'Blessed Warrior adds +2 to fallback hit bonus',
        styles: ['Blessed Warrior'],
        length: 1,
        damage: '1d4+3',
        hitBonus: 8, // str(3) + prof(3) + blessed(2)
        hitBonusFormulaContains: 'Blessed Warrior (2)',
        secondType: undefined,
      },
      {
        label: 'Two-Weapon Fighting adds Bonus Action fallback strike',
        styles: ['Two-Weapon Fighting'],
        length: 2,
        damage: '1d4+3',
        hitBonus: 6,
        hitBonusFormulaContains: undefined,
        secondType: 'Bonus Action',
      },
    ])('fallback unarmed — $label', ({ styles, length, damage, hitBonus, hitBonusFormulaContains, secondType }) => {
      const playerStats = makePlayerStats({
        equipped: [],
        class: { name: 'Fighter', fightingStyles: styles },
      });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(length);
      expect(result[0].name).toBe('Unarmed Strike');
      expect(result[0].damage).toBe(damage);
      expect(result[0].hitBonus).toBe(hitBonus);
      expect(result[0].range).toBe(5);
      expect(result[0].weaponType).toBe('unarmed');
      if (hitBonusFormulaContains) expect(result[0].hitBonusFormula).toContain(hitBonusFormulaContains);
      if (secondType) expect(result[1].type).toBe(secondType);
    });

    it.each([
      { label: 'fightingStyles undefined', class: { name: 'Fighter', fightingStyles: undefined } },
      { label: 'fightingStyles null', class: { name: 'Fighter', fightingStyles: null } },
    ])('$label still builds attacks gracefully', ({ class: classOverride }) => {
      const playerStats = makePlayerStats({ equipped: ['Longsword'], class: classOverride });
      const result = getAttacks(allEquipment, [], playerStats);
      expect(result).toHaveLength(1);
      expect(result[0].damage).toBe('1d8+3');
      expect(result[0].hitBonus).toBe(6);
    });
  });
});
