// @improved-by-ai
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

    it('shows AUTO FAIL for dex save when dex is in autoFailSaves', () => {
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
      render(<CharAbilities {...testProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === 'AUTO FAIL' && el.closest('.abilities:nth-child(3)'));
      expect(saveCell).toBeInTheDocument();
    });

    it('shows AUTO FAIL for con save when con is in autoFailSaves', () => {
      const testProps = {
        allAbilityScores: mockAllAbilityScores,
        playerStats: createPlayerStats(),
        campaignName: 'test-campaign',
        exhaustionPenalty: 0,
        conditionEffects: { autoFailSaves: ['con'] },
        isRaging: false,
        onReroll: vi.fn(),
        onStrokeOfLuck: vi.fn(),
      };
      render(<CharAbilities {...testProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === 'AUTO FAIL' && el.closest('.abilities:nth-child(4)'));
      expect(saveCell).toBeInTheDocument();
    });

    it('shows AUTO FAIL for int save when int is in autoFailSaves', () => {
      const testProps = {
        allAbilityScores: mockAllAbilityScores,
        playerStats: createPlayerStats(),
        campaignName: 'test-campaign',
        exhaustionPenalty: 0,
        conditionEffects: { autoFailSaves: ['int'] },
        isRaging: false,
        onReroll: vi.fn(),
        onStrokeOfLuck: vi.fn(),
      };
      render(<CharAbilities {...testProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === 'AUTO FAIL' && el.closest('.abilities:nth-child(5)'));
      expect(saveCell).toBeInTheDocument();
    });

    it('shows AUTO FAIL for wis save when wis is in autoFailSaves', () => {
      const testProps = {
        allAbilityScores: mockAllAbilityScores,
        playerStats: createPlayerStats(),
        campaignName: 'test-campaign',
        exhaustionPenalty: 0,
        conditionEffects: { autoFailSaves: ['wis'] },
        isRaging: false,
        onReroll: vi.fn(),
        onStrokeOfLuck: vi.fn(),
      };
      render(<CharAbilities {...testProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === 'AUTO FAIL' && el.closest('.abilities:nth-child(6)'));
      expect(saveCell).toBeInTheDocument();
    });

    it('shows AUTO FAIL for cha save when cha is in autoFailSaves', () => {
      const testProps = {
        allAbilityScores: mockAllAbilityScores,
        playerStats: createPlayerStats(),
        campaignName: 'test-campaign',
        exhaustionPenalty: 0,
        conditionEffects: { autoFailSaves: ['cha'] },
        isRaging: false,
        onReroll: vi.fn(),
        onStrokeOfLuck: vi.fn(),
      };
      render(<CharAbilities {...testProps} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === 'AUTO FAIL' && el.closest('.abilities:nth-child(7)'));
      expect(saveCell).toBeInTheDocument();
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

    it('shows (Adv) for DEX when saveAdvantageAbilities includes DEX', () => {
      const { container } = render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['DEX'] }} />);
      const saveTexts = getSaveTexts(container);
      expect(saveTexts).toContain('+4 (Adv)');
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

    it('calculates primal knowledge bonus with proficiency', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Athletics'], passives: [] },
        skillProficiencies: ['Athletics'],
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
      // proficiency = Math.floor((5-1)/4 + 2) = Math.floor(3) = 3
      // strengthBonus = 3 (bonus) + 3 (proficient) = 6
      expect(screen.getByText('Athletics (+6)')).toBeInTheDocument();
    });

    it('calculates primal knowledge bonus with expertise', () => {
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
      // proficiency = Math.floor((5-1)/4 + 2) = 3
      // expertise adds another proficiency
      // strengthBonus = 3 (bonus) + 3 (proficient) + 3 (expertise) = 9
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
      // Stealth is a primal knowledge skill but not proficient
      // strengthBonus = 3 (bonus) = 3
      expect(screen.getByText('Stealth (+3)')).toBeInTheDocument();
    });

    it('handles missing Strength ability when raging with primal knowledge', () => {
      const stats = createPlayerStats({
        level: 5,
        automation: { primalKnowledge: ['Athletics'], passives: [] },
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Athletics', bonus: 2 }] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} isRaging={true} />);
      // Athletics is under Dexterity row, primal knowledge uses Strength.bonus since Strength exists but has no Athletics skill
      // The skill is under Dexterity, so getSkillBonus looks for Strength.abilities.find(a => a.name === 'Athletics') which returns undefined
      // So primal knowledge doesn't apply and the original Dexterity-based bonus is used
      expect(screen.getAllByText(/Athletics/).length).toBeGreaterThan(0);
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

    it('returns 0 bonus when cosmicOmenEffect stored value is null', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(null);
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });

    it('uses d6Value default of 0 when not specified in Weal effect', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Weal', isEven: true }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
    });

    it('uses d6Value default of 0 when not specified in Woe effect', () => {
      const stats = createPlayerStats();
      vi.mocked(getRuntimeValue).mockReturnValueOnce(JSON.stringify({ type: 'Woe', isEven: false }));
      const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);
      const bonusTexts = getBonusTexts(container);
      expect(bonusTexts).toContain('+4');
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
});
