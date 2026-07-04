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

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

function findClickableByText(text) {
  const clickableEls = document.querySelectorAll('.clickable');
  return Array.from(clickableEls).find(el => el.textContent === text);
}

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
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalled();
    });

    it('calls rollSavingThrow when a save value is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalled();
    });

    it('calls rollSkillCheck when a skill name is clicked', () => {
      render(<CharAbilities {...defaultProps} />);
      const athleticsElements = screen.getAllByText(/Athletics/);
      fireEvent.click(athleticsElements[0]);
      expect(getMocks().rollSkillCheck).toHaveBeenCalled();
    });

    it('does not call rollSavingThrow when autoFailSave ability is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'] }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      expect(getMocks().rollSavingThrow).not.toHaveBeenCalled();
    });
  });

  describe('makeCheckContext - condition effects pass context', () => {
    const checkEffectTests = [
      { name: 'strokeOfLuck', effect: { strokeOfLuck: true }, expected: { strokeOfLuck: true } },
      { name: 'luckyAdvantage', effect: { luckyAdvantage: true }, expected: { luckyAdvantage: true, luckyAdvantageType: 'advantage' } },
      { name: 'luckyDisadvantage', effect: { luckyDisadvantage: true }, expected: { luckyDisadvantage: true } },
      { name: 'd20Floor10', effect: { d20Floor10: true }, expected: { d20Floor10: true } },
      { name: 'reliableTalent', effect: { reliableTalent: true }, expected: { reliableTalent: true } },
      { name: 'tacticalMind', effect: { tacticalMind: true, tacticalMindBonus: 5 }, expected: { tacticalMind: true, tacticalMindBonus: 5 } },
    ];

    for (const { name, effect, expected } of checkEffectTests) {
      it(`passes ${name} context when ability check is clicked`, () => {
        render(<CharAbilities {...defaultProps} conditionEffects={effect} />);
        const bonusCell = findClickableByText('+4');
        if (bonusCell) {
          fireEvent.click(bonusCell);
        }
        expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining(expected));
      });
    }

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
      const bonusCell = findClickableByText('+2');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ strCheckReplace: true, strScore: 14 }));
    });

    it('passes strCheckDisadvantage context when Strength ability check is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('does not pass forcedMode when strCheckDisadvantage is true but non-Strength ability is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
      const bonusCell = findClickableByText('+2');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Dexterity', expect.any(Number), undefined);
    });

    it('passes advantage context when abilityCheckAdvantageAbilities abbreviation matches', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['STR'] }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass advantage context when abilityCheckAdvantageAbilities abbreviation does not match', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['DEX'] }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
    });

    it('passes advantage context when abilityCheckAdvantageSkill matches the ability name', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Strength' }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass advantage context when abilityCheckAdvantageSkill does not match', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Acrobatics' }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), undefined);
    });

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
      const wisRow = Array.from(document.querySelectorAll('.abilities')).find(el => el.querySelector('.left')?.textContent === 'Wisdom');
      const wisBonusCell = wisRow ? wisRow.querySelector('div:nth-child(3)') : null;
      if (wisBonusCell) {
        fireEvent.click(wisBonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ wisCheckReplace: true, wisCheckMinBonus: 1 }));
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
      const wisRow = Array.from(document.querySelectorAll('.abilities')).find(el => el.querySelector('.left')?.textContent === 'Wisdom');
      const wisBonusCell = wisRow ? wisRow.querySelector('div:nth-child(3)') : null;
      if (wisBonusCell) {
        fireEvent.click(wisBonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ wisCheckReplace: true, wisCheckMinBonus: 3 }));
    });
  });

  describe('makeCheckContext - forcedMode with other effects', () => {
    it('includes forcedMode when abilityCheckDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, strokeOfLuck: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('disadvantage takes priority over abilityCheckAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true, abilityCheckAdvantageAbilities: ['STR'] }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('includes forcedMode when strCheckDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true, strokeOfLuck: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when abilityCheckAdvantageAbilities is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantageAbilities: ['STR'], strokeOfLuck: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', strokeOfLuck: true }));
    });

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
      const bonusCell = findClickableByText('+2');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strCheckReplace: true, strScore: 14 }));
    });

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
      const wisRow = Array.from(document.querySelectorAll('.abilities')).find(el => el.querySelector('.left')?.textContent === 'Wisdom');
      const wisBonusCell = wisRow ? wisRow.querySelector('div:nth-child(3)') : null;
      if (wisBonusCell) {
        fireEvent.click(wisBonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', wisCheckReplace: true, wisCheckMinBonus: 3 }));
    });

    it('returns forcedMode object when only abilityCheckDisadvantage is set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckDisadvantage: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('returns forcedMode object when only abilityCheckAdvantage is set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ abilityCheckAdvantage: true }} />);
      const bonusCell = findClickableByText('+4');
      if (bonusCell) {
        fireEvent.click(bonusCell);
      }
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });
  });

  describe('makeSaveContext - condition effects pass context', () => {
    it('passes autoReroll context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 3 }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 3 }));
    });

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
      const saveCell = findClickableByText('+4');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ strSaveReplace: true, strScore: 14 }));
    });

    it('passes d20Floor10 context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ d20Floor10: true }));
    });

    it('passes strokeOfLuck context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strokeOfLuck: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ strokeOfLuck: true }));
    });

    it('passes luckyAdvantage context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyAdvantage: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ luckyAdvantage: true }));
    });

    it('passes luckyDisadvantage context when save is clicked', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ luckyDisadvantage: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ luckyDisadvantage: true }));
    });

    it('passes forcedMode disadvantage when str is in saveDisadvantage', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'] }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage' }));
    });

    it('does not pass forcedMode when ability is not in saveDisadvantage', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['dex'] }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: undefined }));
    });

    it('passes forcedMode advantage when saveAdvantageCount > 0', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 2 }} />);
      const saveCell = document.querySelectorAll('.abilities > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('passes forcedMode advantage when ability is in saveAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'] }} />);
      const saveCell = document.querySelectorAll('.abilities > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage' }));
    });

    it('does not pass forcedMode when ability is not in saveAdvantageAbilities', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['DEX'] }} />);
      const saveCell = document.querySelectorAll('.abilities > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: undefined }));
    });

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
      const saveCell = findClickableByText('+5');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Wisdom', expect.any(Number), expect.objectContaining({ forcedMode: undefined }));
    });
  });

  describe('makeSaveContext - forcedMode with other effects', () => {
    it('includes forcedMode when saveDisadvantage is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], strokeOfLuck: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', strokeOfLuck: true }));
    });

    it('includes forcedMode when saveDisadvantage is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 2 }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', autoReroll: true, autoRerollCondition: 'frightened', autoRerollBonus: 2 }));
    });

    it('includes forcedMode when saveAdvantageCount is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1, autoReroll: true, autoRerollCondition: 'stunned', autoRerollBonus: 4 }} />);
      const saveCell = document.querySelectorAll('.abilities > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', autoReroll: true, autoRerollCondition: 'stunned', autoRerollBonus: 4 }));
    });

    it('includes forcedMode when saveAdvantageAbilities is set AND autoReroll is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageAbilities: ['STR'], autoReroll: true, autoRerollCondition: 'paralyzed', autoRerollBonus: 5 }} />);
      const saveCell = document.querySelectorAll('.abilities > div:nth-child(4)');
      if (saveCell[0]) {
        fireEvent.click(saveCell[0]);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'advantage', autoReroll: true, autoRerollCondition: 'paralyzed', autoRerollBonus: 5 }));
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
      const saveCell = findClickableByText('+4');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: undefined, strSaveReplace: true, strScore: 14 }));
    });

    it('includes forcedMode when saveDisadvantage is set AND d20Floor10 is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ saveDisadvantage: ['str'], d20Floor10: true }} />);
      const saveCell = findClickableByText('+6');
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', expect.any(Number), expect.objectContaining({ forcedMode: 'disadvantage', d20Floor10: true }));
    });

    it('includes autoFail when autoFailSaves is set AND strokeOfLuck is also set', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], strokeOfLuck: true }} />);
      const autoFailEl = screen.getByText('AUTO FAIL');
      fireEvent.click(autoFailEl);
      expect(getMocks().rollSavingThrow).not.toHaveBeenCalled();
    });

    it('passes autoFail to context when autoFailSaves does NOT include the ability', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], strokeOfLuck: true }} />);
      const dexRow = Array.from(document.querySelectorAll('.abilities')).find(el => el.querySelector('.left')?.textContent === 'Dexterity');
      const saveCell = dexRow ? Array.from(dexRow.querySelectorAll('.clickable')).find(el => el.textContent === '+4') : null;
      if (saveCell) {
        fireEvent.click(saveCell);
      }
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith('Dexterity', expect.any(Number), expect.objectContaining({ strokeOfLuck: true }));
    });
  });
});
