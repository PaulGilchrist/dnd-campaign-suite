// @maintained-by-ai
/*
 * useTravelManagement — trip survives view navigation (backlog 2026-10-26-E,
 * owner design decision: clicking away mid-trip stays FREE and must never
 * disturb the trip).
 *
 * Live seam: a sidebar click unmounts HexMap (App.jsx conditionally renders
 * the views) and re-clicking Maps remounts it. The runtime store is module-
 * level, so every travel-* key survives the excursion; the fresh hook instance
 * re-reads them through useSyncedState's mount-time store read, and the file
 * resume lane (initialTravelState from useMapLoader) must stay SILENT because
 * change-data is the authority (hasRuntimeValue guard).
 *
 * Pinned contract:
 * - unmounting mid-trip performs ZERO change-data writes (no cancel, no key
 *   removal — leaving the map is not leaving the trip);
 * - remount restores destination/path/pathIndex/accruedCost/budget byte-
 *   identical (no new trip started, nothing cleared);
 * - a restore-only mount (initialTravelState arriving late, mirroring the
 *   async map-file load) writes NOTHING until the user acts, and never
 *   re-adopts the file trip over the live store bytes;
 * - Advance from the restored state moves the party (refs re-seeded at mount).
 *
 * Lane map: publisher snapshot shapes are owned by useTravelManagement.
 * map-writeback.test.js; tool-sync reopen immunity by useTravelToolSync.
 * test.js; this file owns the hook unmount→remount restore itself.
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

// Module-level stores/listeners stand in for the app's module-level runtime
// store: they OUTLIVE every renderHook instance, exactly like the real store
// outlives a HexMap unmount → sidebar excursion → remount.
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

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

const { setRuntimeValue, getStore } = await import('../runtime/useRuntimeState.js');

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

// The exact buildPublishSnapshot bytes a mid-route trip writes back to the
// map file (what useMapLoader reads on reopen → initialTravelState).
const fileTripSnapshot = (overrides = {}) => ({
  travelMode: 'traveling',
  travelPace: 'normal',
  destination: DEST,
  path: PATH,
  pathIndex: 1,
  accruedCost: 1,
  dailyBudget: 6,
  dayExhausted: false,
  forcedMarchHours: 0,
  ...overrides,
});

describe('useTravelManagement — trip survives view navigation (unmount → remount)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('restores the FULL trip after navigating away and back, with zero writes on the excursion and restore', () => {
    // ── Leg 1: plan + advance on the map view ──
    const first = renderHook(() => useTravelManagement(baseArgs({ q: 0, r: 0 })));
    act(() => { first.result.current.setDestinationAndPath(DEST); });
    let res;
    act(() => { res = first.result.current.advanceOneHex(); });
    expect(res.moved).toBe(true);

    const before = {
      travelMode: first.result.current.travelMode,
      destination: first.result.current.destination,
      pathIndex: first.result.current.pathIndex,
      accruedCost: first.result.current.accruedCost,
      dailyBudget: first.result.current.dailyBudget,
    };
    expect(before).toEqual({ travelMode: 'traveling', destination: DEST, pathIndex: 1, accruedCost: 1, dailyBudget: 6 });

    // ── Leg 2: sidebar click → HexMap unmounts. Leaving is NOT leaving the
    // trip: the unmount must write no travel key (no cancel, no removals). ──
    setRuntimeValue.mockClear();
    first.unmount();
    const cancelWrites = setRuntimeValue.mock.calls.filter(
      ([who, key]) => who === 'campaign' && String(key).startsWith('travel-'),
    );
    expect(cancelWrites).toEqual([]);

    // The store still carries every trip key (module-level store survives).
    const store = getStore('campaign');
    expect(store.get('travel-mode')).toBe('traveling');
    expect(store.get('travel-destination')).toEqual(DEST);
    expect(store.get('travel-path')).toHaveLength(4);
    expect(store.get('travel-pathIndex')).toBe(1);
    expect(store.get('travel-accruedCost')).toBe(1);

    // ── Leg 3: Maps → open the hex map again. Fresh hook instance, party at
    // the advanced position. Cold mount reads the LIVE store bytes. ──
    setRuntimeValue.mockClear();
    const onTravelStateChange = vi.fn();
    const second = renderHook(() =>
      useTravelManagement({ ...baseArgs({ q: 1, r: 0 }), onTravelStateChange })
    );

    // Panel state re-adopts EXACTLY: identical to pre-navigation values.
    expect(second.result.current.travelMode).toBe(before.travelMode);
    expect(second.result.current.destination).toEqual(before.destination);
    expect(second.result.current.path).toEqual(PATH);
    expect(second.result.current.pathIndex).toBe(before.pathIndex);
    expect(second.result.current.accruedCost).toBe(before.accruedCost);
    expect(second.result.current.dailyBudget).toBe(before.dailyBudget);
    expect(second.result.current.isTravelActive).toBe(true);

    // Restore-only mount = ZERO change-data writes (no new trip, no
    // re-adoption, no cancel — the hasRuntimeValue authority guard).
    const restoreWrites = setRuntimeValue.mock.calls.filter(
      ([who, key]) => who === 'campaign' && String(key).startsWith('travel-'),
    );
    expect(restoreWrites).toEqual([]);
    // The restored bytes are what the publisher would re-confirm against the
    // file lane — byte-identical, so the loader dirty-gate emits zero PUTs.
    const published = onTravelStateChange.mock.calls.map(([s]) => s);
    published.forEach(s => { expect(s).toEqual(fileTripSnapshot()); });

    // ── Leg 4: the async map-file load lands its travelState (useMapLoader
    // travelInit) — change-data stays the authority; nothing re-adopts. ──
    setRuntimeValue.mockClear();
    second.rerender();
    const late = renderHook(({ t }) =>
      useTravelManagement({ ...baseArgs({ q: 1, r: 0 }), initialTravelState: t }),
      { initialProps: { t: null } },
    );
    act(() => { late.rerender({ t: fileTripSnapshot() }); });
    const adoptionWrites = setRuntimeValue.mock.calls.filter(
      ([who, key]) => who === 'campaign' && String(key).startsWith('travel-'),
    );
    expect(adoptionWrites).toEqual([]);
    expect(getStore('campaign').get('travel-pathIndex')).toBe(1);
    late.unmount();

    // ── Leg 5: Advance works from the restored state and moves the party. ──
    const moveArgs = baseArgs({ q: 1, r: 0 });
    const mover = renderHook(() => useTravelManagement(moveArgs));
    let res2;
    act(() => { res2 = mover.result.current.advanceOneHex(); });
    expect(res2.moved).toBe(true);
    expect(moveArgs.onPartyMove).toHaveBeenCalledWith({ q: 2, r: 0 });
    expect(getStore('campaign').get('travel-pathIndex')).toBe(2);
    expect(getStore('campaign').get('travel-accruedCost')).toBe(2);
    mover.unmount();
    second.unmount();
  });
});
