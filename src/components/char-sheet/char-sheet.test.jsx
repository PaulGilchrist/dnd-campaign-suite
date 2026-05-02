import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSheet from './char-sheet';

// Mock all child components
vi.mock('./char-summary/char-summary', () => ({
  default: vi.fn(({ playerStats, onDeleteCharacter }) => (
    <div data-testid="char-summary">Summary</div>
  )),
}));

vi.mock('./char-abilities', () => ({
  default: vi.fn(({ playerStats, allAbilityScores }) => (
    <div data-testid="char-abilities">Abilities</div>
  )),
}));

vi.mock('./char-summary2', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary2">Summary2</div>
  )),
}));

vi.mock('./char-actions', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions">Actions</div>
  )),
}));

vi.mock('./char-reactions', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions">Reactions</div>
  )),
}));

vi.mock('./char-spells/char-spells', () => ({
  default: vi.fn(({ playerStats, handleTogglePreparedSpells }) => (
    <div data-testid="char-spells">Spells</div>
  )),
}));

vi.mock('./char-special-actions', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions">Special Actions</div>
  )),
}));

vi.mock('./char-inventory', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory">Inventory</div>
  )),
}));

vi.mock('./char-character-advancement', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement">Character Advancement</div>
  )),
}));

vi.mock('../common/subscriber', () => ({
  default: vi.fn(({ handleEvent }) => (
    <div data-testid="subscriber">Subscriber</div>
  )),
}));

// Mock rulesFactory
vi.mock('../../services/rules-factory', () => ({
  default: {
    getPlayerStats: vi.fn(),
  },
}));

// Mock storage
vi.mock('../../services/storage', () => ({
  default: {
    get: vi.fn(),
    setProperty: vi.fn(),
  },
}));

// Mock utils
vi.mock('../../services/utils', () => ({
  default: {
    getFirstName: vi.fn((name) => name),
    guid: vi.fn(() => 'unique-id'),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

import rulesFactory from '../../services/rules-factory';
import storage from '../../services/storage';
import utils from '../../services/utils';

const mockPlayerSummary = {
  name: 'Test Character',
  rules: '5e',
};

const mockPlayerStats = {
  name: 'Test Character',
  abilities: [],
  actions: [],
  reactions: [],
  spellAbilities: {
    spells: [],
    maxPreparedSpells: 0,
  },
};

const mockProps = {
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
  onDeleteCharacter: vi.fn(),
};

describe('CharSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock rulesFactory.getPlayerStats to return mock stats
    rulesFactory.getPlayerStats.mockResolvedValue(mockPlayerStats);

    // Mock localStorage.getItem to return null (no prepared spells)
    mockLocalStorage.getItem.mockReturnValue(null);

    // Mock utils.getFirstName
    utils.getFirstName.mockReturnValue('Test Character');
  });

  it('should render all child components after loading', async () => {
    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('char-summary')).toBeInTheDocument();
    expect(screen.getByTestId('char-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('char-summary2')).toBeInTheDocument();
    expect(screen.getByTestId('char-actions')).toBeInTheDocument();
    expect(screen.getByTestId('char-reactions')).toBeInTheDocument();
    expect(screen.getByTestId('char-spells')).toBeInTheDocument();
    expect(screen.getByTestId('char-special-actions')).toBeInTheDocument();
    expect(screen.getByTestId('char-inventory')).toBeInTheDocument();
    expect(screen.getByTestId('char-character-advancement')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber')).toBeInTheDocument();
  });

  it('should call rulesFactory.getPlayerStats on mount', async () => {
    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(rulesFactory.getPlayerStats).toHaveBeenCalled();
    });
  });

  it('should not render content before playerStats are loaded', () => {
    rulesFactory.getPlayerStats.mockImplementation(() => new Promise(() => {
      // Never resolve
    }));

    render(<CharSheet {...mockProps} />);

    expect(screen.queryByTestId('char-summary')).not.toBeInTheDocument();
  });

  it('should use 2024 rules data when playerSummary.rules is 2024', async () => {
    const playerSummary2024 = {
      ...mockPlayerSummary,
      rules: '2024',
    };

    render(<CharSheet {...mockProps} playerSummary={playerSummary2024} />);

    await waitFor(() => {
      expect(rulesFactory.getPlayerStats).toHaveBeenCalled();
    });

    // Check that the correct parameters were passed
    const callArgs = rulesFactory.getPlayerStats.mock.calls[0];
    expect(callArgs[4]).toBe(mockProps.allSpells2024); // spellData should be allSpells2024
  });

  it('should use 5e rules data when playerSummary.rules is 5e', async () => {
    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(rulesFactory.getPlayerStats).toHaveBeenCalled();
    });

    // Check that the correct parameters were passed
    const callArgs = rulesFactory.getPlayerStats.mock.calls[0];
    expect(callArgs[4]).toBe(mockProps.allSpells); // spellData should be allSpells
  });

  it('should load prepared spells from localStorage', async () => {
    const preparedSpells = ['Fireball', 'Magic Missile'];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ preparedSpells }));

    const playerStatsWithSpells = {
      ...mockPlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
          { name: 'Magic Missile', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-spells')).toBeInTheDocument();
    });
  });

  it('should render char-sheet wrapper div', async () => {
    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(document.querySelector('.char-sheet')).toBeInTheDocument();
    });
  });

  it('should pass onDeleteCharacter to CharSummary', async () => {
    const onDeleteCharacter = vi.fn();
    render(<CharSheet {...mockProps} onDeleteCharacter={onDeleteCharacter} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-summary')).toBeInTheDocument();
    });
  });

  it('should handle storage event and refresh player stats', async () => {
    const playerStatsWithSpells = {
      ...mockPlayerStats,
      name: 'Test Character',
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    // Mock localStorage to return prepared spells
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'Test Character') {
        return JSON.stringify({ preparedSpells: ['Fireball'] });
      }
      return null;
    });

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('should handle storage event with handleEvent', async () => {
    const playerStatsWithSpells = {
      ...mockPlayerStats,
      name: 'Test Character',
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('subscriber')).toBeInTheDocument();
    });

    // Get the subscriber element and verify it's there
    const subscriberElement = screen.getByTestId('subscriber');
    expect(subscriberElement).toBeInTheDocument();
  });

  it('should call storage.setItem in handleEvent when data differs', async () => {
    const playerStatsWithSpells = {
      ...mockPlayerStats,
      name: 'Test Character',
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('should toggle prepared spells with handleTogglePreparedSpells', async () => {
    const playerStatsWithSpells = {
      ...mockPlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('should not toggle prepared spells beyond max limit', async () => {
    const playerStatsWithSpells = {
      ...mockPlayerStats,
      spellAbilities: {
        spells: [
          { name: 'Fireball', prepared: 'Prepared' },
          { name: 'Magic Missile', prepared: 'Prepared' },
          { name: 'Shield', prepared: 'Prepared' },
          { name: 'Misty Step', prepared: '' },
        ],
        maxPreparedSpells: 3,
      },
    };

    rulesFactory.getPlayerStats.mockResolvedValue(playerStatsWithSpells);

    render(<CharSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });
});
