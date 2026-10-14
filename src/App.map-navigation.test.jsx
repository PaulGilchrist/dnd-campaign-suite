// @improved-by-ai
/**
 * App-level contract for map view navigation (App.jsx):
 *
 * GM (localhost):
 *  - "Maps" from any other view opens the maps manager listing.
 *  - The manager opens a map; both the map's back button and the "Maps"
 *    sidebar button return the GM to the manager listing.
 *  - Entering a map from a POI/encounter pushes it onto a navigation stack:
 *    back walks the stack (inner map → original map → manager), and returning
 *    to the manager via "Maps" clears the stack so a fresh open starts clean.
 *  - The manager's back button closes the maps area entirely (blank canvas).
 *
 * Player (non-localhost):
 *  - "Maps" never shows the manager — it resolves the active map via
 *    loadMaps and opens it directly.
 *  - Back from a map lands on the waiting placeholder, never the manager.
 *  - With no active map, a friendly placeholder is shown (never an alert);
 *    clicking "Maps" again re-runs the load and opens the map once the GM
 *    has activated one. A failed load keeps the placeholder quietly.
 *
 * Waiting-placeholder rendering, "Check Again", and map-activate SSE
 * auto-open are covered by App.map-unavailable.test.jsx and
 * App.map-activate.test.jsx — not re-tested here.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';
import { loadMaps } from './services/maps/mapsService.js';

// --- Core mocks (shared with other App test files) ---

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

vi.mock('./services/ui/storage.js', () => ({
  __esModule: true,
  default: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('./services/encounters/combatData.js', async () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
  setCombatSummaryCache: vi.fn(),
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('./hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
  seedTrackedResources: vi.fn(),
  getStore: vi.fn(() => new Map()),
  notify: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// Shared mutable container so the hoisted vi.mock can read the
// current app data shape without capturing a stale reference.
const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

const defaultAppData = () => ({
  abilityScores: [{ full_name: 'Strength' }],
  classes: [{ name: 'Fighter' }],
  classes2024: [{ name: 'Fighter 2024' }],
  equipment: [{ name: 'Longsword' }],
  magicItems: [{ name: 'Wand' }],
  monsters: [],
  races: [{ name: 'Human' }],
  races2024: [{ name: 'Human 2024' }],
  spells: [{ name: 'Fireball' }],
  spells2024: [{ name: 'Fireball 2024' }],
  isLoading: false,
});

// --- Component mocks ---

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return { default: MockCharSheet };
});
vi.mock('./components/initiative/Initiative.jsx', async () => {
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
vi.mock('./components/settlements/Settlements.jsx', async () => {
  const { MockSettlements } = await import('./test/mockComponents.jsx');
  return { default: MockSettlements };
});
vi.mock('./components/log/Log.jsx', async () => {
  const { MockLog } = await import('./test/mockComponents.jsx');
  return { default: MockLog };
});
vi.mock('./components/campaign-admin/CampaignAdmin.jsx', async () => {
  const { MockCampaignAdmin } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignAdmin };
});

// Stub the SSE subscriber so tests never open a real EventSource.
// Events are only pushed by tests that need them (see map-activate suite).
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

// --- Helpers ---

function setLocalhost(hostname) {
  Object.defineProperty(window, 'location', {
    value: { hostname, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

// Let pending microtasks/effects settle (e.g. document.title updates).
async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Click through the campaign selection screen into the app shell.
async function selectCampaign() {
  await waitFor(() => {
    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
  });
  await waitFor(() => {
    expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
  });
  await flushEffects();
}

// Render the app with one character and land on the character sheet.
async function renderInCampaign(hostname = 'localhost') {
  setLocalhost(hostname);
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  render(<App />);
  await selectCampaign();
  expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
}

function clickMaps() {
  fireEvent.click(screen.getByTestId('maps-btn'));
}

// --- Test suite ---

describe('App - Map Navigation & View Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    _appDataRef.value = defaultAppData();

    mockState.campaignName = 'test-campaign';
    mockState.characters = [];

    // Quiet, observable failure channel — map flows must never alert the user.
    window.alert = vi.fn();

    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    // Default: campaign exists with no maps. Individual tests activate maps.
    // (vi.clearAllMocks does NOT reset implementations, so re-arm here.)
    loadMaps.mockResolvedValue({ maps: [] });

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
    setLocalhost('localhost');
  });

  describe('GM (localhost) navigation', () => {
    beforeEach(async () => {
      await renderInCampaign('localhost');
    });

    it('opens the maps manager, and the manager opens a map', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
    });

    it('map back button returns the GM to the manager listing', async () => {
      clickMaps();
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('Maps sidebar button acts as back from a map to the manager listing', async () => {
      clickMaps();
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      clickMaps();
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('does nothing when Maps is clicked while the manager listing is already open', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      clickMaps();
      await flushEffects();
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    });

    it('manager back button closes the maps area entirely', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mm-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      });
      // localhost never sees the player waiting placeholder; the shell stays intact
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('backs through the POI map history stack: inner map, original map, manager', async () => {
      clickMaps();
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });

      // Entering a POI opens the inner map with the original on the stack
      fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('inner-cave');
      });

      // First back pops the stack: original map, not the manager
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });

      // Stack is now empty: back exits to the manager listing
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
    });

    it('clears the POI history when Maps returns to the manager', async () => {
      clickMaps();
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('inner-cave');
      });

      // "Maps" exits the stack to the manager — history must not survive
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      // Fresh open starts a fresh stack: back goes straight to the manager
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
    });
  });

  describe('Player (non-localhost) navigation', () => {
    it('opens the active map directly, skipping the manager listing', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');

      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
    });

    it('does nothing when Maps is clicked while a map is already open', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });

      const loadCallsBefore = loadMaps.mock.calls.length;
      clickMaps();
      await flushEffects();

      // Still on the same map — no reload, no detour to the manager
      expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
      expect(loadMaps.mock.calls.length).toBe(loadCallsBefore);
    });

    it('back from a map lands on the waiting placeholder, never the manager', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('waits quietly with no active map, then opens the map on a second Maps click once the GM activates it', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: false }],
      });
      await renderInCampaign('example.com');

      // First click: no active map → friendly placeholder, never an alert
      clickMaps();
      await waitFor(() => {
        expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
        expect(screen.getByText('Check Again')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();

      // GM activates the map — a second Maps click must re-run the load
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    });

    it('keeps the waiting placeholder without an alert when the maps load fails', async () => {
      loadMaps.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderInCampaign('example.com');

      clickMaps();
      await waitFor(() => {
        expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();
      // Failure is logged, not silently swallowed
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
