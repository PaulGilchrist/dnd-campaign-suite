// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
  loadBackgroundData: vi.fn(() => null),
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
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn(),
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
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
}));

vi.mock('../../character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import { rules5e as raceRules } from '../../character/race-rules/index.js';
import * as abilityCalc from './abilityCalc.js';
import * as attackCalc from './attackCalc.js';
import * as dataLoader from '../../ui/dataLoader.js';
import * as featBuffService from '../../character/featBuffService.js';

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
  abilityCalc.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  abilityCalc.getCarryingCapacity.mockReturnValue(overrides.carryingCapacity ?? 150);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
};

describe('rules.getPlayerStats - speed', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should set speed from playerStats with no bonuses', async () => {
    const playerSummary = makePlayerSummary({ speed: 30 });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.speed).toBe(30);
  });
});

describe('rules.getPlayerStats - racial traits', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should set sizeMultiplier to 2 when Powerful Build trait exists', async () => {
    setupDefaults({ race: { name: 'Hill Giant', languages: ['Common'], traits: [{ name: 'Powerful Build' }] } });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.sizeMultiplier).toBe(2);
  });

  it('should set canMoveThroughCreatureSpace when Halfling Nimbleness trait exists', async () => {
    setupDefaults({ race: { name: 'Lightfoot Halfling', languages: ['Common'], traits: [{ name: 'Halfling Nimbleness' }] } });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.canMoveThroughCreatureSpace).toBe(true);
  });
});

describe('rules.getPlayerStats - feat features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [],
      features: [],
    });
  });

  it('should add feat features to the correct action array based on casting_time', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [
        { name: 'War Caster', description: 'Advantage on con saves', type: 'passive', automation: { casting_time: '1 reaction' } },
        { name: 'Inspiring Leader', description: 'Buff allies', type: 'passive', automation: { casting_time: '1 action' } },
        { name: 'Heal Word', description: 'Restore HP', type: 'passive', automation: { casting_time: '1 bonus action' } },
      ],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.reactions.find((f) => f.name === 'War Caster')).toBeDefined();
    expect(result.actions.find((f) => f.name === 'Inspiring Leader')).toBeDefined();
    expect(result.bonusActions.find((f) => f.name === 'Heal Word')).toBeDefined();
    expect(result.reactions.find((f) => f.name === 'War Caster').source).toBe('feat');
  });
});

describe('rules.getPlayerStats - cloning', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should not mutate the original playerSummary', async () => {
    const playerSummary = makePlayerSummary({ actions: [{ name: 'Attack' }] });
    const originalActions = JSON.stringify(playerSummary.actions);
    await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(JSON.stringify(playerSummary.actions)).toBe(originalActions);
  });
});
