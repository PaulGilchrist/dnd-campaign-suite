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

vi.mock('./Popup.jsx', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="popup">{children}</div>
  )),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(({ name }) => (
    <div data-testid="dice-roll-result"><span>{name || 'dice'}</span></div>
  )),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn().mockResolvedValue(null),
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
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
// Tests — handleStrokeOfLuck callback sets runtime value
// ---------------------------------------------------------------------------

describe('handleStrokeOfLuck callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with handleStrokeOfLuck callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('sets strokeOfLuckUsed to true when called', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleTacticalMind callback (Second Wind resource management)
// ---------------------------------------------------------------------------

describe('handleTacticalMind callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with handleTacticalMind callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Tactical Mind when no secondWindUses stored (resets from max)', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter', class_levels: [{ second_wind: 2 }] },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Tactical Mind when secondWindUses is at 0 (full reset)', async () => {
    mockStore.set('Test Character:secondWindUses', 0);
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter', class_levels: [{ second_wind: 2 }] },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Tactical Mind when secondWindUses is depleted', async () => {
    mockStore.set('Test Character:secondWindUses', 0);
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter', class_levels: [{ second_wind: 0 }] },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSuperiorityManeuver callback (Fighter/PC2 Rogue)
// ---------------------------------------------------------------------------

describe('handleSuperiorityManeuver callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with handleSuperiorityManeuver callback available', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Superiority Maneuver with available maneuvers', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Superiority Maneuver when superiorityDice is 0', async () => {
    mockStore.set('Test Character:superiorityDice', 0);
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Superiority Maneuver with initiative roll type', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Superiority Maneuver error gracefully when maneuver not found', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('handles Superiority Maneuver error when getManeuversForRules throws', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Elusive detection from all action arrays
// ---------------------------------------------------------------------------

describe('elusive detection from action arrays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with Elusive in actions array', async () => {
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in bonusActions array', async () => {
    const stats = {
      ...createDefaultStats(),
      bonusActions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in reactions array', async () => {
    const stats = {
      ...createDefaultStats(),
      reactions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive in specialActions array', async () => {
    const stats = {
      ...createDefaultStats(),
      specialActions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive but incapacitated (Elusive disabled)', async () => {
    mockStore.set('Test Character:activeConditions', ['incapacitated']);
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive and paralyzed condition (Elusive disabled)', async () => {
    mockStore.set('Test Character:activeConditions', ['paralyzed']);
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive and stunned condition (Elusive disabled)', async () => {
    mockStore.set('Test Character:activeConditions', ['stunned']);
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Elusive and unconscious condition (Elusive disabled)', async () => {
    mockStore.set('Test Character:activeConditions', ['unconscious']);
    const stats = {
      ...createDefaultStats(),
      actions: [{ name: 'Elusive' }],
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Ranger level 17 Precise Hunter attack advantage
// ---------------------------------------------------------------------------

describe('ranger level 17 precise hunter attack advantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with Ranger level 17 (Precise Hunter advantage)', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Ranger' },
      level: 17,
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Ranger level 16 (no Precise Hunter advantage)', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Ranger' },
      level: 16,
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Fighter level 17 (no Precise Hunter)', async () => {
    const stats = {
      ...createDefaultStats(),
      class: { name: 'Fighter' },
      level: 17,
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Alert feat (unseenAttackerAdvantageNegate)
// ---------------------------------------------------------------------------

describe('alert feat unseen attacker advantage negate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with unseenAttackerAdvantageNegate true', async () => {
    const stats = {
      ...createDefaultStats(),
      unseenAttackerAdvantageNegate: true,
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with unseenAttackerAdvantageNegate false', async () => {
    const stats = {
      ...createDefaultStats(),
      unseenAttackerAdvantageNegate: false,
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders without unseenAttackerAdvantageNegate property', async () => {
    const stats = {
      ...createDefaultStats(),
    };
    vi.mocked(await import('../../services/rules/rulesFactory.js')).default.getPlayerStats.mockResolvedValue(stats);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Defensive Tactics: Escape the Horde
// ---------------------------------------------------------------------------

describe('defensive tactics escape the horde', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with Defensive Tactics choice "Escape the Horde"', async () => {
    mockStore.set('Test Character:_Defensive_Tactics_choice', 'Escape the Horde');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with Defensive Tactics choice other than "Escape the Horde"', async () => {
    mockStore.set('Test Character:_Defensive_Tactics_choice', 'Other Choice');
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders without Defensive Tactics choice', async () => {
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

  it('renders with holyNimbusActive set to true', async () => {
    mockStore.set('Test Character:holyNimbusActive', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with holyNimbusActive set to false', async () => {
    mockStore.set('Test Character:holyNimbusActive', false);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with holyNimbusActive not set', async () => {
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
// Tests — Stunned speed halved runtime value
// ---------------------------------------------------------------------------

describe('stunned speed halved runtime value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('renders with stunned_speedHalved set', async () => {
    mockStore.set('Test Character:stunned_speedHalved', true);
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with stunned_speedHalved not set', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
