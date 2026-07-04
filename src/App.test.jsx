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

    it('hides campaign selection after selecting campaign', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });

    it('renders CharSheet when campaign has characters', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders character wizard when campaign has no characters', async () => {
      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });

    it('shows campaign selection when navigating back from a view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
      });
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

    it('initializes from localStorage as dark and toggles to light', async () => {
      const { toggleBtn, localStorageMock } = await renderWithTheme('dark');
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('light');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    });

    it('initializes from localStorage as light and toggles to dark', async () => {
      const { toggleBtn, localStorageMock } = await renderWithTheme('light');
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('defaults to dark when localStorage throws on read', async () => {
      const localStorageMock = window.localStorage;
      localStorageMock.getItem.mockImplementation(() => { throw new Error('Storage error'); });
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
    });

    it('does not crash when localStorage throws on write', async () => {
      const { toggleBtn } = await renderWithTheme('dark');
      const localStorageMock = window.localStorage;
      localStorageMock.setItem.mockImplementation(() => { throw new Error('Storage error'); });
      expect(() => {
        fireEvent.click(toggleBtn);
      }).not.toThrow();
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

    it('exercises MapsManager onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('mm-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
    });

    it('exercises Map onBack callback on localhost', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('exercises Map onBack callback on non-localhost', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-1.json', isActive: true }] });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
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

    it('handles campaign rename callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('rename-campaign-btn'));
      await waitFor(() => {
        expect(window.prompt).toHaveBeenCalled();
      });
    });

    it('handles delete campaign callback', async () => {
      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('delete-campaign-btn'));
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
      });
    });

    it('handles delete character from CharSheet', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTitle('Delete Character'));
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
      });
    });

    it('handles upload click', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByText(/Upload/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Upload/));
    });

    it('handles download click', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByText(/Download/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Download/));
    });
  });

  describe('Wizards & overlays', () => {
    it('shows character wizard when Add Character clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
    });

    it('shows edit wizard when Edit clicked on CharSheet', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByText(/Edit/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Edit/));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
        expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
        expect(screen.getByTestId('editing-character').textContent).toBe('Aragorn');
      });
    });

    it('hides wizard when wizard cancel is clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
    });

    it('completing the wizard keeps char-sheet visible', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/campaigns') && !url.endsWith('.json')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ character: { name: 'New Character', level: 1 }, files: ['new-character.json'] }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'New Character', level: 1 }) });
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  describe('Idempotent view navigation', () => {
    const viewTests = [
      { btnId: 'initiative-btn', viewId: 'initiative', label: 'initiative' },
      { btnId: 'encounter-btn', viewId: 'encounter-builder', label: 'encounter' },
      { btnId: 'notes-btn', viewId: 'notes-view', label: 'notes' },
      { btnId: 'quests-btn', viewId: 'quests-view', label: 'quests' },
      { btnId: 'npcs-btn', viewId: 'npcs-view', label: 'npcs' },
      { btnId: 'factions-btn', viewId: 'factions-view', label: 'factions' },
    ];

    it.each(viewTests)('handle$label Click is idempotent when already on $label', async ({ btnId, viewId }) => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId(btnId));
      await waitFor(() => expect(screen.getByTestId(viewId)).toBeInTheDocument());
      fireEvent.click(screen.getByTestId(btnId));
      expect(screen.getByTestId(viewId)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('shows multiple overlays simultaneously: wizard over char-sheet', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    it('sidebar receives isLocalhost=true on localhost', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-localhost').textContent).toBe('true');
      });
    });

    it('sidebar receives isLocalhost=false on non-localhost', async () => {
      setNonLocalhost();
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-localhost').textContent).toBe('false');
      });
    });

    it('shows MapsManager button text as Map on non-localhost', async () => {
      setNonLocalhost();
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('maps-btn')).toHaveTextContent('Map');
    });

    it('shows MapsManager button text as Maps on localhost', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('maps-btn')).toHaveTextContent('Maps');
    });

    it('does not render char-sheet when activeView is not charSheet', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      });
    });
  });
});
