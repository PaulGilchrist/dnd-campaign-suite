// @improved-by-ai
/**
 * App-level contract for the `map-activate` SSE event.
 *
 * Production behavior under test (App.jsx → handleMapActivateEvent):
 *  - The event is campaign-scoped: only `map-activate-<current campaign>` acts.
 *  - GM (localhost) never auto-navigates — the GM manages maps via the
 *    manager listing; their view is untouched by activation pushes.
 *  - A player (non-localhost) is auto-opened onto the activated map ONLY
 *    while stranded on the blank (waiting) maps view — never hijacked off
 *    the character sheet or a map they are already viewing.
 *  - The map opens directly from the pushed payload: the maps list still
 *    reporting "no active map" must not block the auto-open (no re-fetch).
 *  - Malformed events (missing/null data, empty activeMap) are ignored
 *    without crashing or navigating.
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

// Render the app as a network player who clicked "Map" while no map was
// active, and is stranded on the "Waiting for the GM to open a map" view.
async function setupPlayerOnBlankMapView() {
  setHostname('example.com');
  const { loadMaps } = await import('./services/maps/mapsService.js');
  loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  render(<App />);
  await selectCampaign();
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  });
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
  return loadMaps;
}

// The waiting placeholder is the player's resting state whenever no map view
// is open — used to prove ignored events leave the view untouched.
function expectStillWaitingOnBlankMapView() {
  expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  expect(screen.getByTestId('sidebar')).toBeInTheDocument();
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

  it('does not auto-open for a player who never opened the maps view', async () => {
    setHostname('example.com');
    const { loadMaps } = await import('./services/maps/mapsService.js');
    // GM has already activated the map, but the player is on the char sheet
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: true }] });
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
    render(<App />);
    await selectCampaign();

    // Player is on the character sheet, not the maps view
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'battle-arena' },
    });

    // Activation never hijacks a player away from the character sheet
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();

    // First click on Map still loads the now-active map immediately
    fireEvent.click(screen.getByTestId('maps-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    });
  });

  it('does not auto-open maps on localhost (GM stays on the manager listing)', async () => {
    const { loadMaps } = await import('./services/maps/mapsService.js');
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
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

  it('ignores map-activate events scoped to another campaign', async () => {
    await setupPlayerOnBlankMapView();

    await dispatch({
      key: 'map-activate-other-campaign',
      data: { activeMap: 'somewhere-else' },
    });

    expectStillWaitingOnBlankMapView();
  });

  it.each([
    ['null data', null],
    ['empty data object', {}],
    ['empty activeMap', { activeMap: '' }],
    ['null activeMap', { activeMap: null }],
  ])('ignores map-activate events with %s without navigating or crashing', async (_label, data) => {
    await setupPlayerOnBlankMapView();

    await dispatch({ key: 'map-activate-test-campaign', data });
    await flushEffects();

    expectStillWaitingOnBlankMapView();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('does not hijack a player already viewing a different map', async () => {
    setHostname('example.com');
    const { loadMaps } = await import('./services/maps/mapsService.js');
    loadMaps.mockResolvedValue({
      maps: [{ fileName: 'battle-arena.json', isActive: true }],
    });
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
    render(<App />);
    await selectCampaign();
    fireEvent.click(screen.getByTestId('maps-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    });

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'test-map' },
    });
    await flushEffects();

    // Player keeps viewing their current map; no silent swap mid-session
    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
  });
});
