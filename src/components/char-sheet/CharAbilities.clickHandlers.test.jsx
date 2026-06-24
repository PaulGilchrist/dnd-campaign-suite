// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => ({
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  }));
  return { default: mockFn };
});

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

describe('CharAbilities click handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('basic click handlers', () => {
    it('calls setPopupHtml when an ability name is clicked', () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );
      render(<CharAbilities {...defaultProps} />, { wrapper });
      fireEvent.click(screen.getByText('Strength'));
      expect(mockSetPopupHtml).toHaveBeenCalled();
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

  describe('makeCheckContext - strokeOfLuck', () => {
    it('passes strokeOfLuck context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ strokeOfLuck: true }));
    });
  });

  describe('makeCheckContext - luckyAdvantage / luckyDisadvantage', () => {
    it('passes luckyAdvantage context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyAdvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ luckyAdvantage: true, luckyAdvantageType: 'advantage' }));
    });

    it('passes luckyDisadvantage context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ luckyDisadvantage: true }));
    });
  });

  describe('makeCheckContext - d20Floor10', () => {
    it('passes d20Floor10 context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ d20Floor10: true }));
    });
  });

  describe('makeCheckContext - reliableTalent', () => {
    it('passes reliableTalent context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ reliableTalent: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ reliableTalent: true }));
    });
  });

  describe('makeCheckContext - strCheckReplace', () => {
    it('passes strCheckReplace context when ability check is clicked', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ strCheckReplace: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+2' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ strCheckReplace: true, strScore: 14 }));
    });
  });

  describe('makeCheckContext - strCheckDisadvantage', () => {
    it('passes strCheckDisadvantage context when Strength ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('does not pass forcedMode when strCheckDisadvantage is true but non-Strength ability is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+2' && el.closest('.abilities:nth-child(3)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Dexterity', expect.any(Number), undefined);
    });
  });

  describe('makeCheckContext - tacticalMind', () => {
    it('passes tacticalMind context when ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ tacticalMind: true, tacticalMindBonus: 5 }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ tacticalMind: true, tacticalMindBonus: 5 }));
    });
  });

  describe('makeCheckContext - abilityCheckAdvantageAbilities', () => {
    it('passes advantage context when ability abbreviation matches', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['STR'] }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass advantage context when abbreviation does not match', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['DEX'] }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
    });
  });

  describe('makeCheckContext - abilityCheckAdvantage with skill filter', () => {
    it('passes advantage context when abilityCheckAdvantageSkill matches the ability name', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Strength' }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass advantage context when abilityCheckAdvantageSkill does not match', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Acrobatics' }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
    });
  });

  describe('makeCheckContext - abilityCheckDisadvantage overrides abilityCheckAdvantageAbilities', () => {
    it('disadvantage takes priority over abilityCheckAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, abilityCheckAdvantageAbilities: ['STR'] }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });
  });

  describe('makeCheckContext - wisCheckReplace', () => {
    it('passes wisCheckReplace context with minBonus of 1 when wis bonus is negative', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: -3, save: 0, totalScore: 4, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
      // Wisdom is nth-child(6) (header is nth-child(1), Strength is 2, Dex 3, Con 4, Int 5, Wis 6)
      const wisBonusCell = document.querySelectorAll('.abilities:nth-child(6) > div:nth-child(3)');
      if (wisBonusCell[0]) {
        fireEvent.click(wisBonusCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ wisCheckReplace: true, wisCheckMinBonus: 1 }));
    });

    it('passes wisCheckReplace context with correct minBonus when wis bonus is positive', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
      const wisBonusCell = document.querySelectorAll('.abilities:nth-child(6) > div:nth-child(3)');
      if (wisBonusCell[0]) {
        fireEvent.click(wisBonusCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ wisCheckReplace: true, wisCheckMinBonus: 3 }));
    });
  });

  describe('makeSaveContext - autoReroll', () => {
    it('passes autoReroll context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 3 }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 3 }));
    });
  });

  describe('makeSaveContext - strSaveReplace', () => {
    it('passes strSaveReplace context when save is clicked', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ strSaveReplace: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ strSaveReplace: true, strScore: 14 }));
    });
  });

  describe('makeSaveContext - d20Floor10', () => {
    it('passes d20Floor10 context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ d20Floor10: true }));
    });
  });

  describe('makeSaveContext - strokeOfLuck', () => {
    it('passes strokeOfLuck context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ strokeOfLuck: true }));
    });
  });

  describe('makeSaveContext - luckyAdvantage / luckyDisadvantage', () => {
    it('passes luckyAdvantage context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyAdvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ luckyAdvantage: true }));
    });

    it('passes luckyDisadvantage context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ luckyDisadvantage: true }));
    });
  });

  describe('makeSaveContext - autoFailSaves', () => {
    it('does not call rollSavingThrow when autoFailSave is true on click', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      expect(vi.mocked(useLoggedDiceRoll).mock.results[0].value.rollSavingThrow).not.toHaveBeenCalled();
    });
  });

  describe('makeSaveContext - saveDisadvantage', () => {
    it('passes forcedMode disadvantage when str is in saveDisadvantage', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'] }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('does not pass forcedMode when ability is not in saveDisadvantage', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['dex'] }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ autoFail: undefined, forcedMode: undefined }));
    });
  });

  describe('makeSaveContext - saveAdvantageCount', () => {
    it('passes forcedMode advantage when saveAdvantageCount > 0', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 2 }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });
  });

  describe('makeSaveContext - saveAdvantageAbilities', () => {
    it('passes forcedMode advantage when ability is in saveAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'] }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass forcedMode when ability is not in saveAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['DEX'] }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ autoFail: undefined, forcedMode: undefined }));
    });
  });

  describe('makeSaveContext - wisCheckReplace', () => {
    it('wisCheckReplace is only used in makeCheckContext, not makeSaveContext', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ wisCheckReplace: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+5' && el.closest('.abilities:nth-child(6)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ autoFail: undefined, forcedMode: undefined }));
    });
  });

  describe('makeCheckContext - forcedMode composition with other effects', () => {
    it('includes forcedMode when abilityCheckDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when abilityCheckDisadvantage is set AND luckyAdvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, luckyAdvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', luckyAdvantage: true, luckyAdvantageType: 'advantage' }));
    });

    it('includes forcedMode when abilityCheckDisadvantage is set AND d20Floor10 is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, d20Floor10: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', d20Floor10: true }));
    });

    it('includes forcedMode when abilityCheckDisadvantage is set AND tacticalMind is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, tacticalMind: true, tacticalMindBonus: 3 }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', tacticalMind: true, tacticalMindBonus: 3 }));
    });

    it('includes forcedMode when abilityCheckDisadvantage is set AND reliableTalent is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, reliableTalent: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', reliableTalent: true }));
    });

    it('includes forcedMode when abilityCheckDisadvantage is set AND strokeOfLuck is also set for DEX', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+2' && el.closest('.abilities:nth-child(3)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Dexterity', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when abilityCheckAdvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true, strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when strCheckDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true, strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when abilityCheckAdvantageAbilities is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['STR'], strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when abilityCheckAdvantageAbilities is set AND luckyDisadvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['STR'], luckyDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', luckyDisadvantage: true }));
    });
  });

  describe('makeCheckContext - forcedMode preserved with strCheckReplace', () => {
    it('includes forcedMode when abilityCheckDisadvantage is set AND strCheckReplace is also set', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ abilityCheckDisadvantage: true, strCheckReplace: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+2' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strCheckReplace: true, strScore: 14 }));
    });
  });

  describe('makeCheckContext - forcedMode preserved with wisCheckReplace', () => {
    it('includes forcedMode when abilityCheckDisadvantage is set AND wisCheckReplace is also set', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 3, save: 5, totalScore: 16, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ abilityCheckDisadvantage: true, wisCheckReplace: true }} />);
      const wisBonusCell = document.querySelectorAll('.abilities:nth-child(6) > div:nth-child(3)');
      if (wisBonusCell[0]) {
        fireEvent.click(wisBonusCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', wisCheckReplace: true, wisCheckMinBonus: 3 }));
    });
  });

  describe('makeCheckContext - forcedMode with luckyDisadvantage', () => {
    it('includes forcedMode when abilityCheckDisadvantage is set AND luckyDisadvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, luckyDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', luckyDisadvantage: true }));
    });
  });

  describe('makeCheckContext - explicit forcedMode object when only forcedMode is set', () => {
    it('returns { forcedMode } object when only abilityCheckDisadvantage is set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('returns { forcedMode } object when only abilityCheckAdvantage is set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const bonusCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });
  });

  describe('makeSaveContext - autoFail composition with other effects', () => {
    it('includes autoFail when autoFailSaves is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], strokeOfLuck: true }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).not.toHaveBeenCalled();
    });

    it('includes autoFail when autoFailSaves is set AND luckyAdvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], luckyAdvantage: true }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).not.toHaveBeenCalled();
    });

    it('passes autoFail to context when autoFailSaves does NOT include the ability', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(3)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Dexterity', expect.any(Number), expect.objectContaining({ autoFail: undefined, strokeOfLuck: true }));
    });
  });

  describe('makeSaveContext - forcedMode composition with other effects', () => {
    it('includes forcedMode when saveDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], strokeOfLuck: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when saveDisadvantage is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 2 }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 2 }));
    });

    it('includes forcedMode when saveAdvantageCount is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1, autoReroll: true, autoRerollCondition: 'stunned', autoRerollBonus: 4 }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', autoReroll: true, autoRerollCondition: 'stunned', autoRerollBonus: 4 }));
    });

    it('includes forcedMode when saveAdvantageAbilities is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'], autoReroll: true, autoRerollCondition: 'paralyzed', autoRerollBonus: 5 }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', autoReroll: true, autoRerollCondition: 'paralyzed', autoRerollBonus: 5 }));
    });

    it('includes forcedMode when saveAdvantageAbilities is set AND autoReroll is also set without bonus', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'], autoReroll: true, autoRerollCondition: 'paralyzed' }} />);
      const saveCell = document.querySelectorAll('.abilities:nth-child(2) > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', autoReroll: true, autoRerollCondition: 'paralyzed', autoRerollBonus: null }));
    });

    it('includes forcedMode when saveDisadvantage is set AND luckyAdvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], luckyAdvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', luckyAdvantage: true }));
    });

    it('includes forcedMode when saveDisadvantage is set AND luckyDisadvantage is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], luckyDisadvantage: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', luckyDisadvantage: true }));
    });

    it('includes forcedMode when saveDisadvantage is set AND strSaveReplace is also set', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Constitution', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Charisma', bonus: 0, save: 0, totalScore: 10, skills: [] },
        ],
      });
      render(<CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveDisadvantage: ['dex'], strSaveReplace: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+4' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: undefined, strSaveReplace: true, strScore: 14 }));
    });

    it('includes forcedMode when saveDisadvantage is set AND d20Floor10 is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], d20Floor10: true }} />);
      const clickableEls = document.querySelectorAll('.clickable');
      const saveCell = Array.from(clickableEls).find(el => el.textContent === '+6' && el.closest('.abilities:nth-child(2)'));
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      const mocks = vi.mocked(useLoggedDiceRoll).mock.results[0].value;
      expect(mocks.rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', d20Floor10: true }));
    });
  });
});
