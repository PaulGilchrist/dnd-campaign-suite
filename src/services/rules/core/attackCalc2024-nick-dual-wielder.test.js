// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

describe('attackCalc2024 - Nick mastery and Dual Wielder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes off-hand bonus action to Action when Nick mastery is available and used this round', async () => {
    const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
    const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

    vi.mocked(getCurrentCombatRound).mockReturnValue(3);
    vi.mocked(getRuntimeValue).mockReturnValue(3);
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: 'Nick',
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle', 'Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Acidic Spear (1d6) = Action, Dagger (1d4) = Action, Sickle (1d4) = Action because Nick used this round
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Acidic Spear');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Dagger');
    expect(result[1].type).toBe('Action');
    expect(result[2].name).toBe('Sickle');
    expect(result[2].type).toBe('Action');
  });

  it('keeps off-hand as Bonus Action when Nick mastery is not available', async () => {
    const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
    const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

    vi.mocked(getCurrentCombatRound).mockReturnValue(3);
    vi.mocked(getRuntimeValue).mockReturnValue(3);
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: null,
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle', 'Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Acidic Spear (1d6) = Action, Dagger/Sickle = Bonus Action (no Nick)
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Acidic Spear');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Dagger');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[2].name).toBe('Sickle');
    expect(result[2].type).toBe('Bonus Action');
  });

  it('keeps off-hand as Bonus Action when Nick not used this round', async () => {
    const { getCurrentCombatRound } = await import('../../encounters/combatData.js');
    const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');

    vi.mocked(getCurrentCombatRound).mockReturnValue(3);
    vi.mocked(getRuntimeValue).mockReturnValue(2); // different round
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: 'Nick',
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle', 'Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [{ effect: 'two_weapon_fighting', name: 'Dual Wielding' }],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Nick available but not used this round, so off-hands stay as Bonus Action
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Acidic Spear');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Dagger');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[2].name).toBe('Sickle');
    expect(result[2].type).toBe('Bonus Action');
  });

  it('adds Dual Wielder extra attack with magic bonus damage formula', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: null,
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['+2 Dagger', '+1 Sickle', '+3 Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [],
        bonusActions: [
          { type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' },
        ],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Acidic Spear (+3 magic) = Action, Dagger = Bonus Action, Sickle = Bonus
    // Action, one Dual Wielder extra attack (off-hand = +2 Dagger) = 4.
    // FT-104: rows must carry the canonical consumer shape (.type/.hitBonus).
    expect(result).toHaveLength(4);
    expect(result[0].name).toBe('+3 Acidic Spear');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('+2 Dagger');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[2].name).toBe('+1 Sickle');
    expect(result[2].type).toBe('Bonus Action');
    expect(result[3].name).toBe('Dual Wielder Extra Attack');
    expect(result[3].type).toBe('Bonus Action');
    expect(result[3].weaponType).toBe('melee');
    expect(result[3].range).toBe(5);
    expect(result[3].hitBonus).toBe(8); // STR 3 + Prof 3 + magic 2
    expect(result[3].weaponName).toBe('+2 Dagger');
    expect(result[3].damageFormula).toContain('Weapon Magic Bonus');
    expect(result[3].damage).toContain('+2');
    expect(result[3].properties).toContain('Light');
  });

  it('adds Dual Wielder extra attack without magic bonus when weapon is not magical', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: null,
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle', 'Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [],
        bonusActions: [
          { type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' },
        ],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    expect(result).toHaveLength(4);
    expect(result[1].name).toBe('Dagger');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[2].name).toBe('Sickle');
    expect(result[2].type).toBe('Bonus Action');
    expect(result[3].name).toBe('Dual Wielder Extra Attack');
    expect(result[3].type).toBe('Bonus Action');
    expect(result[3].weaponType).toBe('melee');
    expect(result[3].range).toBe(5);
    expect(result[3].hitBonus).toBe(6); // STR 3 + Prof 3, no magic
    expect(result[3].weaponName).toBe('Dagger');
    expect(result[3].damageFormula).not.toContain('Weapon Magic Bonus');
    expect(result[3].damage).toBe('1d4'); // dice only — no ability modifier
  });

  it('FT-104 canonical delta: DW holder with Longsword + Shortsword gets the off-hand bonus row (non-holder gets none)', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: null, extraMasteries: [] });

    const allEquipment = [
      {
        name: 'Longsword',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d8', damage_type: 'Slashing' },
        range: { normal: 5 },
        properties: ['Versatile'],
        mastery: 'Nick',
      },
      {
        name: 'Shortsword',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse'],
        mastery: 'Finesse',
      },
    ];
    const base = {
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
    };

    // Non-holder: Light-only gate — Shortsword promoted to Action, NO bonus row.
    findEquippedWeaponsStub.mockReturnValueOnce([]).mockReturnValueOnce(['Longsword', 'Shortsword']);
    const withoutFeat = getAttacks(allEquipment, [], defaultPlayerStats({
      ...base,
      automation: { passives: [], bonusActions: [] },
    }));
    expect(withoutFeat.some(a => a.name === 'Dual Wielder Extra Attack')).toBe(false);
    expect(withoutFeat.map(a => [a.name, a.type])).toEqual([
      ['Longsword', 'Action'],
      ['Shortsword', 'Action'],
    ]);

    // DW holder: exactly one off-hand Bonus Action row, dice-only damage.
    findEquippedWeaponsStub.mockReturnValueOnce([]).mockReturnValueOnce(['Longsword', 'Shortsword']);
    const withFeat = getAttacks(allEquipment, [], defaultPlayerStats({
      ...base,
      automation: { passives: [], bonusActions: [{ type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' }] },
    }));
    const dwRow = withFeat.find(a => a.name === 'Dual Wielder Extra Attack');
    expect(dwRow).toBeTruthy();
    expect(dwRow.type).toBe('Bonus Action');
    expect(dwRow.weaponType).toBe('melee');
    expect(dwRow.range).toBe(5);
    expect(dwRow.hitBonus).toBe(6); // STR 3 + Prof 3
    expect(dwRow.weaponName).toBe('Shortsword'); // different from main-hand Longsword
    expect(dwRow.damage).toBe('1d6'); // no +3 ability modifier
    expect(withFeat.filter(a => a.name === 'Dual Wielder Extra Attack')).toHaveLength(1);
  });

  it('FT-104: negative ability modifier IS added to the Dual Wielder extra attack damage', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: null, extraMasteries: [] });

    const allEquipment = [
      {
        name: 'Club',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Bludgeoning' },
        range: { normal: 5 },
        properties: ['Light'],
      },
      {
        name: 'Dagger',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d4', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse'],
      },
    ];

    findEquippedWeaponsStub.mockReturnValueOnce([]).mockReturnValueOnce(['Club', 'Dagger']);
    const result = getAttacks(allEquipment, [], defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0, bonus: -1 },
        { name: 'Dexterity', baseScore: 8, abilityImprovements: 0, miscBonus: 0, bonus: -1 },
      ],
      class: { name: 'Fighter' },
      automation: { passives: [], bonusActions: [{ type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' }] },
    }));

    const dwRow = result.find(a => a.name === 'Dual Wielder Extra Attack');
    expect(dwRow).toBeTruthy();
    expect(dwRow.damage).toBe('1d4-1'); // negative ability modifier applies
    expect(dwRow.hitBonus).toBe(2); // STR -1 + Prof 3
  });

  it('FT-104: no Dual Wielder row when the second melee weapon is Two-Handed', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({ baseMastery: null, extraMasteries: [] });

    const allEquipment = [
      {
        name: 'Shortsword',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Finesse'],
      },
      {
        name: 'Greatsword',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '2d6', damage_type: 'Slashing' },
        range: { normal: 5 },
        properties: ['Heavy', 'Two-Handed'],
      },
    ];

    findEquippedWeaponsStub.mockReturnValueOnce([]).mockReturnValueOnce(['Shortsword', 'Greatsword']);
    const result = getAttacks(allEquipment, [], defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      campaignName: 'test-campaign',
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: { passives: [], bonusActions: [{ type: 'dual_wielder_attack', trigger: 'attack_action_with_light_weapon' }] },
    }));

    expect(result.some(a => a.name === 'Dual Wielder Extra Attack')).toBe(false);
  });

  it('skips Nick check when playerStats has no campaignName (localhost)', async () => {
    const { collectWeaponMastery } = await import('../../combat/automation/automationPassives.js');
    vi.mocked(collectWeaponMastery).mockReturnValue({
      baseMastery: 'Nick',
      extraMasteries: [],
    });

    findEquippedWeaponsStub
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Dagger', 'Sickle', 'Acidic Spear']);

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
      {
        name: 'Acidic Spear',
        equipment_category: 'Weapon',
        weapon_range: 'Melee',
        damage: { damage_dice: '1d6', damage_type: 'Piercing' },
        range: { normal: 5 },
        properties: ['Light', 'Thrown'],
      },
    ];
    const playerStats = defaultPlayerStats({
      level: 5,
      name: 'Test Character',
      // No campaignName - Nick check should be skipped
      abilities: [
        { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
      ],
      class: { name: 'Fighter' },
      automation: {
        passives: [],
        bonusActions: [],
      },
    });

    const result = getAttacks(allEquipment, [], playerStats);

    // Without campaignName, Nick check is skipped, off-hands stay as Bonus Action
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Acidic Spear');
    expect(result[0].type).toBe('Action');
    expect(result[1].name).toBe('Dagger');
    expect(result[1].type).toBe('Bonus Action');
    expect(result[2].name).toBe('Sickle');
    expect(result[2].type).toBe('Bonus Action');
  });
});
