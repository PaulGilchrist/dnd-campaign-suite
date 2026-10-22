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

// #1251 FIXED: facade dispatches abilityCalc.getCarryingCapacity — stub completes the
// factory (rules-core.js:23 bundle now forwards it; pins in core/rules-carryingCapacity.test.js).
vi.mock('./abilityCalc.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(), getCarryingCapacity: vi.fn(() => 150),
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(), getHitPoints: vi.fn(), getCarryingCapacity: vi.fn(() => 150),
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
import { rules5e as raceRules } from '../../character/race-rules/index.js';
import * as abilityCalc from './abilityCalc.js';
import * as automationService from '../../combat/automation/automationService.js';
import * as proficiencyUtils from '../../character/proficiencyUtils.js';
import * as featBuffService from '../../character/featBuffService.js';

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

const getPlayerStats = (playerSummary) =>
  rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary });

const setupDefaults = () => {
  classRules.getClass.mockReturnValue({
    name: 'Fighter', hit_die: 10, saving_throws: [], proficiencies: [],
    class_levels: [{}], languages: [], subclass: {}, major: {},
  });
  raceRules.getRace.mockReturnValue({ name: 'Human', languages: ['Common'], traits: [] });
  raceRules.getTraits.mockReturnValue({
    actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
  });
  raceRules.getSenses.mockReturnValue([]);
  raceRules.getImmunities.mockReturnValue([]);
  raceRules.getResistances.mockReturnValue([]);
  classRules.getFeatures.mockReturnValue({
    actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
  });
  automationService.collectAutomationFromFeatures.mockReturnValue({ passives: [], actions: [], specialActions: [] });
  automationService.collectSaveModifiers.mockReturnValue({});
  automationService.collectTurnStartEffects.mockReturnValue([]);
  automationService.getConditionImmunities.mockReturnValue([]);
  automationService.getConditionalImmunities.mockReturnValue([]);
  automationService.getEvasionEffects.mockReturnValue([]);
  automationService.getAllSaveProficiencies.mockReturnValue([]);
  abilityCalc.getAbilities.mockResolvedValue(defaultAbilities);
  abilityCalc.getHitPoints.mockReturnValue(12);
  // No getCarryingCapacity stub: rules.js:394-399 routes carryingCapacity through
  // abilityCalc.getHitPoints (capacity pin lives in rules-core.test.js:96-114).
  proficiencyUtils.getProficiencies.mockReturnValue([5, []]);
  vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
    abilityScoreIncreases: [], proficiencies: [], features: [],
  });
};

describe('rules.getPlayerStats - feat proficiency/expertise buff application', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('appends non-choice feat proficiencies to existing ones without leaking choice placeholders', async () => {
    // Buff shapes mirror featBuffService output (featBuffService.js:62/:66)
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [],
      proficiencies: [
        { name: 'Heavy Armor', type: 'proficiency' },                        // Heavily Armored
        { name: "Artisan's Tools", type: 'proficiency', isChoice: true },  // Crafter — wizard choice, never a placeholder
      ],
      features: [],
    });
    proficiencyUtils.getProficiencies.mockReturnValue([5, ['Light Armor']]);

    const result = await getPlayerStats(makePlayerSummary());

    // rules.js:92-107: non-choice buff appended, existing proficiency preserved
    expect(result.proficiencies).toEqual(['Light Armor', 'Heavy Armor']);
    // rules.js:76-77: choice buffs add nothing to proficiencies
    expect(result.proficiencies).not.toContain("Artisan's Tools");
    expect(result.proficiencies.some((p) => /^\d+ from: /.test(p))).toBe(false);
  });

  it('merges expertSkills into expertise without overwriting existing expertise', async () => {
    const result = await getPlayerStats(makePlayerSummary({
      expertise: ['Insight'],
      expertSkills: ['History'],
    }));

    // rules.js:83-88 pushes onto the initialized expertise array; order-insensitive exact set
    expect(result.expertise).toHaveLength(2);
    expect(result.expertise).toContain('Insight');
    expect(result.expertise).toContain('History');
  });
});
