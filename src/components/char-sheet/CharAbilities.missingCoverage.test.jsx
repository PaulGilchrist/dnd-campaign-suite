import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  }));
  return { default: mockFn };
});

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
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
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    ...overrides,
  };
}

const defaultProps = {
  allAbilityScores: mockAllAbilityScores,
  playerStats: createPlayerStats(),
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  isRaging: false,
  onReroll: vi.fn(),
  onStrokeOfLuck: vi.fn(),
};

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

function findClickableByText(text) {
  const clickableEls = document.querySelectorAll('.clickable');
  return Array.from(clickableEls).find((el) => el.textContent === text);
}

describe('CharAbilities getSkillBonus edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('combines jack of all trades with exhaustion penalty', () => {
    const stats = createPlayerStats({
      level: 10,
      automation: { primalKnowledge: [], passives: [{ type: 'jack_of_all_trades' }] },
      skillProficiencies: ['Athletics'],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 2 }] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={1} />);
    // Acrobatics: skill.bonus(2) + floor(prof(4)/2)(2) - exhaustion(1) = 3
    expect(screen.getByText('Acrobatics (+3)')).toBeInTheDocument();
  });

  it('applies passWithoutTraceBonus to Stealth with exhaustion penalty', () => {
    const stats = createPlayerStats({
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Stealth', bonus: 6 }] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ passWithoutTraceBonus: '3' }} exhaustionPenalty={1} />);
    // Stealth: 6 + 3 - 1 = 8
    expect(screen.getByText('Stealth (+8)')).toBeInTheDocument();
  });

  it('calculates primal knowledge bonus without proficiency when raging', () => {
    const stats = createPlayerStats({
      level: 5,
      automation: { primalKnowledge: ['Stealth'], passives: [] },
      skillProficiencies: [],
      expertise: [],
      abilities: [
        { name: 'Strength', bonus: 3, save: 5, totalScore: 16, skills: [{ name: 'Stealth', bonus: 1 }] },
        { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
      ],
    });
    render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
    // Strength bonus(3) only, not proficient
    expect(screen.getByText('Stealth (+3)')).toBeInTheDocument();
  });
});

describe('CharAbilities getSaveBonus edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('handles null saveBonusExpression gracefully', () => {
    const stats = createPlayerStats();
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveBonusExpression: null, saveBonusAbilities: ['STR'] }} />);
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    // null expression returns 0 early
    expect(saveCells[0].textContent).toBe('+6');
  });

  it('uses computedStats.saveModifiers when saveModifiers is undefined', () => {
    const stats = createPlayerStats({
      saveModifiers: undefined,
      computedStats: {
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Computed Resistance' },
        ],
      },
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'] }} />);
    const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
    expect(saveCells[0].title).toContain('Computed Resistance');
  });
});

describe('CharAbilities makeCheckContext empty context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('returns empty context object when no condition effects are set', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{}} />);
    const bonusCell = findClickableByText('+4');
    expect(bonusCell).toBeTruthy();
    fireEvent.click(bonusCell);
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {});
  });
});
