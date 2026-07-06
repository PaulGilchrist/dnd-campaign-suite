// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
  loadBackgroundData: vi.fn(() => null),
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
import * as featBuffService from '../../character/featBuffService.js';
import * as proficiencyUtils2024 from '../../character/proficiencyUtils2024.js';

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
  name: 'TestCharacter',
  level: 1,
  rules: '5e',
  class: {
    name: 'Fighter',
    saving_throws: [],
    languages: [],
    fightingStyles: [],
    proficiencies: [],
    class_levels: [{}],
    subclass: {},
    major: {},
  },
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
  skillProficiencies: [],
  expertise: [],
  proficiencies: [],
  expertSkills: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  activeBuffs: [],
  ...overrides,
});

const setupDefaults = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
  classRules.getClass.mockReturnValue({
    name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [],
    class_levels: [{}], languages: [], subclass: {}, major: {}, ...overrides.class,
  });
  raceRules.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules.getTraits.mockReturnValue({
    actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.traits,
  });
  raceRules.getSenses.mockReturnValue(overrides.senses || []);
  raceRules.getImmunities.mockReturnValue(overrides.immunities || []);
  raceRules.getResistances.mockReturnValue(overrides.resistances || []);
  classRules.getFeatures.mockReturnValue({
    actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.features,
  });
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
};

describe('rules.getPlayerStats - feat buffs proficiency handling', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add all_skills proficiency feat buff to skillProficiencies', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'all_skills', type: 'skill' }],
      features: [],
    });
    vi.mocked(dataLoader.loadSkills).mockResolvedValue([
      { name: 'Athletics', ability: 'Strength' },
      { name: 'Stealth', ability: 'Dexterity' },
      { name: 'Perception', ability: 'Wisdom' },
    ]);
    const playerSummary = makePlayerSummary({
      skillProficiencies: [],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.skillProficiencies).toContain('Athletics');
    expect(result.skillProficiencies).toContain('Stealth');
    expect(result.skillProficiencies).toContain('Perception');
  });

  it('should add proficiency choice feat buff to proficiencies', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ type: 'proficiency', isChoice: true, choose: 3, from: ['Artisan\'s Tools'] }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      proficiencies: ['Light Armor'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.proficiencies).toContain('3 from: Artisan\'s Tools');
  });

  it('should add non-choice proficiency feat buff to proficiencies', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'Heavy Armor', type: 'proficiency', isChoice: false }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      proficiencies: ['Light Armor'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.proficiencies).toContain('Heavy Armor');
  });
});

describe('rules.getPlayerStats - 2024 expertise feat handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    raceRules2024.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [] });
    raceRules2024.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
    classRules2024.getClass.mockReturnValue({
      name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [],
      class_levels: [{}], languages: [], major: {},
    });
    classRules2024.getFeatures.mockReturnValue({
      actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
    });
    proficiencyUtils2024.getProficiencies.mockReturnValue([2, []]);
    proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);
    abilityCalc2024.getAbilities.mockResolvedValue(defaultAbilities);
    abilityCalc2024.getHitPoints.mockReturnValue(12);
    abilityCalc2024.getCarryingCapacity.mockReturnValue(150);
  });

  it('should mark expertise for 2024 feat proficiency choices', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ type: 'proficiency', isChoice: true, choose: 1, from: ['Knowledge'], grantsExpertise: true }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      proficiencies: ['1 from: Knowledge'],
      expertise: [],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Knowledge');
  });

  it('should support expertSkills field alongside expertise for 2024', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ type: 'proficiency', isChoice: true, choose: 1, from: ['Perception'], grantsExpertise: true }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      proficiencies: ['1 from: Perception'],
      expertise: ['Insight'],
      expertSkills: ['History'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Insight');
    expect(result.expertise).toContain('History');
    expect(result.expertise).toContain('Perception');
  });
});

describe('rules.getPlayerStats - feat feature distribution and sorting', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should distribute feat features to correct action arrays and sort them', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [],
      features: [
        { name: 'ZFeat', description: 'Z feat', type: 'passive', automation: { casting_time: '1 action' } },
        { name: 'AFeat', description: 'A feat', type: 'passive', automation: { casting_time: '1 bonus action' } },
      ],
    });
    const playerSummary = makePlayerSummary({
      actions: [{ name: 'MAction' }],
      bonusActions: [{ name: 'ZBonus' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const actionNames = result.actions.map(a => a.name);
    const bonusNames = result.bonusActions.map(a => a.name);
    expect(actionNames).toEqual(actionNames.slice().sort());
    expect(bonusNames).toEqual(bonusNames.slice().sort());
    expect(actionNames).toContain('ZFeat');
    expect(actionNames).toContain('MAction');
    expect(bonusNames).toContain('AFeat');
    expect(bonusNames).toContain('ZBonus');
  });
});
