import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all child components before importing CharSheet
vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, campaignName }) => (
    <div data-testid="char-summary">
      <span data-testid="summary-name">{playerStats?.name || 'none'}</span>
      <span data-testid="summary-campaign">{campaignName || 'none'}</span>
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-abilities">CharAbilities</div>),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-actions">CharActions</div>),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-inventory">CharInventory</div>),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-reactions">CharReactions</div>),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-special-actions">CharSpecialActions</div>),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-character-advancement">CharCharacterAdvancement</div>),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-spells">CharSpells</div>),
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
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

// Now import CharSheet after all mocks are set up
import CharSheet from './CharSheet';

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

describe('CharSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders char-sheet wrapper when playerStats loads', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders CharSummary component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-summary')).toBeInTheDocument();
    });
  });

  it('renders CharAbilities component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-abilities')).toBeInTheDocument();
    });
  });

  it('renders CharActions component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-actions')).toBeInTheDocument();
    });
  });

  it('renders CharReactions component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-reactions')).toBeInTheDocument();
    });
  });

  it('renders CharSpells component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-spells')).toBeInTheDocument();
    });
  });

  it('renders CharSpecialActions component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-special-actions')).toBeInTheDocument();
    });
  });

  it('renders CharInventory component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-inventory')).toBeInTheDocument();
    });
  });

  it('renders CharCharacterAdvancement component', async () => {
    render(<CharSheet {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-character-advancement')).toBeInTheDocument();
    });
  });

  it('renders with 2024 ruleset', async () => {
    const props2024 = {
      ...defaultProps,
      playerSummary: { ...mockPlayerSummary, rules: '2024' },
    };
    render(<CharSheet {...props2024} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('renders with empty characters array', async () => {
    render(<CharSheet {...defaultProps} characters={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('passes campaignName to child components', async () => {
    render(<CharSheet {...defaultProps} campaignName="my-campaign" />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
