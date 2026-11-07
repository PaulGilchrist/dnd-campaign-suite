// @maintained-by-ai
/**
 * App-level contract: the shared change-key SSE lane keeps the module-level
 * combatData cache (getCombatSummary readers) in sync with server board
 * writes on EVERY lane (bug-aura-caveat-asserts-for-on-board-bearer-stale-cache).
 *
 * Before the fix, only the Initiative view's own SSE subscription refreshed
 * cachedCombatSummaries, so a character-sheet-lane tab stayed boot-stale: the
 * Aura of Protection board-member guard (isBearerAssumedCoPresent) consulted a
 * stale allCreatures list and the phantom-bearer caveat wrongly asserted
 * "assumed co-present (no token)" for a bearer verifiably on the server board.
 *
 * Pinned here through the exact App dispatch table (App.jsx handleChangeKeyEvent
 * via the captured Subscriber handler, sheet view only — the Initiative
 * component is mocked out, so nothing else can refresh the cache):
 *  - a combatSummary echo carrying a board is ADOPTED into the combatData cache
 *    (campaign-keyed) and still REPLACES the runtime bucket (prior behavior);
 *  - a null (cleared-key) echo EVICTS the cache;
 *  - non-board object payloads leave the cache untouched (Initiative-lane
 *    guard precedent: only echoes with creatures are boards);
 *  - foreign-campaign echoes are ignored.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import { replaceRuntimeObject, getStore } from './hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from './services/encounters/combatData.js';
import * as campaignService from './services/campaign/campaignService.js';
import { loadMaps } from './services/maps/mapsService.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber.
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

// --- Core mocks (shared with the other App test files) ---

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
  seedTrackedResources: vi.fn(),
  getStore: vi.fn(() => new Map()),
  notify: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(async () => []),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
  deleteCharacter: vi.fn(async () => {}),
  createCharacter: vi.fn(async (_campaign, characterData) => ({ character: characterData })),
  updateCharacter: vi.fn(async () => {}),
}));

// Shared mutable container so the hoisted vi.mock can read the
// current app data shape without capturing a stale reference.
const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Component mocks (App renders views only through these doubles; the
// Initiative double guarantees no other lane can refresh the cache) ---

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

// Subscriber double that captures the handler so tests can push SSE events
// through the exact dispatch table the real SSE connection feeds.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: ({ handleEvent }) => {
    subscriberMock.props.handleEvent = handleEvent;
    return null;
  },
}));

// --- Helpers ---

const PARTY = [
  { name: 'Aragorn', level: 1 },
  { name: 'Legolas', level: 2 },
];

function jsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Render the app, select the campaign, and clear call history so the
// selection-time combatSummary seed never pollutes the cache assertions.
async function renderOnSheetLane(characters = PARTY) {
  mockState.characters = characters;
  render(<App />);
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
  setCombatSummaryCache.mockClear();
}

// Push an SSE event through the captured App handler.
function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

// --- Test suite ---

describe('App - combatSummary echo keeps the combatData cache live on every lane', () => {
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

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({})));

    campaignService.deleteCharacter.mockImplementation(async () => {});
    campaignService.createCharacter.mockImplementation(
      async (_campaign, characterData) => ({ character: characterData }),
    );
    campaignService.updateCharacter.mockImplementation(async () => {});
    getStore.mockImplementation(() => new Map());
    loadMaps.mockResolvedValue({ maps: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adopts a mid-session board echo into the combatData cache on a sheet-only tab', async () => {
    await renderOnSheetLane();

    // Exactly the DB-run Face B write: ElderPaladin joins the server board
    // while the tab sits on the character sheet.
    const board = {
      round: 1,
      creatures: [
        { name: 'EvasiveFighter', type: 'player', initiative: 8, ac: 19 },
        { name: 'War_Cleric', type: 'player', initiative: 5, ac: 13 },
        { name: 'ElderPaladin', type: 'player', initiative: 7, ac: 19 },
      ],
    };
    await dispatch({ key: 'change-test-campaign-combatSummary', data: board });

    // The aura guard's source of truth is refreshed…
    expect(setCombatSummaryCache).toHaveBeenCalledWith(board, 'test-campaign');
    // …without disturbing the prior full-bucket REPLACE of the runtime store.
    expect(replaceRuntimeObject).toHaveBeenCalledWith('combatSummary', board);
  });

  it('evicts the combatData cache on a null (cleared-key) echo', async () => {
    await renderOnSheetLane();

    await dispatch({ key: 'change-test-campaign-combatSummary', data: null });

    expect(setCombatSummaryCache).toHaveBeenCalledWith(null, 'test-campaign');
  });

  it('leaves the cache untouched on an object echo that carries no board', async () => {
    await renderOnSheetLane();

    // Initiative-lane guard precedent (handleCombatSummaryChange requires
    // data.creatures): a non-board payload is never a board write.
    await dispatch({ key: 'change-test-campaign-combatSummary', data: { action: 'clear' } });

    expect(setCombatSummaryCache).not.toHaveBeenCalled();
  });

  it('ignores combatSummary echoes from other campaigns', async () => {
    await renderOnSheetLane();

    await dispatch({
      key: 'change-other-campaign-combatSummary',
      data: { round: 1, creatures: [{ name: 'ElderPaladin', type: 'player' }] },
    });

    expect(setCombatSummaryCache).not.toHaveBeenCalled();
  });
});
