// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';

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
    <div data-testid="char-character-advancement">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="advancement-count">{playerStats?.characterAdvancement?.length || 0}</span>
    </div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve({
      name: 'Test Bard',
      level: 5,
      hitPoints: { current: 40, max: 40 },
      abilities: [{ name: 'Strength', bonus: 2, save: 4, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Bard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    })),
  },
}));

const mockStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((_key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'bardicInspirationDie') return mockStore.get(`${_key}:bardicInspirationDie`) ?? null;
    if (prop === 'bardicInspirationCombatOptions') return mockStore.get(`${_key}:bardicInspirationCombatOptions`) ?? null;
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
  name: 'Test Bard',
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
// Tests — Bardic Inspiration feature injection
// ---------------------------------------------------------------------------

describe('bardic inspiration feature injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('does not inject "Use Bardic Inspiration" when bardicInspirationDie is null', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', null);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('0');
  });

  it('injects "Use Bardic Inspiration" when bardicInspirationDie is d6', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('1');
  });

  it('injects "Use Bardic Inspiration" when bardicInspirationDie is d8', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd8');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('1');
  });

  it('adds defense combat option when defense_add_to_ac is in combatOptions', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['defense_add_to_ac']));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('2');
  });

  it('adds offense combat option when offense_add_to_damage is in combatOptions', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['offense_add_to_damage']));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('2');
  });

  it('adds both defense and offense combat options', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('3');
  });

  it('handles invalid JSON for combatOptions gracefully without crashing', async () => {
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    mockStore.set('Test Bard:bardicInspirationCombatOptions', 'not-valid-json');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('1');
  });

  it('does not duplicate "Use Bardic Inspiration" if already in characterAdvancement', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Bard',
      level: 5,
      hitPoints: { current: 40, max: 40 },
      abilities: [{ name: 'Strength', bonus: 2, save: 4, skills: [] }],
      spellAbilities: { spells: [], maxPreparedSpells: 5 },
      rules: '5e',
      automation: { passives: [] },
      class: { name: 'Bard' },
      speed: 30,
      race: { speed: 30 },
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [{ name: 'Use Bardic Inspiration', description: 'existing' }],
      skillProficiencies: [],
    }));
    mockStore.set('Test Bard:bardicInspirationDie', 'd6');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('advancement-count')).toHaveTextContent('1');
  });
});
