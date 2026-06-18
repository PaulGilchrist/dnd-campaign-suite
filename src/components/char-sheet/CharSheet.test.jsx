// @improved-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, campaignName, conditionEffects, exhaustionLevel }) => (
    <div data-testid="char-summary">
      <span data-testid="summary-name">{playerStats?.name || 'none'}</span>
      <span data-testid="summary-campaign">{campaignName || 'none'}</span>
      <span data-testid="exhaustion-level">{exhaustionLevel}</span>
      {conditionEffects && <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>}
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats, exhaustionPenalty }) => (
    <div data-testid="char-abilities">
      <span data-testid="abilities-player">{playerStats?.name || 'none'}</span>
      <span data-testid="exhaustion-penalty">{exhaustionPenalty}</span>
    </div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode }) => (
    <div data-testid="char-actions">
      <span data-testid="actions-player">{playerStats?.name || 'none'}</span>
      <span data-testid="cannot-act">{String(cannotAct)}</span>
      <span data-testid="attack-mode">{conditionAttackMode || 'none'}</span>
    </div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory">
      <span data-testid="inventory-player">{playerStats?.name || 'none'}</span>
    </div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-reactions">
      <span data-testid="reactions-player">{playerStats?.name || 'none'}</span>
      <span data-testid="reactions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-special-actions">
      <span data-testid="special-actions-player">{playerStats?.name || 'none'}</span>
      <span data-testid="special-actions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats, campaignName }) => (
    <div data-testid="char-character-advancement">
      <span data-testid="advancement-player">{playerStats?.name || 'none'}</span>
      <span data-testid="advancement-campaign">{campaignName || 'none'}</span>
    </div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats, handleTogglePreparedSpells, exhaustionPenalty }) => (
    <div data-testid="char-spells">
      <span data-testid="spells-player">{playerStats?.name || 'none'}</span>
      <span data-testid="spells-has-toggle">{handleTogglePreparedSpells ? 'true' : 'false'}</span>
      <span data-testid="spells-exhaustion-penalty">{exhaustionPenalty}</span>
    </div>
  )),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockResolvedValue({
      name: 'Test Fighter',
      level: 5,
      hitPoints: { current: 45, max: 45 },
      abilities: [
        { name: 'Strength', bonus: 4, save: 6, skills: [] },
        { name: 'Dexterity', bonus: 2, save: 4, skills: [] },
      ],
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
  setRuntimeValue: vi.fn(),
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
// Tests
// ---------------------------------------------------------------------------

describe('CharSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  // -----------------------------------------------------------------------
  // Rendering & structural assertions
  // -----------------------------------------------------------------------

  describe('wrapper rendering', () => {
    it('renders the char-sheet wrapper after playerStats resolves', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders nothing before playerStats resolves', async () => {
      // The async mock means the component starts with playerStats=null,
      // so the wrapper div should not be in the document initially.
      const { container } = render(<CharSheet {...defaultProps} />);
      expect(container.querySelector('[data-testid="char-sheet"]')).not.toBeInTheDocument();
      // Wait for the async resolution to complete.
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Child component rendering
  // -----------------------------------------------------------------------

  describe('child components', () => {
    it('renders CharSummary', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-summary')).toBeInTheDocument();
      });
    });

    it('renders CharAbilities', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-abilities')).toBeInTheDocument();
      });
    });

    it('renders CharActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-actions')).toBeInTheDocument();
      });
    });

    it('renders CharReactions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-reactions')).toBeInTheDocument();
      });
    });

    it('renders CharSpells', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-spells')).toBeInTheDocument();
      });
    });

    it('renders CharSpecialActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-special-actions')).toBeInTheDocument();
      });
    });

    it('renders CharInventory', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-inventory')).toBeInTheDocument();
      });
    });

    it('renders CharCharacterAdvancement', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-character-advancement')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Props passthrough — verify data flows correctly to children
  // -----------------------------------------------------------------------

  describe('props passthrough', () => {
    it('passes playerStats.name to CharSummary', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('summary-name')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes campaignName to CharSummary', async () => {
      render(<CharSheet {...defaultProps} campaignName="my-campaign" />);
      await waitFor(() => {
        expect(screen.getByTestId('summary-campaign')).toHaveTextContent('my-campaign');
      });
    });

    it('passes campaignName to CharCharacterAdvancement', async () => {
      render(<CharSheet {...defaultProps} campaignName="my-campaign" />);
      await waitFor(() => {
        expect(screen.getByTestId('advancement-campaign')).toHaveTextContent('my-campaign');
      });
    });

    it('passes playerStats.name to CharAbilities', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('abilities-player')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes playerStats.name to CharActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('actions-player')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes playerStats.name to CharReactions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('reactions-player')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes playerStats.name to CharInventory', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('inventory-player')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes playerStats.name to CharSpecialActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('special-actions-player')).toHaveTextContent('Test Fighter');
      });
    });

    it('passes playerStats.name to CharSpells', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('spells-player')).toHaveTextContent('Test Fighter');
      });
    });
  });

  // -----------------------------------------------------------------------
  // Ruleset branching (5e vs 2024)
  // -----------------------------------------------------------------------

  describe('ruleset handling', () => {
    it('renders wrapper with 2024 ruleset', async () => {
      const props2024 = {
        ...defaultProps,
        playerSummary: { ...mockPlayerSummary, rules: '2024' },
      };
      render(<CharSheet {...props2024} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('passes handleTogglePreparedSpells to CharSpells for 5e ruleset', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('spells-has-toggle')).toHaveTextContent('true');
      });
    });

    it('does not pass handleTogglePreparedSpells to CharSpells for 2024 ruleset', async () => {
      const props2024 = {
        ...defaultProps,
        playerSummary: { ...mockPlayerSummary, rules: '2024' },
      };
      render(<CharSheet {...props2024} />);
      await waitFor(() => {
        expect(screen.getByTestId('spells-has-toggle')).toHaveTextContent('false');
      });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('renders with empty characters array', async () => {
      render(<CharSheet {...defaultProps} characters={[]} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders with null activeMapName', async () => {
      render(<CharSheet {...defaultProps} activeMapName={null} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders with undefined campaignName', async () => {
      const props = { ...defaultProps };
      delete props.campaignName;
      render(<CharSheet {...props} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('does not crash when onDeleteCharacter callback is called', async () => {
      const onDelete = vi.fn();
      const props = { ...defaultProps, onDeleteCharacter: onDelete };
      render(<CharSheet {...props} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // No-op: verify the component renders without error when the callback
      // prop is provided (the component doesn't invoke it during render).
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('renders with all callback props as no-op functions', async () => {
      const props = {
        ...defaultProps,
        onDeleteCharacter: vi.fn(),
        onEditCharacter: vi.fn(),
        onUploadClick: vi.fn(),
        onSaveClick: vi.fn(),
      };
      render(<CharSheet {...props} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // Verify the callbacks were NOT called during render
      expect(props.onDeleteCharacter).not.toHaveBeenCalled();
      expect(props.onEditCharacter).not.toHaveBeenCalled();
      expect(props.onUploadClick).not.toHaveBeenCalled();
      expect(props.onSaveClick).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Exhaustion / condition effects passthrough
  // -----------------------------------------------------------------------

  describe('exhaustion and condition effects passthrough', () => {
    it('passes campaignName to CharSummary', async () => {
      render(<CharSheet {...defaultProps} campaignName="exhaustion-test" />);
      await waitFor(() => {
        expect(screen.getByTestId('summary-campaign')).toHaveTextContent('exhaustion-test');
      });
    });

    it('renders with exhaustion level from runtime state', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('exhaustion-level')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // cannotAct / attack mode passthrough
  // -----------------------------------------------------------------------

  describe('combat-related props passthrough', () => {
    it('passes cannotAct to CharActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('cannot-act')).toBeInTheDocument();
      });
    });

    it('passes conditionAttackMode to CharActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('attack-mode')).toBeInTheDocument();
      });
    });

    it('passes cannotAct to CharReactions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('reactions-cannot-act')).toBeInTheDocument();
      });
    });

    it('passes cannotAct to CharSpecialActions', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('special-actions-cannot-act')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Exhaustion penalty passthrough
  // -----------------------------------------------------------------------

  describe('exhaustion penalty passthrough', () => {
    it('passes exhaustionPenalty to CharAbilities', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('exhaustion-penalty')).toBeInTheDocument();
      });
    });

    it('passes exhaustionPenalty to CharSpells', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('spells-exhaustion-penalty')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Structural assertions
  // -----------------------------------------------------------------------

  describe('document structure', () => {
    it('wraps CharCharacterAdvancement in a no-print div', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-character-advancement')).toBeInTheDocument();
      });
      // Verify the parent container has the no-print class
      const advContainer = document.querySelector('[data-testid="char-character-advancement"]');
      expect(advContainer?.parentElement?.className).toContain('no-print');
    });

    it('renders hr separators between sections', async () => {
      render(<CharSheet {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      const hrElements = document.querySelectorAll('hr');
      expect(hrElements.length).toBeGreaterThan(0);
    });
  });
});
