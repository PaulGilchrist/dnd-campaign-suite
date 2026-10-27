// @maintained-by-ai
/*
 * useTravelManagement — cleared-key null echoes must never blank the SPA
 * (bug-hex-arrival-null-echo-blank-screen, 2026-10-27 run L).
 *
 * Live defect: arrival's clearCompletedTripKeys per-key DELETEs broadcast
 * `data: null` change-echoes (campaigns-changedata.js DELETE publishes null);
 * the 947b9702c mirror stored the raw null for travel-path, and the hook's
 * render-phase `path.length` threw TypeError inside useTravelManagement —
 * with no error boundary the ENTIRE app blanked until reload.
 *
 * Pinned contract (two layers):
 * - root fix (App.jsx applyStoreUpdate): a null echo REMOVES the campaign
 *   key, so the hook observes its declared idle defaults (destination null,
 *   path [], pathIndex 0) — locked by App.runtime-events.test.jsx;
 * - defensive guard (this file): even a RAW null in the mirror (any future
 *   lane) renders null-proof — safePath/safePathIndex coerce, and the hook's
 *   returned path/pathIndex keep downstream consumers (HexMap next-hex read,
 *   TravelPanel, TravelPathLayer) off the crash path;
 * - the full arrival sequence (advance to the last hex → mode inactive +
 *   idle trip bytes + per-key DELETE fetches) never throws and lands the
 *   same idle values.
 *
 * Lane map: trip-key REMOVAL via setRuntimeObject + the DELETE fetch trio
 * are pinned by useTravelManagement.test.js (:344+); this file owns the
 * echo-tolerance of the render paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

// Real anchors: cost 1 per hex, budget 6 (same shape as the
// navigation-restore harness) so the 1-hex trip advances cleanly.
vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }]),
  getDailyHexBudget: vi.fn(() => 6),
  getHexMoveCostWithRoad: vi.fn(() => 1),
  HORSEBACK_SPEED_MULTIPLIER: 2,
  TRAVEL_PACES: [
    { id: 'slow', name: 'Slow' },
    { id: 'normal', name: 'Normal' },
    { id: 'fast', name: 'Fast' },
  ],
  EXHAUSTION_LEVELS: 6,
  applyExhaustionSpeedPenaltyToBudget: vi.fn((budget) => budget),
  getExhaustionMultiplierPercent: vi.fn((hours) => Math.round(Math.pow(5 / 6, hours) * 100)),
}));

vi.mock('../../services/campaign/randomEventService.js', () => ({
  shouldTriggerEvent: vi.fn(() => false),
  generateRandomEvent: vi.fn(() => ({ type: 'encounter', title: 'Random Event' })),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(() => []),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasSelfRestoration: vi.fn(() => false),
}));

// Module-level stores/listeners stand in for the app's module-level runtime
// store (same rig as useTravelManagement.day-exhausted-init.test.js).
var _stores;
var _listeners;

vi.mock('../runtime/useRuntimeState.js', () => {
  if (!_stores) {
    _stores = new Map();
    _listeners = new Map();
  }
  return {
    getRuntimeValue: vi.fn(() => null),
    setRuntimeObject: vi.fn((characterKey, properties) => {
      if (!properties || typeof properties !== 'object') return;
      if (!_stores.has(characterKey)) _stores.set(characterKey, new Map());
      const store = _stores.get(characterKey);
      Object.entries(properties).forEach(([k, v]) => store.set(k, v));
      const set = _listeners.get(characterKey);
      if (set) set.forEach(fn => fn());
    }),
    hasRuntimeValue: vi.fn((characterKey, propertyName) => {
      const store = _stores.get(characterKey);
      return !!store && store.has(propertyName);
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (!_stores.has(characterKey)) _stores.set(characterKey, new Map());
      _stores.get(characterKey).set(propertyName, value);
      const set = _listeners.get(characterKey);
      if (set) set.forEach(fn => fn());
    }),
    getStore: vi.fn((key) => {
      if (!_stores.has(key)) {
        _stores.set(key, new Map());
      }
      return _stores.get(key);
    }),
    listeners: _listeners,
  };
});

const { getStore, listeners } = await import('../runtime/useRuntimeState.js');

const PATH = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
const DEST = { q: 1, r: 0 };

const baseArgs = (overrides = {}) => ({
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains' },
  partyPosition: { q: 0, r: 0 },
  onPartyMove: vi.fn(),
  weather: null,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign',
  ...overrides,
});

// Live one-hex trip bytes (advanceOneHex drives off the refs, which seed from
// the mount-time SYNCED values — this store IS the synced path).
const seedTrip = () => {
  const store = getStore('campaign');
  store.set('travel-mode', 'traveling');
  store.set('travel-destination', DEST);
  store.set('travel-path', PATH);
  store.set('travel-pathIndex', 0);
  store.set('travel-accruedCost', 0);
  store.set('travel-dailyBudget', 6);
  return store;
};

// Simulate the SSE fan-out the store mirror performs after App.jsx applies a
// change-echo (notify('campaign') wakes every useSyncedState listener).
const echoCampaignStore = (mutate) => {
  act(() => {
    mutate(getStore('campaign'));
    const set = listeners.get('campaign');
    if (set) set.forEach(fn => fn());
  });
};

describe('useTravelManagement — cleared-key null echoes (blank-screen regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('renders null-proof when a RAW null echo lands on travel-path/pathIndex', () => {
    seedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));
    expect(result.current.hexesRemaining).toBe(1);

    // The exact pre-fix crash feed: the 947b9702c mirror storing raw null.
    echoCampaignStore((store) => {
      store.set('travel-path', null);
      store.set('travel-pathIndex', null);
    });

    expect(result.current.path).toEqual([]);
    expect(result.current.pathIndex).toBe(0);
    expect(result.current.currentPosition).toBeNull();
    expect(result.current.remainingSteps).toEqual([]);
    expect(result.current.hexesRemaining).toBe(0);
  });

  it('falls back to declared defaults when the root fix REMOVES the cleared keys', () => {
    seedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    // App.jsx applyStoreUpdate semantics post-fix: null echo ⇒ store.delete.
    echoCampaignStore((store) => {
      store.delete('travel-destination');
      store.delete('travel-path');
      store.delete('travel-pathIndex');
    });

    expect(result.current.destination).toBeNull();
    expect(result.current.path).toEqual([]);
    expect(result.current.pathIndex).toBe(0);
    expect(result.current.hexesRemaining).toBe(0);
  });

  it('full 1-hex arrival never throws and parks the trip on idle bytes', () => {
    seedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    let moved;
    act(() => { moved = result.current.advanceOneHex(); });
    expect(moved).toEqual({ moved: true, arrived: true });

    // clearCompletedTripKeys: local idle park + per-key DELETE trio.
    const store = getStore('campaign');
    expect(store.get('travel-path')).toEqual([]);
    expect(store.get('travel-pathIndex')).toBe(0);
    expect(store.get('travel-destination')).toBeNull();
    const deleted = global.fetch.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([url]) => decodeURIComponent(url));
    expect(deleted).toEqual([
      '/api/campaigns/test-campaign/travel-destination',
      '/api/campaigns/test-campaign/travel-path',
      '/api/campaigns/test-campaign/travel-pathIndex',
    ]);

    // The server's null echoes arriving AFTER the local park (the pre-fix
    // fatal beat) — the hook must survive and stay idle.
    echoCampaignStore((s) => {
      s.set('travel-path', null);
      s.set('travel-pathIndex', null);
      s.set('travel-destination', null);
    });
    expect(result.current.path).toEqual([]);
    expect(result.current.hexesRemaining).toBe(0);
    expect(result.current.currentPosition).toBeNull();
  });
});
