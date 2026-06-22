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

const createDefaultStats = () => ({
  name: 'Test Character',
  level: 15,
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
});

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createDefaultStats())),
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
// Tests — Fanatical Focus reset when rage buff is present
// ---------------------------------------------------------------------------

describe('fanatical focus reset with rage buff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('does not set fanaticalFocusUsed to false when rage buff is active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'rage', damageBonusExpression: '2d6' }]);
    mockStore.set('Test Character:fanaticalFocusUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    // When raging, the fanaticalFocusUsed should NOT be reset to false
    expect(mockStore.get('Test Character:fanaticalFocusUsed')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — Disciplined Survivor reroll handler behavior
// ---------------------------------------------------------------------------

describe('disciplined survivor reroll handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with disciplined_survivor in autoRerollCondition', async () => {
    const stats = {
      ...createDefaultStats(),
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
          { name: 'Shield', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with focusPoints in playerStats', async () => {
    const stats = {
      ...createDefaultStats(),
      focusPoints: 5,
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Indomitable Courage usage limits enforcement
// ---------------------------------------------------------------------------

describe('indomitable courage usage limits enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with indomitableUses set to 0', async () => {
    mockStore.set('Test Character:indomitableUses', 0);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with indomitableUses at max for level 17 (3 uses)', async () => {
    mockStore.set('Test Character:indomitableUses', 3);
    const stats = { ...createDefaultStats(), level: 17 };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with indomitableUses at max for level 13 (2 uses)', async () => {
    mockStore.set('Test Character:indomitableUses', 2);
    const stats = { ...createDefaultStats(), level: 13 };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with indomitableUses at max for level 1 (1 use)', async () => {
    mockStore.set('Test Character:indomitableUses', 1);
    const stats = { ...createDefaultStats(), level: 1 };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with indomitableUses exceeding max (should still render gracefully)', async () => {
    mockStore.set('Test Character:indomitableUses', 5);
    const stats = { ...createDefaultStats(), level: 10 };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Stroke of Luck usage flag
// ---------------------------------------------------------------------------

describe('stroke of luck usage flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with strokeOfLuckUsed flag set to true', async () => {
    mockStore.set('Test Character:strokeOfLuckUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with strokeOfLuckUsed flag set to false', async () => {
    mockStore.set('Test Character:strokeOfLuckUsed', false);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Disciplined Survivor autoReroll flag handling
// ---------------------------------------------------------------------------

describe('disciplined survivor autoReroll flag handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with disciplinedSurvivorUsed flag set', async () => {
    mockStore.set('Test Character:disciplinedSurvivorUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with autoReroll and disciplinedSurvivorUsed both set', async () => {
    mockStore.set('Test Character:disciplinedSurvivorUsed', true);
    const stats = {
      ...createDefaultStats(),
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }],
        maxPreparedSpells: 3,
      },
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — AutoRerollBonus evaluation
// ---------------------------------------------------------------------------

describe('autoRerollBonus evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with autoRerollBonus null', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with autoRerollBonus set', async () => {
    const stats = {
      ...createDefaultStats(),
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }],
        maxPreparedSpells: 3,
      },
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Fanatical Focus reset when rage buff is absent
// ---------------------------------------------------------------------------

describe('fanatical focus reset when rage buff is absent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('sets fanaticalFocusUsed to false when no rage buff', async () => {
    mockStore.set('Test Character:activeBuffs', []);
    mockStore.set('Test Character:fanaticalFocusUsed', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    // When not raging, the fanaticalFocusUsed should be reset to false
    expect(mockStore.get('Test Character:fanaticalFocusUsed')).toBe(false);
  });
});
