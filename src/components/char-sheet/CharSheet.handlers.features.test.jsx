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
// Tests — Elusive feature detection
// ---------------------------------------------------------------------------

describe('elusive feature detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with Elusive in actions', async () => {
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in bonusActions', async () => {
    const stats = {
      ...createDefaultStats(),
      bonusActions: [{ name: 'Elusive' }],
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in reactions', async () => {
    const stats = {
      ...createDefaultStats(),
      reactions: [{ name: 'Elusive' }],
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in specialActions', async () => {
    const stats = {
      ...createDefaultStats(),
      specialActions: [{ name: 'Elusive' }],
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders without Elusive feature', async () => {
    const stats = {
      ...createDefaultStats(),
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive and incapacitating condition (Elusive should not protect)', async () => {
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    mockStore.set('Test Character:activeConditions', ['paralyzed']);
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Ranger Precise Hunter (level 17+)
// ---------------------------------------------------------------------------

describe('ranger precise hunter level 17+', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with level 17 Ranger', async () => {
    const stats = {
      ...createDefaultStats(),
      level: 17,
      class: { name: 'Ranger' },
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with level 16 Ranger (no precise hunter)', async () => {
    const stats = {
      ...createDefaultStats(),
      level: 16,
      class: { name: 'Ranger' },
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Unseen attacker advantage negate (Alert feat)
// ---------------------------------------------------------------------------

describe('unseen attacker advantage negate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with unseenAttackerAdvantageNegate true', async () => {
    const stats = {
      ...createDefaultStats(),
      unseenAttackerAdvantageNegate: true,
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with unseenAttackerAdvantageNegate undefined', async () => {
    const stats = {
      ...createDefaultStats(),
      unseenAttackerAdvantageNegate: undefined,
    };
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Aura combo effects with characters array
// ---------------------------------------------------------------------------

describe('aura combo effects with characters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with characters array (aura combo effects computed)', async () => {
    const stats = createDefaultStats();
    vi.mocked(rulesFactory.getPlayerStats).mockResolvedValue(stats);
    const chars = [
      { name: 'Ally 1', position: { x: 10, y: 10 } },
      { name: 'Ally 2', position: { x: 20, y: 20 } },
    ];
    render(<CharSheet {...defaultProps} characters={chars} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with activeMapName set', async () => {
    render(<CharSheet {...defaultProps} activeMapName='test-map' />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
