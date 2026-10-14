// @maintained-by-ai
/**
 * App-level contract for the player "map unavailable" waiting placeholder.
 *
 * Production behavior under test (App.jsx → MapsAreaView → MapUnavailable):
 *  - A player (non-localhost) who opens Maps with no active map sees a
 *    friendly waiting placeholder — never an alert, never the maps manager.
 *  - "Check Again" re-runs the active-map load for the CURRENT campaign
 *    exactly once per click: it keeps the placeholder while no map is
 *    active, and opens the map the moment the GM has activated one.
 *  - A failed retry keeps the placeholder quietly (failure logged, no
 *    alert) and stays retryable — the next click recovers.
 *  - GM (localhost) always gets the maps manager listing, never the
 *    placeholder.
 *
 * SSE map-activate auto-open is owned by App.map-activate.test.jsx and
 * Maps-click routing / back navigation by App.map-navigation.test.jsx —
 * deliberately not re-tested here.
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

// Stub the SSE subscriber — this suite drives everything through UI clicks.
// (SSE map-activate auto-open lives in App.map-activate.test.jsx.)
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
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

// Enter the campaign and click "Maps" with the given maps listing.
async function renderOnMapsView({ hostname, maps }) {
  setHostname(hostname);
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  loadMaps.mockResolvedValue({ maps });
  render(<App />);
  await selectCampaign();
  fireEvent.click(screen.getByTestId('maps-btn'));
  await flushEffects();
  return loadMaps;
}

async function renderPlayerOnWaitingMapsView(maps = [{ fileName: 'battle-arena.json', isActive: false }]) {
  await renderOnMapsView({ hostname: 'example.com', maps });
  await waitFor(() => {
    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  });
  return loadMaps;
}

function clickCheckAgain() {
  fireEvent.click(screen.getByRole('button', { name: 'Check Again' }));
}

function expectStillWaiting() {
  expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
}

// --- Test suite ---

describe('App - player map-unavailable waiting placeholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    // Quiet, observable failure channel — the waiting flow must never alert.
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

  it('shows the waiting placeholder (message, retry) instead of an alert when no map is active', async () => {
    // An inactive-map listing (not just an empty one) — the isActive flag
    // must be what decides, and the player never sees the maps manager.
    await renderPlayerOnWaitingMapsView([{ fileName: 'battle-arena.json', isActive: false }]);

    const message = screen.getByText(/Waiting for the GM to open a map/);
    expect(message.closest('.map-unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Again' })).toBeInTheDocument();

    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('"Check Again" loads the current campaign once per click — stays waiting, then opens the GM-activated map', async () => {
    await renderPlayerOnWaitingMapsView();

    // Still no active map: one fresh, campaign-scoped load per click —
    // not a stale result, not a hammering loop — and the placeholder stays.
    const callsBefore = loadMaps.mock.calls.length;
    clickCheckAgain();
    await flushEffects();

    expect(loadMaps.mock.calls.length).toBe(callsBefore + 1);
    expect(loadMaps).toHaveBeenLastCalledWith('test-campaign');
    expectStillWaiting();

    // GM activates — the next click opens the map and swaps the placeholder
    // (message AND retry) out entirely.
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: true }] });
    clickCheckAgain();

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Again' })).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('"Check Again" that fails keeps the placeholder quietly and stays retryable', async () => {
    await renderPlayerOnWaitingMapsView();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Retry hits a network failure → same quiet placeholder, no crash, no alert.
    loadMaps.mockRejectedValueOnce(new Error('Network error'));
    clickCheckAgain();
    await flushEffects();

    expectStillWaiting();
    expect(consoleSpy).toHaveBeenCalled(); // failure logged, not swallowed

    // Recovery: the click after the failure still opens an activated map.
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: true }] });
    clickCheckAgain();

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('GM (localhost) gets the maps manager listing, never the placeholder', async () => {
    await renderOnMapsView({
      hostname: 'localhost',
      maps: [{ fileName: 'battle-arena.json', isActive: false }],
    });

    await waitFor(() => {
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Again' })).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
