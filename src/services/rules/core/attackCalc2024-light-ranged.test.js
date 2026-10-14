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

describe('attackCalc2024 - light ranged weapons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places single light ranged weapon as Action attack', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Hand Crossbow'])
      .mockReturnValueOnce([]);

    const allEquipment = [
      {
        name: 'Hand Crossbow',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 30, long: 120 },
        properties: ['Light', 'Ammunition', 'Loading'],
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
    expect(result[0].name).toBe('Hand Crossbow');
    expect(result[0].type).toBe('Action');
    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'Action',
        abilityName: 'Dexterity',
        abilityBonus: 3,
      })
    );
  });

  it('places two light ranged weapons: highest damage as Action, rest as Bonus Action', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Hand Crossbow', 'Dart'])
      .mockReturnValueOnce([]);

    const allEquipment = [
      {
        name: 'Hand Crossbow',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 30, long: 120 },
        properties: ['Light', 'Ammunition', 'Loading'],
      },
      {
        name: 'Dart',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 20, long: 80 },
        properties: ['Light', 'Thrown'],
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

    // Hand Crossbow (1d6 avg 3.5) > Dart (1d4 avg 2.5), so Hand Crossbow = Action, Dart = Bonus Action
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Hand Crossbow');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Dart');
    expect(result[1].type).toBe('Bonus Action');
  });

  it('applies Archery fighting style to light ranged weapon attacks', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Hand Crossbow'])
      .mockReturnValueOnce([]);

    const allEquipment = [
      {
        name: 'Hand Crossbow',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 30, long: 120 },
        properties: ['Light', 'Ammunition', 'Loading'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter', fightingStyles: ['Archery'] },
    });

    getAttacks(allEquipment, [], playerStats);

    expect(buildWeaponAttackStub).toHaveBeenCalledWith(
      expect.objectContaining({
        extraHitBonus: 2,
        extraHitBonusLabel: 'Archery Fighting Style (2)',
      })
    );
  });

  it('applies Crossbow Expert to Hand Crossbow bonus action attacks (ability bonus in damage)', () => {
    // Make Dart higher damage so it becomes the Action and Hand Crossbow becomes Bonus Action
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Dart', 'Hand Crossbow'])
      .mockReturnValueOnce([]);

    const allEquipment = [
      {
        name: 'Dart',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d8', damage_type: 'Piercing' },
        range: { normal: 20, long: 80 },
        properties: ['Light', 'Thrown'],
      },
      {
        name: 'Hand Crossbow',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 30, long: 120 },
        properties: ['Light', 'Ammunition', 'Loading'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 1,
      abilities: [
        { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        { name: 'Dexterity', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
      ],
      class: { name: 'Fighter' },
      feats: ['Crossbow Expert'],
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Hand Crossbow bonus action should have ability bonus in damage due to Crossbow Expert
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Dart');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Hand Crossbow');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[1].damage).toContain('+3');
    expect(buildWeaponAttackStub).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeAbilityBonusInDamage: true,
      })
    );
  });

  it('does not apply Crossbow Expert ability bonus to non-Hand Crossbow bonus actions', () => {
    findEquippedWeaponsStub
      .mockReturnValueOnce(['Dart', 'Sling'])
      .mockReturnValueOnce([]);

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
        name: 'Sling',
        equipment_category: 'Weapon',
        weapon_range: 'Ranged',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 30, long: 120 },
        properties: ['Light', 'Ammunition'],
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
        passives: [{ effect: 'crossbow_expert', name: 'Crossbow Expert' }],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Sling bonus action should NOT have ability bonus in damage (not Hand Crossbow)
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('Sling');
    expect(result[1].type).toBe('Bonus Action');
    // Without includeAbilityBonusInDamage, the stub returns just the dice
    expect(buildWeaponAttackStub).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeAbilityBonusInDamage: false,
      })
    );
  });
});
