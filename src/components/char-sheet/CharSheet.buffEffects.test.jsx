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
  default: vi.fn(({ playerStats, isRaging }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="is-raging">{String(isRaging)}</span>
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
    if (prop === 'activeConditions') return [];
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
// Tests — Shield buff effect
// ---------------------------------------------------------------------------

describe('shield buff effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with shield buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'shield' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with shield buff and other buffs', async () => {
    mockStore.set('Test Character:activeBuffs', [
      { effect: 'shield' },
      { effect: 'mage_armor' },
    ]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Shield of Faith buff effect
// ---------------------------------------------------------------------------

describe('shield of faith buff effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with shield of faith buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'shield_of_faith' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Haste buff effect
// ---------------------------------------------------------------------------

describe('haste buff effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with haste buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'haste' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Blessing of the Trickster effect
// ---------------------------------------------------------------------------

describe('blessing of the trickster effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with trickster blessing buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'advantage_on_stealth' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Cloak of Shadows effect
// ---------------------------------------------------------------------------

describe('cloak of shadows effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with cloak of shadows buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'cloak_of_shadows' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Blade Ward effect
// ---------------------------------------------------------------------------

describe('blade ward effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with blade ward buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'blade_ward' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Buff-ally effects (Zealous Presence)
// ---------------------------------------------------------------------------

describe('buff-ally effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with advantage_attacks_and_saves buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'advantage_attacks_and_saves' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Reckless Attack effect
// ---------------------------------------------------------------------------

describe('reckless attack effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with advantage_attacks_disadvantage_against buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'advantage_attacks_disadvantage_against' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — See Invisibility effect
// ---------------------------------------------------------------------------

describe('see invisibility effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with see_invisibility buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'see_invisibility' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Shape Shift effect
// ---------------------------------------------------------------------------

describe('shape shift effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with shape_shift buff active', async () => {
    mockStore.set('Test Character:activeBuffs', [{ effect: 'shape_shift' }]);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Peerless Athlete and Large Form runtime values
// ---------------------------------------------------------------------------

describe('peerless athlete and large form runtime values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with peerlessAthleteActive set', async () => {
    mockStore.set('Test Character:peerlessAthleteActive', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with largeFormActive set', async () => {
    mockStore.set('Test Character:largeFormActive', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with both peerlessAthleteActive and largeFormActive set', async () => {
    mockStore.set('Test Character:peerlessAthleteActive', true);
    mockStore.set('Test Character:largeFormActive', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Holy Nimbus runtime value
// ---------------------------------------------------------------------------

describe('holy nimbus runtime value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with holyNimbusActive set', async () => {
    mockStore.set('Test Character:holyNimbusActive', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Defensive Tactics runtime value
// ---------------------------------------------------------------------------

describe('defensive tactics runtime value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with _Defensive_Tactics_choice set to Escape the Horde', async () => {
    mockStore.set('Test Character:_Defensive_Tactics_choice', 'Escape the Horde');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Stunned speed halved runtime value
// ---------------------------------------------------------------------------

describe('stunned speed halved runtime value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with stunned_speedHalved set', async () => {
    mockStore.set('Test Character:stunned_speedHalved', Date.now());
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
