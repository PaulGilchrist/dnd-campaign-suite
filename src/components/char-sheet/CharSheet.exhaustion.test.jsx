// @improved-by-ai
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
  default: vi.fn(({ playerStats, exhaustionPenalty }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="exhaustion-penalty">{exhaustionPenalty}</span>
    </div>
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
      name: 'Test Fighter',
      level: 5,
      hitPoints: { current: 45, max: 45 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Fighter' },
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
    // exhaustionLevel reads from the store so tests can inject values
    if (prop === 'exhaustionLevel') {
      const stored = mockStore.get(`${_key}:${prop}`);
      if (typeof stored === 'number') return stored;
      return 0;
    }
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
  name: 'Test Fighter',
  rules: '5e',
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
// Tests — Exhaustion level clamping
// ---------------------------------------------------------------------------

describe('exhaustion level clamping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('clamps negative exhaustion to 0 (penalty = 0)', async () => {
    mockStore.set('Test Fighter:exhaustionLevel', -1);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    // clamped to 0, penalty = 2 * 0 = 0
    expect(screen.getByTestId('exhaustion-penalty')).toHaveTextContent('0');
  });

  it('clamps exhaustion above 6 to 6 (penalty = 12)', async () => {
    mockStore.set('Test Fighter:exhaustionLevel', 10);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    // clamped to 6, penalty = 2 * 6 = 12
    expect(screen.getByTestId('exhaustion-penalty')).toHaveTextContent('12');
  });

  it('passes exhaustion level 3 through (penalty = 6)', async () => {
    mockStore.set('Test Fighter:exhaustionLevel', 3);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('exhaustion-penalty')).toHaveTextContent('6');
  });

  it('defaults to exhaustion level 0 when stored value is not a number', async () => {
    mockStore.set('Test Fighter:exhaustionLevel', 'invalid');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('exhaustion-penalty')).toHaveTextContent('0');
  });
});
