// @maintained-by-ai
/*
 * useTravelManagement — over-budget MOUNT flag (improve 2026-10-26-E backlog).
 *
 * Live defect (run E): travel-accruedCost survives arrival BY DESIGN, so
 * arriving on a day where accrued + next-hex cost > budget left the NEXT
 * travel-tool mount stranded — disabled "Advance" and NO .travel-panel-
 * exhausted banner (Camp/Forced-March unreachable) until a cancel/re-press
 * (or a wasted reject-click) mount-flagged dayExhausted.
 *
 * Pinned contract (mount seam, mirrors the advance reject-and-flag producer):
 * - AC1: idle mount with accrued + cheapest affordable adjacent-hex cost
 *   OVER budget → dayExhausted true immediately, persisted through the SAME
 *   synced setRuntimeValue lane (change-data truth == rendered banner);
 * - AC2 no false positives: accrued 0, or accrued + cheapest <= budget
 *   (equality included), never flag and never write;
 * - neighbor economics mirror the engine: in-bounds unknown hexes play as
 *   'plains' defaults (API-created maps ship an EMPTY terrain dict — the
 *   live defect shape), out-of-bounds hexes are not legal steps;
 * - extreme weather (every neighbor cost null) stays in the
 *   travel-impossible lane — no flag, no write;
 * - mid-trip resume carrying an affordable next step stays unflagged;
 * - AC4: camp from the init-flagged banner refreshes the day verbatim and
 *   the mount flag does NOT re-fire (accrued → 0); forced march clears via
 *   its own lane and re-derives the penalized budget.
 *
 * Lane map: the reject-and-flag advance is pinned by useTravelManagement.
 * test.js; the banner/advanceDisabled render gates by TravelPanel.test.jsx;
 * THIS file owns the mount-time derivation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

// Real anchors: plains 0.75, hills 1.5 (travelService.js TERRAIN_MOVE_COST),
// normal-pace budget 4. Cost mock keys off terrain so the adjacency scan is
// exercised with genuinely mixed neighbors.
vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]),
  getDailyHexBudget: vi.fn((paceId) => (paceId === 'slow' ? 2 : paceId === 'fast' ? 5 : 4)),
  getHexMoveCostWithRoad: vi.fn((terrainType) => (
    terrainType === 'plains' ? 0.75 : terrainType === 'hills' ? 1.5 : null
  )),
  HORSEBACK_SPEED_MULTIPLIER: 2,
  TRAVEL_PACES: [
    { id: 'slow', name: 'Slow' },
    { id: 'normal', name: 'Normal' },
    { id: 'fast', name: 'Fast' },
  ],
  EXHAUSTION_LEVELS: 6,
  // Faithful 5/6 penalty so the AC4 forced-march budget byte is ground truth.
  applyExhaustionSpeedPenaltyToBudget: vi.fn((budget, stacks) => (
    stacks <= 0 ? budget : Math.floor(Math.pow(5 / 6, stacks) * budget)
  )),
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

const CLOUDY = { label: 'Cloudy', moveCostMod: 1.0, budgetMod: 1.0 };
const EXTREME = { label: 'Blizzard', moveCostMod: null, budgetMod: 0 };

// Party (0,0); hexNeighbors(0,0) = (1,0) (-1,0) (0,1) (0,-1) (1,-1) (-1,1).
// Only '1,0' is on-grid here → cheapest (and only) affordable step = 0.75.
const baseArgs = (overrides = {}) => ({
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains' },
  partyPosition: { q: 0, r: 0 },
  onPartyMove: vi.fn(),
  weather: CLOUDY,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign-init-exhaust',
  ...overrides,
});

// Reload-resume shape: the post-arrival day keys already sit in change-data
// BEFORE the hook mounts (App seeds the store on campaign select).
const seedStore = (keys) => {
  const store = getStore('campaign');
  Object.entries(keys).forEach(([k, v]) => store.set(k, v));
};

const exhaustedWrites = () => setRuntimeValue.mock.calls.filter(
  ([who, key]) => who === 'campaign' && key === 'travel-dayExhausted',
);

describe('useTravelManagement — over-budget mount flag (exhausted-day arrival)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('AC1: mount with accrued + cheapest step over budget flags dayExhausted at once', () => {
    // The exact post-arrival bytes of the live repro: 5 plains legs on the
    // day (3.75) survived arrival; the next hex (0.75) busts the 4 budget.
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    // Banner gate + advanceDisabled read dayExhausted — true on this mount,
    // BEFORE any route is planned (the pre-fix state showed false + a dead
    // "Advance" button with Camp/Forced-March unreachable).
    expect(result.current.dayExhausted).toBe(true);
    // AC3: persisted through the SAME synced lane the reject-and-flag uses.
    expect(exhaustedWrites()).toEqual([
      ['campaign', 'travel-dayExhausted', true, 'test-campaign-init-exhaust'],
    ]);
    expect(getStore('campaign').get('travel-dayExhausted')).toBe(true);
  });

  it('AC3: flags exactly once — re-renders and re-presses never re-write', () => {
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result, rerender } = renderHook(
      ({ args }) => useTravelManagement(args),
      { initialProps: { args: baseArgs() } },
    );
    expect(result.current.dayExhausted).toBe(true);

    setRuntimeValue.mockClear();
    act(() => { result.current.startPlanning(); });   // travel-tool re-press
    rerender({ args: baseArgs({ weather: CLOUDY }) }); // SSE-echo churn
    expect(result.current.dayExhausted).toBe(true);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('AC2: fresh day (accrued 0) mounts unflagged and writes nothing', () => {
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 0,
      'travel-dailyBudget': 4,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('AC2: accrued + cheapest step EXACTLY equals budget does not flag (strict >)', () => {
    // 3.25 + 0.75 = 4.0 — the move IS still affordable.
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.25,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('AC2: one affordable neighbor anywhere keeps the day open (cheapest wins)', () => {
    // accrued 3 vs budget 4: the hills step (1.5) would bust it, the plains
    // step (3.75 total) does not — the mount flag keys off the CHEAPEST
    // legal move only, so the day stays open for planning.
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(
      baseArgs({ terrain: { '1,0': 'plains', '-1,0': 'hills', '0,1': 'hills' } })
    ));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('flags when EVERY neighbor is expensive (explicit hills all around)', () => {
    // accrued 3.75 + hills 1.5 = 5.25 > 4 — no legal step exists.
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(
      baseArgs({ terrain: { '1,0': 'hills', '-1,0': 'hills', '0,1': 'hills', '0,-1': 'hills', '1,-1': 'hills', '-1,1': 'hills' } })
    ));

    expect(result.current.dayExhausted).toBe(true);
    expect(exhaustedWrites()).toHaveLength(1);
  });

  it('API-created map (EMPTY terrain dict) plays as plains defaults and flags', () => {
    // Live 2026-10-26 finding: POST /maps {type:'outdoor'} ships terrain {}
    // — advanceOneHex/calculatePath default unknown IN-BOUNDS hexes to
    // plains 0.75, so the mount scan must agree: 3.75 + 0.75 = 4.5 > 4.
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs({ terrain: {} })));

    expect(result.current.dayExhausted).toBe(true);
    expect(exhaustedWrites()).toHaveLength(1);
  });

  it('empty-terrain day with an affordable default-plains step stays unflagged', () => {
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs({ terrain: {} })));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('extreme weather (every cost null) stays in the travel-impossible lane', () => {
    seedStore({
      'travel-mode': 'inactive',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs({ weather: EXTREME })));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('mid-trip resume with an affordable next step mounts unflagged', () => {
    seedStore({
      'travel-mode': 'traveling',
      'travel-accruedCost': 1,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
      'travel-path': [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      'travel-pathIndex': 0,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs()));

    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('AC4: camp from the init-flagged banner refreshes the day verbatim and stays clear', () => {
    seedStore({
      'travel-mode': 'planning',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result, rerender } = renderHook(
      ({ args }) => useTravelManagement(args),
      { initialProps: { args: baseArgs() } },
    );
    expect(result.current.dayExhausted).toBe(true);

    act(() => { result.current.forceCamp(CLOUDY); });

    expect(result.current.dayExhausted).toBe(false);
    expect(result.current.accruedCost).toBe(0);
    expect(result.current.dailyBudget).toBe(4); // budget re-derived (pace × weather × 0 hours)
    expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');

    // The mount effect must not resurrect the flag on the fresh day.
    setRuntimeValue.mockClear();
    rerender({ args: baseArgs({ weather: CLOUDY }) });
    expect(result.current.dayExhausted).toBe(false);
    expect(exhaustedWrites()).toEqual([]);
  });

  it('AC4: forced march from the init-flagged banner pays the penalty and clears', () => {
    seedStore({
      'travel-mode': 'planning',
      'travel-accruedCost': 3.75,
      'travel-dailyBudget': 4,
      'travel-dayExhausted': false,
    });

    const { result } = renderHook(() => useTravelManagement(baseArgs()));
    expect(result.current.dayExhausted).toBe(true);

    let returned;
    act(() => { returned = result.current.forcedMarch(); });

    expect(returned).toBe(true);
    expect(result.current.dayExhausted).toBe(false);
    expect(result.current.accruedCost).toBe(0);
    expect(result.current.forcedMarchHours).toBe(1);
    expect(result.current.dailyBudget).toBe(3); // floor(4 × 5/6), not 4
    expect(result.current.lastMessage).toContain('Forced march — 1 exhaustion added');
  });
});
