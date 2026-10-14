// @improved-by-ai
/**
 * CharAbilities — conditionEffects DISPLAY lane.
 * Verifies how condition effects, exhaustion, rage, and passive feats change the
 * rendered bonus/save/skill columns. Roll-time context is covered by sibling lanes:
 * clickHandlers (roll calls), event-context / contextFeatures (check ctx),
 * saveBonus (saveBonusExpression), toolEntries (tools), rendering (baseline).
 */
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

const mockAllAbilityScores = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
  .map(name => ({ full_name: name, description: `${name} desc` }));

// Baseline level-5 fighter: proficiency = floor((5-1)/4 + 2) = 3.
// Skill bonuses are consistent with their ability modifier (unproficient = modifier only).
function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 18, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Acrobatics', bonus: 2 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 12, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 8, skills: [] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    ...overrides,
  };
}

const defaultProps = {
  allAbilityScores: mockAllAbilityScores,
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  isRaging: false,
};

function renderAbilities(overrides = {}) {
  const { stats: statsOverrides, ...propOverrides } = overrides;
  return render(
    <CharAbilities
      {...defaultProps}
      playerStats={createPlayerStats(statsOverrides)}
      {...propOverrides}
    />
  );
}

// Column layout per row: 1=name 2=score 3=check bonus 4=save 5=skills.
function columnTexts(container, nth) {
  return Array.from(container.querySelectorAll(`.abilities > div:nth-child(${nth})`)).map(c => c.textContent);
}

const getBonusTexts = container => columnTexts(container, 3);
const getSaveTexts = container => columnTexts(container, 4);

describe('CharAbilities condition effects display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('auto fail saves', () => {
    it('replaces only the targeted ability save with AUTO FAIL, leaving others numeric', () => {
      const { container } = renderAbilities({ conditionEffects: { autoFailSaves: ['str'] } });
      expect(getSaveTexts(container)).toEqual(['AUTO FAIL', '+4', '+3', '+0', '+1', '+2']);
    });
  });

  describe('save advantage', () => {
    it('suffixes every save with (Adv) and the unmodified save value when saveAdvantageCount is set', () => {
      const { container } = renderAbilities({ conditionEffects: { saveAdvantageCount: 2 } });
      expect(getSaveTexts(container)).toEqual(
        ['+6 (Adv)', '+4 (Adv)', '+3 (Adv)', '+0 (Adv)', '+1 (Adv)', '+2 (Adv)']
      );
    });

    it('suffixes (Adv) only for abilities listed in saveAdvantageAbilities', () => {
      const { container } = renderAbilities({ conditionEffects: { saveAdvantageAbilities: ['STR'] } });
      expect(getSaveTexts(container)).toEqual(['+6 (Adv)', '+4', '+3', '+0', '+1', '+2']);
    });
  });

  describe('exhaustion penalty', () => {
    it('subtracts the penalty from every displayed ability bonus and save', () => {
      const { container } = renderAbilities({ exhaustionPenalty: 2 });
      expect(getBonusTexts(container)).toEqual(['+2', '+0', '-1', '-2', '-3', '-2']);
      expect(getSaveTexts(container)).toEqual(['+4', '+2', '+1', '-2', '-1', '+0']);
    });
  });

  describe('pass without a trace', () => {
    it('adds passWithoutTraceBonus to Stealth only, leaving other Dexterity skills unchanged', () => {
      renderAbilities({
        stats: {
          abilities: [
            { name: 'Strength', bonus: 4, save: 6, totalScore: 18, skills: [] },
            { name: 'Dexterity', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Stealth', bonus: 6 }, { name: 'Acrobatics', bonus: 2 }] },
            { name: 'Constitution', bonus: 1, save: 3, totalScore: 12, skills: [] },
            { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
            { name: 'Wisdom', bonus: -1, save: 1, totalScore: 8, skills: [] },
            { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
          ],
        },
        conditionEffects: { passWithoutTraceBonus: '2' },
      });
      // Stealth: 6 + 2 = 8; Acrobatics untouched: 2
      expect(screen.getByText('Stealth (+8)')).toBeInTheDocument();
      expect(screen.getByText('Acrobatics (+2)')).toBeInTheDocument();
    });
  });

  describe('jack of all trades', () => {
    it('adds half proficiency to non-proficient skills only', () => {
      renderAbilities({
        stats: {
          level: 10,
          automation: { primalKnowledge: [], passives: [{ type: 'jack_of_all_trades' }] },
        },
      });
      // Level 10 → proficiency 4, half = 2. Proficient skills (Athletics, Arcana) untouched.
      expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
      expect(screen.getByText('Arcana (+2)')).toBeInTheDocument();
      expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
    });
  });

  describe('isRaging', () => {
    it('replaces a Dexterity skill bonus with the STR-based value for primal knowledge skills only', () => {
      renderAbilities({
        stats: {
          automation: { primalKnowledge: ['Acrobatics'], passives: [] },
          abilities: [
            { name: 'Strength', bonus: 4, save: 6, totalScore: 18, skills: [{ name: 'Athletics', bonus: 8 }] },
            { name: 'Dexterity', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Acrobatics', bonus: 2 }, { name: 'Stealth', bonus: 2 }] },
            { name: 'Constitution', bonus: 1, save: 3, totalScore: 12, skills: [] },
            { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
            { name: 'Wisdom', bonus: -1, save: 1, totalScore: 8, skills: [] },
            { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
          ],
        },
        isRaging: true,
      });
      // Acrobatics: STR bonus (4), not its DEX-based 2; Stealth (not primal) keeps 2
      expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
      expect(screen.getByText('Stealth (+2)')).toBeInTheDocument();
    });

    it('recomputes primal knowledge skill with STR bonus plus proficiency and expertise when raging', () => {
      renderAbilities({
        stats: {
          automation: { primalKnowledge: ['Athletics'], passives: [] },
          expertise: ['Athletics'],
        },
        isRaging: true,
      });
      // Athletics: STR bonus (4) + proficiency (3) + expertise (3) = 10
      expect(screen.getByText('Athletics (Expert) (+10)')).toBeInTheDocument();
    });
  });

  describe('cosmic omen', () => {
    it('keeps displayed bonuses at base values when cosmic omen state is stored (bonus applies at roll time)', () => {
      mockStore.set('Test Fighter:cosmicOmen', JSON.stringify({ type: 'Weal', isEven: true, d6Value: 3 }));
      const { container } = renderAbilities();
      expect(getBonusTexts(container)).toEqual(['+4', '+2', '+1', '+0', '-1', '+0']);
      expect(screen.queryByText(/cosmic/i)).not.toBeInTheDocument();
    });
  });
});
