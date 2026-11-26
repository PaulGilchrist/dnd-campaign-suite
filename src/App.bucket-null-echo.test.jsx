// @maintained-by-ai 2026-11-20
/**
 * Regression: bug-character-bucket-delete-echo-never-self-heals.
 *
 * The wildcard change-data DELETE route (server/routes/campaigns-changedata.js)
 * evicts a whole character bucket and publishes an UNCONDITIONAL null
 * `change-<campaign>-<key>` echo whose own comment promises "stale local copies
 * on other tabs self-heal". handleChangeKeyEvent used to mirror null echoes
 * only for isCampaignKey storeKeys — a CHARACTER-key null echo was silently
 * dropped, so every mounted tab kept phantom badges/rows (e.g. the GM Screen
 * `ElderPaladin — Poisoned` In-Play line) until a full page reload.
 *
 * Rides the App.runtime-events.test.jsx harness with the REAL runtime-state
 * module (importActual), so eviction is proven through the production
 * echo-adoption lane (applyStoreUpdate → replaceRuntimeObject), not a double:
 *  - bystander tab: bucket primed by another client's full-bucket POST echo →
 *    the null DELETE echo evicts every local key and wakes the store listeners
 *    (declared defaults win) without ever re-POSTing (memory-only skipSync law);
 *  - actor tab: bucket primed by this tab's own setRuntimeObject write → the
 *    same echo self-heals it (there is no local character-bucket DELETE API
 *    lane, so the echo path IS the actor's only heal route);
 *  - missing-key DELETE (404 leg still publishes null): an inert remove — no
 *    crash, nothing stored, no notify;
 *  - never a stored null in a character bucket (hex-arrival-null-echo crash
 *    precedent) and non-null scalar character echoes stay dropped as corrupt
 *    noise;
 *  - the campaign-key null-echo lane is byte-unchanged (key REMOVE + notify).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import {
  clearRuntimeState,
  getStore,
  getRuntimeValue,
  hasRuntimeValue,
  replaceRuntimeObject,
  setRuntimeObject,
  addStorageChangeListener,
  listeners,
} from './hooks/runtime/useRuntimeState.js';
import * as campaignService from './services/campaign/campaignService.js';
import { loadMaps } from './services/maps/mapsService.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber.
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

// --- Core mocks (harness parity with App.runtime-events.test.jsx) ---

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

// useRuntimeState stays REAL (importActual): the eviction must be proven on the
// production store + echo-adoption lane, not a double.
vi.mock('./hooks/runtime/useRuntimeState.js', async () => {
  const actual = await vi.importActual('./hooks/runtime/useRuntimeState.js');
  return { ...actual };
});

// Network boundary for character CRUD (HTTP semantics owned elsewhere).
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

// Subscriber double that captures the handler so tests can push SSE events
// through the exact dispatch table the real SSE connection feeds.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: ({ handleEvent }) => {
    subscriberMock.props.handleEvent = handleEvent;
    return null;
  },
}));

// --- Helpers ---

const PARTY = [{ name: 'ElderPaladin', level: 1 }];

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

async function renderInCampaign(characters = PARTY) {
  mockState.characters = characters;
  render(<App />);
  await selectCampaign();
}

// Push an SSE event through the captured App handler.
function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

// --- Test suite ---

describe('App — character-bucket cleared-key (null) echo self-heal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriberMock.props.handleEvent = null;
    clearRuntimeState('ElderPaladin');
    clearRuntimeState('GhostChar');
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

    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({})));

    campaignService.updateCharacter.mockImplementation(async () => {});
    loadMaps.mockResolvedValue({ maps: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bystander tab: the null DELETE echo evicts a bucket primed by a POST echo and wakes consumers without re-POSTing', async () => {
    await renderInCampaign();

    // Another client's POST echo primes the local bucket (full-snapshot adopt).
    await dispatch({
      key: 'change-test-campaign-ElderPaladin',
      data: { activeConditions: ['Poisoned'], currentHitPoints: 224 },
    });
    expect(getRuntimeValue('ElderPaladin', 'activeConditions')).toEqual(['Poisoned']);

    const woke = vi.fn();
    addStorageChangeListener('ElderPaladin', woke);
    const fetchesBefore = global.fetch.mock.calls.length;

    // The DELETE echo (server evicted the key, publishes unconditional null).
    await dispatch({ key: 'change-test-campaign-ElderPaladin', data: null });

    // Whole bucket gone — declared defaults win, never a stored null.
    expect(hasRuntimeValue('ElderPaladin', 'activeConditions')).toBe(false);
    expect(hasRuntimeValue('ElderPaladin', 'currentHitPoints')).toBe(false);
    expect(getRuntimeValue('ElderPaladin', 'activeConditions')).toBeNull();
    expect([...getStore('ElderPaladin').keys()]).toHaveLength(0);
    // Mounted consumers are woken (the GM Screen In-Play row re-renders away).
    expect(woke).toHaveBeenCalled();
    // Memory-only skipSync law: adopting an echo never re-POSTs.
    expect(global.fetch.mock.calls.length).toBe(fetchesBefore);
  });

  it('actor tab: the same echo self-heals a bucket this tab wrote locally (no local DELETE lane)', async () => {
    await renderInCampaign();

    // This tab's own store write (setRuntimeValue/setRuntimeObject lane) —
    // exactly how the acting tab's mirror holds the bucket before a DELETE
    // issued outside the store API (e.g. curl / another tooling lane).
    setRuntimeObject('ElderPaladin', { activeConditions: ['Poisoned'] }, 'test-campaign');
    expect(hasRuntimeValue('ElderPaladin', 'activeConditions')).toBe(true);

    await dispatch({ key: 'change-test-campaign-ElderPaladin', data: null });

    expect(hasRuntimeValue('ElderPaladin', 'activeConditions')).toBe(false);
    expect(getRuntimeValue('ElderPaladin', 'activeConditions')).toBeNull();
  });

  it('missing-key DELETE (404 leg, echo still fires) is an inert remove — no crash, nothing stored', async () => {
    await renderInCampaign();

    const woke = vi.fn();
    addStorageChangeListener('GhostChar', woke);

    await dispatch({ key: 'change-test-campaign-GhostChar', data: null });

    expect(getStore('GhostChar').size).toBe(0);
    expect(hasRuntimeValue('GhostChar', 'activeConditions')).toBe(false);
    // An empty bucket is an empty snapshot replace: zero notify on no change.
    expect(woke).not.toHaveBeenCalled();
    // And the app shell survived the echo.
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });

  it('non-null scalar echo on a character key stays corrupt noise — bucket survives untouched', async () => {
    await renderInCampaign();

    replaceRuntimeObject('ElderPaladin', { activeConditions: ['Poisoned'] });

    await dispatch({ key: 'change-test-campaign-ElderPaladin', data: 'corrupt' });

    expect(getRuntimeValue('ElderPaladin', 'activeConditions')).toEqual(['Poisoned']);
  });

  it('campaign-key null-echo lane is unchanged: null echo REMOVES the key and wakes the campaign store', async () => {
    await renderInCampaign();

    // Mirror an armed top-level targetEffects row set through its object echo.
    await dispatch({
      key: 'change-test-campaign-targetEffects',
      data: [{ targetName: 'ElderPaladin', effect: 'poisoned' }],
    });
    expect(getStore('campaign').has('targetEffects')).toBe(true);

    const woke = vi.fn();
    addStorageChangeListener('campaign', woke);

    await dispatch({ key: 'change-test-campaign-targetEffects', data: null });

    // Removed, never stored as null (the campaign branch's byte-unchanged law).
    expect(getStore('campaign').has('targetEffects')).toBe(false);
    expect(woke).toHaveBeenCalled();
  });
});
