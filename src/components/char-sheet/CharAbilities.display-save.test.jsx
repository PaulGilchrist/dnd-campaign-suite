// @maintained-by-ai
/**
 * CharAbilities — skill-cell DISPLAY lane: the "(Expert)" suffix and how the
 * skill bonus text is formatted.
 *
 * Owns behaviors no sibling lane covers:
 * - "(Expert)" suffix comes solely from the expertise list (proficient and
 *   plain control cells in the same render prove proficiency alone never suffixes).
 * - Expert skill bonus display is sign-formatted (Intl signDisplay: 'always')
 *   and reduced by exhaustionPenalty, suffix intact.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - saveBonus: save-column display with exhaustion / saveBonusExpression.
 * - contextFeatures / event-context: event-triggered roll bonuses (incl. exhaustion).
 * - missingCoverage: JoAT / passWithoutTrace stacking order, roll context stamps.
 * - toolEntries: tool cell rendering. rendering: baseline layout / headers.
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
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    ...overrides,
  };
}

function renderAbilities(statsOverrides = {}, propOverrides = {}) {
  return render(
    <CharAbilities
      allAbilityScores={mockAllAbilityScores}
      playerStats={createPlayerStats(statsOverrides)}
      campaignName="test-campaign"
      exhaustionPenalty={0}
      conditionEffects={{}}
      isRaging={false}
      {...propOverrides}
    />
  );
}

describe('CharAbilities skill-cell display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('suffixes only expertise-list skills with "(Expert)" — proficient and plain skills never suffix', () => {
    // Expertise and proficiency are deliberately disjoint so each cell isolates
    // one branch of the suffix rule: expert-only, proficient-not-expert, plain.
    renderAbilities({
      expertise: ['Arcana'],
      skillProficiencies: ['Athletics'],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Stealth', bonus: 3 }] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      ],
    });

    expect(screen.getByText('Arcana (Expert) (+2)')).toBeInTheDocument();
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    expect(screen.getByText('Stealth (+3)')).toBeInTheDocument();
    // Exactly one suffixed cell — proficiency alone (Athletics) must not suffix.
    expect(screen.getAllByText(/\(Expert\)/)).toHaveLength(1);
  });

  it('formats expert skill bonuses with a leading sign and applies the exhaustion penalty', () => {
    // One render pins all three sign branches of the formatter plus subtraction:
    // 8-2=+6, -1-2=-3, 2-2=+0 — the "(Expert)" suffix stays intact in each.
    renderAbilities(
      {
        expertise: ['Athletics', 'Sleight of Hand', 'Arcana'],
        abilities: [
          { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
          { name: 'Dexterity', bonus: -1, save: 4, totalScore: 8, skills: [{ name: 'Sleight of Hand', bonus: -1 }] },
          { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
        ],
      },
      { exhaustionPenalty: 2 }
    );

    expect(screen.getByText('Athletics (Expert) (+6)')).toBeInTheDocument();
    expect(screen.getByText('Sleight of Hand (Expert) (-3)')).toBeInTheDocument();
    expect(screen.getByText('Arcana (Expert) (+0)')).toBeInTheDocument();
  });
});
