// @maintained-by-ai
/*
 * useTravelManagement — first-travel auto-roll seeds the weather-modded budget
 * (bug-hex-first-roll-unseeded-budget).
 *
 * Live defect (run M, qa-hex-runm): on a fresh outdoor map with NO persisted
 * weather, pressing the travel tool starts planning (startPlanning writes
 * travel-mode into change-data the SAME tick) and the non-persisted-weather
 * auto-roll lands the weather one render LATER. The mount weather-seed effect
 * then fired — but its hasRuntimeValue('campaign','travel-mode') gate was
 * already true, so it silently bailed: a forced storm roll (budgetMod 0.75)
 * ran the whole day on the un-modded lazy base 4 (panel "0.0 / 4", no
 * travel-dailyBudget key for SSE peers, map-file travelState snapshot baked
 * dailyBudget:4). The fix drops the travel-mode guard: the press lane clears
 * the trip keys but NEVER a budget key, so the budget-key guard (store-first)
 * plus the initialTravelState guard (adoption lane) cover everything the mode
 * guard double-covered.
 *
 * Pinned contract:
 * - press (startPlanning) THEN the auto-roll lands → budget seeds
 *   floor(4×0.75)=3 immediately through the synced lane, storm and wind;
 * - clear-weather roll writes the base 4 (key becomes explicit, store
 *   consistent);
 * - store-first on the press lane: a carried travel-dailyBudget survives the
 *   first roll untouched (spent day stays spent BY DESIGN);
 * - file trip (initialTravelState) keeps the adoption lane: the seed never
 *   overwrites the file-stamped budget;
 * - one-shot stands: later weather churn after the press-lane seed never
 *   re-derives (camp / manual re-roll / weatherChange seams own it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

// Real budget anchors (travelService.js): slow 2, normal 4, fast 5.
vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]),
  getDailyHexBudget: vi.fn((paceId) => (paceId === 'slow' ? 2 : paceId === 'fast' ? 5 : 4)),
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

const { setRuntimeValue, getStore } = await import('../runtime/useRuntimeState.js');

// Canonical storm / wind / clear rows from weatherService.js WEATHER_EFFECTS
// (TRUST SOURCE TABLE: storm 0.75, wind 0.8, clear 1.0).
const STORM = { condition: 'storm', label: 'Storm', icon: 'bolt', moveCostMod: 1.5, budgetMod: 0.75 };
const WIND = { condition: 'wind', label: 'High Wind', icon: 'wind', moveCostMod: 1.0, budgetMod: 0.8 };
const CLEAR = { condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1.0, budgetMod: 1.0 };

const baseArgs = (overrides = {}) => ({
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
  campaignName: 'test-campaign-first-roll',
  ...overrides,
});

const budgetWrites = () => setRuntimeValue.mock.calls.filter(
  ([who, key]) => who === 'campaign' && key === 'travel-dailyBudget',
);

describe('useTravelManagement — first-travel auto-roll budget seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('press (startPlanning) THEN a storm auto-roll lands → seeds floor(4×0.75)=3 (the exact broken lane)', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    // Fresh map, no travel keys: base 4 lazy, nothing written.
    expect(result.current.dailyBudget).toBe(4);
    expect(budgetWrites()).toEqual([]);

    // The travel-tool press: startPlanning writes travel-mode BEFORE the
    // auto-roll weather lands (the roll rides the next render).
    act(() => { result.current.startPlanning(); });
    expect(getStore('campaign').get('travel-mode')).toBe('planning');

    act(() => { rerender({ w: STORM }); });
    // Pre-fix this wrote NOTHING (the travel-mode guard bailed the seed).
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 3, 'test-campaign-first-roll']]);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(3);
  });

  it('wind roll after the press seeds floor(4×0.8)=3 (same helper, other sub-1.0 mod)', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    act(() => { result.current.startPlanning(); });
    act(() => { rerender({ w: WIND }); });
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 3, 'test-campaign-first-roll']]);
  });

  it('clear-weather roll after the press writes the base 4 (key becomes explicit)', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    act(() => { result.current.startPlanning(); });
    act(() => { rerender({ w: CLEAR }); });
    expect(result.current.dailyBudget).toBe(4);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(4);
  });

  it('store-first on the press lane: a carried travel-dailyBudget survives the first roll untouched', () => {
    // Spent-day carry BY DESIGN: prior trips today left the budget key in
    // change-data; opening a FRESH (no-weather) map and rolling storm must
    // NOT re-derive it — the budget-key guard keeps the seed silent.
    getStore('campaign').set('travel-dailyBudget', 1);

    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    act(() => { result.current.startPlanning(); });
    act(() => { rerender({ w: STORM }); });

    expect(result.current.dailyBudget).toBe(1);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(1);
    expect(budgetWrites()).toEqual([]);
  });

  it('file trip (initialTravelState) stays the adoption lane — the roll never overwrites the stamped budget', () => {
    const trip = {
      travelMode: 'traveling', travelPace: 'normal', destination: { q: 2, r: 0 },
      path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
      pathIndex: 1, accruedCost: 1, dailyBudget: 6, dayExhausted: false, forcedMarchHours: 0,
    };
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w, initialTravelState: trip })),
      { initialProps: { w: null } },
    );
    // Adoption materialized the file budget (6).
    expect(result.current.dailyBudget).toBe(6);
    setRuntimeValue.mockClear();

    act(() => { rerender({ w: STORM }); });
    // The seed must NOT overwrite 6 with the weather-derived 3.
    expect(result.current.dailyBudget).toBe(6);
    expect(budgetWrites()).toEqual([]);
  });

  it('one-shot stands: after the press-lane seed, later weather churn never re-derives (seams own it)', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    act(() => { result.current.startPlanning(); });
    act(() => { rerender({ w: STORM }); });
    expect(result.current.dailyBudget).toBe(3);
    setRuntimeValue.mockClear();

    // Another tab's camp echo rolls the day's weather to clear — the mount
    // seed must NOT chase it (the camp seam wrote its own budget).
    act(() => { rerender({ w: CLEAR }); });
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([]);
  });
});
