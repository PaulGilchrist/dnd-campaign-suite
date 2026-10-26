// @maintained-by-ai
/*
 * useTravelManagement — budget-at-mount weather seed (improve 2026-10-26-E).
 *
 * Live quirk (run E, twice-bit explorer finding): opening the travel tool on
 * a storm-seeded map showed the UN-MODDED base budget 4 until the first
 * pace/camp/reroll seam re-derived it, because the mount-time default baked
 * lazyDailyBudget() before the async map load surfaced the file's persisted
 * weather. The seed effect re-derives dailyBudget ONCE via the SAME
 * effectiveBudgetForPace helper the seams use, gated by the change-data
 * authority probe (hasRuntimeValue) so a live/resumed day is never clobbered.
 *
 * Pinned contract:
 * - fresh mount + persisted storm weather (budgetMod 0.75) → budget 3
 *   (= floor(4×0.75)) immediately, written through the synced lane;
 * - wind (budgetMod 0.8) → floor(4×0.8) = 3;
 * - clear weather (budgetMod 1.0) → base 4 (no regression, no downgrade);
 * - late weather arrival (async file load lands after mount) seeds too;
 * - one-shot: later weather churn never re-seeds (camp / manual re-roll /
 *   pace seams own re-derivation from their own rolls — ff52b0907);
 * - change-data authority: a stored travel-dailyBudget (LIVE mid-day trip)
 *   survives the mount untouched, even under a storm-weather file (AC2 —
 *   the navigation-restore lane from 9f7114eff depends on this);
 * - a file trip (initialTravelState) belongs to the adoption lane — the
 *   seed stays silent.
 *
 * Lane map: seam re-derivation is pinned by forced-march-budget.test.js;
 * file-init derivation by useMapLoader.travelState.test.js; THIS file owns
 * the mount/adoption weather seed itself.
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
  campaignName: 'test-campaign-wx-seed',
  ...overrides,
});

const budgetWrites = () => setRuntimeValue.mock.calls.filter(
  ([who, key]) => who === 'campaign' && key === 'travel-dailyBudget',
);

describe('useTravelManagement — budget-at-mount weather seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('fresh mount under persisted storm weather seeds floor(4×0.75)=3 immediately', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: STORM })));

    // AC1: weather-modded truth at mount — no pace/camp/reroll seam needed.
    expect(result.current.dailyBudget).toBe(3);
    // Server-first: the seed rides the synced setDailyBudget lane.
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 3, 'test-campaign-wx-seed']]);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(3);
  });

  it('wind weather seeds floor(4×0.8)=3 (same helper, other sub-1.0 mod)', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: WIND })));
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 3, 'test-campaign-wx-seed']]);
  });

  it('clear-weather mount keeps the base budget 4 (AC3, no downgrade)', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: CLEAR })));
    expect(result.current.dailyBudget).toBe(4);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(4);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 4, 'test-campaign-wx-seed']]);
  });

  it('weather arriving AFTER mount (async file load) seeds on arrival', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: null } },
    );
    expect(result.current.dailyBudget).toBe(4); // lazy base while weather unknown
    expect(budgetWrites()).toEqual([]);

    act(() => { rerender({ w: STORM }); });
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 3, 'test-campaign-wx-seed']]);
  });

  it('seed is one-shot: later weather churn never re-derives (seams own it)', () => {
    const { rerender, result } = renderHook(
      ({ w }) => useTravelManagement(baseArgs({ weather: w })),
      { initialProps: { w: STORM } },
    );
    expect(result.current.dailyBudget).toBe(3);
    setRuntimeValue.mockClear();

    // Weather later re-rolls to clear (e.g. an SSE echo of another tab's
    // camp) — the mount seed must NOT chase it; camp/re-roll writes the
    // budget from its own roll (ff52b0907 lane).
    act(() => { rerender({ w: CLEAR }); });
    expect(result.current.dailyBudget).toBe(3);
    expect(budgetWrites()).toEqual([]);
  });

  it('AC2: a stored travel-dailyBudget (live mid-day trip) survives a storm mount untouched', () => {
    // Reload-resume shape: change-data hydration put the LIVE day bytes into
    // the store before the map editor mounts (App.jsx campaign-select seed).
    const store = getStore('campaign');
    store.set('travel-mode', 'traveling');
    store.set('travel-dailyBudget', 7);

    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: STORM })));

    // change-data is authority: the distinctive 7 stands, not re-derived 3.
    expect(result.current.dailyBudget).toBe(7);
    expect(store.get('travel-dailyBudget')).toBe(7);
    expect(budgetWrites()).toEqual([]);
  });

  it('a file trip (initialTravelState) is the adoption lane — the seed stays silent', () => {
    const trip = {
      travelMode: 'traveling', travelPace: 'normal', destination: { q: 2, r: 0 },
      path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
      pathIndex: 1, accruedCost: 1, dailyBudget: 6, dayExhausted: false, forcedMarchHours: 0,
    };
    const { result } = renderHook(() =>
      useTravelManagement(baseArgs({ weather: STORM, initialTravelState: trip }))
    );

    // Adoption stamped the file's budget (6); the seed did NOT overwrite 6
    // with the weather-derived 3.
    expect(result.current.dailyBudget).toBe(6);
    expect(getStore('campaign').get('travel-dailyBudget')).toBe(6);
    expect(budgetWrites()).toEqual([['campaign', 'travel-dailyBudget', 6, 'test-campaign-wx-seed']]);
  });

  it('pace-chip toggle under storm still recomputes exactly as before (AC3)', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: STORM })));
    expect(result.current.dailyBudget).toBe(3); // seeded normal

    setRuntimeValue.mockClear();
    act(() => { result.current.changePace('slow'); });
    expect(result.current.dailyBudget).toBe(1); // floor(2×0.75), seam unchanged

    act(() => { result.current.changePace('normal'); });
    expect(result.current.dailyBudget).toBe(3);
  });
});
