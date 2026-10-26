// @maintained-by-ai
/*
 * useTravelManagement — map-file write-back publisher (improve 2026-10-26-D).
 *
 * The server-first refactor (4497e99ad) moved live travel state to the
 * change-data keys but dropped the old onTravelStateChange publisher, so the
 * map file's travelState stayed null all trip while buildTravelInit still
 * reads it back as the reload-resume source. These tests pin the restored
 * publisher contract:
 * - a quiet mount (idle OR resumed) publishes NOTHING — the loader's
 *   dirty-gate baseline stays byte-equal, so open+back emits zero PUTs;
 * - every committed travel mutation publishes EXACTLY ONE snapshot with the
 *   exact buildTravelInit round-trip shape (null = no-trip);
 * - value churn that produces identical bytes (SSE echoes re-rendering with
 *   new array identities) never re-publishes;
 * - cancel/arrive semantics: both clear to null (arrival clears the
 *   completed-trip planning keys from change-data, improve 2026-10-26-D,
 *   so the map file sheds the finished trip too).
 * Lane map: change-data key writes are owned by useTravelManagement.test.js;
 * the loader ref/bump/persistence half by useMapLoader.api.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]),
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

var _stores;
var _listeners;

vi.mock('../runtime/useRuntimeState.js', () => {
  if (!_stores) {
    _stores = new Map();
    _listeners = new Map();
  }
  return {
    getRuntimeValue: vi.fn(() => null),
    // File-resume seam (improve 2026-10-26-D): merged object write + key probe.
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

const { calculatePath, getHexMoveCostWithRoad } = await import('../../services/campaign/travelService.js');
const { shouldTriggerEvent } = await import('../../services/campaign/randomEventService.js');
const { setRuntimeValue, getStore } = await import('../runtime/useRuntimeState.js');

const baseArgs = {
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains', '2,0': 'plains' },
  partyPosition: { q: 0, r: 0 },
  onPartyMove: vi.fn(),
  weather: null,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign',
};

// Full-budget normal day under the mocks: cost 1/hex, budget 6.
const snapshot = (overrides = {}) => ({
  travelMode: 'planning',
  travelPace: 'normal',
  destination: null,
  path: [],
  pathIndex: 0,
  accruedCost: 0,
  dailyBudget: 6,
  dayExhausted: false,
  forcedMarchHours: 0,
  ...overrides,
});

const renderPublishing = (extraArgs = {}) => {
  const onTravelStateChange = vi.fn();
  const { result } = renderHook(() =>
    useTravelManagement({ ...baseArgs, ...extraArgs, onTravelStateChange })
  );
  return { result, onTravelStateChange };
};

describe('useTravelManagement — map-file write-back publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
    getHexMoveCostWithRoad.mockReturnValue(1);
    shouldTriggerEvent.mockReturnValue(false);
  });

  it('publishes NOTHING on a quiet idle mount', () => {
    const { onTravelStateChange } = renderPublishing();
    expect(onTravelStateChange).not.toHaveBeenCalled();
  });

  it('publishes NOTHING on a quiet RESUMED mount (file bytes equal the live snapshot)', () => {
    const { onTravelStateChange } = renderPublishing({
      initialTravelState: snapshot({ travelMode: 'traveling', destination: { q: 2, r: 0 }, path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }], pathIndex: 1, accruedCost: 1 }),
    });
    expect(onTravelStateChange).not.toHaveBeenCalled();
  });

  it('publishes planning and each advance exactly once with the exact snapshot shape', () => {
    const { result, onTravelStateChange } = renderPublishing();

    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
    expect(onTravelStateChange).toHaveBeenLastCalledWith(snapshot({
      destination: { q: 2, r: 0 },
      path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
    }));

    act(() => { result.current.advanceOneHex(); });
    expect(onTravelStateChange).toHaveBeenCalledTimes(2);
    expect(onTravelStateChange).toHaveBeenLastCalledWith(snapshot({
      travelMode: 'traveling',
      destination: { q: 2, r: 0 },
      path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
      pathIndex: 1,
      accruedCost: 1,
    }));
  });

  it('publishes null once on arrival (completed-trip keys cleared, file sheds the trip)', () => {
    const { result, onTravelStateChange } = renderPublishing();
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    act(() => { result.current.advanceOneHex(); });
    onTravelStateChange.mockClear();

    act(() => { result.current.advanceOneHex(); });   // final hex → arrived

    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
    // buildPublishSnapshot null-gate (inactive AND no destination AND no
    // path) fires because the arrival branch parks the keys on idle bytes —
    // the map file drops the stale trip exactly like change-data does.
    expect(onTravelStateChange).toHaveBeenCalledWith(null);
  });

  it('clears the file back to null on cancel after a started trip', () => {
    const { result, onTravelStateChange } = renderPublishing();
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    act(() => { result.current.advanceOneHex(); });

    act(() => { result.current.cancelTravel(); });

    expect(onTravelStateChange).toHaveBeenLastCalledWith(null);
    expect(onTravelStateChange).toHaveBeenCalledTimes(3);
  });

  it('flags an over-budget reject and forced march in the published snapshot', () => {
    const { result, onTravelStateChange } = renderPublishing();
    calculatePath.mockReturnValue([
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 },
      { q: 4, r: 0 }, { q: 5, r: 0 }, { q: 6, r: 0 }, { q: 7, r: 0 }, { q: 8, r: 0 },
    ]);
    act(() => { result.current.setDestinationAndPath({ q: 8, r: 0 }); });
    onTravelStateChange.mockClear();

    for (let i = 0; i < 7; i++) act(() => { result.current.advanceOneHex(); });
    // 6 advances accrue the budget of 6; the 7th rejects and flags.
    expect(onTravelStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ dayExhausted: true }));

    act(() => { result.current.forcedMarch(); });
    expect(onTravelStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      dayExhausted: false,
      forcedMarchHours: 1,
      accruedCost: 0,
    }));
    // 6 advances + 1 over-budget reject + 1 march = exactly one publish each.
    expect(onTravelStateChange).toHaveBeenCalledTimes(8);
  });

  it('does NOT re-publish when a churn writes byte-identical values (SSE echo lane)', () => {
    const { result, onTravelStateChange } = renderPublishing();
    calculatePath.mockImplementation(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    expect(onTravelStateChange).toHaveBeenCalledTimes(1);

    // Same bytes, new array/object identities — exactly what an SSE echo
    // round-trip through the store produces.
    act(() => {
      result.current.setDestinationAndPath({ q: 2, r: 0 });
    });
    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
  });

  describe('file→store adoption (async travelInit arrival)', () => {
    it('adopts the late trip via the per-key campaign lane, exactly once', () => {
      const trip = {
        travelMode: 'traveling', travelPace: 'normal', destination: { q: 16, r: 10 },
        path: [{ q: 20, r: 10 }, { q: 19, r: 10 }, { q: 18, r: 10 }, { q: 17, r: 10 }, { q: 16, r: 10 }],
        pathIndex: 2, accruedCost: 1.5, dailyBudget: 4, dayExhausted: false, forcedMarchHours: 0,
      };
      const { rerender, result } = renderHook(
        ({ t }) => useTravelManagement({ ...baseArgs, initialTravelState: t }),
        { initialProps: { t: null } },
      );
      expect(getStore('campaign').has('travel-mode')).toBe(false);

      rerender({ t: trip });

      const store = getStore('campaign');
      expect(store.get('travel-mode')).toBe('traveling');
      expect(store.get('travel-pathIndex')).toBe(2);
      expect(store.get('travel-accruedCost')).toBe(1.5);
      expect(store.get('travel-destination')).toEqual({ q: 16, r: 10 });
      expect(store.get('travel-path')).toHaveLength(5);

      // The resumed trip must be actionable: advance reads the internal
      // refs, so adoption has to repopulate them (live finding: without
      // this every post-resume advance silently no-opped).
      let moveRes;
      act(() => { moveRes = result.current.advanceOneHex(); });
      expect(moveRes.moved).toBe(true);
      expect(store.get('travel-pathIndex')).toBe(3);

      // One-shot: further travelInit churn (SSE echo) never re-adopts — the
      // pathIndex stays at the post-advance value, not the trip's stale 2.
      setRuntimeValue.mockClear();
      rerender({ t: { ...trip, pathIndex: 3 } });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(store.get('travel-pathIndex')).toBe(3);
    });

    it('drives advances off the change-data-seeded refs on a reload-resume mount', () => {
      // Normal reload resume: values arrive via the hydrated store (no
      // initialTravelState at all). advanceOneHex reads the refs, so they
      // must seed from the mount-time synced path.
      const store = getStore('campaign');
      store.set('travel-mode', 'traveling');
      store.set('travel-path', [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }]);
      store.set('travel-pathIndex', 1);
      store.set('travel-accruedCost', 1);
      store.set('travel-dailyBudget', 6);
      const { result } = renderHook(() => useTravelManagement(baseArgs));

      let res;
      act(() => { res = result.current.advanceOneHex(); });
      expect(res.moved).toBe(true);
      expect(store.get('travel-pathIndex')).toBe(2);
      expect(store.get('travel-accruedCost')).toBe(2);
    });

    it('never adopts over live change-data travel keys (change-data is the authority)', () => {
      // Pre-arm the campaign bucket the way a reload-seeded store has it.
      getStore('campaign').set('travel-mode', 'planning');
      const { rerender } = renderHook(
        ({ t }) => useTravelManagement({ ...baseArgs, initialTravelState: t }),
        { initialProps: { t: null } },
      );
      rerender({ t: { travelMode: 'traveling', travelPace: 'normal', destination: { q: 1, r: 1 }, path: [], pathIndex: 0, accruedCost: 1, dailyBudget: 4, dayExhausted: false, forcedMarchHours: 0 } });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(getStore('campaign').get('travel-mode')).toBe('planning');
    });
  });
});
