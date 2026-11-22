// @maintained-by-ai
/**
 * Regression: bug-character-store-ghost-keys-survive-campaign-switch.
 *
 * The d25431cab fix re-scoped only the shared 'campaign' store on campaign
 * entry. Character-KEYED store buckets (useRuntimeState.js `stores` Map keyed
 * by BARE character name) stayed seed-if-absent and were never evicted, so a
 * no-reload campaign switch leaked the PREVIOUS campaign's per-character
 * runtime keys into a SAME-NAMED creature in the new campaign. Witnessed
 * live: a fresh qa-arena `NPC 1` (B's change-data carried NO `NPC 1` key)
 * opened its allies editor PRE-CHECKING campaign A's allies ("Confirm Allies
 * (2)") and raised a full Friendly Fire confirm when arming AasimarTest as
 * target — ghost bytes read through getAllyList/hasExplicitAllyList. A page
 * RELOAD cured it (fresh store + SSE connect replay = honest face), which is
 * exactly why the enter seam must rescope the character scope too.
 *
 * The enter seam now EVICTS every character-keyed store on a real campaign
 * CHANGE (evictCharacterStores, App.jsx charScopedCampaignRef gate); the new
 * campaign's own buckets rehydrate through the reload-proven lanes (SSE
 * connect replay + the character seed effect), so the evict is memory-only.
 * Same-campaign re-select must NOT evict (the char seed effect skips a
 * re-select, so locally-derived seeds would strand).
 *
 * Pins (harness mirrors App.campaign-store-rescope.test.jsx):
 *  - A→B switch WITHOUT reload: A's `NPC 1` bucket (the confirmed-ally ghost)
 *    is unreadable under B — getRuntimeValue('NPC 1','selectedAllies') is
 *    null and the store is empty; B's own campaign-scope keys still adopt;
 *  - the evict WAKES a mounted character-store consumer (notify);
 *  - re-selecting the SAME campaign keeps live character bytes (mirror law);
 *  - B→A round trip evicts B's writes too (scope follows the campaign);
 *  - the rescope POSTs NOTHING — a stale mirror POSTing A's bucket into B is
 *    the data-pollution twin of this bug (whole-mirror law).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import {
  clearRuntimeState,
  getAllStoreKeys,
  getStore,
  getRuntimeValue,
  setRuntimeValue,
  hasRuntimeValue,
  addStorageChangeListener,
  listeners,
} from './hooks/runtime/useRuntimeState.js';

// --- Core mocks (harness parity with App.campaign-store-rescope.test.jsx) ---

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
// production `stores` Map + notify lane, not a double.
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
  },
  // The zero-character throwaway face: its OWN truth only, NO 'NPC 1' key
  // (mirrors the witnessed qa-arena GET that held no ally bucket at all).
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
// Every call is also recorded so the pins can prove the rescope POSTs nothing.
let fetchCalls;
function mockFetchPerCampaign() {
  fetchCalls = [];
  global.fetch = vi.fn((url, opts) => {
    fetchCalls.push({ url: String(url), method: opts?.method || 'GET' });
    const match = String(url).match(/\/api\/campaigns\/([^/]+)\/change-data/);
    if (match) {
      const snap = SNAPSHOTS[decodeURIComponent(match[1])];
      return Promise.resolve(jsonResponse(snap ?? {}));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

// The exact witnessed ghost lane: NPC 1's allies CONFIRMED under campaign A
// through the production setRuntimeValue write (whole-mirror POST absorbed by
// the fetch double) — not a hand-planted store entry.
function confirmNpcAlliesUnderCampaignA() {
  setRuntimeValue('NPC 1', 'selectedAllies', ['AasimarTest', 'NPC 1'], 'test-campaign');
}

// --- Test suite ---

describe('App — character-store rescope on campaign change (ghost-bucket eviction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SNAPSHOTS = { ...DEFAULT_SNAPSHOTS };
    for (const key of getAllStoreKeys()) clearRuntimeState(key);
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

  it('A→B switch WITHOUT reload evicts A\'s NPC 1 bucket (the ghost selectedAllies is unreadable under B)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    confirmNpcAlliesUnderCampaignA();
    expect(getRuntimeValue('NPC 1', 'selectedAllies')).toEqual(['AasimarTest', 'NPC 1']);

    // Same tab, no reload: back to the picker, into the zero-character
    // throwaway whose server snapshot carries NO 'NPC 1' key.
    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    mockState.characters = [];
    await selectCampaign();

    // The ghost is GONE: B's fresh same-named creature now reads the honest
    // self-only default (getAllyList's [creatureName] fallback) and
    // hasExplicitAllyList is false — no pre-checked modal, no friendly-fire
    // confirm gating target arming.
    expect(hasRuntimeValue('NPC 1', 'selectedAllies')).toBe(false);
    expect(getRuntimeValue('NPC 1', 'selectedAllies')).toBeNull();
    expect(getStore('NPC 1').size).toBe(0);
    // The campaign-scope lane from d25431cab is unchanged: B's own truth adopts.
    expect(getStore('campaign').get('travel-mode')).toBe('planning');
  });

  it('the evict WAKES a mounted character-store consumer (notify)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    confirmNpcAlliesUnderCampaignA();
    const woke = vi.fn();
    addStorageChangeListener('NPC 1', woke);

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    await selectCampaign();

    // Consumers registered on the character key are notified, so a card/modal
    // mounted across the switch re-reads (declared defaults win) — no reload.
    expect(woke).toHaveBeenCalled();
  });

  it('re-selecting the SAME campaign keeps live character bytes (mirror law)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    confirmNpcAlliesUnderCampaignA();
    // Seed-effect-shaped local key (never POSTed on its own): must survive too.
    getStore('NPC 1').set('targetName', 'AasimarTest');

    // Back to the picker and re-enter the SAME campaign (the Admin-clear
    // re-select pass).
    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    await selectCampaign();

    // Character scope: untouched on a same-campaign re-select — the char seed
    // effect skips a re-select (seededCampaignRef gate), so evicting here
    // would strand locally-derived seeds until a reload.
    expect(getRuntimeValue('NPC 1', 'selectedAllies')).toEqual(['AasimarTest', 'NPC 1']);
    expect(getRuntimeValue('NPC 1', 'targetName')).toBe('AasimarTest');
  });

  it('B→A round trip evicts B\'s writes too (scope follows the campaign)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    await selectCampaign();
    setRuntimeValue('Goblin', 'activeConditions', ['Poisoned'], 'qa-starter');
    expect(getRuntimeValue('Goblin', 'activeConditions')).toEqual(['Poisoned']);

    // Round trip back into test-campaign.
    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'test-campaign';
    await selectCampaign();

    expect(getStore('Goblin').size).toBe(0);
    // Eviction is not sticky in campaign scope: A's snapshot re-adopts.
    expect(getStore('campaign').get('aiConfig')).toEqual(GHOST_AI_CONFIG);
  });

  it('the character rescope POSTs NOTHING (memory-only skipSync law)', async () => {
    mockState.characters = [];
    render(<App />);
    await selectCampaign();
    confirmNpcAlliesUnderCampaignA();
    fetchCalls.length = 0;

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    mockState.campaignName = 'qa-starter';
    await selectCampaign();

    // Ghost bytes evict LOCALLY only. A POST of A's NPC 1 mirror to B would be
    // the cross-campaign data-pollution twin of this bug (whole-mirror law).
    const pollutingPosts = fetchCalls.filter(
      (c) => c.method === 'POST' && /\/api\/campaigns\/qa-starter\/NPC/.test(c.url)
    );
    expect(pollutingPosts).toEqual([]);
    // And A's bucket must not be re-POSTed to A either during the switch.
    const aResends = fetchCalls.filter(
      (c) => c.method === 'POST' && /\/api\/campaigns\/test-campaign\/NPC/.test(c.url)
    );
    expect(aResends).toEqual([]);
  });
});
