// @maintained-by-ai
/*
 * useTravelManagement — quiet-adopt reconciliation (bug-hex-quiet-adopt-stale-file-travelstate).
 *
 * After a mid-plan reload loses the ~1s debounced map-file write-back, the
 * reopened editor adopts the STORE trip while the map FILE still describes
 * the PREVIOUS trip. The publisher used to fire its resume publish inside the
 * async load window, where useMapLoader.applyExistingMap clobbers it by
 * re-adopting the file bytes into the save ref + dirty-gate baseline — so
 * the diverged file never reconciled (zero PUTs indefinitely, and the stale
 * resume cache resurrects the wrong trip once the store goes quiet).
 *
 * Pinned contract:
 * - a resume mount HOLDS its premature publish until the document bytes
 *   land, then seeds the last-published record from the FILE snapshot;
 * - store trip ≠ file trip on mount ⇒ EXACTLY ONE publish carrying the
 *   store snapshot (the reconciliation PUT);
 * - file bytes == store bytes on mount ⇒ zero publishes (a2da687d7
 *   quiet-resume zero-PUT contract);
 * - a file-less mount (fresh map / no file trip) defers the resume publish
 *   but still publishes every real mutation (write-back lane intact);
 * - adoption mounts (store silent at mount) are unchanged: one publish of
 *   the file's own bytes after materialization, never a null wipe.
 * Lane map: snapshot shapes + mutation counts are owned by
 * useTravelManagement.map-writeback.test.js; this file owns the
 * store-vs-file settle reconciliation.
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

const { getStore } = await import('../runtime/useRuntimeState.js');

const baseArgs = {
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' },
  partyPosition: { q: 0, r: 0 },
  onPartyMove: vi.fn(),
  weather: null,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign',
};

const snapshot = (overrides = {}) => ({
  travelMode: 'planning',
  travelPace: 'normal',
  destination: null,
  path: [],
  pathIndex: 0,
  accruedCost: 0,
  dailyBudget: 4,
  dayExhausted: false,
  forcedMarchHours: 0,
  ...overrides,
});

// The LIVE store trip (survives the reload through change-data): the shorter
// re-plan, destination (18,9) on a 4-hex path.
const STORE_DEST = { q: 18, r: 9 };
const STORE_PATH = [{ q: 20, r: 10 }, { q: 19, r: 10 }, { q: 18, r: 9 }, { q: 17, r: 9 }];
// The STALE file trip (the PREVIOUS 180px plan whose debounced PUT was
// lost to the reload): destination (17,9) on a 5-hex path.
const FILE_DEST = { q: 17, r: 9 };
const FILE_PATH = [{ q: 20, r: 10 }, { q: 19, r: 10 }, { q: 18, r: 10 }, { q: 17, r: 10 }, FILE_DEST];

const seedStoreTrip = (t) => {
  const store = getStore('campaign');
  store.set('travel-mode', t.travelMode);
  store.set('travel-pace', t.travelPace);
  store.set('travel-destination', t.destination);
  store.set('travel-path', t.path);
  store.set('travel-pathIndex', t.pathIndex);
  store.set('travel-accruedCost', t.accruedCost);
  store.set('travel-dailyBudget', t.dailyBudget);
  store.set('travel-dayExhausted', t.dayExhausted);
  store.set('travel-forcedMarchHours', t.forcedMarchHours);
};

const renderAsyncFile = (extraArgs = {}) => {
  const onTravelStateChange = vi.fn();
  const { result, rerender } = renderHook(
    ({ t }) =>
      useTravelManagement({ ...baseArgs, ...extraArgs, initialTravelState: t, onTravelStateChange }),
    { initialProps: { t: null } },
  );
  return { result, rerender, onTravelStateChange };
};

describe('useTravelManagement — quiet-adopt reconciliation (store vs stale file trip)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('holds the premature resume publish, then publishes EXACTLY ONE store snapshot when the file trip diverges', () => {
    seedStoreTrip(snapshot({ destination: STORE_DEST, path: STORE_PATH }));
    const { rerender, onTravelStateChange } = renderAsyncFile();

    // Load window: the resume publish must NOT fire — applyExistingMap would
    // clobber it with the file bytes anyway (the original defect's root).
    expect(onTravelStateChange).not.toHaveBeenCalled();

    // Document lands with the STALE trip → one reconciliation publish of the
    // ADOPTED store bytes (the loader dirty-gate turns it into one PUT).
    act(() => { rerender({ t: snapshot({ destination: FILE_DEST, path: FILE_PATH }) }); });

    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
    expect(onTravelStateChange).toHaveBeenCalledWith(snapshot({
      destination: STORE_DEST,
      path: STORE_PATH,
    }));
  });

  it('stays byte-silent when the loaded file trip equals the store trip (quiet resume)', () => {
    const trip = snapshot({ travelMode: 'traveling', destination: STORE_DEST, path: STORE_PATH, pathIndex: 1, accruedCost: 1 });
    seedStoreTrip(trip);
    const { rerender, onTravelStateChange } = renderAsyncFile();

    expect(onTravelStateChange).not.toHaveBeenCalled();
    act(() => { rerender({ t: snapshot(trip) }); });
    // a2da687d7 zero-PUT contract: file == store ⇒ publish NOTHING.
    expect(onTravelStateChange).not.toHaveBeenCalled();
  });

  it('adoption mount (store silent) is unchanged: one publish of the file bytes after materialization, never a null wipe', () => {
    const fileTrip = snapshot({ travelMode: 'traveling', destination: FILE_DEST, path: FILE_PATH, pathIndex: 2, accruedCost: 1.5 });
    const { rerender, onTravelStateChange } = renderAsyncFile();

    act(() => { rerender({ t: fileTrip }); });

    // The adoption lane materialized the file trip into the store…
    const store = getStore('campaign');
    expect(store.get('travel-mode')).toBe('traveling');
    expect(store.get('travel-destination')).toEqual(FILE_DEST);
    // …and the publisher re-confirms the file's OWN bytes once — the loader
    // already holds them in ref + baseline, so this lands as zero PUTs.
    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
    expect(onTravelStateChange).toHaveBeenCalledWith(snapshot({
      travelMode: 'traveling', destination: FILE_DEST, path: FILE_PATH, pathIndex: 2, accruedCost: 1.5,
    }));
  });

  it('a file-less mount (fresh map) defers the resume publish but still publishes real mutations', () => {
    const store = getStore('campaign');
    store.set('travel-mode', 'traveling');
    store.set('travel-path', [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }]);
    store.set('travel-pathIndex', 1);
    store.set('travel-accruedCost', 1);
    store.set('travel-dailyBudget', 6);
    const { result, onTravelStateChange } = renderAsyncFile();

    // Resume bytes held while no document travelState ever arrives…
    expect(onTravelStateChange).not.toHaveBeenCalled();

    // …but the write-back lane stays intact: a real mutation publishes.
    let res;
    act(() => { res = result.current.advanceOneHex(); });
    expect(res.moved).toBe(true);
    expect(onTravelStateChange).toHaveBeenCalledTimes(1);
    expect(onTravelStateChange).toHaveBeenCalledWith(expect.objectContaining({
      travelMode: 'traveling',
      pathIndex: 2,
      accruedCost: 2,
    }));
  });
});
