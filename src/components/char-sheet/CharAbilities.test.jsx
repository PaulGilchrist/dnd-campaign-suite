// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
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

describe('CharAbilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('header rendering', () => {
    it('renders all column headers', () => {
      render(<CharAbilities {...defaultProps} />);
      expect(screen.getByText('Ability')).toBeInTheDocument();
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

  describe('auto fail saves', () => {
    it('shows AUTO FAIL text when ability abbreviation is in autoFailSaves', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      expect(screen.getByText('AUTO FAIL')).toBeInTheDocument();
    });

    it('does not show AUTO FAIL when ability is not in autoFailSaves', () => {
      const testProps = {
        allAbilityScores: mockAllAbilityScores,
        playerStats: createPlayerStats(),
        campaignName: 'test-campaign',
        exhaustionPenalty: 0,
        conditionEffects: { autoFailSaves: ['dex'] },
        isRaging: false,
        onReroll: vi.fn(),
        onStrokeOfLuck: vi.fn(),
      };
      const { container } = render(<CharAbilities {...testProps} />);
      const saveCells = container.querySelectorAll('.abilities > div:nth-child(4)');
      const saveTexts = Array.from(saveCells).map(c => c.textContent);
      // Strength save (first data row) should NOT show AUTO FAIL
      expect(saveTexts[1]).not.toBe('AUTO FAIL');
    });

    it('does not show AUTO FAIL for empty autoFailSaves', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: [] }} />);
      expect(screen.queryByText('AUTO FAIL')).not.toBeInTheDocument();
    });

    it('does not show AUTO FAIL when conditionEffects is undefined', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={undefined} />);
      expect(screen.queryByText('AUTO FAIL')).not.toBeInTheDocument();
    });
  });

  describe('save advantage', () => {
    it('shows (Adv) suffix when saveAdvantageCount is greater than zero', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1 }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+6 (Adv)');
    });

    it('shows (Adv) for specific ability save advantage', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+6 (Adv)');
    });

    it('does not show (Adv) when saveAdvantageCount is zero', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 0 }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).not.toContain('+6 (Adv)');
    });

    it('does not show (Adv) when ability is not in saveAdvantageAbilities', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['WIS'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).not.toContain('+6 (Adv)');
    });
  });

  describe('save disadvantage', () => {
    it('does not show (Adv) when saveDisadvantage includes the ability', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).not.toContain('+6 (Adv)');
    });
  });

  describe('exhaustion penalty', () => {
    it('reduces ability bonuses by exhaustion penalty amount', () => {
      const stats = createPlayerStats();
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+2');
      expect(bonusTexts).toContain('+0');
      expect(bonusTexts).toContain('-3');
    });

    it('reduces save values by exhaustion penalty amount', () => {
      const stats = createPlayerStats();
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} exhaustionPenalty={2} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+4');
    });

    it('applies no penalty when exhaustionPenalty is zero', () => {
      const { container } = render(<CharAbilities {...defaultProps} exhaustionPenalty={0} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });

    it('does not crash when exhaustionPenalty is not provided', () => {
      const props = { ...defaultProps };
      delete props.exhaustionPenalty;
      render(<CharAbilities {...props} />);
      expect(screen.getByText('Strength')).toBeInTheDocument();
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

    it('does not add passWithoutTraceBonus to non-Stealth skills', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 6 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ passWithoutTraceBonus: '2' }} />);
      expect(screen.getByText('Acrobatics (+6)')).toBeInTheDocument();
    });

    it('does not add passWithoutTraceBonus when conditionEffects is undefined', () => {
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
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={undefined} />);
      expect(screen.getByText('Stealth (+6)')).toBeInTheDocument();
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

    it('does not add jack of all trades bonus when feature is not active', () => {
      const stats = createPlayerStats({
        level: 10,
        automation: { primalKnowledge: [], passives: [] },
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

    it('does not override non-primal knowledge skills when raging', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Arcana'], passives: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 2 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
      expect(screen.getByText('Acrobatics (+2)')).toBeInTheDocument();
      expect(screen.getByText(/Arcana \(\+\d+\)/)).toBeInTheDocument();
    });

    it('renders normally when isRaging is false', () => {
      render(<CharAbilities {...defaultProps} isRaging={false} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    });

    it('renders normally when isRaging is not provided', () => {
      const props = { ...defaultProps };
      delete props.isRaging;
      render(<CharAbilities {...props} />);
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    });
  });

  describe('cosmic omen effect', () => {
    it('adds Weal even bonus to ability checks and saves when cosmicOmenEffect is set', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+7');
    });

    it('adds negative Woe odd bonus to ability checks and saves when cosmicOmenEffect is set', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Woe', isEven: false, d6Value: 5 }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('-1');
    });

    it('does not add cosmic omen bonus for Weal with odd number', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Weal', isEven: false, d6Value: 3 }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });

    it('does not add cosmic omen bonus for Woe with even number', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Woe', isEven: true, d6Value: 4 }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });

    it('handles invalid JSON in cosmicOmenEffect gracefully', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce('not-valid-json');
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });
  });

  describe('clickable elements', () => {
    it('calls setPopupHtml when an ability name is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      fireEvent.click(screen.getByText('Strength'));
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.setPopupHtml).toHaveBeenCalled();
    });

    it('calls rollAbilityCheck when an ability bonus is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.rollAbilityCheck).toHaveBeenCalled();
    });

    it('calls rollSavingThrow when a save value is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.rollSavingThrow).toHaveBeenCalled();
    });

    it('calls rollSkillCheck when a skill name is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      const athleticsElements = screen.getAllByText(/Athletics/);
      fireEvent.click(athleticsElements[0]);
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.rollSkillCheck).toHaveBeenCalled();
    });

    it('does not call rollSavingThrow when autoFailSave ability is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.rollSavingThrow).not.toHaveBeenCalled();
    });
  });

  describe('penalized/buffed CSS classes', () => {
    it('applies stat--penalized class when exhaustionPenalty is greater than zero', () => {
      const { container } = render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
      const bonusCells = container.querySelectorAll('.abilities > div:nth-child(3)');
      expect(bonusCells.length).toBeGreaterThan(0);
    });

    it('applies stat--penalized class when abilityCheckDisadvantage is set', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true }} />);
      const bonusCells = container.querySelectorAll('.stat--penalized');
      expect(bonusCells.length).toBeGreaterThan(0);
    });

    it('applies stat--penalized class when autoFailSave is active', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      const penalizedCells = container.querySelectorAll('.stat--penalized');
      expect(penalizedCells.length).toBeGreaterThan(0);
    });

    it('applies stat--buffed class when save advantage is active', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1 }} />);
      const buffedCells = container.querySelectorAll('.stat--buffed');
      expect(buffedCells.length).toBeGreaterThan(0);
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
      expect(screen.getByText('Ability')).toBeInTheDocument();
      expect(screen.queryByText('Strength')).not.toBeInTheDocument();
    });
  });
});
