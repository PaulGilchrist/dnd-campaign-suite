// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
  loadBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(() => []),
}));

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
  },
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: { getClass: vi.fn(), getFeatures: vi.fn(), getHighestSubclassLevel: vi.fn() },
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(), getRacialBonus: vi.fn(), getImmunities: vi.fn(),
    getResistances: vi.fn(), getSenses: vi.fn(), getTraits: vi.fn(),
  },
  rules2024: { getRace: vi.fn(), getSenses: vi.fn(), getTraits: vi.fn() },
}));

vi.mock('./abilityCalc.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(), getCarryingCapacity: vi.fn(),
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(), getCarryingCapacity: vi.fn(),
}));

vi.mock('./attackCalc.js', () => ({
  getAttacks: vi.fn(() => []),
  parseMagicItemName: vi.fn((name) => ({ baseName: name, magicBonus: 0 })),
}));

vi.mock('./attackCalc2024.js', () => ({ getAttacks: vi.fn() }));
vi.mock('./spellCalc.js', () => ({ getSpellAbilities: vi.fn(() => null) }));
vi.mock('./spellCalc2024.js', () => ({ getSpellAbilities: vi.fn(() => null) }));

vi.mock('../../character/proficiencyUtils.js', () => ({
  getProficiencyChoiceCount: vi.fn(() => 0),
  getProficiencies: vi.fn(() => [5, []]),
}));

vi.mock('../../character/proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(() => 0),
  getProficiencies: vi.fn(() => [5, []]),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
getRuntimeValue: vi.fn(() => undefined) }));

vi.mock('../../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => ({ passives: [], actions: [], specialActions: [] })),
  collectSaveModifiers: vi.fn(() => ({})),
  collectTurnStartEffects: vi.fn(() => []),
  getConditionImmunities: vi.fn(() => []),
  getConditionalImmunities: vi.fn(() => []),
  getEvasionEffects: vi.fn(() => []),
  getAllSaveProficiencies: vi.fn(() => []),
  evaluateAutoExpression: vi.fn(() => 0),
  buildAttackInfo: vi.fn(() => null),
}));

vi.mock('../../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
}));

vi.mock('../../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [],
    proficiencies: [],
    features: [],
  })),
}));

vi.mock('../../character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [],
    characterAdvancement: [],
  })),
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';
import * as abilityCalc from './abilityCalc.js';
import * as abilityCalc2024 from './abilityCalc2024.js';
import * as attackCalc from './attackCalc.js';
import * as automationService from '../../combat/automation/automationService.js';
import * as dataLoader from '../../ui/dataLoader.js';
import * as elfishLineageHandler from '../../automation/handlers/class-other/elfishLineageHandler.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

const defaultSkills = [
  { name: 'Athletics', ability: 'Strength' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
  { name: 'Persuasion', ability: 'Charisma' },
  { name: 'Deception', ability: 'Charisma' },
];

const defaultAbilities = [
  { name: 'Strength', totalScore: 15, bonus: 2, skills: [] },
  { name: 'Dexterity', totalScore: 14, bonus: 2, skills: [] },
  { name: 'Constitution', totalScore: 13, bonus: 1, skills: [] },
  { name: 'Intelligence', totalScore: 12, bonus: 1, skills: [] },
  { name: 'Wisdom', totalScore: 10, bonus: 0, skills: [] },
  { name: 'Charisma', totalScore: 8, bonus: -1, skills: [] },
];

const makePlayerSummary = (overrides = {}) => ({
  name: 'TestCharacter', level: 1, rules: '5e',
  class: { name: 'Fighter', saving_throws: [], languages: [], fightingStyles: [], proficiencies: [], class_levels: [{}], subclass: {}, major: {} },
  race: { name: 'Human', languages: ['Common'], traits: [] },
  languages: [],
  abilities: [
    { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
  ],
  inventory: { equipped: [], magicItems: [] },
  skillProficiencies: [], expertise: [], actions: [], bonusActions: [], reactions: [], specialActions: [], activeBuffs: [],
  ...overrides,
});

const setupDefaults = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
  classRules.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, ...overrides.class });
  raceRules.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.traits });
  raceRules.getSenses.mockReturnValue(overrides.senses || []);
  raceRules.getImmunities.mockReturnValue(overrides.immunities || []);
  raceRules.getResistances.mockReturnValue(overrides.resistances || []);
  classRules.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.features });
  automationService.collectAutomationFromFeatures.mockReturnValue(overrides.automation || { passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  abilityCalc.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  abilityCalc.getCarryingCapacity.mockReturnValue(overrides.carryingCapacity ?? 150);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
  elfishLineageHandler.getElfisLineageSelection.mockReturnValue(overrides.lineage ?? null);
};

const setup2024Defaults = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
  raceRules2024.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules2024.getSenses.mockReturnValue(overrides.senses || []);
  raceRules2024.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.traits });
  classRules2024.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, ...overrides.class });
  classRules2024.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.features });
  abilityCalc2024.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  abilityCalc.getCarryingCapacity.mockReturnValue(overrides.carryingCapacity ?? 150);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
  automationService.collectAutomationFromFeatures.mockReturnValue(overrides.automation || { passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  elfishLineageHandler.getElfisLineageSelection.mockReturnValue(null);
};

describe('rules.getPlayerStats - speed bonuses', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add 5 ft speed for Wood Elf lineage', async () => {
    setupDefaults({ lineage: 'Wood Elf' });
    const playerSummary = makePlayerSummary({ speed: 30 });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.speed).toBe(35);
  });

  it('should add speed_bonus when condition allows', async () => {
    setupDefaults({ automation: { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '15', condition: 'no_heavy_armor' }], actions: [], specialActions: [] } });
    const playerSummary = makePlayerSummary({ speed: 30 });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.speed).toBe(45);
  });

  it('should not apply speed_bonus when wearing heavy armor with no_heavy_armor condition', async () => {
    setupDefaults({ automation: { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' }], actions: [], specialActions: [] } });
    const playerSummary = makePlayerSummary({
      speed: 30,
      inventory: { equipped: ['Plate Armor'], magicItems: [] },
      equipment: [{ name: 'Plate Armor', armor_category: 'Heavy' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.speed).toBe(30);
  });
});

describe('rules.getPlayerStats - senses enhancements (5e)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it.each`
    existingSenses                          | expectedSenses
    ${[{ name: 'Darkvision', value: '60 ft.' }]}                         | ${[{ name: 'Darkvision', value: '120 ft.' }]}
    ${[{ name: 'Darkvision', value: '120 ft.' }]}                         | ${[{ name: 'Darkvision', value: '120 ft.' }]}
    ${[]}                                   | ${[{ name: 'Darkvision', value: '120 ft.' }]}
  `('should handle Third Eye darkvision: existing=$existingSenses', async ({ existingSenses, expectedSenses }) => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([{ name: 'The Third Eye', effect: 'darkvision_120' }]);
    raceRules.getSenses.mockReturnValue(existingSenses);
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toEqual(expectedSenses);
  });

  it('should add Truesight from passive_buff automation', async () => {
    setupDefaults({
      automation: { passives: [{ type: 'passive_buff', effect: 'truesight', range: '60 ft.' }], actions: [], specialActions: [] },
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Truesight', value: '60 ft.' });
  });

  it('should use default 60 ft for Truesight when range is missing', async () => {
    setupDefaults({
      automation: { passives: [{ type: 'passive_buff', effect: 'truesight' }], actions: [], specialActions: [] },
      senses: [],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Truesight', value: '60 ft.' });
  });

  it('should not duplicate Truesight if already present', async () => {
    setupDefaults({
      automation: { passives: [{ type: 'passive_buff', effect: 'truesight', range: '120 ft.' }], actions: [], specialActions: [] },
      senses: [{ name: 'Truesight', value: '30 ft.' }],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const truesightCount = result.senses.filter(s => s.name === 'Truesight').length;
    expect(truesightCount).toBe(1);
  });
});

describe('rules.getPlayerStats - 2024 senses', () => {
  beforeEach(() => { vi.clearAllMocks(); setup2024Defaults(); });

  it('should set senses from raceRules.getSenses in 2024 mode', async () => {
    raceRules2024.getSenses.mockReturnValue([{ name: 'Darkvision', value: '120 ft.' }]);
    const playerSummary = makePlayerSummary({ rules: '2024' });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
  });

  it('should apply Umbral Sight darkvision for Gloom Stalker in 2024', async () => {
    setup2024Defaults({
      class: { name: 'Ranger', major: { name: 'Stalker' } },
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
    });
    const playerSummary = makePlayerSummary({ rules: '2024', class: { name: 'Ranger', major: { name: 'Stalker' } } });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
  });

  it('should apply Third Eye darkvision in 2024 mode', async () => {
    vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([{ name: 'The Third Eye', effect: 'darkvision_120' }]);
    setup2024Defaults({ senses: [{ name: 'Darkvision', value: '60 ft.' }], class: { name: 'Fighter' } });
    const playerSummary = makePlayerSummary({ rules: '2024' });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
  });

  it('should apply Truesight in 2024 mode', async () => {
    setup2024Defaults({
      automation: { passives: [{ type: 'passive_buff', effect: 'truesight', range: '120 ft.' }], actions: [], specialActions: [] },
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
    });
    const playerSummary = makePlayerSummary({ rules: '2024' });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.senses).toContainEqual({ name: 'Truesight', value: '120 ft.' });
  });
});
