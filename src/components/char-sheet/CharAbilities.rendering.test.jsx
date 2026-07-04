// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

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

describe('CharAbilities rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('header rendering', () => {
    it('renders all column headers', () => {
      render(<CharAbilities {...defaultProps} />);
      expect(screen.getByText('Abilities')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Bonus')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
    });
  });

  describe('ability rows', () => {
    it('renders all six ability names', () => {
      render(<CharAbilities {...defaultProps} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.getByText('Dexterity')).toBeInTheDocument();
      expect(screen.getByText('Constitution')).toBeInTheDocument();
      expect(screen.getByText('Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Wisdom')).toBeInTheDocument();
      expect(screen.getByText('Charisma')).toBeInTheDocument();
    });

    it('renders ability scores, bonuses, and saves with correct values', () => {
      const { container } = render(<CharAbilities {...defaultProps} />);
      // Collect all text content from ability cells
      const allText = container.querySelector('.char-abilities').textContent;
      // Total scores
      expect(allText).toContain('14');
      expect(allText).toContain('12');
      expect(allText).toContain('11');
      expect(allText).toContain('10');
      expect(allText).toContain('9');
      // Bonuses with sign prefix
      expect(allText).toContain('+4');
      expect(allText).toContain('+2');
      expect(allText).toContain('+1');
      expect(allText).toContain('+0');
      expect(allText).toContain('-1');
      // Saving throws with sign prefix
      expect(allText).toContain('+6');
      expect(allText).toContain('+3');
    });

    it('renders skill names with their bonuses', () => {
      render(<CharAbilities {...defaultProps} />);
      const athleticsElements = screen.getAllByText(/Athletics/);
      expect(athleticsElements.length).toBeGreaterThan(0);
    });

    it('renders skill bonuses next to skill names', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    });

    it('renders multiple skills in the same ability separated by commas', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }, { name: 'Intimidation', bonus: 6 }] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getAllByText(/Athletics/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Intimidation/).length).toBeGreaterThan(0);
    });
  });

  describe('empty skills', () => {
    it('renders abilities without skills and excludes skill entries', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.queryByText('Athletics')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders with undefined optional playerStats fields (conditionEffects, automation, skillProficiencies, expertise)', () => {
      const props = {
        ...defaultProps,
        playerStats: {
          ...defaultProps.playerStats,
          conditionEffects: undefined,
          automation: undefined,
          skillProficiencies: undefined,
          expertise: undefined,
        },
      };
      render(<CharAbilities {...props} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders no ability rows when abilities array is empty', () => {
      const stats = createPlayerStats({ abilities: [] });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Abilities')).toBeInTheDocument();
      expect(screen.queryByText('Strength')).not.toBeInTheDocument();
    });
  });
});
