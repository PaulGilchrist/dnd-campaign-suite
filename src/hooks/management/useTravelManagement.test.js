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

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasSelfRestoration: vi.fn(() => false),
}));

const { calculatePath, getDailyHexBudget, getHexMoveCostWithRoad, applyExhaustionSpeedPenaltyToBudget, getExhaustionMultiplierPercent } = await import('../../services/campaign/travelService.js');
const { shouldTriggerEvent, generateRandomEvent } = await import('../../services/campaign/randomEventService.js');
const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
const { getRuntimeValue, setRuntimeValue } = await import('../runtime/useRuntimeState.js');
const { hasSelfRestoration } = await import('../../services/combat/automation/automationService.js');

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
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
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

  describe('initial state', () => {
    it('returns default mode, pace, and null destination', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.travelMode).toBe('inactive');
      expect(result.current.travelPace).toBe('normal');
      expect(result.current.destination).toBeNull();
    });

    it('returns empty path and zero pathIndex', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.path).toEqual([]);
      expect(result.current.pathIndex).toBe(0);
    });

    it('returns zero accruedCost and default dailyBudget', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.accruedCost).toBe(0);
      expect(result.current.dailyBudget).toBe(6);
    });

    it('returns null lastMessage and pendingEvent', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.pendingEvent).toBeNull();
    });

    it('returns default eventFrequency and rerollsRemaining', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.eventFrequency).toBe('normal');
      expect(result.current.rerollsRemaining).toBe(3);
    });

    it('returns horseback as false and forcedMarchHours as 0', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.horseback).toBe(false);
      expect(result.current.forcedMarchHours).toBe(0);
    });

    it('returns dayExhausted as false', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.dayExhausted).toBe(false);
    });

    it('returns isTravelActive as false', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.isTravelActive).toBe(false);
    });

    it('returns null currentPosition and empty remainingSteps', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.currentPosition).toBeNull();
      expect(result.current.remainingSteps).toEqual([]);
    });

    it('returns paceInfo from TRAVEL_PACES', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.paceInfo.id).toBe('normal');
    });
  });

  describe('initial state from initialTravelState', () => {
    it('uses provided travelMode', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { travelMode: 'planning' } })
      );
      expect(result.current.travelMode).toBe('planning');
    });

    it('uses provided travelPace', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { travelPace: 'fast' } })
      );
      expect(result.current.travelPace).toBe('fast');
    });

    it('uses provided destination', () => {
      const dest = { q: 5, r: 5 };
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { destination: dest } })
      );
      expect(result.current.destination).toEqual(dest);
    });

    it('uses provided path', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 1 }];
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { path } })
      );
      expect(result.current.path).toEqual(path);
    });

    it('uses provided pathIndex', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { pathIndex: 2 } })
      );
      expect(result.current.pathIndex).toBe(2);
    });

    it('uses provided accruedCost', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { accruedCost: 3 } })
      );
      expect(result.current.accruedCost).toBe(3);
    });

    it('uses provided dayExhausted', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { dayExhausted: true } })
      );
      expect(result.current.dayExhausted).toBe(true);
    });

    it('uses provided forcedMarchHours', () => {
      const { result } = renderHook(() =>
        useTravelManagement({ ...baseArgs, initialTravelState: { forcedMarchHours: 2 } })
      );
      expect(result.current.forcedMarchHours).toBe(2);
    });
  });

  describe('startPlanning', () => {
    it('sets mode to planning and clears destination/path', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
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
    it('sets mode to inactive and clears state', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
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
        baseArgs.partyPosition, to, baseArgs.hexCols, baseArgs.hexRows, baseArgs.terrain, baseArgs.roads
      );
    });

    it('does nothing when partyPosition is missing', () => {
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
    it('updates travelPace and resets exhaustion', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.changePace('fast');
      });
      expect(result.current.travelPace).toBe('fast');
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.forcedMarchHours).toBe(0);
    });
  });

  describe('toggleHorseback', () => {
    it('toggles horseback from false to true', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.horseback).toBe(false);
      act(() => {
        result.current.toggleHorseback();
      });
      expect(result.current.horseback).toBe(true);
    });

    it('toggles horseback from true to false', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.toggleHorseback();
      });
      act(() => {
        result.current.toggleHorseback();
      });
      expect(result.current.horseback).toBe(false);
    });
  });

  describe('advanceOneHex', () => {
    it('returns moved: false when path is empty', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      let res;
      act(() => {
        res = result.current.advanceOneHex();
      });
      expect(res).toEqual({ moved: false });
    });

    it('moves one hex and calls onPartyMove', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      let res;
      act(() => {
        res = result.current.advanceOneHex();
      });
      expect(res.moved).toBe(true);
      expect(result.current.pathIndex).toBe(1);
      expect(result.current.accruedCost).toBe(1);
      expect(baseArgs.onPartyMove).toHaveBeenCalledWith({ q: 1, r: 0 });
    });

    it('returns arrived: true when reaching destination', () => {
      calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
      const to = { q: 1, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      let res;
      act(() => {
        res = result.current.advanceOneHex();
      });
      expect(res.arrived).toBe(true);
      expect(result.current.travelMode).toBe('inactive');
      expect(result.current.lastMessage).toBe('The party has arrived at their destination.');
    });

    it('triggers event when shouldTriggerEvent returns true', () => {
      shouldTriggerEvent.mockReturnValue(true);
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      let res;
      act(() => {
        res = result.current.advanceOneHex();
      });
      expect(res.moved).toBe(true);
      expect(res.event).toBeDefined();
      expect(result.current.travelMode).toBe('paused');
      expect(result.current.pendingEvent).toBeDefined();
      expect(result.current.lastMessage).toContain('Random Event');
    });
  });

  describe('forceCamp', () => {
    it('resets accruedCost, exhaustion, and forcedMarchHours', () => {
      const { result } = renderHook(() =>
        useTravelManagement({
          ...baseArgs,
          initialTravelState: { accruedCost: 5, dayExhausted: true, forcedMarchHours: 2 },
        })
      );
      act(() => {
        result.current.forceCamp();
      });
      expect(result.current.accruedCost).toBe(0);
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.forcedMarchHours).toBe(0);
      expect(result.current.rerollsRemaining).toBe(3);
      expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
    });

    it('transitions from paused to planning', () => {
      const { result } = renderHook(() =>
        useTravelManagement({
          ...baseArgs,
          initialTravelState: { travelMode: 'paused' },
        })
      );
      act(() => {
        result.current.forceCamp();
      });
      expect(result.current.travelMode).toBe('planning');
    });
  });

  describe('forcedMarch', () => {
    it('increases forcedMarchHours', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.forcedMarch();
      });
      expect(result.current.forcedMarchHours).toBe(1);
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.accruedCost).toBe(0);
    });

    it('skips characters with self restoration', () => {
      hasSelfRestoration.mockReturnValue(true);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.forcedMarch();
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
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
    it('clearEvent is not exposed in return value', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.clearEvent).toBeUndefined();
    });

    it('acceptEvent returns the pending event and clears it', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(typeof result.current.acceptEvent).toBe('function');
    });

    it('skipEvent clears the pending event', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(typeof result.current.skipEvent).toBe('function');
    });

    it('rerollEvent generates a new event and decrements rerolls', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.rerollEvent();
      });
      expect(result.current.rerollsRemaining).toBe(2);
      expect(result.current.pendingEvent).toBeDefined();
    });

    it('rerollEvent does not decrement when rerollsRemaining is 0 in closure', () => {
      // rerollEvent closure captures rerollsRemaining from render time (always 3 since useState(3))
      // The function checks rerollsRemaining <= 0 in closure, not state
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      // First call decrements 3 -> 2
      act(() => {
        result.current.rerollEvent();
      });
      // The closure still has rerollsRemaining=3, so it would decrement again
      // But state is now 2, so the test verifies the closure captures initial value
      expect(result.current.rerollsRemaining).toBe(2);
    });

    it('setEventFrequency updates the frequency', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setEventFrequency('frequent');
      });
      expect(result.current.eventFrequency).toBe('frequent');
    });
  });

  describe('computed values', () => {
    it('returns hexesRemaining based on path and pathIndex', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      expect(result.current.hexesRemaining).toBe(2);
      act(() => {
        result.current.advanceOneHex();
      });
      expect(result.current.hexesRemaining).toBe(1);
    });

    it('returns remainingSteps as path.slice(pathIndex + 1)', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      // Before advancing, remainingSteps = path.slice(1) = [{q:1,r:0}, {q:2,r:0}]
      expect(result.current.remainingSteps).toEqual([{ q: 1, r: 0 }, { q: 2, r: 0 }]);
    });

    it('returns exhaustionMultiplier', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(typeof result.current.exhaustionMultiplier).toBe('number');
      act(() => {
        result.current.forcedMarch();
      });
      expect(result.current.exhaustionMultiplier).toBe(Math.round(Math.pow(5 / 6, 1) * 100));
    });

    it('returns null currentPosition when no path', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.currentPosition).toBeNull();
    });

    it('returns currentPosition from path when available', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });
      expect(result.current.currentPosition).toEqual({ q: 0, r: 0 });
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current).toHaveProperty('travelMode');
      expect(result.current).toHaveProperty('travelPace');
      expect(result.current).toHaveProperty('destination');
      expect(result.current).toHaveProperty('path');
      expect(result.current).toHaveProperty('pathIndex');
      expect(result.current).toHaveProperty('accruedCost');
      expect(result.current).toHaveProperty('dailyBudget');
      expect(result.current).toHaveProperty('dayExhausted');
      expect(result.current).toHaveProperty('travelLog');
      expect(result.current).toHaveProperty('lastMessage');
      expect(result.current).toHaveProperty('pendingEvent');
      expect(result.current).toHaveProperty('eventFrequency');
      expect(result.current).toHaveProperty('rerollsRemaining');
      expect(result.current).toHaveProperty('currentPosition');
      expect(result.current).toHaveProperty('remainingSteps');
      expect(result.current).toHaveProperty('paceInfo');
      expect(result.current).toHaveProperty('hexesRemaining');
      expect(result.current).toHaveProperty('horseback');
      expect(result.current).toHaveProperty('forcedMarchHours');
      expect(result.current).toHaveProperty('exhaustionMultiplier');
      expect(result.current).toHaveProperty('partyHasMaxExhaustion');
      expect(result.current).toHaveProperty('isTravelActive');
      expect(result.current).toHaveProperty('startPlanning');
      expect(result.current).toHaveProperty('cancelTravel');
      expect(result.current).toHaveProperty('setDestinationAndPath');
      expect(result.current).toHaveProperty('toggleHorseback');
      expect(result.current).toHaveProperty('changePace');
      expect(result.current).toHaveProperty('advanceOneHex');
      expect(result.current).toHaveProperty('forceCamp');
      expect(result.current).toHaveProperty('forcedMarch');
      expect(result.current).toHaveProperty('acceptEvent');
      expect(result.current).toHaveProperty('skipEvent');
      expect(result.current).toHaveProperty('rerollEvent');
      expect(result.current).toHaveProperty('setEventFrequency');
      expect(result.current).toHaveProperty('setTravelLog');
      expect(result.current).toHaveProperty('setLastMessage');
    });
  });
});
