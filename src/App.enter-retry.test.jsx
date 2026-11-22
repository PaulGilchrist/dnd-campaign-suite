// @maintained-by-ai
/**
 * App enter-gate escape pins (backlog TT 2026-11-22):
 *
 * The enter-seam change-data GET gates ALL campaign rendering. Before the
 * fix, a stalled socket pinned the tab on `Loading campaign...` forever and
 * a fast GET failure (500/network) merely logged — no user-visible escape.
 * Now App's enter lane (useCampaignEnterGate):
 *  1. races the gate load against CAMPAIGN_ENTER_TIMEOUT_MS — past it the
 *     face flips to CampaignEnterFailed (role="alert" + visible Retry,
 *     clearly distinct from the busy overlay),
 *  2. Retry re-issues the enter read (begin + strict preload join ONE GET)
 *     and a subsequent success renders the campaign IN THE SAME TAB (no
 *     window.location.reload),
 *  3. a fast rejection (e.g. a 500 carrying changeDataStatus) lands on the
 *     SAME failure face without burning the timeout,
 *  4. a normal successful enter NEVER shows the failure face (no flicker),
 *     and the seam never fans out duplicate concurrent GETs,
 *  5. the face's `Back to Campaigns` escape returns to campaign selection in
 *     the SAME tab (no reload) via App's ONE back-to-selection lane, and a
 *     re-select re-runs the enter seam fresh.
 *
 * Mock timers throughout — no wall-clock burn. The change-data snapshot lane
 * is doubled so the App-level pins can watch begin/abandon call-shape; the
 * physical abort/fresh-GET law is pinned in changeDataSnapshot.test.js.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';
import { CAMPAIGN_ENTER_TIMEOUT_MS } from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

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

// The gate load joins the enter GET through the combatData lane — double it
// so each attempt's outcome (stall / reject / resolve) is driven per test.
const gateLoad = vi.hoisted(() => ({ calls: [], settles: [] }));
vi.mock('./services/encounters/combatData.js', async () => ({
  loadCombatSummary: vi.fn((name, opts) => {
    const settled = new Promise((resolve, reject) => {
      gateLoad.settles.push({ name, opts, resolve, reject });
    });
    gateLoad.calls.push({ name, opts });
    return settled;
  }),
  setCombatSummaryCache: vi.fn(),
  getCombatSummary: vi.fn(() => null),
}));

// Snapshot lane doubled: App-level pins watch the enter begin/abandon shape;
// the abort + fresh-GET physics are pinned in changeDataSnapshot.test.js.
vi.mock('./services/campaign/changeDataSnapshot.js', () => ({
  beginCampaignChangeDataEntry: vi.fn(),
  readCampaignChangeData: vi.fn(async () => ({})),
  fetchCampaignChangeData: vi.fn(async () => ({})),
  abandonCampaignChangeDataEntry: vi.fn(),
}));

vi.mock('./hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeObject: vi.fn(),
  replaceRuntimeObject: vi.fn(),
  evictCharacterStores: vi.fn(),
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
  default: function MockSubscriber() { return null; },
}));

// --- Helpers ---

function setLocalhost(hostname) {
  Object.defineProperty(window, 'location', {
    value: { hostname, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

function setupDataLoaderMocks() {
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
}

/** Drain microtasks/promises while fake timers stay frozen at "now". */
async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

/** Mount, land on the picker, click into the campaign (seam opens). */
async function selectCampaign() {
  await flush();
  await act(async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
  });
  await flush();
}

/** Advance past the bounded enter timeout (stall escape fires). */
async function stallPastTimeout() {
  await act(async () => {
    vi.advanceTimersByTime(CAMPAIGN_ENTER_TIMEOUT_MS + 10);
  });
  await flush();
}

const failureFace = () => document.querySelector('.campaign-enter-failed');

describe('App enter gate: bounded stall escape + unified failure/Retry face', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    gateLoad.calls.length = 0;
    gateLoad.settles.length = 0;

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

    setLocalhost('localhost');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    localStorage.clear();
    setupDataLoaderMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('a stalled enter GET past the timeout swaps the busy face for the Retry face', async () => {
    render(<App />);
    await selectCampaign();

    // While the seam is pending the busy face renders exactly as before.
    expect(document.querySelector('.loading-overlay')).not.toBeNull();
    expect(screen.getByText('Loading campaign...')).toBeInTheDocument();
    expect(failureFace()).toBeNull();
    // ONE enter read, zero fan-out while the socket is held.
    expect(gateLoad.calls).toHaveLength(1);

    await stallPastTimeout();

    // Honest failure face: alert tier + Retry control, busy overlay gone.
    const face = failureFace();
    expect(face).not.toBeNull();
    expect(face).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(document.querySelector('.loading-overlay')).toBeNull();
    // The stalled seam is ABANDONED (releases the socket/slot for the retry).
    const snapshot = await import('./services/campaign/changeDataSnapshot.js');
    expect(snapshot.abandonCampaignChangeDataEntry).toHaveBeenCalledWith('test-campaign');
    // No extra GETs were fanned out by the timeout itself.
    expect(gateLoad.calls).toHaveLength(1);
  });

  it('Retry re-issues the enter GET; the server answering lands the campaign in the same tab', async () => {
    render(<App />);
    await selectCampaign();
    await stallPastTimeout();
    expect(failureFace()).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    await flush();

    // The enter read was re-issued (fresh begin + strict preload join).
    expect(gateLoad.calls).toHaveLength(2);
    expect(gateLoad.calls[1].opts).toEqual({ strict: true });
    const snapshot = await import('./services/campaign/changeDataSnapshot.js');
    expect(snapshot.beginCampaignChangeDataEntry).toHaveBeenCalledTimes(2);
    // The face is replaced by the busy face while the retry is in flight.
    expect(failureFace()).toBeNull();
    expect(document.querySelector('.loading-overlay')).not.toBeNull();

    // Server answers the retry → campaign renders, NO page reload.
    await act(async () => {
      gateLoad.settles[1].resolve({ round: 1, creatures: [] });
    });
    await flush();

    expect(failureFace()).toBeNull();
    expect(document.querySelector('.loading-overlay')).toBeNull();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('a fast GET failure (500) reaches the SAME failure/Retry face without the timeout', async () => {
    render(<App />);
    await selectCampaign();

    // Reject exactly like the strict lane does on not-ok (changeDataStatus).
    const err = new Error('change-data fetch failed (500) for test-campaign');
    err.changeDataStatus = 500;
    err.changeDataStatusText = 'Server Error';
    await act(async () => {
      gateLoad.settles[0].reject(err);
    });
    await flush();

    const face = failureFace();
    expect(face).not.toBeNull();
    expect(face).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(document.querySelector('.loading-overlay')).toBeNull();
    // Fast-fail never needed the stall clock (no busy-face wall past settle).
    await act(async () => {
      vi.advanceTimersByTime(CAMPAIGN_ENTER_TIMEOUT_MS + 10);
    });
    expect(failureFace()).not.toBeNull(); // stays failed, no second attempt fanned out
    expect(gateLoad.calls).toHaveLength(1);
  });

  it('a normal successful enter never flickers the Retry face', async () => {
    render(<App />);
    await selectCampaign();

    expect(failureFace()).toBeNull();
    expect(document.querySelector('.loading-overlay')).not.toBeNull();

    // Answer UNDER the timeout — busy face straight to the shell.
    await act(async () => {
      gateLoad.settles[0].resolve({ round: 2, creatures: [{ name: 'Thorndeer' }] });
    });
    await flush();

    expect(failureFace()).toBeNull();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    // Even advancing past the (now-cleared) timeout after success, the face
    // stays clean: no delayed stall escape, no Retry chrome ever mounted.
    await stallPastTimeout();
    expect(failureFace()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('Back to Campaigns escapes the failure face to selection in-tab, and re-selecting re-runs the seam', async () => {
    render(<App />);
    await selectCampaign();
    await stallPastTimeout();
    expect(failureFace()).not.toBeNull();

    // The escape rides App's ONE back-to-selection lane (sidebar "Campaigns"
    // seam): swaps to the picker immediately, no reload, failure card gone.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to Campaigns' }));
    });
    await flush();

    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    expect(failureFace()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();

    // Re-selecting re-runs the enter seam fresh (existing gate behavior):
    // busy face while in flight, no stale failure face resurrected.
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-campaign-btn'));
    });
    await flush();

    expect(gateLoad.calls).toHaveLength(2);
    expect(gateLoad.calls[1].opts).toEqual({ strict: true });
    expect(failureFace()).toBeNull();
    expect(document.querySelector('.loading-overlay')).not.toBeNull();

    // Server answers the fresh attempt → campaign lands in the same tab.
    await act(async () => {
      gateLoad.settles[1].resolve({ round: 1, creatures: [] });
    });
    await flush();

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
