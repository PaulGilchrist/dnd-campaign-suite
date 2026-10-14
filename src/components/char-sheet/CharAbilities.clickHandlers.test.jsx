// @maintained-by-ai
/**
 * CharAbilities — click → roll context matrix (owner lane).
 * Owns the clicked-cell roll contract: which bonus reaches each roll fn and
 * exactly what context makeCheckContext / makeSaveContext stamp (or omit).
 *
 * Exact-match assertions pin BOTH presence and absence of context keys, so
 * one parameterized row replaces a per-flag test without losing signal.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - missingCoverage: modifier stacking order, bardicInspirationDie stamping,
 *   luckyDisadvantageActive prop, advantage tooltip sources.
 * - saveBonus: saveBonusExpression parsing (owns the AUTO FAIL click guard).
 * - event-context / contextFeatures: `internal-skill-check` event routing
 *   (owns wisCheckReplace floor via events, Powerful Build, strSaveReplace).
 * - conditionEffects / display-save / rendering: display-only suffixes and
 *   AUTO FAIL text. reliableTalent (CLA-291) / psiBolsteredKnack (CLA-270).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

// Stable roll interface shared across renders — avoids brittle per-render mock.results[0] lookups.
const mockRoll = {
  setPopupHtml: vi.fn(),
  rollAbilityCheck: vi.fn(),
  rollSavingThrow: vi.fn(),
  rollSkillCheck: vi.fn(),
};

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => mockRoll),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => mockRoll),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
}));

const mockAllAbilityScores = [
  { full_name: 'Strength', description: 'STR desc' },
  { full_name: 'Dexterity', description: 'DEX desc' },
  { full_name: 'Constitution', description: 'CON desc' },
  { full_name: 'Intelligence', description: 'INT desc' },
  { full_name: 'Wisdom', description: 'WIS desc' },
  { full_name: 'Charisma', description: 'CHA desc' },
];

// Fixture keeps clicked-cell texts unique: bonus column {+4,+2,+1,+0,-1,+0},
// save column {+6,+4,+3,+0,+1,+2}. STR is always the first row, so a plain
// '+4'/' +6' lookup lands on Strength before any later row reuses a value.
function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 6 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [{ name: 'Perception', bonus: 3 }] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: ['Athletics'], passives: [] },
    expertise: [],
    ...overrides,
  };
}

function renderAbilities({ conditionEffects = {}, playerStats = createPlayerStats(), exhaustionPenalty = 0 } = {}) {
  return render(
    <CharAbilities
      allAbilityScores={mockAllAbilityScores}
      playerStats={playerStats}
      campaignName="test-campaign"
      exhaustionPenalty={exhaustionPenalty}
      conditionEffects={conditionEffects}
      isRaging={false}
    />
  );
}

function clickClickable(container, text, { prefix = false } = {}) {
  const cell = Array.from(container.querySelectorAll('.clickable'))
    .find(el => (prefix ? el.textContent.startsWith(text) : el.textContent === text));
  expect(cell, `clickable cell "${text}" not found`).toBeTruthy();
  fireEvent.click(cell);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

describe('clicked cells roll the displayed value', () => {
  it('clicking an ability name opens its description popup', () => {
    renderAbilities();
    fireEvent.click(screen.getByText('Strength'));
    expect(mockRoll.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('STR desc'));
  });

  it('clicking the STR bonus rolls the displayed bonus with no context', () => {
    const { container } = renderAbilities();
    clickClickable(container, '+4');
    expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {});
  });

  it('clicking the STR save rolls the displayed save with only the base save-context keys', () => {
    const { container } = renderAbilities();
    clickClickable(container, '+6');
    expect(mockRoll.rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
    });
  });

  it('clicking a skill rolls its computed bonus with no context', () => {
    const { container } = renderAbilities();
    clickClickable(container, 'Athletics', { prefix: true });
    expect(mockRoll.rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, {});
  });
});

describe('makeCheckContext stamps feature flags exactly', () => {
  // All condition-effect feature flags active at once: one exact-match pins
  // every flag's presence, its renamed keys, and the absence of spurious ones.
  it('stamps every check feature flag onto the ability-check context', () => {
    const { container } = renderAbilities({
      conditionEffects: {
        strokeOfLuck: true,
        luckyAdvantage: true,
        luckyDisadvantage: true,
        d20Floor10: true,
        tacticalMind: true,
        tacticalMindBonus: 5,
        autoRerollForChecks: true,
        autoRerollCondition: 'roll_equals_1',
        darkOnesLuck: true,
      },
    });
    clickClickable(container, '+4');
    expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {
      strokeOfLuck: true,
      luckyAdvantage: true,
      luckyAdvantageType: 'advantage',
      luckyDisadvantage: true,
      luckyDisadvantageType: 'disadvantage',
      d20Floor10: true,
      tacticalMind: true,
      tacticalMindBonus: 5,
      autoReroll: true,
      autoRerollCondition: 'roll_equals_1',
      autoRerollBonus: null,
      darkOnesLuck: true,
    });
  });

  it('stamps strCheckReplace with the Strength score alongside forcedMode disadvantage', () => {
    const { container } = renderAbilities({
      conditionEffects: { strCheckReplace: true, abilityCheckDisadvantage: true },
    });
    clickClickable(container, '+4');
    expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {
      forcedMode: 'disadvantage',
      strCheckReplace: true,
      strScore: 14,
    });
  });
});

describe('makeCheckContext forcedMode resolution', () => {
  const cases = [
    {
      name: 'advantage from abilityCheckAdvantageAbilities matching STR',
      conditionEffects: { abilityCheckAdvantageAbilities: ['STR'] },
      context: { forcedMode: 'advantage' },
    },
    {
      name: 'advantage from abilityCheckAdvantage scoped to the matching ability name',
      conditionEffects: { abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Strength' },
      context: { forcedMode: 'advantage' },
    },
    {
      name: 'unscoped abilityCheckAdvantage cancels abilityCheckDisadvantage',
      conditionEffects: { abilityCheckDisadvantage: true, abilityCheckAdvantage: true },
      context: {},
    },
    {
      name: 'strCheckDisadvantage survives and merges with strokeOfLuck',
      conditionEffects: { strCheckDisadvantage: true, strokeOfLuck: true },
      context: { forcedMode: 'disadvantage', strokeOfLuck: true },
    },
  ];

  for (const { name, conditionEffects, context } of cases) {
    it(`clicking the STR bonus resolves forcedMode: ${name}`, () => {
      const { container } = renderAbilities({ conditionEffects });
      clickClickable(container, '+4');
      expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, context);
    });
  }
});

describe('makeSaveContext stamping', () => {
  // Clicks the STR save cell; '+6' also matches the '(Adv)' suffix text.
  const cases = [
    {
      name: 'saveDisadvantage forces disadvantage and merges with strokeOfLuck',
      conditionEffects: { saveDisadvantage: ['str'], strokeOfLuck: true },
      context: { forcedMode: 'disadvantage', autoFail: undefined, strokeOfLuck: true },
    },
    {
      name: 'saveAdvantageCount forces advantage',
      conditionEffects: { saveAdvantageCount: 2 },
      context: { forcedMode: 'advantage', autoFail: undefined },
    },
    {
      name: 'saveAdvantageAbilities forces advantage for the listed ability',
      conditionEffects: { saveAdvantageAbilities: ['STR'] },
      context: { forcedMode: 'advantage', autoFail: undefined },
    },
    {
      name: 'restoreBalance normalizes the roll mode',
      conditionEffects: { restoreBalance: true },
      context: { forcedMode: 'normal', autoFail: undefined },
    },
    {
      name: 'autoReroll claims the single feature-extra slot, excluding later builders',
      conditionEffects: {
        autoRerollForSaves: true,
        autoRerollCondition: 'frightened',
        autoRerollBonus: 3,
        strokeOfLuck: true,
        d20Floor10: true,
      },
      context: {
        forcedMode: undefined,
        autoFail: undefined,
        autoReroll: true,
        autoRerollCondition: 'frightened',
        autoRerollBonus: 3,
      },
    },
    {
      name: 'saveDisadvantage scoped to another ability leaves STR unforced',
      conditionEffects: { saveDisadvantage: ['dex'] },
      context: {},
    },
  ];

  for (const { name, conditionEffects, context } of cases) {
    it(name, () => {
      const { container } = renderAbilities({ conditionEffects });
      clickClickable(container, '+6', { prefix: true });
      expect(mockRoll.rollSavingThrow).toHaveBeenCalledWith('Strength', 6, context);
    });
  }
});
