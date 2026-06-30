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

function getBonusTexts(container) {
  const bonusCells = container.querySelectorAll('.abilities > div:nth-child(3)');
  return Array.from(bonusCells).map(c => c.textContent);
}

function getSaveTexts(container) {
  const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
  return Array.from(saveCells).map(c => c.textContent);
}

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

    it('renders ability total scores', () => {
      const { container } = render(<CharAbilities {...defaultProps} />);
      const scoreCells = container.querySelectorAll('.abilities > div:nth-child(2)');
      const scoreTexts = Array.from(scoreCells).map(c => c.textContent);
      expect(scoreTexts).toContain('14');
      expect(scoreTexts).toContain('12');
      expect(scoreTexts).toContain('11');
      expect(scoreTexts).toContain('10');
      expect(scoreTexts).toContain('9');
    });

    it('renders ability bonuses with sign prefix', () => {
      const { container } = render(<CharAbilities {...defaultProps} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
      expect(bonusTexts).toContain('+2');
      expect(bonusTexts).toContain('+1');
      expect(bonusTexts).toContain('+0');
      expect(bonusTexts).toContain('-1');
    });

    it('renders saving throw values with sign prefix', () => {
      const { container } = render(<CharAbilities {...defaultProps} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+6');
      expect(saveTexts).toContain('+4');
      expect(saveTexts).toContain('+3');
      expect(saveTexts).toContain('+2');
      expect(saveTexts).toContain('+1');
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
    it('renders without error when an ability has no skills', () => {
      const stats = createPlayerStats();
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders correctly when all abilities have empty skill lists', () => {
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
    it('renders when conditionEffects is undefined', () => {
      const props = { ...defaultProps };
      delete props.conditionEffects;
      render(<CharAbilities {...props} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders when allAbilityScores is empty', () => {
      render(<CharAbilities {...defaultProps} allAbilityScores={[]} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders when abilities array is empty', () => {
      const stats = createPlayerStats({ abilities: [] });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Abilities')).toBeInTheDocument();
      expect(screen.queryByText('Strength')).not.toBeInTheDocument();
    });

    it('renders when playerStats automation is undefined', () => {
      const stats = createPlayerStats({ automation: undefined });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders when playerStats skillProficiencies is undefined', () => {
      const stats = createPlayerStats({ skillProficiencies: undefined });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });

    it('renders when playerStats expertise is undefined', () => {
      const stats = createPlayerStats({ expertise: undefined });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
    });
  });
});
