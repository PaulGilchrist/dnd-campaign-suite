import { render, screen, fireEvent } from '@testing-library/react';
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
      { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
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
  playerStats: createPlayerStats(),
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  isRaging: false,
  onReroll: vi.fn(),
  onStrokeOfLuck: vi.fn(),
};

function getSaveCell(container, abilityIndex) {
  return container.querySelectorAll('.abilities > div:nth-child(4)')[abilityIndex];
}

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

describe('CharAbilities save bonus rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('save bonus expression with wisdom_modifier', () => {
    it.each([
      {
        name: 'applies to all listed abilities',
        abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
        wisBonus: 3,
        wisSave: 5,
        expectedStr: '+11',
        expectedWis: '+10',
      },
      {
        name: 'applies only to abilities in saveBonusAbilities',
        abilities: ['WIS'],
        wisBonus: 3,
        wisSave: 5,
        expectedStr: '+6',
        expectedWis: '+10',
      },
      {
        name: 'handles negative wisdom modifier',
        abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
        wisBonus: -2,
        wisSave: 0,
        expectedStr: '+6',
        expectedWis: '+0',
      },
    ])('$name', ({ abilities, wisBonus, wisSave, expectedStr, expectedWis }) => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: wisBonus, save: wisSave, totalScore: 8 + wisBonus, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      const { container } = render(
        <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveBonusExpression: '+2 + wisdom_modifier', saveBonusAbilities: abilities }} />
      );
      expect(getSaveCell(container, 0).textContent).toBe(expectedStr);
      expect(getSaveCell(container, 4).textContent).toBe(expectedWis);
    });
  });

  describe('save bonus expression parsing', () => {
    it.each([
      {
        name: 'sums numeric parts plus wisdom modifier',
        expr: '+2 + 3 + wisdom_modifier',
        wisBonus: 2,
        expectedStr: '+13',
      },
      {
        name: 'handles numeric only with no wisdom modifier',
        expr: '+2 + 3',
        wisBonus: null,
        expectedStr: '+11',
      },
      {
        name: 'handles wisdom only with no numeric parts',
        expr: 'wisdom_modifier',
        wisBonus: 5,
        expectedStr: '+11',
      },
    ])('$name', ({ expr, wisBonus, expectedStr }) => {
      const props = { ...defaultProps, conditionEffects: { saveBonusExpression: expr, saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] } };
      if (wisBonus !== null) {
        const stats = createPlayerStats({
          abilities: [
            { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
            { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
            { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
            { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
            { name: 'Wisdom', bonus: wisBonus, save: 7, totalScore: 20, skills: [] },
            { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
          ],
        });
        props.playerStats = stats;
      }
      const { container } = render(<CharAbilities {...props} />);
      expect(getSaveCell(container, 0).textContent).toBe(expectedStr);
    });
  });

  describe('save bonus with exhaustion penalty', () => {
    it('subtracts exhaustion penalty from save display after bonus is applied', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ saveBonusExpression: '+2', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} exhaustionPenalty={1} />
      );
      expect(getSaveCell(container, 0).textContent).toBe('+7');
    });

    it('applies exhaustion penalty when save bonus expression is also present', () => {
      const stats = createPlayerStats({
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
          { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
          { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
          { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
          { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
        ],
      });
      const { container } = render(
        <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveBonusExpression: '+2 + wisdom_modifier', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} exhaustionPenalty={2} />
      );
      expect(getSaveCell(container, 0).textContent).toBe('+8');
    });
  });

  describe('save advantage tooltip with save bonus expression', () => {
    it('shows warding bond tooltip when saveBonusExpression has positive value', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ saveBonusExpression: '+2 + wisdom_modifier', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      expect(getSaveCell(container, 0).title).toContain('+2 [Warding Bond]');
    });

    it('combines warding bond tooltip with spell resistance tooltip', () => {
      const stats = createPlayerStats({
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Spell Resistance' },
        ],
      });
      const { container } = render(
        <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'], saveBonusExpression: '+2 + wisdom_modifier', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      expect(getSaveCell(container, 0).title).toContain('Spell Resistance');
      expect(getSaveCell(container, 0).title).toContain('+2 [Warding Bond]');
    });
  });

  describe('save bonus with auto fail interaction', () => {
    it('shows AUTO FAIL text even when save bonus expression is present', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], saveBonusExpression: '+2', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      expect(screen.getByText('AUTO FAIL')).toBeInTheDocument();
      expect(getSaveCell(container, 0).textContent).toBe('AUTO FAIL');
      expect(getSaveCell(container, 1).textContent).toBe('+6');
    });
  });

  describe('save bonus with save advantage styling', () => {
    it('shows (Adv) suffix when saveBonusExpression gives advantage', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ saveAdvantageCount: 1, saveBonusExpression: '+2', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      expect(getSaveCell(container, 0).textContent).toContain('(Adv)');
    });
  });

  describe('save bonus click handler', () => {
    it('includes save bonus in rollSavingThrow call when expression is present', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ saveBonusExpression: '+3', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      const mockRoll = getMocks().rollSavingThrow;
      fireEvent.click(getSaveCell(container, 0));
      expect(mockRoll).toHaveBeenCalledWith('Strength', 9, expect.any(Object));
    });

    it('excludes autoFailSaves abilities from rollSavingThrow even with save bonus', () => {
      const { container } = render(
        <CharAbilities {...defaultProps} conditionEffects={{ autoFailSaves: ['str'], saveBonusExpression: '+3', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }} />
      );
      const mockRoll = getMocks().rollSavingThrow;
      fireEvent.click(getSaveCell(container, 0));
      expect(mockRoll).not.toHaveBeenCalled();
    });
  });
});
