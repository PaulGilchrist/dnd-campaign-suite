// @maintained-by-ai
/*
 * useTravelManagement — trip-owner stamp release lanes (backlog 2026-10-27).
 *
 * Live defect: releaseTripOwner was wired ONLY into cancelTravel; the code
 * comment claimed "arrival lands through the same inactive seam" but the
 * arrival cleanup (clearCompletedTripKeys) never released, so travel-started-by
 * held the finished trip's owner uuid until the NEXT trip's startPlanning
 * re-stamped it (live read 27-L: key still holds the owner uuid post-arrival).
 *
 * Pinned contract:
 * - startPlanning claims: the store carries this tab's session id;
 * - ARRIVAL (final-hex advance) releases through cancel's EXACT lane: the
 *   shared releaseTripOwner null-write (setRuntimeValue('campaign',
 *   'travel-started-by', null) → server POST {value:null}) — the key parks
 *   on null, it is NEVER added to the per-key DELETE trio (that lane is the
 *   hex-editor null-echo crash path, travel keys only);
 * - cancel still releases (unchanged);
 * - a fresh trip after arrival re-claims a live owner;
 * - the arrival trip-key DELETE trio (destination/path/pathIndex) is
 *   byte-identical to before the fix.
 *
 * travelSession.js is NOT mocked: its claim/release ride the mocked
 * runtime-store lane below (same rig as useTravelManagement.null-echo.test.js),
 * so the observable write on the campaign store IS the release mechanism.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';
import { getSessionId, TRIP_OWNER_KEY } from '../../services/maps/travelSession.js';

// Real anchors: cost 1 per hex, budget 6 (same shape as the null-echo
// harness) so the 1-hex trip advances cleanly to arrival.
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
// store (same rig as useTravelManagement.null-echo.test.js).
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

const { getStore, setRuntimeValue } = await import('../runtime/useRuntimeState.js');

const DEST = { q: 1, r: 0 };
const OWNER_NULL_WRITE = (calls) => calls.some(
  ([key, prop, value]) => key === 'campaign' && prop === TRIP_OWNER_KEY && value === null
);

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

// Live one-hex trip bytes owned by THIS tab (advanceOneHex drives off the
// refs, which seed from the mount-time SYNCED values — this store IS the
// synced path; the owner stamp mirrors a startPlanning claim).
const seedOwnedTrip = () => {
  const store = getStore('campaign');
  store.set('travel-mode', 'traveling');
  store.set('travel-destination', DEST);
  store.set('travel-path', [{ q: 0, r: 0 }, { q: 1, r: 0 }]);
  store.set('travel-pathIndex', 0);
  store.set('travel-accruedCost', 0);
  store.set('travel-dailyBudget', 6);
  store.set(TRIP_OWNER_KEY, getSessionId());
  return store;
};

describe('useTravelManagement — trip-owner claim/release lanes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('startPlanning claims ownership with this tab\'s live session id', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs()));
    act(() => { result.current.startPlanning(); });

    expect(getStore('campaign').get(TRIP_OWNER_KEY)).toBe(getSessionId());
  });

  it('arrival (final-hex advance) releases the stamp via cancel\'s null-write lane', () => {
    const store = seedOwnedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    let moved;
    act(() => { moved = result.current.advanceOneHex(); });
    expect(moved).toEqual({ moved: true, arrived: true });

    // Release rides setRuntimeValue('campaign', 'travel-started-by', null)
    // — the same shared lane cancelTravel uses (server POST {value:null}).
    expect(OWNER_NULL_WRITE(setRuntimeValue.mock.calls)).toBe(true);
    expect(store.get(TRIP_OWNER_KEY)).toBeNull();

    // NOT the per-key DELETE lane (that path is reserved for the completed
    // trip keys; the owner stamp must never join it — hex-editor null-echo).
    const deleted = global.fetch.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([url]) => decodeURIComponent(url));
    expect(deleted).toEqual([
      '/api/campaigns/test-campaign/travel-destination',
      '/api/campaigns/test-campaign/travel-path',
      '/api/campaigns/test-campaign/travel-pathIndex',
    ]);

    // Trip semantics untouched: idle park + day-state keys survive arrival.
    expect(store.get('travel-destination')).toBeNull();
    expect(store.get('travel-path')).toEqual([]);
    expect(store.get('travel-pathIndex')).toBe(0);
    expect(store.get('travel-accruedCost')).toBeDefined();
    expect(store.get('travel-dailyBudget')).toBeDefined();
  });

  it('cancelTravel still releases the stamp', () => {
    const store = seedOwnedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    act(() => { result.current.cancelTravel(); });

    expect(OWNER_NULL_WRITE(setRuntimeValue.mock.calls)).toBe(true);
    expect(store.get(TRIP_OWNER_KEY)).toBeNull();
    expect(global.fetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
  });

  it('a fresh trip after arrival re-claims a live owner', () => {
    seedOwnedTrip();
    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    act(() => { result.current.advanceOneHex(); });
    expect(getStore('campaign').get(TRIP_OWNER_KEY)).toBeNull();

    act(() => { result.current.startPlanning(); });
    expect(getStore('campaign').get(TRIP_OWNER_KEY)).toBe(getSessionId());
  });
});
