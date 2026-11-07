// @maintained-by-ai
/**
 * App-level contract for the deactivated-map advisory (backlog 2026-11-05 CW):
 * while a player's map view is OPEN and the campaign's active map (the
 * '__map__' SSE seam mirrored into App state by handleMapActivateEvent) no
 * longer matches the mounted board, the map header must show a subtle hint —
 * WITHOUT ever blanking the view (never-hijack).
 *
 * Pinning seams (mapIsActive reaches the mocked <Map> as a prop, surfaced via
 * MockMap's map-is-active testid):
 *  - mounted map == active map (fresh auto-open or click-open) → no advisory;
 *  - GM deactivate (activeMap: null) while the view is open → advisory, board
 *    stays mounted (criterion: never-hijack preserved);
 *  - GM switch to ANOTHER map → advisory on the orphaned view, no hijack, and
 *    the roller context adopts the new active map;
 *  - GM re-activates the SAME mounted map → advisory clears LIVE, no reload.
 *
 * Hint rendering itself: components/map/MapToolbar.deactivated-hint.test.jsx.
 * Event contract for auto-open/hijack: App.map-activate.test.jsx.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

// --- Core mocks (mirrors App.map-activate.test.jsx) ---

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

function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

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
  return loadMaps;
}

// Player with battle-arena OPEN via the normal click-to-resolve lane.
async function setupPlayerOnOpenMap() {
  await renderAsPlayer([{ fileName: 'battle-arena.json', isActive: true }]);
  fireEvent.click(screen.getByTestId('maps-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
  });
}

const activate = (activeMap) => ({
  key: 'map-activate-test-campaign',
  data: { activeMap },
});

// --- Test suite ---

describe('App - deactivated-map advisory (mapIsActive derivation)', () => {
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

  it('no advisory while the mounted map IS the active map (click-open face)', async () => {
    await setupPlayerOnOpenMap();
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('true');
  });

  it('no advisory on the SSE auto-open — mapsView and context arm in lockstep', async () => {
    await setupPlayerOnBlankMapView();

    await dispatch(activate('battle-arena'));

    await waitFor(() => {
      expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    });
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('true');
  });

  it('GM deactivate: advisory lights on the still-mounted board (never-hijack)', async () => {
    await setupPlayerOnOpenMap();

    await dispatch(activate(null));

    // The board survives untouched…
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    expect(window.alert).not.toHaveBeenCalled();
    // …and the header hint state flips on (MapToolbar renders the copy —
    // pinned by MapToolbar.deactivated-hint.test.jsx).
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('false');
  });

  it('re-activating the SAME mounted map clears the advisory live (no reload)', async () => {
    await setupPlayerOnOpenMap();
    await dispatch(activate(null));
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('false');

    await dispatch(activate('battle-arena'));

    // Same mounted board, hint gone — the activation also re-armed this tab's
    // context on the '__map__' seam.
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('true');
  });

  it('GM switch to another map: advisory on the orphaned view, zero hijack', async () => {
    await setupPlayerOnOpenMap();

    await dispatch(activate('test-map'));

    // Never-hijack: the player keeps battle-arena mounted…
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('map-name')).toHaveTextContent('battle-arena');
    // …but it is no longer the table's map, so the hint lights.
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('false');

    // Switching back to the mounted map clears it again.
    await dispatch(activate('battle-arena'));
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('true');
  });

  it('the switch also arms the roller context (context follows the table)', async () => {
    await setupPlayerOnOpenMap();

    await dispatch(activate('test-map'));

    fireEvent.click(screen.getByTestId('initiative-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('initiative')).toBeInTheDocument();
    });
    expect(screen.getByTestId('init-map-name').textContent).toBe('test-map');
  });
});
