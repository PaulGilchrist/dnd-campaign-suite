// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
  loadBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
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
  elfishLineageSpeedBonus: vi.fn(() => 0),
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

const getStats = (playerSummary) => rules.getPlayerStats({
  allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary,
});

// Speed passthrough/bonuses: owned by rules-playerStats-senses-speed.test.js.
// Powerful Build sizeMultiplier + grapple save modifier: owned by
// rules.getPlayerStats.test.js (CLA-209). carryingCapacity=HP defect pin:
// owned by rules-core.test.js (#1251). Not re-pinned here.

describe('rules.getPlayerStats - racial movement traits', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('sets canMoveThroughCreatureSpace only for the Halfling Nimbleness trait', async () => {
    setupDefaults({ race: { name: 'Lightfoot Halfling', languages: ['Common'], traits: [{ name: 'Halfling Nimbleness' }] } });
    const nimble = await getStats(makePlayerSummary());
    expect(nimble.canMoveThroughCreatureSpace).toBe(true);

    // A similarly named but different trait must not set the flag.
    setupDefaults({ race: { name: 'Wood Elf', languages: ['Common'], traits: [{ name: 'Fleet of Foot' }] } });
    const notNimble = await getStats(makePlayerSummary());
    expect(notNimble.canMoveThroughCreatureSpace).toBeUndefined();
  });
});

describe('rules.getPlayerStats - feat feature casting_time routing', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('routes each feat feature to exactly one action array by automation.casting_time, sourced as feat', async () => {
    // featureCategories is mocked empty, so a 'passive' casting_time not listed in
    // characterAdvancement must fall through to specialActions (rules.js :154-157).
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [
        { name: 'War Caster', description: 'Advantage on con saves', type: 'passive', automation: { casting_time: '1 reaction' }, featName: 'War Caster' },
        { name: 'Inspiring Leader', description: 'Buff allies', type: 'passive', automation: { casting_time: '1 action' }, featName: 'Inspiring Leader' },
        { name: 'Heal Word', description: 'Restore HP', type: 'passive', automation: { casting_time: '1 bonus action' }, featName: 'Healer' },
        { name: 'Lucky', description: 'Reroll dice', type: 'passive', automation: { casting_time: 'passive' }, featName: 'Lucky' },
      ],
    });
    const result = await getStats(makePlayerSummary());

    const inArray = (arr, name) => arr.filter((f) => f.name === name);
    expect(inArray(result.actions, 'Inspiring Leader')).toHaveLength(1);
    expect(inArray(result.bonusActions, 'Heal Word')).toHaveLength(1);
    expect(inArray(result.reactions, 'War Caster')).toHaveLength(1);
    expect(inArray(result.specialActions, 'Lucky')).toHaveLength(1);

    // No leakage into the wrong arrays, and rows carry feat provenance.
    expect(inArray(result.reactions, 'Inspiring Leader')).toHaveLength(0);
    expect(inArray(result.actions, 'War Caster')).toHaveLength(0);
    expect(inArray(result.bonusActions, 'Lucky')).toHaveLength(0);
    expect(inArray(result.actions, 'Inspiring Leader')[0]).toMatchObject({ source: 'feat', featName: 'Inspiring Leader' });
  });
});

describe('rules.getPlayerStats - input isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaults(); });

  it('returns a clone: pushed feat rows appear on the result, never on the original playerSummary', async () => {
    const playerSummary = makePlayerSummary({ actions: [{ name: 'Attack', description: 'raw', type: 'action' }] });
    const snapshot = JSON.stringify(playerSummary);
    vi.mocked(featBuffService.computeAllFeatBuffs).mockReturnValue({
      abilityScoreIncreases: [], proficiencies: [],
      features: [
        { name: 'Inspiring Leader', description: 'Buff allies', type: 'passive', automation: { casting_time: '1 action' }, featName: 'Inspiring Leader' },
      ],
    });
    const result = await getStats(playerSummary);

    expect(result).not.toBe(playerSummary);
    // Assembly (rules.js:432 cloneDeep) mutated only the clone: the caller's
    // summary is byte-for-byte intact even though the result gained a feat row.
    expect(JSON.stringify(playerSummary)).toBe(snapshot);
    expect(result.actions.some((f) => f.name === 'Inspiring Leader')).toBe(true);
  });
});
