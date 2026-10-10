// @improved-by-ai

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

function setLocalhost(hostname = 'localhost') {
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

function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

async function setupPlayerOnWaitingMapsView() {
  setLocalhost('example.com');
  const { loadMaps } = await import('./services/maps/mapsService.js');
  loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });
  mockState.characters = [{ name: 'Aragorn', level: 1 }];
  render(<App />);
  await selectCampaign();
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
  });
  return loadMaps;
}

// --- Test suite ---

describe('App - player map-unavailable waiting placeholder', () => {
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
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'New Campaign Name');

    setLocalhost('localhost');
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
    setLocalhost('localhost');
  });

  it('shows the waiting placeholder with icon and retry button instead of an alert', async () => {
    await setupPlayerOnWaitingMapsView();

    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
    expect(screen.getByText('Check Again')).toBeInTheDocument();
    expect(document.querySelector('.map-unavailable i.fa-solid.fa-map')).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('"Check Again" re-runs the active-map load and keeps the placeholder while no map is active', async () => {
    const loadMaps = await setupPlayerOnWaitingMapsView();

    const callsBefore = loadMaps.mock.calls.length;
    fireEvent.click(screen.getByText('Check Again'));
    await flushEffects();

    expect(loadMaps.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(screen.getByText(/Waiting for the GM to open a map/)).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('"Check Again" renders the map once one is active', async () => {
    const loadMaps = await setupPlayerOnWaitingMapsView();

    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: true }] });
    fireEvent.click(screen.getByText('Check Again'));

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
  });

  it('SSE map-activate replaces the placeholder with the map with zero player clicks', async () => {
    await setupPlayerOnWaitingMapsView();

    await dispatch({
      key: 'map-activate-test-campaign',
      data: { activeMap: 'battle-arena' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(screen.getByTestId('map-name').textContent).toBe('battle-arena');
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
  });

  it('GM (localhost) still sees the maps manager, never the placeholder', async () => {
    setLocalhost('localhost');
    const { loadMaps } = await import('./services/maps/mapsService.js');
    loadMaps.mockResolvedValue({ maps: [{ fileName: 'battle-arena.json', isActive: false }] });
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
    render(<App />);
    await selectCampaign();
    fireEvent.click(screen.getByTestId('maps-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
