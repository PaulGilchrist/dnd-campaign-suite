// @maintained-by-ai
/**
 * App-level contract for map view navigation (App.jsx → handleMapsClick /
 * handleEnterMap / handleBackFromMap):
 *
 * GM (localhost):
 *  - "Maps" from the character sheet opens the maps manager listing; the
 *    manager opens a map; the map's back button returns to the listing,
 *    which stays open until another sidebar view replaces it (the manager
 *    has no Back button — the sidebar is the exit).
 *  - Entering a POI pushes the current map onto a navigation stack: back
 *    walks the stack (inner map → original map → manager).
 *  - Clicking "Maps" while viewing a map exits the stack to the manager and
 *    clears the stack (re-clicking the manager listing is a no-op), so a
 *    fresh open starts on a clean stack.
 *  - Clicking "Maps" from ANOTHER view while a map is still open (left open
 *    before navigating away) navigates on the FIRST click — the click must
 *    re-arm activeView too, not just the mapsView sub-state.
 *
 * Player (non-localhost):
 *  - "Maps" never shows the manager — it resolves the active map via
 *    loadMaps and opens it directly; re-clicking it while a map is open
 *    triggers no reload.
 *  - Leaving to another view (Log) and back re-mounts the map view and
 *    re-resolves the active map (a GM activation while away is honored).
 *  - Back from a map with an EMPTY stack no longer strands the player on the
 *    waiting placeholder while a map is active — the Back-transition self-
 *    heal seed re-opens the active map with zero clicks (backlog 2026-11-05
 *    CV); the placeholder-only face (no active map) is covered in
 *    App.map-self-heal.test.jsx. Never the manager either way.
 *  - With no active map, re-clicking "Maps" re-runs the load (campaign-
 *    scoped) and opens the map once the GM has activated one.
 *
 * Waiting-placeholder rendering, "Check Again", failed-load quietness, and
 * map-activate SSE auto-open are covered by App.map-unavailable.test.jsx
 * and App.map-activate.test.jsx — not re-tested here.
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
  useRuntimeValue: vi.fn(() => null),
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
vi.mock('./components/music/MusicPlayer.jsx', async () => {
  const { MockMusicPlayer } = await import('./test/mockComponents.jsx');
  return { default: MockMusicPlayer };
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

function openMapFromManager() {
  fireEvent.click(screen.getByTestId('open-map-btn'));
}

function backFromMap() {
  fireEvent.click(screen.getByTestId('map-back-btn'));
}

async function expectMapShowing(name) {
  await waitFor(() => {
    expect(screen.getByTestId('map-name').textContent).toBe(name);
  });
  expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
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

    it('Maps opens the manager, the manager opens a map, and map-back returns to the listing', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      openMapFromManager();
      await expectMapShowing('dungeon-1');

      // Map's back button returns to the manager listing (empty history).
      backFromMap();
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      // The manager has no Back button: the sidebar is the only exit, so the
      // listing stays open and Maps remains the active view.
      expect(screen.queryByTestId('mm-back-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Maps');
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();
    });

    // Backlog map-load-notice-slug-naming: the manager row's display name must
    // reach the editor's mapsView so a rejected document load can name the
    // map by what the user clicked, not its kebab slug. POI-entered maps
    // carry no row — the notice falls back to the slug there.
    it('manager-open threads the row display name into the editor; POI-enter drops it to the slug fallback', async () => {
      clickMaps();
      openMapFromManager();
      await expectMapShowing('dungeon-1');
      expect(screen.getByTestId('map-display-name').textContent).toBe('Dungeon 1');

      fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
      await expectMapShowing('inner-cave');
      expect(screen.getByTestId('map-display-name').textContent).toBe('');

      // Popping the stack restores the map, but the history stack stores only
      // slugs — the popped entry keeps the slug-fallback contract.
      backFromMap();
      await expectMapShowing('dungeon-1');
      expect(screen.getByTestId('map-display-name').textContent).toBe('');
    });

    // Regression (2026-10-28 improve run, QA 2026-10-27 run F): the Maps pane
    // could strand in the blank `activeView === 'mapsManager'` +
    // `mapsView.type === 'none'` sub-state — MapsAreaView renders null there
    // while the sidebar still read "Maps", and the first re-entry click was
    // swallowed by handleMapsClick's "already on mapsManager" early return
    // (hence the observed "second sidebar click to populate"). The
    // handleMapsClick self-heal below guards any path that still reaches the
    // blank sub-state; the campaign-switch path itself now resets activeView
    // on select (bug-stale-character-sheet-cross-campaign-writes).
    it('re-clicking Maps while the listing is open is a no-op (sidebar stays on Maps)', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Maps');

      // Second click must not blank the pane or reset the stack.
      clickMaps();
      await flushEffects();
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Maps');
    });

    it('a campaign switch to a characterless campaign cannot strand a blank Maps pane', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      // Leave and switch to a different, characterless campaign: the select
      // callback opens the creation wizard and never resets activeView, while
      // the campaignName effect clears mapsView to 'none' — the blank sub-state.
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
      });
      mockState.campaignName = 'test-campaign-two';
      mockState.characters = [];
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-campaign-btn'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      await flushEffects();

      // Campaign select now resets activeView (regression bug-stale-character-
      // sheet-cross-campaign-writes, 2026-11-04 CR): the stale "Maps"
      // indicator from the PREVIOUS campaign can no longer survive the switch
      // — the zero-character wizard is the only surface — so no indicator
      // renders and the maps pane stays unmounted until Maps is clicked.
      expect(screen.queryByTestId('sidebar-active-indicator')).not.toBeInTheDocument();
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // One Maps click self-heals into the new campaign's manager listing.
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mm-campaign')).toHaveTextContent('test-campaign-two');
    });

    it('backs through the POI map history stack: inner map, original map, manager', async () => {
      clickMaps();
      openMapFromManager();
      await expectMapShowing('dungeon-1');

      // Entering a POI opens the inner map with the original on the stack
      fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
      await expectMapShowing('inner-cave');

      // First back pops the stack: original map, not the manager
      backFromMap();
      await expectMapShowing('dungeon-1');

      // Stack is now empty: back exits to the manager listing
      backFromMap();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });
      expect(window.alert).not.toHaveBeenCalled();
    });

    // Regression (2026-11-03 QA backlog, GM twin of
    // bug-lan-map-nav-noop-mid-session): opening a map and then navigating to
    // another view leaves mapsView stuck at type 'map' (MapsAreaView only
    // mounts under activeView 'mapsManager'). The old localhost branch reset
    // ONLY that sub-state, so the first Maps click from e.g. the Log changed
    // an invisible flag — the rendered view stayed put and only the second
    // click reached the else branch and navigated. One click must navigate.
    it('clicking Maps from another view while a map is open navigates on the first click', async () => {
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      openMapFromManager();
      await expectMapShowing('dungeon-1');

      // Leave the open map for the campaign log (view change only —
      // handleLogClick never touches mapsView, mirroring the sheet route).
      fireEvent.click(screen.getByTestId('log-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // ONE Maps click: the view must actually change to the manager listing
      // (log view gone, indicator on Maps) — not just an internal flag.
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('campaign-log-view')).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Maps');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('Maps exits the POI stack to the manager and clears history, and re-clicking it there is a no-op', async () => {
      clickMaps();
      openMapFromManager();
      await expectMapShowing('dungeon-1');
      fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
      await expectMapShowing('inner-cave');

      // "Maps" exits the stack to the manager — history must not survive
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
      });

      // Already on the manager listing: clicking "Maps" again stays put
      clickMaps();
      await flushEffects();
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // Fresh open starts a fresh stack: back goes straight to the manager
      // (if 'inner-cave' had survived on the stack, back would show it)
      openMapFromManager();
      await expectMapShowing('dungeon-1');
      backFromMap();
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
      await expectMapShowing('dungeon-1');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('does nothing when Maps is clicked while a map is already open', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');
      clickMaps();
      await expectMapShowing('dungeon-1');

      const loadCallsBefore = loadMaps.mock.calls.length;
      clickMaps();
      await flushEffects();

      // Still on the same map — no reload, no detour to the manager
      expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
      expect(loadMaps.mock.calls.length).toBe(loadCallsBefore);
    });

    // Regression (bug-lan-map-nav-noop-mid-session): leaving the map view for
    // another sidebar view unmounts MapsAreaView while mapsView still carries
    // type 'map' — the old "already on their only view" branch swallowed every
    // later Map click, stranding the player on the previous view for the rest
    // of the session (silent no-op, zero errors, reload-only recovery). One
    // re-entry click must re-arm the view AND re-resolve the active map, so a
    // GM activation made while the player was away is honored instead of
    // re-opening the stale name left in mapsView.
    it('re-clicking Map after leaving to another view re-mounts the map and follows the current active map', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');
      clickMaps();
      await expectMapShowing('dungeon-1');

      // Player leaves the map view for the campaign log.
      fireEvent.click(screen.getByTestId('log-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // GM activates a different map while the player is away.
      loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'dungeon-1.json', isActive: false },
          { fileName: 'crypt-2.json', isActive: true },
        ],
      });

      // One Map click re-mounts the view on the CURRENT active map —
      // not a silent fall-back to the log, not the stale mapsView name.
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-name').textContent).toBe('crypt-2');
      });
      expect(screen.queryByTestId('campaign-log-view')).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Maps');
      expect(window.alert).not.toHaveBeenCalled();
    });

    // Backlog 2026-11-05 CV: Back with an empty stack used to land on the
    // "Waiting for the GM to open a map…" placeholder even while the map was
    // still active on the server (only NEW activation SSE events auto-opened
    // while blank). The Back-transition self-heal seed now re-opens the view from
    // the armed active-map context with zero clicks — and never the manager.
    it('back from a map self-heals onto the still-active map, never the manager', async () => {
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });
      await renderInCampaign('example.com');
      clickMaps();
      await expectMapShowing('dungeon-1');

      backFromMap();
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      // Re-opened from the armed context — no waiting pane, no manager,
      // no manual "Check Again", and no extra server round-trip needed.
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('waits quietly with no active map, then re-clicking Maps re-queries and opens the GM-activated map', async () => {
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
      const loadCallsBefore = loadMaps.mock.calls.length;
      clickMaps();
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-name').textContent).toBe('dungeon-1');
      });
      // Exactly one fresh, campaign-scoped re-query via the Maps button
      // (the "Check Again" retry button is covered by map-unavailable).
      expect(loadMaps.mock.calls.length).toBe(loadCallsBefore + 1);
      expect(loadMaps).toHaveBeenLastCalledWith('test-campaign');
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    });
  });
});
