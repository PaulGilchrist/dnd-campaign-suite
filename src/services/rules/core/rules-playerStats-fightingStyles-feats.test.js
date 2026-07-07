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
  getProficiencyChoiceCount: vi.fn(() => 0),
  getProficiencies: vi.fn(() => [5, []]),
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
};

const setupDefaults2024 = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
  classRules2024.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, ...overrides.class });
  raceRules2024.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules2024.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.traits });
  raceRules2024.getSenses.mockReturnValue(overrides.senses || []);
  classRules2024.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [], ...overrides.features });
  automationService.collectAutomationFromFeatures.mockReturnValue(overrides.automation || { passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  abilityCalc2024.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  abilityCalc.getCarryingCapacity.mockReturnValue(overrides.carryingCapacity ?? 150);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
};

const fightStyleCases5e = [
  { name: 'Interception', style: 'Interception', className: 'Paladin', array: 'reactions', featureName: 'Interception', type: 'interception' },
  { name: 'Protection', style: 'Protection', className: 'Paladin', array: 'reactions', featureName: 'Protection', type: 'protection' },
  { name: 'Thrown Weapon Fighting', style: 'Thrown Weapon Fighting', className: 'Fighter', array: 'specialActions', featureName: 'Thrown Weapon Fighting', type: 'thrown_weapon_fighting' },
  { name: 'Two-Weapon Fighting', style: 'Two-Weapon Fighting', className: 'Fighter', array: 'specialActions', featureName: 'Two-Weapon Fighting', type: 'two_weapon_fighting' },
  { name: 'Blessed Warrior', style: 'Blessed Warrior', className: 'Cleric', array: 'specialActions', featureName: 'Blessed Warrior', type: 'blessed_warrior' },
  { name: 'Druidic Warrior', style: 'Druidic Warrior', className: 'Druid', array: 'specialActions', featureName: 'Druidic Warrior', type: 'druidic_warrior' },
  { name: 'Superior Technique', style: 'Superior Technique', className: 'Battle Master', array: 'specialActions', featureName: 'Combat Superiority', type: 'combat_superiority' },
];

describe('rules.getPlayerStats - fighting style reaction features (5e)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it.each(fightStyleCases5e)(
    'should add $name feature when fighting style "$name" is present',
    async ({ style, className, array, featureName, type }) => {
      classRules.getClass.mockReturnValue({ name: className, hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: [style] });
      const playerSummary = makePlayerSummary({
        class: { name: className, fightingStyles: [style] },
      });
      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
      const feature = result[array].find((a) => a.name === featureName);
      expect(feature).toBeDefined();
      expect(feature.type).toBe(type);
      expect(feature.hasAutomation).toBe(true);
    },
  );

  it('should add both Interception and Protection reactions when both styles are present', async () => {
    classRules.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Interception', 'Protection'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception', 'Protection'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.reactions.find((r) => r.name === 'Interception')).toBeDefined();
    expect(result.reactions.find((r) => r.name === 'Protection')).toBeDefined();
  });
});

describe('rules.getPlayerStats - fighting style reaction features (2024)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults2024(); });

  it.each([
    { style: 'Protection', className: 'Paladin', array: 'reactions', featureName: 'Protection', type: 'protection' },
    { style: 'Interception', className: 'Paladin', array: 'reactions', featureName: 'Interception', type: 'interception' },
  ])(
    'should add $featureName reaction when fighting style "$style" is present (2024)',
    async ({ style, className, array, featureName, type }) => {
      classRules2024.getClass.mockReturnValue({ name: className, hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: [style] });
      const playerSummary = makePlayerSummary({
        rules: '2024',
        class: { name: className, fightingStyles: [style] },
        race: { name: 'Human', languages: ['Common'], traits: [] },
      });
      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
      const feature = result[array].find((a) => a.name === featureName);
      expect(feature).toBeDefined();
      expect(feature.type).toBe(type);
      expect(feature.hasAutomation).toBe(true);
    },
  );

  it('should not add 5e-specific features when ruleset is 2024', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Thrown Weapon Fighting', 'Two-Weapon Fighting'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting', 'Two-Weapon Fighting'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.specialActions.find((a) => a.name === 'Thrown Weapon Fighting')).toBeUndefined();
    expect(result.specialActions.find((a) => a.name === 'Two-Weapon Fighting')).toBeUndefined();
  });
});

describe('rules.getPlayerStats - action array re-sorting after fighting styles', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should re-sort all action arrays after adding fighting style features', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception', 'Protection'] },
      actions: [{ name: 'ZAction' }, { name: 'AAction' }],
      reactions: [{ name: 'ZReaction' }, { name: 'AReaction' }],
      specialActions: [{ name: 'ZSpecial' }, { name: 'ASpecial' }],
      bonusActions: [{ name: 'ZBonus' }, { name: 'ABonus' }],
      characterAdvancement: [{ name: 'ZAdvancement' }, { name: 'AAdvancement' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.actions.map((a) => a.name)).toEqual([...result.actions.map((a) => a.name)].sort((a, b) => a.localeCompare(b)));
    expect(result.reactions.map((r) => r.name)).toEqual([...result.reactions.map((r) => r.name)].sort((a, b) => a.localeCompare(b)));
    expect(result.specialActions.map((a) => a.name)).toEqual([...result.specialActions.map((a) => a.name)].sort((a, b) => a.localeCompare(b)));
    expect(result.bonusActions.map((a) => a.name)).toEqual([...result.bonusActions.map((a) => a.name)].sort((a, b) => a.localeCompare(b)));
    expect(result.characterAdvancement.map((a) => a.name)).toEqual([...result.characterAdvancement.map((a) => a.name)].sort((a, b) => a.localeCompare(b)));
  });
});

const proficiencyBuffCases = [
  {
    name: 'should add non-choice proficiency feat buffs (e.g., Heavily Armored)',
    buff: { name: 'Heavy Armor', type: 'proficiency', isChoice: false },
    existingProfs: [],
    expectedProf: 'Heavy Armor',
    expectedSkillProfs: null,
    checkDup: false,
  },
  {
    name: 'should add all_skills proficiency feat buffs to skillProficiencies',
    buff: { name: 'all_skills', type: 'skill', isChoice: false },
    existingProfs: [],
    expectedProf: null,
    expectedSkillProfs: ['Athletics', 'Stealth'],
    checkDup: false,
  },
  {
    name: 'should handle proficiency choice feat buffs (e.g., Crafter\'s 3 Artisan\'s Tools)',
    buff: { name: 'Artisan\'s Tools', type: 'proficiency', isChoice: true, choose: 3, from: ['Artisan\'s Tools'] },
    existingProfs: [],
    expectedProf: '3 from: Artisan\'s Tools',
    expectedSkillProfs: null,
    checkDup: false,
  },
  {
    name: 'should not duplicate existing proficiencies from feat buffs',
    buff: { name: 'Skill: Stealth', type: 'proficiency', isChoice: false },
    existingProfs: ['Skill: Stealth'],
    expectedProf: 'Skill: Stealth',
    expectedSkillProfs: null,
    checkDup: true,
  },
  {
    name: 'should not duplicate proficiency choice feat buffs',
    buff: { name: 'Artisan\'s Tools', type: 'proficiency', isChoice: true, choose: 3, from: ['Artisan\'s Tools'] },
    existingProfs: ['3 from: Artisan\'s Tools'],
    expectedProf: '3 from: Artisan\'s Tools',
    expectedSkillProfs: null,
    checkDup: true,
  },
];

describe('rules.getPlayerStats - feat proficiency buffs', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it.each(proficiencyBuffCases)('$name', async ({ buff, existingProfs, expectedProf, expectedSkillProfs, checkDup }) => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [buff],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      proficiencies: existingProfs,
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    if (expectedProf) {
      expect(result.proficiencies).toContain(expectedProf);
    }
    if (expectedSkillProfs) {
      for (const skill of expectedSkillProfs) {
        expect(result.skillProficiencies).toContain(skill);
      }
    }
    if (checkDup && expectedProf) {
      const count = result.proficiencies.filter((p) => p === expectedProf).length;
      expect(count).toBe(1);
    }
  });
});

describe('rules.getPlayerStats - expertise handling', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add expertSkills entries to expertise array and skip empty/non-string entries', async () => {
    const playerSummary = makePlayerSummary({
      expertSkills: ['', 123, 'Stealth', null, 'Persuasion'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Stealth');
    expect(result.expertise).toContain('Persuasion');
  });
});
