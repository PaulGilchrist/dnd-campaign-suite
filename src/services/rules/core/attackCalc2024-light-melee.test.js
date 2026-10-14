import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

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
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}));

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

describe('attackCalc2024 - light melee weapons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places single light melee weapon as Action attack', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter' },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dagger');
    expect(result[0].type).toBe('Action');
  });

  it('places two light melee weapons: highest damage as Action, rest as Bonus Action', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
      {
        name: 'Sickle',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Slashing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter' },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('Action');
    expect(result[1].type).toBe('Bonus Action');
  });

  it('applies Two-Weapon Fighting passive to off-hand light melee bonus action damage', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
      {
        name: 'Sickle',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Slashing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Off-hand weapon should have ability bonus in damage from two_weapon_fighting
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('Bonus Action');
    expect(result[1].damage).toContain('+3');
    expect(buildWeaponAttackStub).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeAbilityBonusInDamage: true,
      })
    );
  });

  it('applies Dueling fighting style with single light melee weapon and no ranged weapons', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter', fightingStyles: ['Dueling'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraDamage: '+2',
        extraDamageLabel: 'Dueling Fighting Style (2)',
      })
    );
  });

  it('applies Blessed Warrior fighting style hit bonus to melee attacks', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Cleric', fightingStyles: ['Blessed Warrior'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraHitBonus: 2,
        extraHitBonusLabel: 'Blessed Warrior (2)',
      })
    );
  });

  it('applies Druidic Warrior fighting style damage bonus to melee attacks', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Druid', fightingStyles: ['Druidic Warrior'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraDamage: '+2',
        extraDamageLabel: 'Druidic Warrior (2)',
      })
    );
  });

  it('combines Dueling + Blessed Warrior damage and hit bonuses', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter', fightingStyles: ['Dueling', 'Blessed Warrior'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraDamage: '+2',
        extraDamageLabel: 'Dueling Fighting Style (2)',
        extraHitBonus: 2,
        extraHitBonusLabel: 'Blessed Warrior (2)',
      })
    );
  });

  it('combines Dueling + Druidic Warrior damage bonuses', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Druid', fightingStyles: ['Dueling', 'Druidic Warrior'] },
    });

    getAttacks(allEquipment, [], playerStats);

    // The code joins ['+2', '+2'] with ' + ' producing '+2 + +2'
    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraDamage: '+2 + +2',
        extraDamageLabel: 'Dueling Fighting Style (2) + Druidic Warrior (2)',
      })
    );
  });

  it('does not apply Dueling when both light melee and ranged weapons are equipped', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Dart'])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dart',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 20, long: 80 },
        properties: ['Light', 'Thrown'],
      },
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter', fightingStyles: ['Dueling'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).not.toHaveBeenCalledWith(
      expect.objectContaining({ extraDamage: '+2' })
    );
  });

  it('applies Two-Weapon Fighting passive to light melee off-hand in < 2 weapons path', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger']);

    const allEquipment = [
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
        bonusActions: [],
      },
    });

    // Single light melee weapon → all Action (no off-hand)
    const result = getAttacks(allEquipment, [], playerStats);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dagger');
    expect(result[0].type).toBe('Action');
  });
});
