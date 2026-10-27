// @maintained-by-ai
/*
 * useTravelManagement — extreme-weather prompt copy (bug 2026-10-27-G).
 *
 * Live defect: the cost-null advance reject wrote "Extreme extreme makes
 * travel impossible. Camp and wait it out." — the template prepended a hard
 * "Extreme" to `weather.label?.toLowerCase()` while the production extreme
 * label IS "Extreme" (weatherService.js), doubling the word.
 *
 * Pinned contract:
 * - blocked advance (weather.moveCostMod null) rejects honestly (no move, no
 *   accrual, no dayExhausted flag — the banner lane stays the budget lane)
 *   and writes the verbatim prompt "Extreme weather makes travel impossible.
 *   Camp and wait it out." off the production label (no doubled word);
 * - forceCamp from the blocked state refreshes the day through the same seam
 *   the new panel camp row wires to (budget re-derived from the NEW roll).
 *
 * Lane map: the camp affordance render is pinned by TravelPanel.extreme-
 * weather-camp.test.jsx; the extreme_weather log row + stale-message clear by
 * HexMap.extreme-weather.test.jsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]),
  getDailyHexBudget: vi.fn(() => 4),
  // Base cost is never consulted under a null moveCostMod, but keep it real.
  getHexMoveCostWithRoad: vi.fn(() => 0.75),
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

const { getStore } = await import('../runtime/useRuntimeState.js');

// weatherService.js production "extreme" row verbatim.
const EXTREME = {
  condition: 'extreme',
  label: 'Extreme',
  icon: 'triangle-exclamation',
  moveCostMod: null,
  budgetMod: 0,
};
const CLOUDY = { label: 'Cloudy', moveCostMod: 1, budgetMod: 1 };

const baseArgs = (overrides = {}) => ({
  hexCols: 10,
  hexRows: 10,
  terrain: { '1,0': 'plains', '2,0': 'plains' },
  partyPosition: { q: 0, r: 0 },
  onPartyMove: vi.fn(),
  weather: EXTREME,
  monsters: [],
  playerLevels: [1],
  roads: [],
  characters: [{ name: 'Hero' }],
  campaignName: 'test-campaign-extreme-copy',
  ...overrides,
});

describe('useTravelManagement — extreme-weather prompt copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
  });

  it('blocked advance writes the doubled-word-free prompt verbatim and stays honest', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs()));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });

    let res;
    act(() => { res = result.current.advanceOneHex(); });

    expect(res.moved).toBe(false);
    expect(result.current.lastMessage)
      .toBe('Extreme weather makes travel impossible. Camp and wait it out.');
    expect(getStore('campaign').get('travel-lastMessage'))
      .toBe('Extreme weather makes travel impossible. Camp and wait it out.');
    // Reject-honest: no accrual, no move, and the budget banner lane is NOT
    // flagged (dayExhausted stays the budget lane — the camp affordance here
    // keys off the weather itself, TravelPanel.extreme-weather-camp.test.jsx).
    expect(result.current.accruedCost).toBe(0);
    expect(result.current.pathIndex).toBe(0);
    expect(result.current.dayExhausted).toBe(false);
  });

  it('forceCamp from the blocked state refreshes the day off the NEW roll', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs()));
    act(() => { result.current.forceCamp(CLOUDY); });

    expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
    expect(result.current.dailyBudget).toBe(4);
    expect(result.current.dayExhausted).toBe(false);
    expect(result.current.accruedCost).toBe(0);
  });
});
