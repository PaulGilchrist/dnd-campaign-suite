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

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  buildAbilityDetailHtml: vi.fn(() => () => 'ability detail html'),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveAdvantage: vi.fn(() => false),
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

  describe('ability row rendering', () => {
    it('renders all six ability names as clickable elements', () => {
      render(<CharAbilities {...defaultProps} />);
      const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
      abilityNames.forEach((name) => {
        const el = screen.getByText(name);
        expect(el).toBeInTheDocument();
        expect(el.classList.contains('clickable')).toBe(true);
      });
    });

    it('renders ability scores in the score column', () => {
      render(<CharAbilities {...defaultProps} />);
      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('11')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      const scores = screen.getAllByText('10');
      expect(scores).toHaveLength(2);
    });

    it('renders skill bonuses next to skill names', () => {
      render(<CharAbilities {...defaultProps} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
      expect(screen.getByText('Acrobatics (+6)')).toBeInTheDocument();
      expect(screen.getByText('Arcana (+2)')).toBeInTheDocument();
      expect(screen.getByText('Perception (+3)')).toBeInTheDocument();
    });

    it('renders no ability rows when abilities array is empty', () => {
      const stats = createPlayerStats({ abilities: [] });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Abilities')).toBeInTheDocument();
      expect(screen.queryByText('Strength')).not.toBeInTheDocument();
    });
  });
});
