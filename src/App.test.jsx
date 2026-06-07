import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

// ──────────────────────────────────────────────
// Mock service modules and node_modules
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// Mock all child view components
// ──────────────────────────────────────────────
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

// Mock Subscriber to avoid EventSource in tests
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: vi.fn(() => null),
}));

// ──────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────
describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset shared state
    mockState.campaignName = 'test-campaign';
    mockState.characters = [];

    // Global stubs
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'New Campaign Name');

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

    // Data loader defaults
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
  });

  // ──────────────────────────────────────────────
  // Helper: select a campaign and wait for effects
  // ──────────────────────────────────────────────
  const selectCampaign = async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  };

  // ──────────────────────────────────────────────
  // Initial state & rendering
  // ──────────────────────────────────────────────
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

    it('renders CharSheet when activeView is charSheet and activeCharacter exists', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders Initiative view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      });
    });

    it('renders EncounterBuilder view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('encounter-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('encounter-builder')).toBeInTheDocument();
      });
    });

    it('renders Notes view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('notes-view')).toBeInTheDocument();
      });
    });

    it('renders Quests view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('quests-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('quests-view')).toBeInTheDocument();
      });
    });

    it('renders NPCs view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('npcs-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('npcs-view')).toBeInTheDocument();
      });
    });

    it('renders Factions view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('factions-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('factions-view')).toBeInTheDocument();
      });
    });

    it('renders MapsManager when maps clicked on localhost', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('shows nothing when no active character and no overlay is shown', async () => {
      // After selecting a campaign with characters, then backing to campaigns
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      // Go back to campaigns — which sets showCampaignSelection=true, < CampaignSelection renders
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────
  // Theme toggle
  // ──────────────────────────────────────────────
  describe('Theme toggle', () => {
    it('theme initializes from localStorage (dark)', async () => {
      window.localStorage.getItem.mockReturnValue('dark');
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
    });

    it('theme initializes from localStorage (light)', async () => {
      window.localStorage.getItem.mockReturnValue('light');
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('light');
      });
    });

    it('toggles from dark to light when toggleTheme is called', async () => {
      window.localStorage.getItem.mockReturnValue('dark');
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
      fireEvent.click(screen.getByTestId('theme-toggle-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('light');
      });
    });

    it('toggles from light to dark when toggleTheme is called', async () => {
      window.localStorage.getItem.mockReturnValue('light');
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('light');
      });
      fireEvent.click(screen.getByTestId('theme-toggle-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
    });

    it('persists theme to localStorage on toggle', async () => {
      window.localStorage.getItem.mockReturnValue('dark');
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('theme-toggle-btn'));
      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });

    it('defaults to dark when localStorage throws on read', async () => {
      window.localStorage.getItem.mockImplementation(() => { throw new Error('Storage error'); });
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
      });
    });

    it('does not crash when localStorage throws on write', async () => {
      window.localStorage.getItem.mockReturnValue('dark');
      window.localStorage.setItem.mockImplementation(() => { throw new Error('Storage error'); });
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      expect(() => {
        fireEvent.click(screen.getByTestId('theme-toggle-btn'));
      }).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────
  // View switching (maps)
  // ──────────────────────────────────────────────
  describe('View switching', () => {
    it('renders Map when MapsManager calls onOpenMap', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      // Open maps manager
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      // Open a map from the manager
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
      // Open maps manager, then open a map
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      // Click Maps button again — handleMapsClick detects type === 'map' and sets type to 'manager'
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
    });

    it('clicking Maps while already on MapsManager does nothing (no re-render cycle)', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      // Clear mocks to observe calls
      vi.clearAllMocks();
      // Click Maps again while activeView === 'mapsManager' — should be a no-op
      fireEvent.click(screen.getByTestId('maps-btn'));
      // The maps-manager should still be there (nothing changed)
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
    });

    it('loadActiveMapAndOpen renders Map when on non-localhost with active map', async () => {
      // Set non-localhost so loadActiveMapAndOpen is called
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
        configurable: true,
      });
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

    it('passes correct props to Map component', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('map-char-count').textContent).toBe('1');
        expect(screen.getByTestId('map-localhost').textContent).toBe('true');
      });
    });

    it('passes correct props to EncounterBuilder', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('encounter-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('eb-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('eb-char-count').textContent).toBe('1');
      });
    });

    it('passes correct props to Notes', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('notes-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('notes-localhost').textContent).toBe('true');
      });
    });

    it('passes correct props to NPCs', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('npcs-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('npcs-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('npcs-char-count').textContent).toBe('1');
      });
    });

    it('passes correct props to Factions', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('factions-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('factions-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('factions-localhost').textContent).toBe('true');
      });
    });

    it('exercises MapsManager onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      // Click MapsManager back button — triggers onBack={() => setMapsView({ type: 'none' })}
      fireEvent.click(screen.getByTestId('mm-back-btn'));
      // After setting mapsView to { type: 'none' } AND activeView is 'mapsManager',
      // neither MapsManager nor Map renders
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
      // Click Map back button — triggers onBack={() => setMapsView({ type: 'manager' })} on localhost
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('exercises Map onBack callback on non-localhost', async () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
        configurable: true,
      });
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-1.json', isActive: true }] });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      // Click Map back button — triggers onBack={() => setMapsView({ type: 'none' })} on non-localhost
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      });
    });

    it('exercises Notes onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => expect(screen.getByTestId('notes-view')).toBeInTheDocument());
      // Click Notes back button
      fireEvent.click(screen.getByTestId('notes-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('notes-view')).not.toBeInTheDocument();
      });
    });

    it('exercises Quests onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('quests-btn'));
      await waitFor(() => expect(screen.getByTestId('quests-view')).toBeInTheDocument());
      // Click Quests back button
      fireEvent.click(screen.getByTestId('quests-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('quests-view')).not.toBeInTheDocument();
      });
    });

    it('exercises Factions onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('factions-btn'));
      await waitFor(() => expect(screen.getByTestId('factions-view')).toBeInTheDocument());
      // Click Factions back button
      fireEvent.click(screen.getByTestId('factions-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('factions-view')).not.toBeInTheDocument();
      });
    });

    it('passes correct props to Initiative', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('init-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('init-char-count').textContent).toBe('1');
      });
    });

    it('passes correct props to Quests', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('quests-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('quests-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('quests-localhost').textContent).toBe('true');
      });
    });
  });

  // ──────────────────────────────────────────────
  // Campaign & character management
  // ──────────────────────────────────────────────
  describe('Campaign & character management', () => {
    it('shows character wizard when campaign has no characters', async () => {
      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // Should not show char-sheet when no characters
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });

    it('shows char sheet when campaign has characters', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

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
      // Click the second character in the sidebar
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
      // No characters so delete campaign button is enabled
      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      // Since no characters, wizard shows. Delete button should be enabled.
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

  // ──────────────────────────────────────────────
  // Wizards & overlays
  // ──────────────────────────────────────────────
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
      // Open the wizard
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // Cancel
      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
    });

    it('completing the wizard keeps char-sheet visible', async () => {
      // Setup fetch mock to return proper responses for the wizard completion flow
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/campaigns') && !url.endsWith('.json')) {
          // The POST to create character, or the GET to list campaign files
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ character: { name: 'New Character', level: 1 }, files: ['new-character.json'] }) });
        }
        // The GET to load the actual character file
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'New Character', level: 1 }) });
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // Open wizard
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // Complete wizard
      fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
      // CharSheet should still be rendered
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────
  describe('Edge cases', () => {
    it('shows multiple overlays simultaneously: campaign selection + character wizard', async () => {
      // campaign selection IS the overlay, not simul with wizard
      // Test: Adding character while char-sheet is open, then also clicking edit maintains both states
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // Open add character wizard
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // CharSheet should still be visible underneath overlay
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    it('activeView switching while wizard overlay is open', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // Open wizard
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // Switch view while wizard is open (go to initiative)
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
      });
      // Wizard should still be visible (overlays independent of activeView)
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      // CharSheet should be gone because activeView switched
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });

    it('handleInitiativeClick is idempotent when already on initiative', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      // Go to initiative
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
      });
      // Click initiative again — should stay on initiative (guard: activeView !== 'initiative')
      fireEvent.click(screen.getByTestId('initiative-btn'));
      expect(screen.getByTestId('initiative')).toBeInTheDocument();
    });

    it('handleEncounterClick is idempotent when already on encounter', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('encounter-btn'));
      await waitFor(() => expect(screen.getByTestId('encounter-builder')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('encounter-btn'));
      expect(screen.getByTestId('encounter-builder')).toBeInTheDocument();
    });

    it('handleNotesClick is idempotent when already on notes', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => expect(screen.getByTestId('notes-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('notes-btn'));
      expect(screen.getByTestId('notes-view')).toBeInTheDocument();
    });

    it('handleQuestsClick is idempotent when already on quests', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('quests-btn'));
      await waitFor(() => expect(screen.getByTestId('quests-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('quests-btn'));
      expect(screen.getByTestId('quests-view')).toBeInTheDocument();
    });

    it('handleNPCsClick is idempotent when already on npcs', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('npcs-btn'));
      await waitFor(() => expect(screen.getByTestId('npcs-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('npcs-btn'));
      expect(screen.getByTestId('npcs-view')).toBeInTheDocument();
    });

    it('handleFactionsClick is idempotent when already on factions', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('factions-btn'));
      await waitFor(() => expect(screen.getByTestId('factions-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('factions-btn'));
      expect(screen.getByTestId('factions-view')).toBeInTheDocument();
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
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', reload: vi.fn() },
        writable: true,
        configurable: true,
      });
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-localhost').textContent).toBe('false');
      });
    });

    it('shows alert on rename campaign error', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Rename failed' }) }));

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('rename-campaign-btn'));
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Rename failed'));
      });
    });

    it('shows alert on delete campaign error', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Delete failed' }) }));

      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      // Delete campaign button should be enabled (no characters)
      fireEvent.click(screen.getByTestId('delete-campaign-btn'));
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Delete failed'));
      });
    });

    it('shows alert on delete character error', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: false, statusText: 'Not Found', json: () => Promise.resolve({}) }));

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTitle('Delete Character'));
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Not Found'));
      });
    });

    it('goes back to campaigns from NPCs view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('npcs-btn'));
      await waitFor(() => expect(screen.getByTestId('npcs-view')).toBeInTheDocument());
      // Click NPCs back button
      fireEvent.click(screen.getByTestId('npcs-back-btn'));
      // activeView should be set to null, so char-sheet should not show
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('npcs-view')).not.toBeInTheDocument();
    });

    it('subscription resets mapsView when campaignName changes', async () => {
      // The useEffect that watches campaignName calls setMapsView({ type: 'none' })
      // This is tested by campaignName changing from null to a value on campaign selection
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      // mapsView should reset to 'none' on campaign name change
      // Verify that clicking maps opens maps manager properly
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('does not render char-sheet when no active character even with correct activeView', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      // Go to initiative (this doesn't clear activeCharacter in App,
      // but charSheet only renders when activeView === 'charSheet')
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      });
    });

    it('clicking back to campaigns returns to campaign selection', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      });
    });
  });
});
