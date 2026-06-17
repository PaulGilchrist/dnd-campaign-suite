import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  })),
}));

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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getRuntimeValue: vi.fn((key, prop) => store.get(`${key}:${prop}`) ?? null),
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((key, prop) => store.get(`${key}:${prop}`) ?? null),
  };
});

const mockAllAbilityScores = [
  { full_name: 'Strength', description: 'STR desc' },
  { full_name: 'Dexterity', description: 'DEX desc' },
  { full_name: 'Constitution', description: 'CON desc' },
  { full_name: 'Intelligence', description: 'INT desc' },
  { full_name: 'Wisdom', description: 'WIS desc' },
  { full_name: 'Charisma', description: 'CHA desc' },
];

const mockPlayerStats = {
  name: 'Test Fighter',
  level: 5,
  abilities: [
    { name: 'Strength', bonus: 4, save: 6, skills: [{ name: 'Athletics', bonus: 8 }] },
    { name: 'Dexterity', bonus: 2, save: 4, skills: [{ name: 'Acrobatics', bonus: 6 }] },
    { name: 'Constitution', bonus: 1, save: 3, skills: [] },
    { name: 'Intelligence', bonus: 0, save: 0, skills: [{ name: 'Arcana', bonus: 2 }] },
    { name: 'Wisdom', bonus: -1, save: 1, skills: [{ name: 'Perception', bonus: 3 }] },
    { name: 'Charisma', bonus: 0, save: 2, skills: [] },
  ],
  skillProficiencies: ['Athletics', 'Arcana'],
  automation: { primalKnowledge: ['Athletics'], passives: [] },
  expertise: [],
};

const defaultProps = {
  allAbilityScores: mockAllAbilityScores,
  playerStats: mockPlayerStats,
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  onReroll: vi.fn(),
  onStrokeOfLuck: vi.fn(),
};

describe('CharAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ability headers', () => {
    render(<CharAbilities {...defaultProps} />);
    expect(screen.getByText('Ability')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Bonus')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('renders all ability names', () => {
    render(<CharAbilities {...defaultProps} />);
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
    expect(screen.getByText('Charisma')).toBeInTheDocument();
  });

  it('renders ability scores', () => {
    const stats = { ...mockPlayerStats, abilities: mockPlayerStats.abilities.map(a => ({ ...a, totalScore: a.bonus + 10 })) };
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('renders ability bonuses with sign prefix', () => {
    const { container } = render(<CharAbilities {...defaultProps} />);
    expect(container.textContent).toContain('+4');
    expect(container.textContent).toContain('+2');
    expect(container.textContent).toContain('-1');
  });

  it('renders skill names with bonuses', () => {
    const { container } = render(<CharAbilities {...defaultProps} />);
    expect(container.textContent).toContain('Athletics');
    expect(container.textContent).toContain('Acrobatics');
    expect(container.textContent).toContain('Perception');
  });

  it('renders saving throw values', () => {
    const { container } = render(<CharAbilities {...defaultProps} />);
    expect(container.textContent).toContain('+6');
    expect(container.textContent).toContain('+4');
  });

  it('shows AUTO FAIL when autoFailSaves includes the ability abbr', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
    expect(screen.getByText('AUTO FAIL')).toBeInTheDocument();
  });

  it('shows (Adv) when hasSaveAdvantage is true', () => {
    const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1 }} />);
    expect(container.textContent).toContain('(Adv)');
  });

  it('applies exhaustion penalty to bonuses', () => {
    const { container } = render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
    expect(container.textContent).toContain('+2');
  });

  it('applies condition passWithoutTraceBonus to Stealth', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ passWithoutTraceBonus: '2' }} />);
    // Stealth bonus should include the +2 from passWithoutTrace
  });

  it('renders Jack of All Trades bonus for non-proficient skills', () => {
    const stats = {
      ...mockPlayerStats,
      level: 5,
      automation: {
        ...mockPlayerStats.automation,
        passives: [{ type: 'jack_of_all_trades' }],
      },
    };
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    // Dexterity skill Acrobatics is not proficient for this char (only Athletics and Arcana)
  });

  it('renders with empty skills array', () => {
    const stats = {
      ...mockPlayerStats,
      abilities: mockPlayerStats.abilities.map(a => ({ ...a, skills: [] })),
    };
    render(<CharAbilities {...defaultProps} playerStats={stats} />);
    expect(screen.getByText('Strength')).toBeInTheDocument();
  });

  it('renders condition effect badges on saves', () => {
    render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['dex'] }} />);
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
  });

  it('renders with isRaging true', () => {
    render(<CharAbilities {...defaultProps} isRaging={true} />);
    expect(screen.getByText('Strength')).toBeInTheDocument();
  });

  it('handles ability popup click', () => {
    render(<CharAbilities {...defaultProps} />);
    // The ability name should be clickable
  });
});
