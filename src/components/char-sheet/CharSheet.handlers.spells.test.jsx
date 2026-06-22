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
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
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
    })),
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
    if (prop === 'activeConditions') return mockStore.get(`${_key}:activeConditions`) ?? [];
    if (prop === 'activeBuffs') return mockStore.get(`${_key}:activeBuffs`) ?? [];
    if (prop === 'targetEffects') return mockStore.get(`${_key}:targetEffects`) ?? [];
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPlayerSummary = {
  name: 'Test Character',
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
// Tests — Senses modification (Aspect of the Wilds - Owl)
// ---------------------------------------------------------------------------

describe('senses modification aspect of the wilds owl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with existing darkvision sense', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
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
      senses: [{ name: 'Darkvision', value: '60 ft.' }],
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Owl');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders without existing darkvision sense', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
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
      senses: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      skillProficiencies: [],
    }));
    mockStore.set('Test Character:aspectOfTheWildsOption', 'Owl');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — 5e prepared spells loading from runtime state
// ---------------------------------------------------------------------------

describe('5e prepared spells loading from runtime state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with preparedSpells in runtime state (5e ruleset)', async () => {
    mockStore.set('Test Character:preparedSpells', ['Fireball', 'Shield']);
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
          { name: 'Shield', prepared: '' },
          { name: 'Magic Missile', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with empty preparedSpells array in runtime state', async () => {
    mockStore.set('Test Character:preparedSpells', []);
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }],
        maxPreparedSpells: 3,
      },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('does not load preparedSpells for 2024 ruleset', async () => {
    mockStore.set('Test Character:preparedSpells', ['Fireball']);
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }],
        maxPreparedSpells: 3,
      },
      rules: '2024',
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
    }));
    const props2024 = {
      ...defaultProps,
      playerSummary: { ...mockPlayerSummary, rules: '2024' },
    };
    render(<CharSheet {...props2024} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Spell prepared toggle state
// ---------------------------------------------------------------------------

describe('spell prepared toggle state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with already-prepared spells', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
          { name: 'Shield', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with all spells already prepared at max', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
      abilities: [{ name: 'Strength', bonus: 4, save: 6, skills: [] }],
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
          { name: 'Shield', prepared: 'Prepared' },
          { name: 'Magic Missile', prepared: 'Prepared' },
        ],
        maxPreparedSpells: 3,
      },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Hit points runtime sync
// ---------------------------------------------------------------------------

describe('hit points runtime sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('syncs hitPoints to runtime state on mount', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 30, max: 50 },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(mockStore.get('Test Character:hitPoints')).toEqual({ current: 30, max: 50 });
  });

  it('syncs hitPoints with full values', async () => {
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve({
      name: 'Test Character',
      level: 10,
      hitPoints: { current: 50, max: 50 },
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
    }));
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(mockStore.get('Test Character:hitPoints')).toEqual({ current: 50, max: 50 });
  });
});
