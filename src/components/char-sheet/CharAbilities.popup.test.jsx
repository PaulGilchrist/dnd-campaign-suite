// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

  vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  })),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
    automation: { primalKnowledge: ['Athletics'], passives: [] },
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

describe('CharAbilities popup integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('calls setPopupHtml with ability description HTML when ability name is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    const wrapper = ({ children }) => (
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
        {children}
      </DiceRollContext.Provider>
    );

    render(<CharAbilities {...defaultProps} />, { wrapper });
    fireEvent.click(screen.getByText('Strength'));
    expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Strength'));
  });

  it('calls setPopupHtml with Dexterity description when Dexterity is clicked', () => {
    const mockSetPopupHtml = vi.fn();
    const wrapper = ({ children }) => (
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
        {children}
      </DiceRollContext.Provider>
    );

    render(<CharAbilities {...defaultProps} />, { wrapper });
    fireEvent.click(screen.getByText('Dexterity'));
    expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Dexterity'));
  });

  it('renders popup parent container with correct class', () => {
    const mockSetPopupHtml = vi.fn();
    const wrapper = ({ children }) => (
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
        {children}
      </DiceRollContext.Provider>
    );

    const { container } = render(<CharAbilities {...defaultProps} />, { wrapper });
    expect(container.querySelector('.abilities-popup-parent')).toBeInTheDocument();
  });

  it('handles ability name click when allAbilityScores is empty array', () => {
    const mockSetPopupHtml = vi.fn();
    const wrapper = ({ children }) => (
      <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
        {children}
      </DiceRollContext.Provider>
    );

    render(<CharAbilities {...defaultProps} allAbilityScores={[]} />, { wrapper });
    fireEvent.click(screen.getByText('Strength'));
    expect(mockSetPopupHtml).toHaveBeenCalled();
  });
});
