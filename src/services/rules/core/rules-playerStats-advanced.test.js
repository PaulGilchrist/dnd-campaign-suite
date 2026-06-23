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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(() => undefined) }));

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

  it('should default speed when not provided', async () => {
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    // speed is undefined if not in playerSummary (no default applied)
    expect(result.speed).toBeUndefined();
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

  it('should not set sizeMultiplier when Powerful Build is absent', async () => {
    setupDefaults({ race: { name: 'Human', languages: ['Common'], traits: [] } });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.sizeMultiplier).toBeUndefined();
  });

  it('should set canMoveThroughCreatureSpace when Halfling Nimbleness trait exists', async () => {
    setupDefaults({ race: { name: 'Lightfoot Halfling', languages: ['Common'], traits: [{ name: 'Halfling Nimbleness' }] } });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.canMoveThroughCreatureSpace).toBe(true);
  });

  it('should not set canMoveThroughCreatureSpace when trait is absent', async () => {
    setupDefaults({ race: { name: 'Human', languages: ['Common'], traits: [] } });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.canMoveThroughCreatureSpace).toBeUndefined();
  });
});

describe('rules.getPlayerStats - hunter prey', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add Horde Breaker attack when Hunter prey passive and extra attacks', async () => {
    vi.mocked(automationService.collectAutomationFromFeatures).mockReturnValue({
      passives: [{ type: 'hunter_prey', name: "Hunter's Prey" }],
      actions: [],
      specialActions: [],
    });
    classRules.getRangerFeatures.mockReturnValue({ extraAttacks: 1 });
    const playerSummary = makePlayerSummary({
      class: { name: 'Ranger', saving_throws: [], languages: [], subclass: {}, major: {} },
      proficiency: 3,
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const hordeBreaker = result.attacks.find((a) => a.isHordeBreaker);
    expect(hordeBreaker).toBeDefined();
    expect(hordeBreaker.name).toBe("Horde Breaker");
    expect(hordeBreaker.damage).toBe('1d4');
    expect(hordeBreaker.type).toBe('Bonus Action');
  });

  it('should not add Horde Breaker when no extra attacks', async () => {
    vi.mocked(automationService.collectAutomationFromFeatures).mockReturnValue({
      passives: [{ type: 'hunter_prey', name: "Hunter's Prey" }],
      actions: [],
      specialActions: [],
    });
    classRules.getRangerFeatures.mockReturnValue({ extraAttacks: 0 });
    const playerSummary = makePlayerSummary({
      class: { name: 'Ranger', saving_throws: [], languages: [], subclass: {}, major: {} },
      proficiency: 2,
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const hordeBreaker = result.attacks.find((a) => a.isHordeBreaker);
    expect(hordeBreaker).toBeUndefined();
  });
});

describe('rules.getPlayerStats - allFeatures', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should collect all features from action arrays', async () => {
    classRules.getFeatures.mockReturnValue({
      actions: [{ name: 'Action Surge', description: 'Take an extra action' }],
      bonusActions: [{ name: 'Second Wind' }],
      reactions: [{ name: 'Opportunity Attack' }],
      specialActions: [{ name: 'Fighter Level 2' }],
      characterAdvancement: [],
    });
    const playerSummary = makePlayerSummary({ actions: [{ name: 'Attack', description: 'Make an attack' }] });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.allFeatures).toBeDefined();
    expect(Array.isArray(result.allFeatures)).toBe(true);
    const actionSurge = result.allFeatures.find((f) => f.name === 'Action Surge');
    expect(actionSurge).toBeDefined();
    expect(actionSurge.description).toBe('Take an extra action');
  });
});

describe('rules.getPlayerStats - feat features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    // Reset feat buff mock to return empty by default
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [],
      features: [],
    });
  });

  it('should add feat features to reactions when casting_time is reaction', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [{ name: 'War Caster', description: 'Advantage on con saves', type: 'passive', automation: { casting_time: '1 reaction' } }],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const warCaster = result.reactions.find((f) => f.name === 'War Caster');
    expect(warCaster).toBeDefined();
    expect(warCaster.source).toBe('feat');
  });

  it('should add feat features to actions when casting_time is action', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [{ name: 'Inspiring Leader', description: 'Buff allies', type: 'passive', automation: { casting_time: '1 action' } }],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.actions.find((f) => f.name === 'Inspiring Leader')).toBeDefined();
  });

  it('should add feat features to bonusActions when casting_time is bonus action', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [{ name: 'Heal Word', description: 'Restore HP', type: 'passive', automation: { casting_time: '1 bonus action' } }],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.bonusActions.find((f) => f.name === 'Heal Word')).toBeDefined();
  });

  it('should re-process automation after adding feat features', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [{ name: 'Test Feat', description: 'A test feat', type: 'passive', automation: { type: 'passive_buff', effect: 'test' } }],
    });
    automationService.collectAutomationFromFeatures.mockImplementation((features) => {
      if (features && features.some((f) => f.name === 'Test Feat')) {
        return { passives: [{ type: 'passive_buff', effect: 'test' }], actions: [], specialActions: [] };
      }
      return { passives: [], actions: [], specialActions: [] };
    });
    const playerSummary = makePlayerSummary();
    await rules.getPlayerStats([], [], [], [], [], playerSummary);
    // Second call should include feat features
    expect(automationService.collectAutomationFromFeatures).toHaveBeenCalledTimes(2);
  });
});

import * as featBuffService from '../../character/featBuffService.js';
import * as automationService from '../../combat/automation/automationService.js';

describe('rules.getPlayerStats - action defaults', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should default empty action arrays when missing from playerSummary', async () => {
    const playerSummary = makePlayerSummary({
      actions: undefined, bonusActions: undefined, reactions: undefined,
      specialActions: undefined, characterAdvancement: undefined, expertise: undefined,
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(Array.isArray(result.actions)).toBe(true);
    expect(Array.isArray(result.bonusActions)).toBe(true);
    expect(Array.isArray(result.reactions)).toBe(true);
    expect(Array.isArray(result.specialActions)).toBe(true);
    expect(Array.isArray(result.characterAdvancement)).toBe(true);
    expect(Array.isArray(result.expertise)).toBe(true);
  });
});

describe('rules.getPlayerStats - cloning', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should preserve original playerSummary properties via deep clone', async () => {
    const playerSummary = makePlayerSummary({ customField: 'customValue', nested: { key: 'value' } });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.customField).toBe('customValue');
    expect(result.nested.key).toBe('value');
  });

  it('should not mutate the original playerSummary', async () => {
    const playerSummary = makePlayerSummary({ actions: [{ name: 'Attack' }] });
    const originalActions = JSON.stringify(playerSummary.actions);
    await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(JSON.stringify(playerSummary.actions)).toBe(originalActions);
  });

  it('should set proficiency from playerSummary level', async () => {
    const playerSummary = makePlayerSummary({ level: 11 });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.proficiency).toBe(4);
  });
});
