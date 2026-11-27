// @maintained-by-ai 2026-11-26
/**
 * App-level contract for the `map-activate` SSE event (App.jsx →
 * handleMapActivateEvent):
 *
 *  - A player (non-localhost) stranded on the blank "waiting" maps view is
 *    auto-opened onto the activated map with zero further clicks, straight
 *    from the pushed payload — the still-"no active map" maps listing must
 *    not block the auto-open (no re-fetch).
 *  - Activation never hijacks a player off the character sheet. (The
 *    never-re-switch-an-open-map-view face is pinned by
 *    App.map-self-heal.test.jsx; the advisory UI on the orphaned board by
 *    App.map-deactivated-advisory.test.jsx.)
 *  - The GM (localhost) never auto-navigates — activation pushes keep them
 *    on the manager listing — but the event MUST still arm the GM tab's own
 *    map context (the roller lanes consume activeMapName via Initiative →
 *    MonsterCardModal mapData; bug-gm-activate-without-open-gridless-roller-lane).
 *  - A `null` activeMap (server-side deactivation) DISARMS each tab's
 *    context without navigating or ejecting anyone; MapContextSync would
 *    otherwise force-stamp the stale map back into '__map__' (re-select
 *    resurrection vector).
 *  - Deleting the ACTIVE map from the manager clears the GM tab's armed map
 *    context; deleting a non-active map leaves it armed.
 *  - Events scoped to another campaign and payloads that carry nothing to
 *    arm (null data, empty/null activeMap) are ignored without navigating,
 *    alerting, or crashing.
 *
 * Click-driven map navigation lives in App.map-navigation.test.jsx;
 * waiting-placeholder rendering in App.map-unavailable.test.jsx.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

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
  replaceRuntimeObject: vi.fn(),
  evictCharacterStores: vi.fn(),
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

vi.mock('./components/common/Subscriber.jsx', () => ({
  default: ({ handleEvent }) => {
    subscriberMock.props.handleEvent = handleEvent;
    return null;
  },
}));

// --- Helpers ---

function setHostname(hostname) {
  Object.defineProperty(window, 'location', {
    value: { hostname, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

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

// Push an SSE event through the exact handler the real Subscriber received.
function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

function activate(activeMap) {
  return { key: 'map-activate-test-campaign', data: { activeMap } };
}

// Render with the given maps listing on the server, as a network player by
// default (pass 'localhost' for the GM tab).
async function renderApp(maps, hostname = 'example.com') {
  const { loadMaps } = await import('./services/maps/mapsService.js');
  loadMaps.mockResolvedValue({ maps });
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  setHostname(hostname);
  render(<App />);
  await selectCampaign();
  return loadMaps;
}

// GM tab parked on the maps-manager listing. The mock manager's Delete
// button always calls onMapDeleted('dungeon-1').
async function renderGmOnManager(maps) {
  await renderApp(maps, 'localhost');
  await openManager();
}

async function openManager() {
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
  });
}

// Visit Initiative and read the mapName prop the roller lanes consume
// ('' when the tab's map context is disarmed).
async function expectRollerMap(name) {
  fireEvent.click(screen.getByTestId('initiative-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('initiative')).toBeInTheDocument();
  });
  expect(screen.getByTestId('init-map-name').textContent).toBe(name);
}

// Player who clicked "Map" while no map was active — stranded on the
// "Waiting for the GM to open a map" view.
async function setupPlayerOnBlankMapView() {
  const loadMaps = await renderApp([
    { fileName: 'battle-arena.json', isActive: false },
  ]);
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  });
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  return loadMaps;
}

// The waiting placeholder is the resting state for every ignored event.
function expectStillWaitingOnBlankMapView() {
  expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
}

// --- Test suite ---

describe('App - map-activate SSE auto-open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriberMock.props.handleEvent = null;

    _appDataRef.value = {
      abilityScores: [{ full_name: 'Strength' }],
      classes: [{ name: 'Fighter' }],
      classes2024: [{ name: 'Fighter 2024' }],
      equipment: [{ name: 'Longsword' }],
      magicItems: [{ name: 'Wand' }],
      magicItems2024: [{ name: 'Wand 2024' }],
      monsters: [],
      races: [{ name: 'Human' }],
      races2024: [{ name: 'Human 2024' }],
      spells: [{ name: 'Fireball' }],
      spells2024: [{ name: 'Fireball 2024' }],
      isLoading: false,
    };

    mockState.campaignName = 'test-campaign';
    mockState.characters = [];

    window.alert = vi.fn();

    setHostname('localhost');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

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
    setHostname('localhost');
  });

  it('auto-opens the activated map for a player stranded on the blank maps view (no extra clicks)', async () => {
    const loadMaps = await setupPlayerOnBlankMapView();
    const loadCallsBefore = loadMaps.mock.calls.length;

    await dispatch(activate('battle-arena'));

    await waitFor(() => {
      expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    });
    // The waiting placeholder is swapped out entirely — the player never
    // clicks "Check Again" and never sees an alert.
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
    // The map came from the pushed event payload, not a re-fetch of the
    // (still "no active map") listing.
    expect(loadMaps.mock.calls.length).toBe(loadCallsBefore);
  });

  it('never hijacks a player sitting on the character sheet', async () => {
    // The GM has already activated the map; activation pushes must not
    // surface on the sheet — the player reaches the map via their own Maps
    // click (owned by App.map-navigation.test.jsx).
    await renderApp([{ fileName: 'battle-arena.json', isActive: true }]);
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

    await dispatch(activate('battle-arena'));

    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  });

  // Regression (bug-gm-activate-without-open-gridless-roller-lane): the
  // localhost early-return used to skip setActiveMapName entirely, so a GM
  // who ACTIVATEs a map (without Open/re-select) keeps a null local context —
  // every MonsterCardModal lane fed by Initiative's mapName prop then runs
  // with mapData:null and measured range/aura gating silently degrades to
  // tokenless leniency on the GM's own tab.
  describe('GM (localhost) map-context arming and clearing', () => {
    it('arms the GM tab map context on activate — staying on the manager listing, and re-arms on later activations', async () => {
      await renderGmOnManager([{ fileName: 'battle-arena.json', isActive: false }]);

      await dispatch(activate('battle-arena'));

      // No hijack: GMs manage maps manually — activation pushes never
      // navigate them off the manager listing.
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // The GM tab's own roller context (Initiative → MonsterCardModal
      // mapName/mapData chain) adopted the activated map without any Open.
      await expectRollerMap('battle-arena');

      await dispatch(activate('test-map'));
      await expectRollerMap('test-map');
    });

    it('clears the GM map context when the manager deletes the ACTIVE map', async () => {
      await renderGmOnManager([{ fileName: 'dungeon-1.json', isActive: false }]);

      await dispatch(activate('dungeon-1'));

      // The mock Delete button calls onMapDeleted('dungeon-1') — deleting
      // the map this tab has armed must clear the stale context.
      fireEvent.click(screen.getByTestId('delete-map-btn'));
      await flushEffects();

      await expectRollerMap('');
    });

    it('leaves the armed context in place when the deleted map is not the active one', async () => {
      await renderGmOnManager([
        { fileName: 'battle-arena.json', isActive: true },
        { fileName: 'dungeon-1.json', isActive: false },
      ]);

      // Select-time load arms the listing's active map (no SSE event needed).
      await expectRollerMap('battle-arena');
      await openManager();

      // Delete 'dungeon-1' — a different map must not blank the armed one.
      fireEvent.click(screen.getByTestId('delete-map-btn'));
      await flushEffects();

      await expectRollerMap('battle-arena');
    });
  });

  it.each([
    ['scoped to another campaign', 'map-activate-other-campaign', { activeMap: 'somewhere-else' }],
    ['with null data', 'map-activate-test-campaign', null],
    ['with an empty activeMap', 'map-activate-test-campaign', { activeMap: '' }],
    // The /deactivate route publishes this key with null — a legitimate
    // disarm signal, never an open signal for a waiting player.
    ['with a null activeMap (server-side deactivation)', 'map-activate-test-campaign', { activeMap: null }],
  ])('leaves the player waiting when map-activate is %s', async (_label, key, data) => {
    await setupPlayerOnBlankMapView();

    await dispatch({ key, data });

    expectStillWaitingOnBlankMapView();
  });

  // Backlog 2026-11-04 CQ: a null payload must DISARM every tab's context
  // (or MapContextSync's next transition force-stamps the stale map back
  // into '__map__' — re-select resurrection vector) without ever
  // navigating or ejecting anyone. The waiting-player face of null is
  // covered by the ignored-payload rows above.
  describe('map-activate SSE with activeMap null (server-side deactivation)', () => {
    it('disarms the GM tab map context — no navigation, later activation re-arms', async () => {
      await renderGmOnManager([{ fileName: 'battle-arena.json', isActive: false }]);

      await dispatch(activate('battle-arena'));
      await dispatch(activate(null));

      // Manager listing stays put — a deactivation never navigates the GM.
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

      // Roller context adopted the null (gridless until the next activation).
      await expectRollerMap('');

      // A fresh activation after the deactivation re-arms normally.
      await dispatch(activate('test-map'));
      await expectRollerMap('test-map');
    });

    it('never hijacks a player off a map view but still disarms the context', async () => {
      await renderApp([{ fileName: 'battle-arena.json', isActive: true }]);
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
      });

      await dispatch(activate(null));

      // Their view is theirs — the map stays rendered (no ejection, no alert)…
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(window.alert).not.toHaveBeenCalled();
      // …but the roller-lane context (activeMapName prop chain) adopted null.
      await expectRollerMap('');
    });
  });
});
