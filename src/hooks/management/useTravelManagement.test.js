// @maintained-by-ai
// Deterministic state-machine contract tests for useTravelManagement. All services
// and the runtime store are fully mocked, so this suite stays green across app churn
// unless the hook's own observable contract changes.
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

function _valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => _valuesEqual(a[k], b[k]));
  }
  return false;
}

var _stores;
var _listeners;

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
      const store = _stores.get(characterKey);
      if (!store) return;
      const existing = store.get(propertyName);
      if (_valuesEqual(existing, value)) return;
      store.set(propertyName, value);
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

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasSelfRestoration: vi.fn(() => false),
}));

const { calculatePath, getDailyHexBudget, getHexMoveCostWithRoad, applyExhaustionSpeedPenaltyToBudget, getExhaustionMultiplierPercent } = await import('../../services/campaign/travelService.js');
const { shouldTriggerEvent, generateRandomEvent } = await import('../../services/campaign/randomEventService.js');
const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
const { getRuntimeValue, setRuntimeValue } = await import('../runtime/useRuntimeState.js');
const { hasSelfRestoration } = await import('../../services/combat/automation/automationService.js');

const defaultPath = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];

describe('useTravelManagement', () => {
  const baseArgs = {
    hexCols: 10,
    hexRows: 10,
    terrain: { '1,0': 'plains', '2,0': 'plains' },
    partyPosition: { q: 0, r: 0 },
    onPartyMove: vi.fn(),
    weather: null,
    monsters: [],
    playerLevels: [1, 1, 1],
    roads: [],
    characters: [{ name: 'Hero' }],
    campaignName: 'test-campaign',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    calculatePath.mockReturnValue([...defaultPath]);
    getDailyHexBudget.mockReturnValue(6);
    getHexMoveCostWithRoad.mockReturnValue(1);
    applyExhaustionSpeedPenaltyToBudget.mockImplementation((b) => b);
    getExhaustionMultiplierPercent.mockImplementation((h) => Math.round(Math.pow(5 / 6, h) * 100));
    shouldTriggerEvent.mockReturnValue(false);
    generateRandomEvent.mockReturnValue({ type: 'encounter', title: 'Random Event' });
    generateEncounterSuggestions.mockReturnValue([]);
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockReturnValue(undefined);
    hasSelfRestoration.mockReturnValue(false);
  });

  // Shared setup for event tests: plan a route, arm the event trigger, advance once.
  // Returns the advanceOneHex result so callers can assert the return contract too.
  function advanceIntoEvent(result) {
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    shouldTriggerEvent.mockReturnValue(true);
    let res;
    act(() => { res = result.current.advanceOneHex(); });
    return res;
  }

  describe('initial state', () => {
    it('returns default values when no initialTravelState is provided', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      const s = result.current;

      expect(s.travelMode).toBe('inactive');
      expect(s.travelPace).toBe('normal');
      expect(s.destination).toBeNull();
      expect(s.path).toEqual([]);
      expect(s.pathIndex).toBe(0);
      expect(s.accruedCost).toBe(0);
      expect(s.dailyBudget).toBe(6);
      expect(s.dayExhausted).toBe(false);
      expect(s.forcedMarchHours).toBe(0);
      expect(s.horseback).toBe(false);
      expect(s.isTravelActive).toBe(false);
      expect(s.pendingEvent).toBeNull();
      expect(s.lastMessage).toBeNull();
      expect(s.currentPosition).toBeNull();
      expect(s.remainingSteps).toEqual([]);
      expect(s.paceInfo.id).toBe('normal');
      expect(s.eventFrequency).toBe('normal');
      expect(s.rerollsRemaining).toBe(3);
      expect(s.travelLog).toEqual([]);
    });

    it('restores full travel state from initialTravelState', () => {
      const { result } = renderHook(() =>
        useTravelManagement({
          ...baseArgs,
          initialTravelState: {
            travelMode: 'planning',
            travelPace: 'fast',
            destination: { q: 5, r: 5 },
            path: [{ q: 0, r: 0 }, { q: 1, r: 1 }],
            pathIndex: 2,
            accruedCost: 3,
            dayExhausted: true,
            forcedMarchHours: 2,
          },
        })
      );

      expect(result.current.travelMode).toBe('planning');
      expect(result.current.travelPace).toBe('fast');
      expect(result.current.destination).toEqual({ q: 5, r: 5 });
      expect(result.current.path).toEqual([{ q: 0, r: 0 }, { q: 1, r: 1 }]);
      expect(result.current.pathIndex).toBe(2);
      expect(result.current.accruedCost).toBe(3);
      expect(result.current.dayExhausted).toBe(true);
      expect(result.current.forcedMarchHours).toBe(2);
    });
  });

  describe('startPlanning', () => {
    it('resets mode to planning and clears destination, path, and message', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath({ q: 2, r: 0 });
      });
      act(() => {
        result.current.startPlanning();
      });

      expect(result.current.travelMode).toBe('planning');
      expect(result.current.destination).toBeNull();
      expect(result.current.path).toEqual([]);
      expect(result.current.pathIndex).toBe(0);
      expect(result.current.lastMessage).toBeNull();
    });
  });

  describe('cancelTravel', () => {
    it('resets mode to inactive and clears all travel state', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath({ q: 2, r: 0 });
      });
      act(() => {
        result.current.cancelTravel();
      });

      expect(result.current.travelMode).toBe('inactive');
      expect(result.current.destination).toBeNull();
      expect(result.current.path).toEqual([]);
      expect(result.current.pathIndex).toBe(0);
      expect(result.current.lastMessage).toBeNull();
    });
  });

  describe('setDestinationAndPath', () => {
    it('sets destination and path when path is non-empty', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });

      expect(result.current.destination).toEqual(to);
      expect(result.current.path).toHaveLength(3);
      expect(result.current.travelMode).toBe('planning');
      expect(result.current.pathIndex).toBe(0);
      expect(calculatePath).toHaveBeenCalledWith(
        baseArgs.partyPosition, to, { hexCols: baseArgs.hexCols, hexRows: baseArgs.hexRows, terrain: baseArgs.terrain, roads: baseArgs.roads }
      );
    });

    it('does nothing when partyPosition is null', () => {
      const { result } = renderHook(() => useTravelManagement({ ...baseArgs, partyPosition: null }));
      act(() => {
        result.current.setDestinationAndPath({ q: 2, r: 0 });
      });

      expect(result.current.destination).toBeNull();
      expect(result.current.path).toEqual([]);
    });

    it('does nothing when calculatePath returns empty', () => {
      calculatePath.mockReturnValue([]);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath({ q: 2, r: 0 });
      });

      expect(result.current.destination).toBeNull();
      expect(result.current.path).toEqual([]);
    });
  });

  describe('changePace', () => {
    it('updates travelPace, resets exhaustion, and recalculates dailyBudget', () => {
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { dayExhausted: true, forcedMarchHours: 2 },
      }));
      act(() => {
        result.current.changePace('fast');
      });

      expect(result.current.travelPace).toBe('fast');
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.forcedMarchHours).toBe(0);
      expect(applyExhaustionSpeedPenaltyToBudget).toHaveBeenCalled();
    });
  });

  describe('toggleHorseback', () => {
    it('toggles horseback true then false', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.horseback).toBe(false);

      act(() => { result.current.toggleHorseback(); });
      expect(result.current.horseback).toBe(true);

      act(() => { result.current.toggleHorseback(); });
      expect(result.current.horseback).toBe(false);
    });
  });

  describe('advanceOneHex', () => {
    it('returns { moved: false } when path is empty', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      let res;
      act(() => { res = result.current.advanceOneHex(); });
      expect(res).toEqual({ moved: false });
    });

    it('advances one hex and calls onPartyMove with the next hex', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });

      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res.moved).toBe(true);
      expect(result.current.pathIndex).toBe(1);
      expect(result.current.accruedCost).toBe(1);
      expect(baseArgs.onPartyMove).toHaveBeenCalledWith({ q: 1, r: 0 });
    });

    it('returns { moved: true, arrived: true } when reaching the destination', () => {
      calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
      const to = { q: 1, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });

      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res.arrived).toBe(true);
      expect(result.current.travelMode).toBe('inactive');
      expect(result.current.lastMessage).toBe('The party has arrived at their destination.');
    });

    it('does not advance when accruedCost would exceed dailyBudget', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { dailyBudget: 0 },
      }));
      act(() => { result.current.setDestinationAndPath(to); });

      act(() => { result.current.advanceOneHex(); });
      expect(result.current.dayExhausted).toBe(true);
      expect(result.current.lastMessage).toContain('exhausted their travel budget');

      let res;
      act(() => { res = result.current.advanceOneHex(); });
      expect(res.moved).toBe(false);
    });

    it('returns { moved: false } when weather makes travel impossible', () => {
      getHexMoveCostWithRoad.mockReturnValue(null);
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        weather: { label: 'Cataclysmic', moveCostMod: null },
      }));
      act(() => { result.current.setDestinationAndPath(to); });

      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res.moved).toBe(false);
      expect(result.current.lastMessage).toContain('makes travel impossible');
    });

    it('triggers a random event and pauses travel when shouldTriggerEvent returns true', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      expect(result.current.travelMode).toBe('paused');
      expect(result.current.pendingEvent).toEqual({ type: 'encounter', title: 'Random Event' });
      expect(result.current.lastMessage).toContain('Random Event');
    });
  });

  describe('forceCamp', () => {
    it('resets accruedCost, exhaustion, forcedMarchHours, and rerolls', () => {
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { accruedCost: 5, dayExhausted: true, forcedMarchHours: 2 },
      }));

      act(() => { result.current.forceCamp(); });

      expect(result.current.accruedCost).toBe(0);
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.forcedMarchHours).toBe(0);
      expect(result.current.rerollsRemaining).toBe(3);
      expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
    });

    it('transitions from paused to planning', () => {
      const { result: pausedResult } = renderHook(() => useTravelManagement({
        ...baseArgs,
        campaignName: 'test-campaign-paused',
        initialTravelState: { travelMode: 'paused' },
      }));
      act(() => { pausedResult.current.forceCamp(); });
      expect(pausedResult.current.travelMode).toBe('planning');
    });

    it('does not transition from inactive', () => {
      const { result: inactiveResult } = renderHook(() => useTravelManagement({
        ...baseArgs,
        campaignName: 'test-campaign-inactive',
        initialTravelState: { travelMode: 'inactive' },
      }));
      act(() => { inactiveResult.current.forceCamp(); });
      expect(inactiveResult.current.travelMode).toBe('inactive');
    });

    it('clears pendingEvent', () => {
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { pendingEvent: { type: 'encounter' } },
      }));
      act(() => { result.current.forceCamp(); });
      expect(result.current.pendingEvent).toBeNull();
    });
  });

  describe('forcedMarch', () => {
    it('increases forcedMarchHours and resets budget when no one has self restoration', () => {
      hasSelfRestoration.mockReturnValue(false);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      let returned;
      act(() => { returned = result.current.forcedMarch(); });

      expect(returned).toBe(true);
      expect(result.current.forcedMarchHours).toBe(1);
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.accruedCost).toBe(0);
      expect(result.current.lastMessage).toContain('Forced march');
    });

    it('returns false and shows message when a character has max exhaustion', () => {
      getRuntimeValue.mockReturnValue(6);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      let returned;
      act(() => { returned = result.current.forcedMarch(); });

      expect(returned).toBe(false);
      expect(result.current.lastMessage).toContain('Cannot forced march');
    });
  });

  describe('partyHasMaxExhaustion', () => {
    it('returns true when any character has exhaustion >= EXHAUSTION_LEVELS', () => {
      getRuntimeValue.mockReturnValue(6);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.partyHasMaxExhaustion).toBe(true);
    });

    it('returns false when no character has max exhaustion', () => {
      getRuntimeValue.mockReturnValue(3);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.partyHasMaxExhaustion).toBe(false);
    });
  });

  describe('event handling', () => {
    it('returns the event from advanceOneHex when an event triggers', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      const res = advanceIntoEvent(result);

      expect(res.moved).toBe(true);
      expect(res.event).toEqual({ type: 'encounter', title: 'Random Event' });
    });

    it('acceptEvent returns the pending event and clears it', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      let evt;
      act(() => { evt = result.current.acceptEvent(); });
      expect(evt).toEqual({ type: 'encounter', title: 'Random Event' });
      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
    });

    it('skipEvent clears the pending event without returning it', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      let skipped;
      act(() => { skipped = result.current.skipEvent(); });
      expect(skipped).toBeUndefined();
      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
    });

    it('rerollEvent generates a new event and decrements rerollsRemaining', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      act(() => { result.current.rerollEvent(); });
      expect(result.current.rerollsRemaining).toBe(2);
      expect(result.current.pendingEvent).toEqual({ type: 'encounter', title: 'Random Event' });
    });

    it('rerollEvent stops once rerolls are exhausted', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      for (let i = 0; i < 3; i++) {
        act(() => { result.current.rerollEvent(); });
      }
      expect(result.current.rerollsRemaining).toBe(0);
      // 1 event from the advance + 3 rerolls; a 4th reroll must not generate more.
      expect(generateRandomEvent).toHaveBeenCalledTimes(4);

      act(() => { result.current.rerollEvent(); });
      expect(result.current.rerollsRemaining).toBe(0);
      expect(generateRandomEvent).toHaveBeenCalledTimes(4);
    });

    it('enriches combat events with encounter suggestions when monsters are available', () => {
      shouldTriggerEvent.mockReturnValue(true);
      generateRandomEvent.mockReturnValue({ type: 'combat', title: 'Ambush' });
      generateEncounterSuggestions.mockReturnValue([{
        monsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
        difficultyLabel: 'Easy',
        totalXP: 50,
      }]);
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        monsters: [{ name: 'Goblin' }],
      }));
      const res = advanceIntoEvent(result);

      expect(res.event.encounter).toEqual({
        monsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
        difficultyLabel: 'Easy',
        totalXP: 50,
      });
      // Plains terrain at { q: 1, r: 0 } maps to grassland/desert environments.
      expect(generateEncounterSuggestions).toHaveBeenCalledWith(expect.objectContaining({
        monsters: [{ name: 'Goblin' }],
        playerLevels: baseArgs.playerLevels,
        environments: ['grassland', 'desert'],
      }));
    });
  });

  describe('computed values', () => {
    it('hexesRemaining decreases as the party advances', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });
      expect(result.current.hexesRemaining).toBe(2);

      act(() => { result.current.advanceOneHex(); });
      expect(result.current.hexesRemaining).toBe(1);

      act(() => { result.current.advanceOneHex(); });
      expect(result.current.hexesRemaining).toBe(0);
    });

    it('exhaustionMultiplier reflects forcedMarchHours', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.exhaustionMultiplier).toBe(100);

      act(() => { result.current.forcedMarch(); });
      expect(result.current.exhaustionMultiplier).toBe(Math.round(Math.pow(5 / 6, 1) * 100));
    });

    it('currentPosition is null when no path, then reflects path[pathIndex]', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.currentPosition).toBeNull();

      const to = { q: 2, r: 0 };
      act(() => { result.current.setDestinationAndPath(to); });
      expect(result.current.currentPosition).toEqual({ q: 0, r: 0 });

      act(() => { result.current.advanceOneHex(); });
      expect(result.current.currentPosition).toEqual({ q: 1, r: 0 });
    });
  });
});
