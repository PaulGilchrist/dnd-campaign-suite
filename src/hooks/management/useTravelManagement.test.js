// @cleaned-by-ai
// @improved-by-ai
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
        baseArgs.partyPosition, to, baseArgs.hexCols, baseArgs.hexRows, baseArgs.terrain, baseArgs.roads
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
      const { result } = renderHook(() => useTravelManagement(baseArgs));
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
      shouldTriggerEvent.mockReturnValue(true);
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });

      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res.moved).toBe(true);
      expect(res.event).toBeDefined();
      expect(result.current.travelMode).toBe('paused');
      expect(result.current.pendingEvent).toBeDefined();
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

    it('transitions from paused to planning, but not from other modes', () => {
      const { result: pausedResult } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { travelMode: 'paused' },
      }));
      act(() => { pausedResult.current.forceCamp(); });
      expect(pausedResult.current.travelMode).toBe('planning');

      const { result: inactiveResult } = renderHook(() => useTravelManagement({
        ...baseArgs,
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
    it('acceptEvent returns the pending event and clears it', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });
      shouldTriggerEvent.mockReturnValue(true);
      act(() => { result.current.advanceOneHex(); });

      let evt;
      act(() => { evt = result.current.acceptEvent(); });
      expect(evt).toEqual({ type: 'encounter', title: 'Random Event' });
      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
    });

    it('skipEvent clears the pending event without returning it', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });
      shouldTriggerEvent.mockReturnValue(true);
      act(() => { result.current.advanceOneHex(); });

      act(() => { result.current.skipEvent(); });
      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
    });

    it('rerollEvent generates a new event and decrements rerollsRemaining', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath(to); });
      shouldTriggerEvent.mockReturnValue(true);
      act(() => { result.current.advanceOneHex(); });

      act(() => { result.current.rerollEvent(); });
      expect(result.current.rerollsRemaining).toBe(2);
      expect(result.current.pendingEvent).toEqual({ type: 'encounter', title: 'Random Event' });
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
