// @maintained-by-ai
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

// Base saves: STR +6, DEX +4, CON +3, INT +0, WIS +4, CHA +2
function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
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

function getSaveCells(container) {
  return Array.from(container.querySelectorAll('.abilities > div:nth-child(4)'));
}

function getSaveTexts(container) {
  return getSaveCells(container).map((cell) => cell.textContent);
}

// Overrides the Wisdom modifier (its save stays at the base +4) so expressions
// referencing wisdom_modifier resolve against a known value.
function statsWithWisdomBonus(wisBonus) {
  return createPlayerStats({
    abilities: defaultProps.playerStats.abilities.map((a) =>
      a.name === 'Wisdom' ? { ...a, bonus: wisBonus, totalScore: 18 + wisBonus } : a
    ),
  });
}

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

describe('CharAbilities save bonus rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('save column display with saveBonusExpression', () => {
    it.each([
      {
        name: 'sums numeric parts and applies to every ability when saveBonusAbilities is omitted',
        expr: '+2 + 3',
        expected: ['+11', '+9', '+8', '+5', '+9', '+7'],
      },
      {
        name: 'resolves an expression of wisdom_modifier alone',
        expr: 'wisdom_modifier',
        wisBonus: 5,
        expected: ['+11', '+9', '+8', '+5', '+9', '+7'],
      },
      {
        name: 'sums numeric parts with wisdom_modifier',
        expr: '+2 + wisdom_modifier',
        wisBonus: 4,
        expected: ['+12', '+10', '+9', '+6', '+10', '+8'],
      },
      {
        name: 'restricts the bonus to abilities listed in saveBonusAbilities',
        expr: '+2 + wisdom_modifier',
        abilities: ['WIS'],
        wisBonus: 4,
        expected: ['+6', '+4', '+3', '+0', '+10', '+2'],
      },
      {
        name: 'lets a negative wisdom modifier reduce the bonus without clamping to zero',
        expr: '+3 + wisdom_modifier',
        wisBonus: -1,
        expected: ['+8', '+6', '+5', '+2', '+6', '+4'],
      },
      {
        name: 'subtracts the exhaustion penalty after applying the bonus',
        expr: '+2 + wisdom_modifier',
        wisBonus: 3,
        exhaustionPenalty: 2,
        expected: ['+9', '+7', '+6', '+3', '+7', '+5'],
      },
    ])('$name', ({ expr, abilities, wisBonus, exhaustionPenalty = 0, expected }) => {
      const { container } = render(
        <CharAbilities
          {...defaultProps}
          playerStats={wisBonus === undefined ? defaultProps.playerStats : statsWithWisdomBonus(wisBonus)}
          exhaustionPenalty={exhaustionPenalty}
          conditionEffects={{ saveBonusExpression: expr, saveBonusAbilities: abilities }}
        />
      );
      expect(getSaveTexts(container)).toEqual(expected);
    });
  });

  describe('save tooltip with save bonus (Warding Bond)', () => {
    it('shows the warding bond bonus in the save tooltip, alone and combined with spell resistance', () => {
      const ce = { saveBonusExpression: '+2 + wisdom_modifier', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] };
      const solo = render(<CharAbilities {...defaultProps} conditionEffects={ce} />);
      expect(getSaveCells(solo.container)[0].title).toBe('+2 [Warding Bond]');
      solo.unmount();

      const stats = createPlayerStats({
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Spell Resistance' },
        ],
      });
      const { container } = render(
        <CharAbilities {...defaultProps} playerStats={stats} conditionEffects={{ saveAdvantage: ['against_spell'], ...ce }} />
      );
      const title = getSaveCells(container)[0].title;
      expect(title).toContain('Spell Resistance');
      expect(title).toContain('+2 [Warding Bond]');
    });
  });

  describe('auto fail interaction with save bonus', () => {
    it('replaces only the targeted save with AUTO FAIL while other saves keep the bonus', () => {
      const { container } = render(
        <CharAbilities
          {...defaultProps}
          conditionEffects={{ autoFailSaves: ['str'], saveBonusExpression: '+2', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }}
        />
      );
      expect(getSaveTexts(container)).toEqual(['AUTO FAIL', '+6', '+5', '+2', '+6', '+4']);
    });
  });

  describe('save roll with bonus', () => {
    it('includes the save bonus in rollSavingThrow for each clicked ability', () => {
      const { container } = render(
        <CharAbilities
          {...defaultProps}
          conditionEffects={{ saveBonusExpression: '+3', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }}
        />
      );
      const mockRoll = getMocks().rollSavingThrow;
      fireEvent.click(getSaveCells(container)[0]);
      expect(mockRoll).toHaveBeenCalledWith('Strength', 9, expect.any(Object));
      fireEvent.click(getSaveCells(container)[4]);
      expect(mockRoll).toHaveBeenCalledWith('Wisdom', 7, expect.any(Object));
    });

    it('excludes autoFailSaves abilities from rollSavingThrow even with save bonus, while others still roll', () => {
      const { container } = render(
        <CharAbilities
          {...defaultProps}
          conditionEffects={{ autoFailSaves: ['str'], saveBonusExpression: '+3', saveBonusAbilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }}
        />
      );
      const mockRoll = getMocks().rollSavingThrow;
      fireEvent.click(getSaveCells(container)[0]);
      expect(mockRoll).not.toHaveBeenCalled();
      fireEvent.click(getSaveCells(container)[1]);
      expect(mockRoll).toHaveBeenCalledWith('Dexterity', 7, expect.any(Object));
    });
  });
});
