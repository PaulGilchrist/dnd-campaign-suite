// @improved-by-ai
import { render } from '@testing-library/react';
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

describe('CharAbilities getSaveAdvantageSource tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('shows Spell Resistance source when against_spell condition exists', () => {
    const stats = createPlayerStats({
      saveModifiers: [
        { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Spell Resistance' },
      ],
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'] }} />);
    const strengthRow = container.querySelector('.abilities');
    const saveCell = strengthRow ? strengthRow.querySelectorAll('div:nth-child(4)') : [];
    expect(saveCell[0]).toHaveAttribute('title', 'Spell Resistance');
  });

  it('shows comma-separated sources for non-against_spell advantages', () => {
    const stats = createPlayerStats({
      saveModifiers: [
        { target: 'saving_throw', effect: 'advantage', condition: 'against_goblins', source: 'Bless' },
        { target: 'saving_throw', effect: 'advantage', condition: 'against_dragons', source: 'Aura of Protection' },
      ],
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantageCount: 1 }} />);
    const strengthRow = container.querySelector('.abilities');
    const saveCell = strengthRow ? strengthRow.querySelectorAll('div:nth-child(4)') : [];
    expect(saveCell[0]).toHaveAttribute('title', 'Bless, Aura of Protection');
  });

  it('falls back to computedStats.saveModifiers when saveModifiers is absent', () => {
    const stats = createPlayerStats({
      saveModifiers: undefined,
      computedStats: {
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Magic Resistance' },
        ],
      },
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'] }} />);
    const strengthRow = container.querySelector('.abilities');
    const saveCell = strengthRow ? strengthRow.querySelectorAll('div:nth-child(4)') : [];
    expect(saveCell[0]).toHaveAttribute('title', 'Magic Resistance');
  });

  it('returns default "Spell Resistance" when no matching modifier found', () => {
    const stats = createPlayerStats({
      saveModifiers: [
        { target: 'saving_throw', effect: 'advantage', condition: 'against_goblins', source: 'Bless' },
      ],
    });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'] }} />);
    const strengthRow = container.querySelector('.abilities');
    const saveCell = strengthRow ? strengthRow.querySelectorAll('div:nth-child(4)') : [];
    expect(saveCell[0]).toHaveAttribute('title', 'Spell Resistance');
  });
});
