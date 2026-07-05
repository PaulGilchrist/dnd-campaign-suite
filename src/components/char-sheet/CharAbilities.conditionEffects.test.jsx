// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

describe('CharAbilities condition effects on rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('auto fail saves', () => {
    it('shows AUTO FAIL for save when ability is in autoFailSaves', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      expect(screen.getByText('AUTO FAIL')).toBeInTheDocument();
    });
  });

  describe('save advantage', () => {
    it('shows (Adv) suffix when saveAdvantageCount or saveAdvantageAbilities is set', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+6 (Adv)');
    });

    it('does not show (Adv) when no advantage conditions are set', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 0, saveAdvantageAbilities: ['WIS'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).not.toContain('+6 (Adv)');
    });
  });

  describe('exhaustion penalty', () => {
    it('reduces ability bonuses and save values by exhaustion penalty amount', () => {
      const stats = createPlayerStats();
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+2');
      expect(bonusTexts).toContain('+0');
      expect(bonusTexts).toContain('-3');
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+4');
    });
  });

  describe('condition effects on skills', () => {
    it('adds passWithoutTraceBonus to Stealth skill only', () => {
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
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ passWithoutTraceBonus: '2' }} />);
      expect(screen.getByText('Stealth (+8)')).toBeInTheDocument();
    });
  });

  describe('jack of all trades', () => {
    it('adds half proficiency to non-proficient skill bonuses', () => {
      const stats = createPlayerStats({
        level: 10,
        automation: {
          primalKnowledge: [],
          passives: [{ type: 'jack_of_all_trades' }],
        },
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
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
      expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
    });

    it('does not add jack of all trades bonus to proficient skills', () => {
      const stats = createPlayerStats({
        level: 10,
        automation: {
          primalKnowledge: [],
          passives: [{ type: 'jack_of_all_trades' }],
        },
        skillProficiencies: ['Athletics', 'Acrobatics'],
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 2 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
      expect(screen.getByText('Acrobatics (+2)')).toBeInTheDocument();
    });
  });

  describe('isRaging interactions', () => {
    it('uses primal knowledge skills to override skill bonus when raging', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Acrobatics'], passives: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 2 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
      expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
    });

    it('calculates primal knowledge bonus with proficiency and expertise', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Athletics'], passives: [] },
        skillProficiencies: ['Athletics'],
        expertise: ['Athletics'],
        abilities: [
          { name: 'Strength', bonus: 3, save: 5, totalScore: 16, skills: [{ name: 'Athletics', bonus: 5 }] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
      expect(screen.getByText('Athletics (+9)')).toBeInTheDocument();
    });

    it('uses strength bonus when primal skill but not proficient', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Stealth'], passives: [] },
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
      expect(screen.getByText('Stealth (+3)')).toBeInTheDocument();
    });
  });

  describe('cosmic omen effect', () => {
    it.each([
      { type: 'Weal', isEven: true, d6Value: 3, expectedBonus: '+7', label: 'Weal with even number adds bonus' },
      { type: 'Woe', isEven: false, d6Value: 5, expectedBonus: '-1', label: 'Woe with odd number subtracts bonus' },
      { type: 'Weal', isEven: false, d6Value: 3, expectedBonus: '+4', label: 'Weal with odd number adds no bonus' },
      { type: 'Woe', isEven: true, d6Value: 4, expectedBonus: '+4', label: 'Woe with even number adds no bonus' },
    ])('applies $label', ({ type, isEven, d6Value, expectedBonus }) => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type, isEven, d6Value }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain(expectedBonus);
    });

    it('handles invalid JSON in cosmicOmenEffect gracefully', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce('not-valid-json');
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });
  });

  describe('penalized CSS classes', () => {
    it('applies stat--penalized class to bonus cells when abilityCheckDisadvantage is set', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true }} />);
      const bonusCells = container.querySelectorAll('.abilities > div:nth-child(3)');
      bonusCells.forEach(cell => {
        expect(cell.classList.contains('stat--penalized')).toBe(true);
      });
    });
  });
});
