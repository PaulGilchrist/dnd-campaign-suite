// @improved-by-ai
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

vi.mock('../common/Popup.jsx', () => ({
  default: ({ children, onClickOrKeyDown }) => (
    <div data-testid="popup" onClick={onClickOrKeyDown}>
      {children}
    </div>
  ),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: ({ onReroll, onStrokeOfLuck }) => (
    <div data-testid="dice-roll-result">
      <button onClick={onReroll}>Reroll</button>
      <button onClick={onStrokeOfLuck}>Stroke of Luck</button>
    </div>
  ),
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

describe('CharAbilities popup rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders popup when popupHtml is a string', () => {
    const mockSetPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: '<h3>Strength</h3>Strength description',
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} />);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByTestId('popup').querySelector('h3')).toHaveTextContent('Strength');
  });

  it('renders popup when popupHtml is an object (DiceRollResult)', () => {
    const mockSetPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: { name: 'Test Roll', type: 'd20' },
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} />);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByTestId('dice-roll-result')).toBeInTheDocument();
  });

  it('does not render popup when popupHtml is null', () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} />);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('calls setPopupHtml with null when popup is dismissed', () => {
    const mockSetPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: '<h3>Test</h3>Test',
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} />);
    fireEvent.click(screen.getByTestId('popup'));
    expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
  });

  it('renders DiceRollResult with onReroll and onStrokeOfLuck props when popupHtml is an object', () => {
    const mockSetPopupHtml = vi.fn();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: { name: 'Test Roll', type: 'd20' },
      setPopupHtml: mockSetPopupHtml,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    render(<CharAbilities {...defaultProps} />);
    const diceRollResult = screen.getByTestId('dice-roll-result');
    expect(diceRollResult).toBeInTheDocument();
  });

  it('renders popup parent container with correct class', () => {
    vi.mocked(useLoggedDiceRoll).mockReturnValue({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
    });

    const { container } = render(<CharAbilities {...defaultProps} />);
    expect(container.querySelector('.abilities-popup-parent')).toBeInTheDocument();
  });
});
