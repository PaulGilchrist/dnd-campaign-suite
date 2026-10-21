// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
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

// No getCarryingCapacity stub: rules.js:394-399 routes carryingCapacity through
// abilityCalc.getHitPoints (capacity pin lives in rules-core.test.js:95-114).
vi.mock('./abilityCalc.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(),
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(),
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
  elfishLineageSpeedBonus: vi.fn(() => 0),
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
import * as proficiencyUtils from '../../character/proficiencyUtils.js';
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

// getPlayerStats replaces playerStats.class with cr.getClass()'s result
// (rules.js:444), so fighting styles must be pinned on the class mock, not
// only on the playerSummary.
const setupDefaults = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  classRules.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, ...overrides.class });
  raceRules.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
  raceRules.getSenses.mockReturnValue(overrides.senses || []);
  raceRules.getImmunities.mockReturnValue(overrides.immunities || []);
  raceRules.getResistances.mockReturnValue(overrides.resistances || []);
  classRules.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
  automationService.collectAutomationFromFeatures.mockReturnValue(overrides.automation || { passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  abilityCalc.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
};

const setupDefaults2024 = (overrides = {}) => {
  vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
  classRules2024.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, ...overrides.class });
  raceRules2024.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [], ...overrides.race });
  raceRules2024.getTraits.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
  raceRules2024.getSenses.mockReturnValue(overrides.senses || []);
  classRules2024.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
  automationService.collectAutomationFromFeatures.mockReturnValue(overrides.automation || { passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  abilityCalc2024.getAbilities.mockResolvedValue(overrides.abilities || defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(overrides.hitPoints ?? 12);
  attackCalc.getAttacks.mockReturnValue(overrides.attacks || []);
};

const getPlayerStats = (playerSummary) =>
  rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary });

describe('rules.getPlayerStats - fighting style features (5e)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('adds every 5e fighting style reaction/special action with its type and automation payload', async () => {
    const styles = ['Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Blessed Warrior', 'Druidic Warrior', 'Superior Technique'];
    classRules.getClass.mockReturnValue({ name: 'Paladin', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], subclass: {}, major: {}, fightingStyles: styles });
    const result = await getPlayerStats(makePlayerSummary());

    // Exact arrays pin which builder ran, alphabetical order after
    // rules.js:127 sortActionArrays, and the 5e reaction push order.
    expect(result.reactions.map((r) => r.name)).toEqual(['Interception', 'Protection']);
    expect(result.specialActions.map((a) => a.name)).toEqual([
      'Blessed Warrior', 'Combat Superiority', 'Druidic Warrior', 'Thrown Weapon Fighting', 'Two-Weapon Fighting',
    ]);

    const byName = (array, name) => result[array].find((f) => f.name === name);
    expect(byName('reactions', 'Interception')).toMatchObject({
      type: 'interception', hasAutomation: true,
      automation: { type: 'interception', trigger: 'ally_within_5ft_attacked', range: '5_ft', damageExpression: '1d10', damageBonusExpression: 'proficiency_bonus', requiresShield: true },
    });
    expect(byName('reactions', 'Protection')).toMatchObject({
      type: 'protection', hasAutomation: true,
      automation: { type: 'reaction_debuff', trigger: 'creature_attacks_ally_within_5ft_while_holding_shield', effect: 'disadvantage_on_attacks_vs_ally', duration: 'until_start_of_next_turn', requiresShield: true },
    });
    for (const [name, effect] of [
      ['Thrown Weapon Fighting', 'thrown_weapon_fighting'],
      ['Two-Weapon Fighting', 'two_weapon_fighting'],
      ['Blessed Warrior', 'blessed_warrior'],
      ['Druidic Warrior', 'druidic_warrior'],
    ]) {
      expect(byName('specialActions', name)).toMatchObject({
        type: effect, hasAutomation: true,
        automation: { type: 'passive_rule', effect },
      });
    }
    expect(byName('specialActions', 'Combat Superiority')).toMatchObject({
      type: 'combat_superiority', hasAutomation: true,
      automation: { type: 'combat_superiority', dieExpression: '6', uses_max: 1, saveDc: 'ability', saveAbility: ['STR', 'DEX'] },
    });
  });
});

describe('rules.getPlayerStats - fighting style features (2024)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults2024(); });

  it('routes 2024 characters through the 2024 builders and excludes 5e-only style features', async () => {
    classRules2024.getClass.mockReturnValue({ name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [], class_levels: [{}], languages: [], major: {}, fightingStyles: ['Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting'] });
    const result = await getPlayerStats(makePlayerSummary({
      rules: '2024',
      class: { name: 'Fighter', fightingStyles: ['Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting'] },
    }));

    // 2024 builder pushes Protection before Interception (rules-fightingStyles.js:68/:92),
    // so this exact sorted order also proves sortActionArrays ran.
    expect(result.reactions.map((r) => r.name)).toEqual(['Interception', 'Protection']);
    // 2024-specific automation proves the 2024 Interception ran, not the 5e one
    // (5e uses trigger 'ally_within_5ft_attacked' + requiresShield).
    const interception = result.reactions.find((r) => r.name === 'Interception');
    expect(interception).toMatchObject({
      type: 'interception', hasAutomation: true,
      automation: { type: 'interception', trigger: 'creature_hits_ally_within_5ft', damageExpression: '1d10', damageBonusExpression: 'proficiency_bonus', requiresShieldOrWeapon: true },
    });
    expect(interception.automation.requiresShield).toBeUndefined();
    expect(result.reactions.find((r) => r.name === 'Protection')).toMatchObject({
      type: 'protection', hasAutomation: true,
      automation: { type: 'reaction_debuff', requiresShield: true },
    });
    // 5e-only passive styles must not appear under 2024.
    expect(result.specialActions).toEqual([]);
  });
});

describe('rules.getPlayerStats - action array sorting and dedupe', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('returns every action array sorted and deduped by name, with no fighting style features injected', async () => {
    // characterAdvancement flows only from class features (rules-actions.js:111) —
    // summary-level entries are dropped, so supply the unsorted pair there.
    classRules.getFeatures.mockReturnValue({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [{ name: 'ZAdvancement' }, { name: 'AAdvancement' }, { name: 'ZAdvancement' }] });
    const result = await getPlayerStats(makePlayerSummary({
      actions: [{ name: 'ZAction' }, { name: 'AAction' }, { name: 'ZAction' }],
      bonusActions: [{ name: 'ZBonus' }, { name: 'ABonus' }],
      reactions: [{ name: 'ZReaction' }, { name: 'AReaction' }],
      specialActions: [{ name: 'ZSpecial' }, { name: 'ZSpecial' }, { name: 'ASpecial' }],
    }));

    expect(result.actions.map((a) => a.name)).toEqual(['AAction', 'ZAction']);
    expect(result.bonusActions.map((a) => a.name)).toEqual(['ABonus', 'ZBonus']);
    expect(result.specialActions.map((a) => a.name)).toEqual(['ASpecial', 'ZSpecial']);
    expect(result.characterAdvancement.map((a) => a.name)).toEqual(['AAdvancement', 'ZAdvancement']);
    // No fighting styles on the class mock → nothing fighting-style-related injected.
    expect(result.reactions.map((r) => r.name)).toEqual(['AReaction', 'ZReaction']);
    expect(result.reactions.some((r) => ['Interception', 'Protection'].includes(r.name))).toBe(false);
    expect(result.specialActions.some((a) => ['Blessed Warrior', 'Druidic Warrior', 'Combat Superiority'].includes(a.name))).toBe(false);
  });
});

describe('rules.getPlayerStats - feat proficiency buffs', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('expands an all_skills feat buff into the full skill list without leaking it into proficiencies', async () => {
    // rules.js:69-73: name 'all_skills' + type 'skill' fans out to every
    // loadSkills() name; the non-choice proficiency filter at rules.js:92
    // requires type 'proficiency', so 'all_skills' itself must not appear.
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [{ name: 'all_skills', type: 'skill', isChoice: false }],
      features: [],
    });
    const result = await getPlayerStats(makePlayerSummary());

    expect(result.skillProficiencies).toEqual(defaultSkills.map((s) => s.name));
    expect(result.proficiencies).not.toContain('all_skills');
  });

  it('skips duplicated proficiencies — both those already granted and repeats within the buff list', async () => {
    // Existing proficiencies arrive via the getProficiencies channel
    // (rules.js:492), not the playerSummary — mock it there so the
    // dedupe Set at rules.js:99-104 actually runs.
    proficiencyUtils.getProficiencies.mockReturnValue([5, ['Heavy Armor']]);
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [
        { name: 'Heavy Armor', type: 'proficiency', isChoice: false }, // already granted → skipped
        { name: 'Heavy Armor', type: 'proficiency', isChoice: false }, // repeat in buff list → skipped
        { name: 'Medium Armor', type: 'proficiency', isChoice: false }, // new → appended once
      ],
      features: [],
    });
    const result = await getPlayerStats(makePlayerSummary());

    expect(result.proficiencies).toEqual(['Heavy Armor', 'Medium Armor']);
  });
});

describe('rules.getPlayerStats - expertise handling', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('merges only non-empty string expertSkills into expertise, skipping invalid entries in order', async () => {
    // rules.js:83-88: typeof-string-and-non-empty guard. Exact array — an
    // empty string or 123 leaking through would break this pin.
    const result = await getPlayerStats(makePlayerSummary({
      expertise: ['Insight'],
      expertSkills: ['', 123, 'Stealth', null, 'Persuasion'],
    }));

    expect(result.expertise).toEqual(['Insight', 'Stealth', 'Persuasion']);
  });
});
