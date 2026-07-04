import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-abilities"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockResolvedValue({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '2024',
      automation: { passives: [] },
      class: { name: 'Druid' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }),
  },
}));

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((_key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'bardicInspirationDie') return null;
    if (prop === 'bardicInspirationCombatOptions') return null;
    if (prop === 'activeConditions') return [];
    if (prop === 'activeBuffs') return [];
    if (prop === 'targetEffects') return [];
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPlayerSummary = {
  name: 'Test Character',
  rules: '2024',
};

const defaultProps = {
  allAbilityScores: [],
  allClasses: [],
  allClasses2024: [],
  allEquipment: [],
  allMagicItems: [],
  allRaces: [],
  allSpells: [],
  allSpells2024: [],
  playerSummary: mockPlayerSummary,
  allRaces2024: [],
  allMagicItems2024: [],
  campaignName: 'test-campaign',
  activeMapName: null,
  characters: [],
  onDeleteCharacter: vi.fn(),
  onEditCharacter: vi.fn(),
  onUploadClick: vi.fn(),
  onSaveClick: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests — Aquatic Affinity passive sets runtime state
// ---------------------------------------------------------------------------

describe('aquatic affinity passive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('sets aquaticAffinityEmanationRange when aquatic_affinity passive is present', async () => {
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '2024',
      automation: { passives: [{ effect: 'aquatic_affinity' }] },
      class: { name: 'Druid' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    });
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(mockStore.get('Test Character:aquaticAffinityEmanationRange')).toBe(10);
  });
});
