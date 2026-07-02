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

describe('rules.getPlayerStats - fighting style reaction features (5e)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add Interception reaction when Interception fighting style is present', async () => {
    classRules.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Interception'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const interception = result.reactions.find((r) => r.name === 'Interception');
    expect(interception).toBeDefined();
    expect(interception.type).toBe('interception');
    expect(interception.hasAutomation).toBe(true);
    expect(interception.automation.type).toBe('interception');
    expect(interception.automation.requiresShield).toBe(true);
  });

  it('should not duplicate Interception reaction if already present', async () => {
    const existingInterception = { name: 'Interception', type: 'interception' };
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception'] },
      reactions: [existingInterception],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const interceptions = result.reactions.filter((r) => r.name === 'Interception');
    expect(interceptions.length).toBe(1);
  });

  it('should add Protection reaction when Protection fighting style is present (5e)', async () => {
    classRules.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Protection'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Protection'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const protection = result.reactions.find((r) => r.name === 'Protection');
    expect(protection).toBeDefined();
    expect(protection.type).toBe('protection');
    expect(protection.hasAutomation).toBe(true);
    expect(protection.automation.type).toBe('reaction_debuff');
    expect(protection.automation.requiresShield).toBe(true);
  });

  it('should not duplicate Protection reaction if already present (5e)', async () => {
    const existingProtection = { name: 'Protection', type: 'protection' };
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Protection'] },
      reactions: [existingProtection],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const protections = result.reactions.filter((r) => r.name === 'Protection');
    expect(protections.length).toBe(1);
  });

  it('should add Thrown Weapon Fighting special action when fighting style is present (5e)', async () => {
    classRules.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Thrown Weapon Fighting'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const thrownWeapon = result.specialActions.find((a) => a.name === 'Thrown Weapon Fighting');
    expect(thrownWeapon).toBeDefined();
    expect(thrownWeapon.type).toBe('thrown_weapon_fighting');
    expect(thrownWeapon.hasAutomation).toBe(true);
    expect(thrownWeapon.automation.type).toBe('passive_rule');
  });

  it('should not duplicate Thrown Weapon Fighting if already present', async () => {
    const existing = { name: 'Thrown Weapon Fighting', type: 'thrown_weapon_fighting' };
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting'] },
      specialActions: [existing],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const count = result.specialActions.filter((a) => a.name === 'Thrown Weapon Fighting').length;
    expect(count).toBe(1);
  });

  it('should add Two-Weapon Fighting special action when fighting style is present (5e)', async () => {
    classRules.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Two-Weapon Fighting'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const twoWeapon = result.specialActions.find((a) => a.name === 'Two-Weapon Fighting');
    expect(twoWeapon).toBeDefined();
    expect(twoWeapon.type).toBe('two_weapon_fighting');
    expect(twoWeapon.hasAutomation).toBe(true);
  });

  it('should not duplicate Two-Weapon Fighting if already present', async () => {
    const existing = { name: 'Two-Weapon Fighting', type: 'two_weapon_fighting' };
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Two-Weapon Fighting'] },
      specialActions: [existing],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const count = result.specialActions.filter((a) => a.name === 'Two-Weapon Fighting').length;
    expect(count).toBe(1);
  });

  it('should add Blessed Warrior special action when fighting style is present', async () => {
    classRules.getClass.mockReturnValue({ name: 'Cleric', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Blessed Warrior'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Cleric', fightingStyles: ['Blessed Warrior'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const blessedWarrior = result.specialActions.find((a) => a.name === 'Blessed Warrior');
    expect(blessedWarrior).toBeDefined();
    expect(blessedWarrior.type).toBe('blessed_warrior');
    expect(blessedWarrior.hasAutomation).toBe(true);
  });

  it('should add Druidic Warrior special action when fighting style is present', async () => {
    classRules.getClass.mockReturnValue({ name: 'Druid', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Druidic Warrior'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Druid', fightingStyles: ['Druidic Warrior'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const druidicWarrior = result.specialActions.find((a) => a.name === 'Druidic Warrior');
    expect(druidicWarrior).toBeDefined();
    expect(druidicWarrior.type).toBe('druidic_warrior');
    expect(druidicWarrior.hasAutomation).toBe(true);
  });

  it('should add Combat Superiority special action when Superior Technique fighting style is present', async () => {
    classRules.getClass.mockReturnValue({ name: 'Battle Master', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: ['Superior Technique'] });
    const playerSummary = makePlayerSummary({
      class: { name: 'Battle Master', fightingStyles: ['Superior Technique'] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const superiority = result.specialActions.find((a) => a.name === 'Combat Superiority');
    expect(superiority).toBeDefined();
    expect(superiority.type).toBe('combat_superiority');
    expect(superiority.hasAutomation).toBe(true);
    expect(superiority.automation.dieExpression).toBe('6');
    expect(superiority.automation.uses_max).toBe(1);
  });

  it('should not add fighting style features when fightingStyles array is missing', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: undefined },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.reactions.find((r) => r.name === 'Interception')).toBeUndefined();
    expect(result.specialActions.find((a) => a.name === 'Thrown Weapon Fighting')).toBeUndefined();
  });

  it('should not add Interception for non-Fighter classes without the style', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Wizard', fightingStyles: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.reactions.find((r) => r.name === 'Interception')).toBeUndefined();
  });

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

  it('should add Protection reaction when Protection fighting style is present (2024)', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Protection'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Paladin', fightingStyles: ['Protection'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const protection = result.reactions.find((r) => r.name === 'Protection');
    expect(protection).toBeDefined();
    expect(protection.type).toBe('protection');
    expect(protection.hasAutomation).toBe(true);
    expect(protection.automation.type).toBe('reaction_debuff');
    expect(protection.automation.requiresShield).toBe(true);
  });

  it('should add Interception reaction when Interception fighting style is present (2024)', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Interception'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Paladin', fightingStyles: ['Interception'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const interception = result.reactions.find((r) => r.name === 'Interception');
    expect(interception).toBeDefined();
    expect(interception.type).toBe('interception');
    expect(interception.hasAutomation).toBe(true);
    expect(interception.automation.requiresShieldOrWeapon).toBe(true);
  });

  it('should not duplicate Protection reaction if already present (2024)', async () => {
    const existingProtection = { name: 'Protection', type: 'protection' };
    classRules2024.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Protection'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Paladin', fightingStyles: ['Protection'] },
      reactions: [existingProtection],
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const protections = result.reactions.filter((r) => r.name === 'Protection');
    expect(protections.length).toBe(1);
  });

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

  it('should still add Blessed Warrior in 2024 mode', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Cleric', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Blessed Warrior'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Cleric', fightingStyles: ['Blessed Warrior'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const blessedWarrior = result.specialActions.find((a) => a.name === 'Blessed Warrior');
    expect(blessedWarrior).toBeDefined();
  });

  it('should still add Druidic Warrior in 2024 mode', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Druid', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Druidic Warrior'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Druid', fightingStyles: ['Druidic Warrior'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const druidicWarrior = result.specialActions.find((a) => a.name === 'Druidic Warrior');
    expect(druidicWarrior).toBeDefined();
  });

  it('should still add Combat Superiority in 2024 mode', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Battle Master', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Superior Technique'] });
    const playerSummary = makePlayerSummary({
      rules: '2024',
      class: { name: 'Battle Master', fightingStyles: ['Superior Technique'] },
      race: { name: 'Human', languages: ['Common'], traits: [] },
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const superiority = result.specialActions.find((a) => a.name === 'Combat Superiority');
    expect(superiority).toBeDefined();
  });
});

describe('rules.getPlayerStats - action array re-sorting after fighting styles', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should re-sort actions after adding fighting style features', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception', 'Protection'] },
      actions: [{ name: 'ZAction' }, { name: 'AAction' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const actionNames = result.actions.map((a) => a.name);
    expect(actionNames).toEqual([...actionNames].sort((a, b) => a.localeCompare(b)));
  });

  it('should re-sort reactions after adding fighting style reactions', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Paladin', fightingStyles: ['Interception', 'Protection'] },
      reactions: [{ name: 'ZReaction' }, { name: 'AReaction' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const reactionNames = result.reactions.map((r) => r.name);
    expect(reactionNames).toEqual([...reactionNames].sort((a, b) => a.localeCompare(b)));
  });

  it('should re-sort specialActions after adding fighting style special actions', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Thrown Weapon Fighting', 'Two-Weapon Fighting'] },
      specialActions: [{ name: 'ZSpecial' }, { name: 'ASpecial' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const specialNames = result.specialActions.map((a) => a.name);
    expect(specialNames).toEqual([...specialNames].sort((a, b) => a.localeCompare(b)));
  });

  it('should re-sort bonusActions and characterAdvancement after fighting styles', async () => {
    const playerSummary = makePlayerSummary({
      class: { name: 'Fighter', fightingStyles: ['Superior Technique'] },
      bonusActions: [{ name: 'ZBonus' }, { name: 'ABonus' }],
      characterAdvancement: [{ name: 'ZAdvancement' }, { name: 'AAdvancement' }],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const bonusNames = result.bonusActions.map((a) => a.name);
    expect(bonusNames).toEqual([...bonusNames].sort((a, b) => a.localeCompare(b)));
    const advNames = result.characterAdvancement.map((a) => a.name);
    expect(advNames).toEqual([...advNames].sort((a, b) => a.localeCompare(b)));
  });
});

describe('rules.getPlayerStats - feat proficiency buffs', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add non-choice proficiency feat buffs (e.g., Heavily Armored)', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'Heavy Armor', type: 'proficiency', isChoice: false }],
      features: [],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.proficiencies).toContain('Heavy Armor');
  });

  it('should not duplicate existing proficiencies from feat buffs', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'Skill: Stealth', type: 'proficiency', isChoice: false }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      proficiencies: ['Skill: Stealth'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const count = result.proficiencies.filter((p) => p === 'Skill: Stealth').length;
    expect(count).toBe(1);
  });

  it('should add all_skills proficiency feat buffs to skillProficiencies', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'all_skills', type: 'skill', isChoice: false }],
      features: [],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.skillProficiencies).toContain('Athletics');
    expect(result.skillProficiencies).toContain('Stealth');
  });

  it('should handle proficiency choice feat buffs (e.g., Crafter\'s 3 Artisan\'s Tools)', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'Artisan\'s Tools', type: 'proficiency', isChoice: true, choose: 3, from: ['Artisan\'s Tools'] }],
      features: [],
    });
    const playerSummary = makePlayerSummary();
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.proficiencies).toContain('3 from: Artisan\'s Tools');
  });

  it('should not duplicate proficiency choice feat buffs', async () => {
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'Artisan\'s Tools', type: 'proficiency', isChoice: true, choose: 3, from: ['Artisan\'s Tools'] }],
      features: [],
    });
    const playerSummary = makePlayerSummary({
      proficiencies: ['3 from: Artisan\'s Tools'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    const count = result.proficiencies.filter((p) => p === '3 from: Artisan\'s Tools').length;
    expect(count).toBe(1);
  });
});

import * as featBuffService from '../../character/featBuffService.js';

describe('rules.getPlayerStats - expertise handling', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('should add expertSkills entries to expertise array', async () => {
    const playerSummary = makePlayerSummary({
      expertSkills: ['Stealth', 'Persuasion'],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Stealth');
    expect(result.expertise).toContain('Persuasion');
  });

  it('should skip empty expertSkills entries', async () => {
    const playerSummary = makePlayerSummary({
      expertSkills: ['', 'Stealth', ''],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Stealth');
    const emptyCount = result.expertise.filter((e) => e === '').length;
    expect(emptyCount).toBe(0);
  });

  it('should skip non-string expertSkills entries', async () => {
    const playerSummary = makePlayerSummary({
      expertSkills: [123, 'Stealth', null],
    });
    const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
    expect(result.expertise).toContain('Stealth');
  });
});
