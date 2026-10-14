// @maintained-by-ai
/**
 * App-level contract for the `map-activate` SSE event (App.jsx →
 * handleMapActivateEvent):
 *
 *  - A player (non-localhost) stranded on the blank "waiting" maps view is
 *    auto-opened onto the activated map with zero further clicks, straight
 *    from the pushed payload — the still-"no active map" maps listing must
 *    not block the auto-open (no re-fetch).
 *  - Activation never hijacks a player off the character sheet or off a map
 *    they are already viewing.
 *  - The GM (localhost) never auto-navigates — they manage maps via the
 *    manager listing.
 *  - Events scoped to another campaign, and malformed payloads (null data,
 *    empty activeMap), are ignored without navigating, alerting, or
 *    crashing.
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

// Render as a network player with the given maps listing on the server.
async function renderAsPlayer(maps) {
  const { loadMaps } = await import('./services/maps/mapsService.js');
  loadMaps.mockResolvedValue({ maps });
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  setHostname('example.com');
  render(<App />);
  await selectCampaign();
  return loadMaps;
}

// Player who clicked "Map" while no map was active — stranded on the
// "Waiting for the GM to open a map" view.
async function setupPlayerOnBlankMapView() {
  const loadMaps = await renderAsPlayer([
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

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'battle-arena' },
    });

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

  it('never hijacks a player away from the view they are already on', async () => {
    // GM has already activated the map; player is on the character sheet —
    // the activation must not appear until they navigate to Maps themselves
    // (click-to-open itself is covered by App.map-navigation.test.jsx).
    await renderAsPlayer([{ fileName: 'battle-arena.json', isActive: true }]);
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'battle-arena' },
    });

    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

    // Player opens Maps, then a fresh activation must not swap the map out
    // from under them mid-session.
    fireEvent.click(screen.getByTestId('maps-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    });

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'test-map' },
    });

    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
  });

  it('does not auto-open maps on localhost (GM stays on the manager listing)', async () => {
    const { loadMaps } = await import('./services/maps/mapsService.js');
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
    setHostname('localhost');
    render(<App />);
    await selectCampaign();
    fireEvent.click(screen.getByTestId('maps-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
    });

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'battle-arena' },
    });

    // GM manages maps manually — activation pushes do not navigate them.
    expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  });

  it.each([
    ['another campaign', 'map-activate-other-campaign', { activeMap: 'somewhere-else' }],
    ['null data', 'map-activate-test-campaign', null],
    ['an empty activeMap', 'map-activate-test-campaign', { activeMap: '' }],
  ])('leaves the player waiting when map-activate is scoped to %s', async (_label, key, data) => {
    await setupPlayerOnBlankMapView();

    await dispatch({ key, data });

    expectStillWaitingOnBlankMapView();
  });
});
