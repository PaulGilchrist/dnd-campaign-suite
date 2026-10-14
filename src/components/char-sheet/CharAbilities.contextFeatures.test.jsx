import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

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

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
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
  return Array.from(clickableEls).find((el) => el.textContent === text);
}

describe('CharAbilities event listener and context features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('INTERNAL_SKILL_CHECK_EVENT', () => {
    it('dispatches rollAbilityCheck for check type with exhaustion penalty applied', () => {
      render(<CharAbilities {...defaultProps} exhaustionPenalty={2} />);
      window.dispatchEvent(
        new CustomEvent('internal-skill-check', { detail: { skillName: 'Strength', checkType: 'check' } })
      );
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 2, undefined);
    });

    it('dispatches rollSkillCheck for skill type with getSkillBonus result', () => {
      render(<CharAbilities {...defaultProps} />);
      window.dispatchEvent(
        new CustomEvent('internal-skill-check', { detail: { skillName: 'Athletics', checkType: 'skill' } })
      );
      const [, bonus] = getMocks().rollSkillCheck.mock.calls[0];
      expect(Number.isNaN(bonus)).toBe(false);
      expect(bonus).toBe(8);
    });

    it('does nothing when event has no skillName', () => {
      render(<CharAbilities {...defaultProps} />);
      window.dispatchEvent(new CustomEvent('internal-skill-check', { detail: {} }));
      expect(getMocks().rollAbilityCheck).not.toHaveBeenCalled();
      expect(getMocks().rollSkillCheck).not.toHaveBeenCalled();
    });

    it('applies makeCheckContext to skill checks from event', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ reliableTalent: true }} />);
      window.dispatchEvent(
        new CustomEvent('internal-skill-check', { detail: { skillName: 'Athletics', checkType: 'skill' } })
      );
      expect(getMocks().rollSkillCheck).toHaveBeenCalledWith(
        'Athletics',
        8,
        expect.objectContaining({ reliableTalent: true })
      );
    });

    it('applies makeCheckContext to ability checks from event', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ d20Floor10: true }} />);
      window.dispatchEvent(
        new CustomEvent('internal-skill-check', { detail: { skillName: 'Strength', checkType: 'check' } })
      );
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
        'Strength',
        expect.any(Number),
        expect.objectContaining({ d20Floor10: true })
      );
    });

    it('removes event listener on unmount', () => {
      const { unmount } = render(<CharAbilities {...defaultProps} />);
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('makeCheckContext - advantage/disadvantage interactions', () => {
    it('applies Powerful Build advantage for STR checks (no prior forcedMode)', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckAdvantage: true }} />);
      const bonusCell = findClickableByText('+4');
      expect(bonusCell).toBeTruthy();
      fireEvent.click(bonusCell);
      expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
        'Strength',
        expect.any(Number),
        expect.objectContaining({ forcedMode: 'advantage' })
      );
    });

    it('applies Ray of Enfeeblement disadvantage for Dexterity ability check', () => {
      render(<CharAbilities {...defaultProps} conditionEffects={{ strCheckDisadvantage: true }} />);
      const bonusCells = document.querySelectorAll('.abilities > div:nth-child(3)');
      fireEvent.click(bonusCells[1]);
      const callArgs = getMocks().rollAbilityCheck.mock.calls[0];
      expect(callArgs[2]).not.toHaveProperty('forcedMode');
    });
  });

  describe('makeSaveContext - strSaveReplace behavior', () => {
    it('passes strSaveReplace context with strScore', () => {
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
      expect(saveCell).toBeTruthy();
      fireEvent.click(saveCell);
      expect(getMocks().rollSavingThrow).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ strSaveReplace: true, strScore: 14 })
      );
    });
  });
});
