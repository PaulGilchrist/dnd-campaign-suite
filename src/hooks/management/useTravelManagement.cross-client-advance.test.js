// @maintained-by-ai
/*
 * useTravelManagement — cross-client shared-trip adoption keeps the advance
 * refs in lockstep with the SYNCED path/pathIndex (bug-travel-cross-client-
 * advance-replays-hex).
 *
 * Live fingerprint: Tab A plans a route; Tab B adopts it via the SSE echo and
 * advances one hex (server travel-pathIndex 0→1, budget charged). Tab A's
 * display mirrors the echo, but advanceOneHex drives off pathRef/pathIndexRef,
 * which pre-fix were only backfilled at mount/resume/arrival/new-destination/
 * local-advance — so Tab A's next press REPLAYED the already-traversed hex:
 * phantom budget charge + duplicate `travel advance` log row + pathIndex
 * stuck, self-healing only on the press after. A 2-hex trip cost 3 advances.
 *
 * Pinned contract (adoption-only backfill effect):
 * - an external (echo-simulated) pathIndex bump moves the refs: the next
 *   advance walks the NEXT hex exactly once, charges exactly once, and the
 *   synced index advances — no replay;
 * - an external path replacement is adopted too (advance walks the new route);
 * - a LOCAL advance remains idempotent through the echo (same refs, one
 *   charge per press).
 *
 * Lane map: mount/resume ref-seeding is owned by navigation-restore.test.js
 * (Leg 5) and the map-file adoption by map-writeback.test.js; this file owns
 * the SSE-echo adoption lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }]),
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

// Module-level store stand-in, same idiom as navigation-restore.test.js:
// writes notify the useSyncedState listeners exactly like the real store does
// when an SSE echo lands — that is the lane under test.
var _stores;
var _listeners;

function _valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === Number(b);
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => _valuesEqual(a[k], b[k]));
  }
  return false;
}

vi.mock('../runtime/useRuntimeState.js', () => {
  if (!_stores) {
    _stores = new Map();
    _listeners = new Map();
  }
  function notify(characterKey) {
    const set = _listeners.get(characterKey);
    if (set) {
      set.forEach(fn => fn());
    }
  }
  return {
    getRuntimeValue: vi.fn(() => null),
    setRuntimeObject: vi.fn((characterKey, properties) => {
      if (!properties || typeof properties !== 'object') return;
      if (!_stores.has(characterKey)) _stores.set(characterKey, new Map());
      const store = _stores.get(characterKey);
      Object.entries(properties).forEach(([k, v]) => store.set(k, v));
      notify(characterKey);
    }),
    hasRuntimeValue: vi.fn((characterKey, propertyName) => {
      const store = _stores.get(characterKey);
      return !!store && store.has(propertyName);
    }),
    // Echo-shaped setter: STORE WRITE always lands (valuesEqual only skips
    // the re-notify), matching useSyncedState's own short-circuit semantics.
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (!_stores.has(characterKey)) _stores.set(characterKey, new Map());
      const store = _stores.get(characterKey);
      const existing = store.get(propertyName);
      store.set(propertyName, value);
      if (_valuesEqual(existing, value)) return;
      notify(characterKey);
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

const { setRuntimeValue, getStore } = await import('../runtime/useRuntimeState.js');
const { calculatePath } = await import('../../services/campaign/travelService.js');

const PATH = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }];
const DEST = { q: 3, r: 0 };

const baseArgs = (partyPosition) => ({
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' },
  partyPosition,
  onPartyMove: vi.fn(),
  weather: null,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign',
});

// Simulate the SSE echo of the OTHER client's write: the store lands the
// bytes and notifies; useSyncedState mirrors them into this hook's state.
const externalWrite = (key, value) => {
  act(() => { setRuntimeValue('campaign', key, value, 'test-campaign'); });
};

describe('useTravelManagement — cross-client echo adoption re-seeds the advance refs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    calculatePath.mockReturnValue([...PATH]);
  });

  it('advance after an external pathIndex echo walks the NEXT hex once (no replay)', () => {
    const args = baseArgs({ q: 0, r: 0 });
    const { result } = renderHook(() => useTravelManagement(args));

    // Tab A plans the full 4-point route (refs seeded locally).
    act(() => { result.current.setDestinationAndPath(DEST); });
    expect(getStore('campaign').get('travel-pathIndex')).toBe(0);

    // Tab B adopts the trip via the echo and advances one hex: server truth
    // becomes pathIndex 1 / accruedCost 1 while Tab A sits idle.
    externalWrite('travel-pathIndex', 1);
    externalWrite('travel-accruedCost', 1);
    expect(result.current.pathIndex).toBe(1); // display mirrors honestly…

    // Tab A presses Advance: PRE-fix it re-walked path[1] (charge +2 with
    // pathIndex stuck at 1 and a duplicate log row). Post-fix it moves ONCE.
    let res;
    act(() => { res = result.current.advanceOneHex(); });

    expect(res.moved).toBe(true);
    expect(res.arrived).toBeUndefined();
    // The party moves to the hex Tab B had NOT yet traversed…
    expect(args.onPartyMove).toHaveBeenCalledTimes(1);
    expect(args.onPartyMove).toHaveBeenCalledWith({ q: 2, r: 0 });
    // …exactly one budget charge on top of the visitor's…
    expect(getStore('campaign').get('travel-accruedCost')).toBe(2);
    // …and the shared index advances 1→2 (stuck-at-1 was the fingerprint).
    expect(getStore('campaign').get('travel-pathIndex')).toBe(2);
  });

  it('external echo at the penultimate hex: next local advance ARRIVES (2-hex trip = 2 advances)', () => {
    // The live repro was a 3-hex route: visitor's 1 advance + the buggy
    // replay + a second press to arrive = 3 charges. Post-fix the GM's single
    // press on the echoing index lands the arrival.
    const args = baseArgs({ q: 0, r: 0 });
    const { result } = renderHook(() => useTravelManagement(args));
    act(() => { result.current.setDestinationAndPath(DEST); });

    // Visitor walked two of the three route hexes (index now penultimate).
    externalWrite('travel-pathIndex', 2);
    externalWrite('travel-accruedCost', 2);

    let res;
    act(() => { res = result.current.advanceOneHex(); });

    expect(res).toEqual({ moved: true, arrived: true });
    expect(args.onPartyMove).toHaveBeenCalledWith({ q: 3, r: 0 });
    expect(getStore('campaign').get('travel-accruedCost')).toBe(3); // not 4
    expect(result.current.travelMode).toBe('inactive');
    // Arrival clears the completed trip keys.
    expect(getStore('campaign').get('travel-pathIndex')).toBe(0);
    expect(getStore('campaign').get('travel-path')).toEqual([]);
  });

  it('external path replacement is adopted (advance walks the NEW route)', () => {
    const args = baseArgs({ q: 0, r: 0 });
    const { result } = renderHook(() => useTravelManagement(args));
    act(() => { result.current.setDestinationAndPath(DEST); });

    // The other client re-plans mid-open (e.g. cancels + re-arms a route).
    externalWrite('travel-path', [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }, { q: 0, r: 3 }]);
    externalWrite('travel-pathIndex', 1);

    let res;
    act(() => { res = result.current.advanceOneHex(); });

    expect(res.moved).toBe(true);
    // Pre-fix this replayed the OLD path[1] ({q:1,r:0}); post-fix it walks
    // the echoed route's next hex.
    expect(args.onPartyMove).toHaveBeenCalledWith({ q: 0, r: 2 });
    expect(getStore('campaign').get('travel-pathIndex')).toBe(2);
  });

  it('local advance stays idempotent through its own echo (one charge per press)', () => {
    const args = baseArgs({ q: 0, r: 0 });
    const { result } = renderHook(() => useTravelManagement(args));
    act(() => { result.current.setDestinationAndPath(DEST); });

    let res;
    act(() => { res = result.current.advanceOneHex(); });
    expect(res.moved).toBe(true);
    // The store echo of our own write lands the same bytes — refs unchanged.
    externalWrite('travel-pathIndex', getStore('campaign').get('travel-pathIndex'));
    externalWrite('travel-accruedCost', getStore('campaign').get('travel-accruedCost'));

    let res2;
    act(() => { res2 = result.current.advanceOneHex(); });
    expect(res2.moved).toBe(true);
    expect(args.onPartyMove).toHaveBeenLastCalledWith({ q: 2, r: 0 });
    expect(getStore('campaign').get('travel-pathIndex')).toBe(2);
    expect(getStore('campaign').get('travel-accruedCost')).toBe(2);
  });
});
