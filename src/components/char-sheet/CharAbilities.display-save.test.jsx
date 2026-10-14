// @improved-by-ai
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

describe('CharAbilities expertise display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('marks every expert skill with "(Expert)" and leaves non-expert skills unsuffixed', () => {
    renderAbilities({
      expertise: ['Athletics', 'Arcana'],
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 3 }] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      ],
    });

    expect(screen.getByText('Athletics (Expert) (+8)')).toBeInTheDocument();
    expect(screen.getByText('Arcana (Expert) (+2)')).toBeInTheDocument();
    expect(screen.getByText('Acrobatics (+3)')).toBeInTheDocument();
    expect(screen.queryByText('Acrobatics (Expert) (+3)')).not.toBeInTheDocument();
  });

  it('renders no "(Expert)" suffixes when the character has no expertise, even for proficient skills', () => {
    renderAbilities({ expertise: [] });

    // Athletics and Arcana are proficient in the base fixture — proficiency alone must not suffix.
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    expect(screen.getByText('Arcana (+2)')).toBeInTheDocument();
    expect(screen.queryByText(/\(Expert\)/)).not.toBeInTheDocument();
  });

  it('drives the suffix from the expertise list rather than skill proficiencies', () => {
    renderAbilities({
      expertise: ['Stealth'],
      skillProficiencies: ['Athletics'],
      abilities: [
        { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Stealth', bonus: 5 }] },
        { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
      ],
    });

    expect(screen.getByText('Stealth (Expert) (+5)')).toBeInTheDocument();
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
  });

  it('formats a negative expert skill bonus with a minus sign', () => {
    renderAbilities({
      expertise: ['Sleight of Hand'],
      abilities: [
        { name: 'Dexterity', bonus: -1, save: 4, totalScore: 8, skills: [{ name: 'Sleight of Hand', bonus: -1 }] },
      ],
    });

    expect(screen.getByText('Sleight of Hand (Expert) (-1)')).toBeInTheDocument();
  });

  it('subtracts the exhaustion penalty from an expert skill bonus while keeping the suffix', () => {
    renderAbilities({ expertise: ['Athletics'] }, { exhaustionPenalty: 2 });

    expect(screen.getByText('Athletics (Expert) (+6)')).toBeInTheDocument();
    expect(screen.queryByText('Athletics (Expert) (+8)')).not.toBeInTheDocument();
  });
});
