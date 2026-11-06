// @maintained-by-ai
/**
 * App-level contract for the player mapsView self-heal (backlog 2026-11-05
 * CV — App.jsx handleBackFromMap blank-state branch):
 *
 *  - A player who presses Back from a map view (empty stack) is NO LONGER
 *    stranded on the "Waiting for the GM to open a map…" placeholder while a
 *    map is active: the Back-transition self-heal seeds the view from the
 *    tab's armed context AND runs one server-truth auto-check (the "Check
 *    Again" lane, loadActiveMapAndOpen), so the active map re-opens with zero
 *    clicks (previously only NEW activation SSE events auto-opened while
 *    blank).
 *  - No-map case unchanged: after a server-side deactivation (map-activate
 *    SSE with activeMap null) disarms the tab context, the auto-check finds
 *    nothing active, Back lands on the waiting placeholder and nothing
 *    auto-opens.
 *  - Never-hijack contract preserved: an activation while a map view is OPEN
 *    neither swaps the open view nor is the still-open view re-switched by
 *    the self-heal (it runs only on the Back transition); Back then follows
 *    the CURRENT server-active map, mirroring the re-entry Maps-click.
 *
 * SSE auto-open from the blank state and null-echo disarm live in
 * App.map-activate.test.jsx; click-driven routing/stack in
 * App.map-navigation.test.jsx; placeholder rendering + "Check Again" in
 * App.map-unavailable.test.jsx.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';
import { loadMaps } from './services/maps/mapsService.js';

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

// Render as a network player whose server has the given maps listing.
async function renderAsPlayer(maps) {
  loadMaps.mockResolvedValue({ maps });
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  setHostname('example.com');
  render(<App />);
  await selectCampaign();
  return loadMaps;
}

// Player clicks "Map" and the view opens on the active map.
async function openActiveMap() {
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });
}

function backFromMap() {
  fireEvent.click(screen.getByTestId('map-back-btn'));
}

// --- Test suite ---

describe('App - player mapsView self-heal (blank state with an active map)', () => {
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

    // Quiet, observable failure channel — map flows must never alert.
    window.alert = vi.fn();

    setHostname('localhost');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    // vi.clearAllMocks does NOT reset implementations — re-arm defaults.
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
    setHostname('localhost');
  });

  it('Back from an open map self-heals: instant seed from the armed context + one server-truth auto-check', async () => {
    const loads = await renderAsPlayer([
      { fileName: 'battle-arena.json', isActive: true },
    ]);
    await openActiveMap();
    expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');

    const loadCallsBefore = loads.mock.calls.length;
    backFromMap();

    // The blank sub-state never renders the placeholder: the Back-transition
    // self-heal seed swaps straight back to the armed active map…
    await waitFor(() => {
      expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
    // …and exactly one campaign-scoped auto-check (the "Check Again" lane)
    // follows, so a disarmed/stale tab context still re-joins server truth.
    await waitFor(() => {
      expect(loads.mock.calls.length).toBe(loadCallsBefore + 1);
      expect(loads).toHaveBeenLastCalledWith('test-campaign');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('no-map case unchanged: after a server deactivation, Back lands on the placeholder and nothing auto-opens', async () => {
    const loads = await renderAsPlayer([
      { fileName: 'battle-arena.json', isActive: true },
    ]);
    await openActiveMap();

    // GM deactivates — the null echo disarms this tab's context but never
    // ejects the open view (map-activate contract).
    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: null },
    });
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    // The server listing now reflects the deactivation (the mock is the
    // "server" — keep it consistent with the null echo).
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });

    const loadCallsBefore = loads.mock.calls.length;
    backFromMap();

    // No armed map ⇒ the auto-check runs ONCE, finds nothing active, and the
    // waiting placeholder is the resting state — no auto-open is invented.
    await waitFor(() => {
      expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
      expect(loads.mock.calls.length).toBe(loadCallsBefore + 1);
    });
    await flushEffects();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Again' })).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('activation while a map view is open never re-switches it; Back follows the CURRENT active map', async () => {
    await renderAsPlayer([
      { fileName: 'battle-arena.json', isActive: true },
      { fileName: 'test-map.json', isActive: false },
    ]);
    await openActiveMap();

    // GM activates a DIFFERENT map while the player's view is open —
    // never-hijack: the open view keeps rendering battle-arena, and the
    // self-heal stays inert (it only runs on the Back transition).
    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'test-map' },
    });
    expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();

    // Back self-heals onto the CURRENT active map (the auto-check follows
    // server truth, mirroring the re-entry Maps-click contract).
    loadMaps.mockResolvedValue({
      maps: [
        { fileName: 'battle-arena.json', isActive: false },
        { fileName: 'test-map.json', isActive: true },
      ],
    });
    backFromMap();
    await waitFor(() => {
      expect(screen.getByTestId('map-name').textContent).toBe('test-map');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
