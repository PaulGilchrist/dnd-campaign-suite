// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

vi.mock('./services/ui/dataLoader.js', async () => {
  const { dataLoaderMocks } = await import('./test/appTestState.js');
  return dataLoaderMocks;
});

vi.mock('./services/ui/utils.js', () => ({
  default: { getName: vi.fn((name) => name || '') },
}));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('./services/maps/mapsService.js', () => ({
  loadMaps: vi.fn(),
}));

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return { default: MockCharSheet };
});
vi.mock('./components/initiative/initiative.jsx', async () => {
  const { MockInitiative } = await import('./test/mockComponents.jsx');
  return { default: MockInitiative };
});
vi.mock('./components/campaign-selection/CampaignSelection.jsx', async () => {
  const { MockCampaignSelection } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignSelection };
});
vi.mock('./components/character-creation/CharacterCreationWizard.jsx', async () => {
  const { MockWizard } = await import('./test/mockComponents.jsx');
  return { default: MockWizard };
});
vi.mock('./components/sidebar/Sidebar.jsx', async () => {
  const { MockSidebar } = await import('./test/mockComponents.jsx');
  return { default: MockSidebar };
});
vi.mock('./components/maps-manager/MapsManager.jsx', async () => {
  const { MockMapsManager } = await import('./test/mockComponents.jsx');
  return { default: MockMapsManager };
});
vi.mock('./components/map/Map.jsx', async () => {
  const { MockMap } = await import('./test/mockComponents.jsx');
  return { default: MockMap };
});
vi.mock('./components/encounter/EncounterBuilder.jsx', async () => {
  const { MockEncounterBuilder } = await import('./test/mockComponents.jsx');
  return { default: MockEncounterBuilder };
});
vi.mock('./components/notes/Notes.jsx', async () => {
  const { MockNotes } = await import('./test/mockComponents.jsx');
  return { default: MockNotes };
});
vi.mock('./components/quests/Quests.jsx', async () => {
  const { MockQuests } = await import('./test/mockComponents.jsx');
  return { default: MockQuests };
});
vi.mock('./components/npcs/NPCs.jsx', async () => {
  const { MockNPCs } = await import('./test/mockComponents.jsx');
  return { default: MockNPCs };
});
vi.mock('./components/factions/Factions.jsx', async () => {
  const { MockFactions } = await import('./test/mockComponents.jsx');
  return { default: MockFactions };
});

vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

vi.mock('./components/settlements/Settlements.jsx', async () => {
  const { MockSettlements } = await import('./test/mockComponents.jsx');
  return { default: MockSettlements };
});

vi.mock('./components/log/Log.jsx', async () => {
  const { MockLog } = await import('./test/mockComponents.jsx');
  return { default: MockLog };
});

const originalLocation = window.location;

describe('App', () => {
  const defaultFetch = () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  beforeEach(() => {
    vi.clearAllMocks();

    mockState.campaignName = 'test-campaign';
    mockState.characters = [];

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'New Campaign Name');

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn(defaultFetch);

    dataLoaderMocks.loadAbilityScores.mockResolvedValue([{ full_name: 'Strength' }]);
    dataLoaderMocks.loadClassData.mockImplementation((v) =>
      Promise.resolve(v === '2024' ? [{ name: 'Fighter 2024' }] : [{ name: 'Fighter' }]),
    );
    dataLoaderMocks.loadEquipment.mockResolvedValue([{ name: 'Longsword' }]);
    dataLoaderMocks.loadMagicItems.mockImplementation((v) =>
      Promise.resolve(v === '2024' ? [{ name: 'Wand 2024' }] : [{ name: 'Wand' }]),
    );
    dataLoaderMocks.loadRaceData.mockImplementation((v) =>
      Promise.resolve(v === '2024' ? [{ name: 'Human 2024' }] : [{ name: 'Human' }]),
    );
    dataLoaderMocks.loadSpells.mockImplementation((v) =>
      Promise.resolve(v === '2024' ? [{ name: 'Fireball 2024' }] : [{ name: 'Fireball' }]),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  const selectCampaign = async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  };

  const setNonLocalhost = () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  };

  describe('Initial state & rendering', () => {
    it('renders campaign selection initially', async () => {
      render(<App />);
      expect(await screen.findByTestId('campaign-selection')).toBeInTheDocument();
    });

    it.each([
      { characters: [{ name: 'Aragorn', level: 1 }], expectedView: 'char-sheet', expectedName: 'Aragorn' },
      { characters: [], expectedView: 'character-wizard', expectedName: null },
    ])('renders $expectedView when campaign has $characters.length characters', async ({ characters, expectedView, expectedName }) => {
      mockState.characters = characters;
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId(expectedView)).toBeInTheDocument();
      });
      if (expectedName) {
        expect(screen.getByTestId('character-name').textContent).toBe(expectedName);
      } else {
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      }
    });
  });

  describe('Theme toggle', () => {
    const renderWithTheme = async (initialTheme) => {
      const localStorageMock = window.localStorage;
      const origGetItem = localStorageMock.getItem;

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'theme') return initialTheme;
        return origGetItem(key);
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe(initialTheme);
      });

      return { toggleBtn: screen.getByTestId('theme-toggle-btn'), localStorageMock };
    };

    it('toggles theme and persists to localStorage', async () => {
      const { toggleBtn, localStorageMock } = await renderWithTheme('dark');
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('light');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    });
  });

  describe('View switching', () => {
    it('renders Map when MapsManager calls onOpenMap', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
    });

    it('navigates back from Map to MapsManager when maps button clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
    });

    it('loadActiveMapAndOpen renders Map when on non-localhost with active map', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-1.json', isActive: true }] });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });
      expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
    });

    it('shows alert when on non-localhost and no active map found', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-1.json', isActive: false }] });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('No map is currently active. Ask your Game Master to activate one.');
      });
    });

    it('shows alert when loadMaps fails on non-localhost', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockRejectedValue(new Error('Network error'));

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to load map data.');
      });
    });
  });

  describe('Campaign & character management', () => {
    it('switches active character when character button clicked in sidebar', async () => {
      mockState.characters = [
        { name: 'Aragorn', level: 1 },
        { name: 'Legolas', level: 2 },
      ];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('character-name').textContent).toBe('Aragorn');
      });
      fireEvent.click(screen.getByTestId('char-btn-Legolas'));
      await waitFor(() => {
        expect(screen.getByTestId('character-name').textContent).toBe('Legolas');
      });
    });
  });

  describe('Edge cases', () => {
    it.each([
      { isLocalhost: true, expectedButton: 'Maps', expectedSidebar: 'true' },
      { isLocalhost: false, expectedButton: 'Map', expectedSidebar: 'false' },
    ])('sidebar displays correct map button text and localhost flag (%s)', async ({ isLocalhost, expectedButton, expectedSidebar }) => {
      if (!isLocalhost) setNonLocalhost();
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('maps-btn')).toHaveTextContent(expectedButton);
      expect(screen.getByTestId('sidebar-localhost').textContent).toBe(expectedSidebar);
    });
  });
});
