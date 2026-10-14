// @maintained-by-ai
/**
 * CharAbilities — baseline layout lane (owner: headers + grid structure).
 * Pins the section/column headers, one row per ability with cells in column
 * order (name/score/bonus/save/skills, sign-formatted columns), and the
 * empty-abilities negative path.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - clickHandlers: click → roll contract incl. ability name → description popup.
 * - display-save: "(Expert)" suffix and skill-cell text formatting.
 * - saveBonus / conditionEffects / missingCoverage: save column and modifier
 *   display ((Adv), AUTO FAIL, tooltip sources, stacking order).
 * - toolEntries: tool cells. event-context / contextFeatures / reliableTalent
 *   / psiBolsteredKnack: event routing and feature gates.
 */
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

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  buildAbilityDetailHtml: vi.fn(() => () => 'ability detail html'),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveAdvantage: vi.fn(() => false),
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

// Expected cell text per row, in column order — the fixture is the baseline
// (no modifiers, no exhaustion), so bonus/save use the always-sign formatter.
const EXPECTED_ROWS = [
  { name: 'Strength', score: '14', bonus: '+4', save: '+6', skills: ['Athletics (+8)'] },
  { name: 'Dexterity', score: '12', bonus: '+2', save: '+4', skills: ['Acrobatics (+6)'] },
  { name: 'Constitution', score: '11', bonus: '+1', save: '+3', skills: [] },
  { name: 'Intelligence', score: '10', bonus: '+0', save: '+0', skills: ['Arcana (+2)'] },
  { name: 'Wisdom', score: '9', bonus: '-1', save: '+1', skills: ['Perception (+3)'] },
  { name: 'Charisma', score: '10', bonus: '+0', save: '+2', skills: [] },
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
};

describe('CharAbilities baseline layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders section/column headers and one row per ability with cells in column order', () => {
    const { container } = render(<CharAbilities {...defaultProps} />);

    expect(screen.getByText('Abilities')).toBeInTheDocument();
    const headers = Array.from(screen.getByText('Name').closest('.tableHeader').children)
      .map(el => el.textContent);
    expect(headers).toEqual(['Name', 'Score', 'Bonus', 'Save', 'Skills']);

    const rows = Array.from(container.querySelectorAll('.abilities'));
    expect(rows).toHaveLength(EXPECTED_ROWS.length);
    rows.forEach((row, i) => {
      const expected = EXPECTED_ROWS[i];
      const cells = Array.from(row.children).map(el => el.textContent);
      // Column-order contract: name, score, sign-formatted bonus, sign-formatted save.
      expect(cells.slice(0, 4)).toEqual([expected.name, expected.score, expected.bonus, expected.save]);
      expected.skills.forEach(skillText => expect(cells[4]).toContain(skillText));
    });
    // Abilities with no skills render an empty skills cell.
    EXPECTED_ROWS.forEach((expected, i) => {
      if (expected.skills.length === 0) {
        expect(Array.from(rows[i].children)[4].textContent).toBe('');
      }
    });
  });

  it('renders headers with no ability rows when the abilities array is empty', () => {
    const stats = createPlayerStats({ abilities: [] });
    const { container } = render(<CharAbilities {...defaultProps} playerStats={stats} />);

    expect(screen.getByText('Abilities')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(container.querySelectorAll('.abilities')).toHaveLength(0);
    expect(screen.queryByText('Strength')).not.toBeInTheDocument();
  });
});
