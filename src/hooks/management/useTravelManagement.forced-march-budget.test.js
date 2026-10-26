// @maintained-by-ai
// Regression: the exhaustion speed penalty must land on the day it is earned.
// forcedMarch()/forceCamp()/changePace() write travel-forcedMarchHours in the
// SAME tick they write travel-dailyBudget — when the budget rode the memoized
// effectiveBudgetForPace closure (deps [forcedMarchHours]) it always saw the
// PRE-write hours: Forced March paid a full un-penalized budget (4 instead of
// floor(4×5/6)=3) and Camp's fresh day carried yesterday's penalty (3 instead
// of 4). The sibling useTravelManagement.test.js mocks the penalty as identity
// and cannot see this, so this suite uses the REAL budget-penalty formula.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelManagement from './useTravelManagement.js';

vi.mock('../../services/campaign/travelService.js', () => ({
  calculatePath: vi.fn(() => [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]),
  getDailyHexBudget: vi.fn((paceId) => (paceId === 'slow' ? 2 : paceId === 'fast' ? 6 : 4)),
  getHexMoveCostWithRoad: vi.fn(() => 1),
  HORSEBACK_SPEED_MULTIPLIER: 2,
  TRAVEL_PACES: [
    { id: 'slow', name: 'Slow' },
    { id: 'normal', name: 'Normal' },
    { id: 'fast', name: 'Fast' },
  ],
  EXHAUSTION_LEVELS: 6,
  // Faithful copy of travelService.js (EXHAUSTION_SPEED_MULTIPLIER = 5/6) —
  // must stay numerically identical so budget pins below are ground truth.
  applyExhaustionSpeedPenaltyToBudget: vi.fn((baseBudget, stacks) => {
    if (stacks <= 0) return baseBudget;
    return Math.floor(Math.pow(5 / 6, stacks) * baseBudget);
  }),
  getExhaustionMultiplierPercent: vi.fn((stacks) => Math.round(Math.pow(5 / 6, stacks) * 100)),
}));

vi.mock('../../services/campaign/randomEventService.js', () => ({
  shouldTriggerEvent: vi.fn(() => false),
  generateRandomEvent: vi.fn(() => ({ type: 'encounter', title: 'Random Event' })),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(() => []),
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
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (!_stores.has(characterKey)) _stores.set(characterKey, new Map());
      _stores.get(characterKey).set(propertyName, value);
      const set = _listeners.get(characterKey);
      if (set) set.forEach(fn => fn());
    }),
    getStore: vi.fn((key) => {
      if (!_stores.has(key)) _stores.set(key, new Map());
      return _stores.get(key);
    }),
    listeners: _listeners,
  };
});

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasSelfRestoration: vi.fn(() => false),
}));

const { getRuntimeValue } = await import('../runtime/useRuntimeState.js');

describe('useTravelManagement forced-march budget math (stale-closure regression)', () => {
  // Cloudy weather: budgetMod 1.0 (weatherService.js ground truth) so the
  // budget is pure pace × exhaustion math: Normal base 4, floor(4×5/6)=3.
  const baseArgs = {
    hexCols: 10,
    hexRows: 10,
    terrain: { '1,0': 'plains', '2,0': 'plains' },
    partyPosition: { q: 0, r: 0 },
    onPartyMove: vi.fn(),
    weather: { label: 'Cloudy', moveCostMod: 1.0, budgetMod: 1.0 },
    monsters: [],
    playerLevels: [1, 1, 1],
    roads: [],
    characters: [{ name: 'Hero' }],
    campaignName: 'test-campaign-fm-budget',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    getRuntimeValue.mockReturnValue(null);
  });

  it('Forced March from hours=0 applies the 1-stack penalty to the SAME day budget (4 → 3)', () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    expect(result.current.dailyBudget).toBe(4);

    let returned;
    act(() => { returned = result.current.forcedMarch(); });

    expect(returned).toBe(true);
    expect(result.current.forcedMarchHours).toBe(1);
    expect(result.current.dailyBudget).toBe(3); // floor(4 × 5/6), NOT 4
    expect(result.current.lastMessage).toContain('Speed reduced to 83%');
  });

  it('second Forced March stacks the penalty (hours 1 → 2, budget floor(4×(5/6)²)=2)', () => {
    const { result } = renderHook(() => useTravelManagement({
      ...baseArgs,
      campaignName: 'test-campaign-fm-budget-2',
      initialTravelState: { travelMode: 'traveling', forcedMarchHours: 1, dailyBudget: 3 },
    }));

    act(() => { result.current.forcedMarch(); });

    expect(result.current.forcedMarchHours).toBe(2);
    expect(result.current.dailyBudget).toBe(2); // floor(4 × 25/36) = 2
    expect(result.current.lastMessage).toContain('Speed reduced to 69%');
  });

  it('Camp from hours=1 clears the penalty on the fresh day (budget → un-penalized 4)', () => {
    const { result } = renderHook(() => useTravelManagement({
      ...baseArgs,
      campaignName: 'test-campaign-fm-budget-camp',
      initialTravelState: { travelMode: 'traveling', forcedMarchHours: 1, dailyBudget: 3, accruedCost: 3, dayExhausted: true },
    }));
    expect(result.current.dailyBudget).toBe(3);

    act(() => { result.current.forceCamp(); });

    expect(result.current.forcedMarchHours).toBe(0);
    expect(result.current.dailyBudget).toBe(4); // refreshed UN-penalized, NOT 3
    expect(result.current.accruedCost).toBe(0);
    expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
  });

  it('changePace from hours=2 writes the new pace budget with the reset hours (0)', () => {
    const { result } = renderHook(() => useTravelManagement({
      ...baseArgs,
      campaignName: 'test-campaign-fm-budget-pace',
      initialTravelState: { travelMode: 'traveling', forcedMarchHours: 2, dayExhausted: true },
    }));

    act(() => { result.current.changePace('fast'); });

    expect(result.current.travelPace).toBe('fast');
    expect(result.current.forcedMarchHours).toBe(0);
    expect(result.current.dailyBudget).toBe(6); // fast base, no stale 2-stack penalty
  });
});
