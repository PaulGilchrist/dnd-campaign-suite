// @maintained-by-ai 2026-11-21
/**
 * Regression: bug-campaign-store-ghost-keys-survive-campaign-switch.
 *
 * The 'campaign' runtime store is ONE global bucket (useRuntimeState.js
 * `stores`, keyed by characterKey only). The old select-time hydration
 * (seedCampaignRuntimeData) was seed-if-absent & skip-null: switching
 * campaigns in the SAME tab without a reload left campaign A's keys readable
 * under campaign B — the Admin AI panel rendered A's aiConfig (endpoint,
 * model, a fully mounted live referee console) while
 * GET /api/campaigns/B/aiConfig honestly answered {value:null}. And the
 * hydration sat on a `computedCharacters.length > 0` gate, so a fresh
 * ZERO-character campaign never re-scoped the store at all.
 *
 * The select seam now ADOPTS-AND-EVICTS the selected campaign's change-data
 * snapshot (hydrateCampaignRuntimeData → replaceRuntimeObject, mirroring the
 * character-bucket full-replace law) on its own campaignName/epoch gate.
 *
 * Pins (harness mirrors App.campaign-switch-wizards.test.jsx):
 *  - A→B no-reload switch evicts A's keys absent from B's snapshot and
 *    adopts B's own keys — on the ZERO-character face (the witnessed ghost);
 *  - a mounted campaign-store consumer is WOKEN by the rescope (notify);
 *  - re-selecting the SAME campaign re-reads server truth (a key the server
 *    no longer holds is evicted — the admin-clear select-rehydrate pass
 *    becomes a single pass, no resurrection);
 *  - null-valued snapshot entries are never stored (null-echo REMOVE doctrine);
 *  - a FAILED change-data fetch never evicts (null snapshot = "unknown",
 *    not "empty").
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import {
  clearRuntimeState,
  getStore,
  addStorageChangeListener,
  listeners,
} from './hooks/runtime/useRuntimeState.js';

// --- Core mocks (harness parity with App.campaign-switch-wizards.test.jsx) ---

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

// useRuntimeState stays REAL (importActual): the rescope must be proven on the
// production store + replace/notify lane, not a double.
vi.mock('./hooks/runtime/useRuntimeState.js', async () => {
  const actual = await vi.importActual('./hooks/runtime/useRuntimeState.js');
  return { ...actual };
});

vi.mock('./services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(async () => []),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
  deleteCharacter: vi.fn(async () => {}),
  createCharacter: vi.fn(async (_campaign, characterData) => ({ character: characterData })),
  updateCharacter: vi.fn(async () => {}),
}));

const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Component mocks (shared doubles) ---

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
  default: () => null,
}));

// --- Helpers ---

const GHOST_AI_CONFIG = {
  mode: 'suggest',
  endpoint: 'http://localhost:8001/v1',
  model: 'capture-mock',
  provider: 'openai',
};

// Per-campaign server change-data snapshots (GET /api/campaigns/:c/change-data).
// Restored to the defaults in beforeEach — tests may mutate them per scenario.
const DEFAULT_SNAPSHOTS = {
  'test-campaign': {
    aiConfig: GHOST_AI_CONFIG,
    enforcement: { mode: 'on' },
  },
  // The zero-character throwaway face: its OWN truth only, no aiConfig.
  'qa-starter': {
    'travel-mode': 'planning',
  },
};
let SNAPSHOTS;

function jsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle() {
  for (let i = 0; i < 5; i++) await flushEffects();
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
  await settle();
}

function leaveCampaign() {
  fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
}

// Route the change-data GET at the per-campaign snapshot; everything else
// (character loads, POSTs) gets an empty OK body like the sibling harnesses.
function mockFetchPerCampaign() {
  global.fetch = vi.fn((url) => {
    const match = String(url).match(/\/api\/campaigns\/([^/]+)\/change-data/);
    if (match) {
      const snap = SNAPSHOTS[decodeURIComponent(match[1])];
      return Promise.resolve(jsonResponse(snap ?? {}));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

// --- Test suite ---

describe('App — campaign-store rescope on select (ghost-key eviction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SNAPSHOTS = { ...DEFAULT_SNAPSHOTS };
    clearRuntimeState('campaign');
    listeners.clear();

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

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    mockFetchPerCampaign();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a clean entry seam issues exactly ONE change-data GET (shared enter-seam snapshot)', async () => {
    // Backlog 2026-11-22 SV: the mount seam used to fire one GET per consumer
    // (select-callback preload, rescope hydrate, character seed, sheet mount).
    // The select callback now BEGINS one shared read and every seam lane adopts
    // it — this harness's mocked loadCombatSummary consumes the slot too.
    mockState.characters = [];
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    const baseFetch = global.fetch;
    let changeDataGets = 0;
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/change-data')) changeDataGets += 1;
      return baseFetch(url);
    });
    await selectCampaign();

    expect(changeDataGets).toBe(1);
    // The one shared snapshot still hydrates the store (adopt-and-evict law
    // unchanged — hydration content, not just count, is intact).
    expect(getStore('campaign').get('aiConfig')).toEqual(GHOST_AI_CONFIG);
  });

  it('A→B switch WITHOUT reload evicts A\'s keys and adopts B\'s own snapshot (zero-character face)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    // Campaign A hydrated its own truth.
    expect(getStore('campaign').get('aiConfig')).toEqual(GHOST_AI_CONFIG);

    // Same tab, no reload: back to the picker, into the fresh throwaway.
    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    mockState.characters = [];
    await selectCampaign();

    // The ghost is GONE: A's aiConfig/enforcement evicted (absent from B's
    // snapshot), B's own key adopted — the Admin AI panel can only ever read
    // B's truth now (off/unset ⇒ collapsed row, no console).
    expect(getStore('campaign').has('aiConfig')).toBe(false);
    expect(getStore('campaign').has('enforcement')).toBe(false);
    expect(getStore('campaign').get('travel-mode')).toBe('planning');
  });

  it('the rescope WAKES a mounted campaign-store consumer (notify on evict)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    const woke = vi.fn();
    addStorageChangeListener('campaign', woke);

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    await selectCampaign();

    // Consumers registered on the stable store Map are notified, so a panel
    // mounted across the switch re-reads (declared defaults win) — no reload.
    expect(woke).toHaveBeenCalled();
  });

  it('re-selecting the SAME campaign re-reads server truth — a server-cleared key is evicted in ONE pass', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();
    expect(getStore('campaign').has('aiConfig')).toBe(true);

    // Admin Clear Change Data lands server-side (snapshot now empty for it)
    // and the GM re-selects the same campaign from the picker.
    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    SNAPSHOTS['test-campaign'] = {};
    await selectCampaign();

    // Old seed-if-absent kept the ghost (never evicted ⇒ the two-pass law).
    // Adopt-and-evict sweeps it in a single select pass.
    expect(getStore('campaign').has('aiConfig')).toBe(false);
    expect(getStore('campaign').has('enforcement')).toBe(false);
    expect(getStore('campaign').size).toBe(0);
  });

  it('null-valued snapshot entries are never stored (null-echo REMOVE doctrine)', async () => {
    mockState.characters = [];
    SNAPSHOTS['test-campaign'] = { 'travel-started-by': null };
    render(<App />);
    await selectCampaign();

    // A POST-null lane parks null server-side; the client store stays clean —
    // absent, never a stored null (hex-arrival-null-echo precedent).
    expect(getStore('campaign').has('travel-started-by')).toBe(false);
  });

  it('a FAILED change-data fetch keeps the store intact (unknown ≠ empty)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();
    expect(getStore('campaign').has('aiConfig')).toBe(true);

    // Serve an honest failure (never an empty object pretending to be truth).
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/change-data')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      return Promise.resolve(jsonResponse({}));
    });

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    await selectCampaign();

    // No snapshot ⇒ no evict (a failed fetch must not wipe the live scope;
    // the next successful select re-scopes from real server truth).
    expect(getStore('campaign').has('aiConfig')).toBe(true);
  });
});
