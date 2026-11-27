// @maintained-by-ai 2026-11-26
// Deterministic state-machine contract tests for useTravelManagement. All services
// and the runtime store are fully mocked, so this suite stays green across app churn
// unless the hook's own observable contract changes. Bug-lane siblings own the deep
// seams (session phase, trip owner, write-back, budget seeds, weather copy, null
// echoes); THIS file owns the core travel state machine: mount defaults/resume,
// plan/cancel/destination, advance transitions, day reset (camp), forced march,
// event lifecycle, and the max-EX display gate.
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

// sessionService's audit transport. The hook stays REAL through sessionService
// (mid-route advances arm the travel phase, which POSTs an audit line); the
// phase-OWNERSHIP semantics are the session-phase/traveling-phase siblings'
// lane — here we only need the transport silent so the suite never fetches.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
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
const { getRuntimeValue, setRuntimeValue, setRuntimeObject, getStore } = await import('../runtime/useRuntimeState.js');
const { hasSelfRestoration } = await import('../../services/combat/automation/automationService.js');
// REAL module import: pins arrival prose against the producer/consumer shared
// constant instead of a locally duplicated string.
const { TRIP_ARRIVAL_MESSAGE } = await import('../../services/maps/travelSession.js');

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
      expect(s.hexesRemaining).toBe(0);
      expect(s.paceInfo).toEqual({ id: 'normal', name: 'Normal' });
      expect(s.eventFrequency).toBe('normal');
      expect(s.rerollsRemaining).toBe(3);
      expect(s.exhaustionMultiplier).toBe(100);
      expect(s.partyHasMaxExhaustion).toBe(false);
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

  // startPlanning and cancelTravel are the two trip-entry/exit resets: identical
  // observable effect except the mode they park on (claim/release provenance is
  // owned by the trip-owner sibling).
  it.each([
    ['startPlanning', 'planning'],
    ['cancelTravel', 'inactive'],
  ])('%s parks an in-progress plan on idle bytes with mode %s', (action, mode) => {
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    act(() => { result.current[action](); });

    expect(result.current.travelMode).toBe(mode);
    expect(result.current.destination).toBeNull();
    expect(result.current.path).toEqual([]);
    expect(result.current.pathIndex).toBe(0);
    expect(result.current.lastMessage).toBeNull();
  });

  describe('setDestinationAndPath', () => {
    it('sets destination and path when path is non-empty', () => {
      const to = { q: 2, r: 0 };
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => {
        result.current.setDestinationAndPath(to);
      });

      expect(result.current.destination).toEqual(to);
      expect(result.current.path).toEqual(defaultPath);
      expect(result.current.travelMode).toBe('planning');
      expect(result.current.pathIndex).toBe(0);
      // Seam contract: pathfinding must receive the full grid context.
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

  it('changePace moves to the new pace budget at the NEW pace and clears the day penalties', () => {
    // Mount parked on a penalized day (FM hours 2, exhausted). Pre-fix
    // stale-closure lane is the forced-march-budget sibling's; here the pin is
    // the observable bundle: pace adopted, budget re-derived through the
    // service at the NEW pace id, hours/exhaustion reset alongside it.
    getDailyHexBudget.mockImplementation((pace) => (pace === 'fast' ? 8 : 6));
    const { result } = renderHook(() => useTravelManagement({
      ...baseArgs,
      initialTravelState: { dayExhausted: true, forcedMarchHours: 2 },
    }));
    act(() => {
      result.current.changePace('fast');
    });

    expect(getDailyHexBudget).toHaveBeenCalledWith('fast');
    expect(result.current.travelPace).toBe('fast');
    expect(result.current.dailyBudget).toBe(8);
    expect(result.current.dayExhausted).toBe(false);
    expect(result.current.forcedMarchHours).toBe(0);
  });

  describe('horseback', () => {
    it('toggleHorseback flips the flag both ways', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.horseback).toBe(false);

      act(() => { result.current.toggleHorseback(); });
      expect(result.current.horseback).toBe(true);

      act(() => { result.current.toggleHorseback(); });
      expect(result.current.horseback).toBe(false);
    });

    it('mounted advances accrue at 1/HORSEBACK_SPEED_MULTIPLIER of the footed cost', () => {
      // Family gap: every lane toggles economics around the multiplier; this
      // pins the only producer that applies it to advance accrual.
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });

      act(() => { result.current.toggleHorseback(); });
      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res).toEqual({ moved: true });
      expect(result.current.accruedCost).toBe(0.5);

      // On foot the same base cost accrues in full.
      act(() => { result.current.toggleHorseback(); });
      act(() => { result.current.advanceOneHex(); });
      expect(result.current.accruedCost).toBe(1.5);
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

      expect(res).toEqual({ moved: true });
      expect(result.current.pathIndex).toBe(1);
      expect(result.current.accruedCost).toBe(1);
      expect(baseArgs.onPartyMove).toHaveBeenCalledWith({ q: 1, r: 0 });
    });

    it('arrival deactivates the trip, echoes the shared prose, and clears the completed-trip keys (improve 2026-10-26-D)', async () => {
      // Pre-fix fingerprint: completing a trip left travel-destination/-path/
      // -pathIndex in the campaign bucket beside travel-mode:inactive.
      // Post-fix: the three trip keys are parked on idle bytes locally AND
      // DELETEd from change-data (null-POSTs would leave `key: null` behind).
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath({ q: 1, r: 0 }); });
      setRuntimeValue.mockClear();

      let res;
      await act(async () => { res = result.current.advanceOneHex(); });

      // Full return contract + self-consistent arrived state: mode inactive
      // next to the arrival prose (pinned against the shared constant).
      expect(res).toEqual({ moved: true, arrived: true });
      expect(result.current.travelMode).toBe('inactive');
      expect(result.current.lastMessage).toBe(TRIP_ARRIVAL_MESSAGE);
      // Trip keys cleared from hook state and the campaign store…
      expect(result.current.destination).toBeNull();
      expect(result.current.path).toEqual([]);
      expect(result.current.pathIndex).toBe(0);
      const store = getStore('campaign');
      expect(store.get('travel-destination')).toBeNull();
      expect(store.get('travel-path')).toEqual([]);
      expect(store.get('travel-pathIndex')).toBe(0);
      // …via ONE merged skipSync object write (no resurrecting POST)…
      expect(setRuntimeObject).toHaveBeenCalledWith('campaign', {
        'travel-destination': null,
        'travel-path': [],
        'travel-pathIndex': 0,
      }, 'test-campaign', true);
      expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'travel-destination', expect.anything(), expect.anything());
      expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'travel-path', expect.anything(), expect.anything());
      expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'travel-pathIndex', expect.anything(), expect.anything());
      // …plus one key-removal DELETE per completed-trip key.
      const deleteUrls = fetchSpy.mock.calls
        .filter(([, opts]) => opts?.method === 'DELETE')
        .map(([url]) => url);
      expect(deleteUrls).toEqual([
        '/api/campaigns/test-campaign/travel-destination',
        '/api/campaigns/test-campaign/travel-path',
        '/api/campaigns/test-campaign/travel-pathIndex',
      ]);
      fetchSpy.mockRestore();
    });

    it('mid-trip cancel never DELETEs change-data keys (clear stays null-write)', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
      act(() => { result.current.advanceOneHex(); });
      fetchSpy.mockClear();

      act(() => { result.current.cancelTravel(); });

      // Cancel's contract (reload-resume mid-trip depends on the keys'
      // presence semantics) is untouched by the arrival clearing lane.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.destination).toBeNull();
    });

    it('rejects an advance over budget, flags the day, and moves nothing', () => {
      // The mount-time over-budget FLAG lane is day-exhausted-init's; here the
      // pin is the reject producer: message, no accrual, no party move.
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { dailyBudget: 0 },
      }));
      act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });

      let res;
      act(() => { res = result.current.advanceOneHex(); });

      expect(res).toEqual({ moved: false });
      expect(result.current.dayExhausted).toBe(true);
      expect(result.current.lastMessage).toContain('exhausted their travel budget');
      expect(result.current.accruedCost).toBe(0);
      expect(result.current.pathIndex).toBe(0);
      expect(baseArgs.onPartyMove).not.toHaveBeenCalled();

      // And it keeps rejecting on the next press.
      act(() => { res = result.current.advanceOneHex(); });
      expect(res).toEqual({ moved: false });
    });

    it('advance into an event moves, returns the event, and pauses the trip', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      const res = advanceIntoEvent(result);

      expect(res).toEqual({ moved: true, event: { type: 'encounter', title: 'Random Event' } });
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

    it('camping from a spawned event dismisses it and resumes planning', () => {
      // Pre-fix this test seeded `initialTravelState: { pendingEvent }`, which
      // the hook never reads — vacuous. Real lane: advance into an event
      // (paused + pendingEvent live), then camp.
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      act(() => { result.current.forceCamp(); });

      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
      expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
    });

    it('does not change travelMode to planning if mode is inactive', () => {
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        initialTravelState: { travelMode: 'inactive' },
      }));
      act(() => { result.current.forceCamp(); });
      expect(result.current.travelMode).toBe('inactive');
    });
  });

  describe('forcedMarch', () => {
    it('adds exhaustion through the runtime store, re-pays the budget, and drops the multiplier', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.exhaustionMultiplier).toBe(100);

      let returned;
      act(() => { returned = result.current.forcedMarch(); });

      expect(returned).toBe(true);
      expect(result.current.forcedMarchHours).toBe(1);
      expect(result.current.dayExhausted).toBe(false);
      expect(result.current.accruedCost).toBe(0);
      expect(result.current.lastMessage).toContain('Forced march');
      // Seam contract: exhaustion rides the runtime store per character
      // (the store is the only path to the character sheets).
      expect(setRuntimeValue).toHaveBeenCalledWith('Hero', 'exhaustionLevel', 1, 'test-campaign');
      // Derived multiplier follows the new hours (budget math per-stack is the
      // forced-march-budget sibling's lane).
      expect(result.current.exhaustionMultiplier).toBe(Math.round(Math.pow(5 / 6, 1) * 100));
    });

    it('returns false and shows the refusal when a character has max exhaustion', () => {
      getRuntimeValue.mockReturnValue(6);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      let returned;
      act(() => { returned = result.current.forcedMarch(); });

      expect(returned).toBe(false);
      expect(result.current.lastMessage).toContain('Cannot forced march');
      expect(result.current.forcedMarchHours).toBe(0);
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Hero', 'exhaustionLevel', expect.anything(), expect.anything());
    });

    it('skips party members with self restoration', () => {
      const { result } = renderHook(() => useTravelManagement({
        ...baseArgs,
        characters: [{ name: 'Paladin' }, { name: 'Fighter' }],
      }));
      hasSelfRestoration.mockImplementation((char) => char?.name === 'Paladin');

      let returned;
      act(() => { returned = result.current.forcedMarch(); });

      expect(returned).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'exhaustionLevel', 1, 'test-campaign');
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Paladin', 'exhaustionLevel', expect.anything(), expect.anything());
    });
  });

  // The persisted travel-lastMessage header keeps showing the last FM press's
  // success copy even after the party hits max EX — while the FM button is
  // natively disabled. The hook's returned lastMessage swaps ONLY that copy
  // (prefix-matched) while maxed; every other message passes through. The
  // three cells below are the swap truth table (max × prefix).
  describe('stale-march copy display gate (backlog 2026-10-30-AN)', () => {
    const SUCCESS_COPY = 'Forced march — 1 exhaustion added to all party members. Daily budget reduced to 33%.';
    const REFUSAL_COPY = 'Cannot forced march — a party member has reached maximum exhaustion.';
    const seedMessage = (text) => getStore('campaign').set('travel-lastMessage', text);
    const seedLevel = (level) =>
      getRuntimeValue.mockImplementation((key, prop) =>
        (key === 'Hero' && prop === 'exhaustionLevel' ? level : null));

    it('replaces the success copy with the refusal wording while a member is maxed', () => {
      seedLevel(6);
      seedMessage(SUCCESS_COPY);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.partyHasMaxExhaustion).toBe(true);
      expect(result.current.lastMessage).toBe(REFUSAL_COPY);
    });

    it('passes the success copy through byte-identical below max (no regression)', () => {
      seedLevel(5);
      seedMessage(SUCCESS_COPY);
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.partyHasMaxExhaustion).toBe(false);
      expect(result.current.lastMessage).toBe(SUCCESS_COPY);
    });

    it('leaves unrelated messages untouched even at max (camp/arrival/event copy passes)', () => {
      seedLevel(6);
      seedMessage('A new day dawns. Travel budget refreshed.');
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.lastMessage).toBe('A new day dawns. Travel budget refreshed.');
    });
  });

  describe('event handling', () => {
    // accept navigates away (PLANNING restore); skip re-joins the route. From
    // this first-advance pause both legs park on planning — the mid-route
    // skip-restores-traveling resume is the traveling-phase sibling's lane.
    it.each([
      ['acceptEvent', { type: 'encounter', title: 'Random Event' }],
      ['skipEvent', undefined],
    ])('%s clears the pending event and returns %s', (method, expected) => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result);

      let out;
      act(() => { out = result.current[method](); });

      expect(out).toEqual(expected);
      expect(result.current.pendingEvent).toBeNull();
      expect(result.current.travelMode).toBe('planning');
      expect(result.current.lastMessage).toBeNull();
    });

    it('rerollEvent spends rerolls one per press, regenerates, and stops at zero', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      advanceIntoEvent(result); // 1 generation from the advance

      act(() => { result.current.rerollEvent(); });
      expect(result.current.rerollsRemaining).toBe(2);
      expect(result.current.pendingEvent).toEqual({ type: 'encounter', title: 'Random Event' });

      act(() => { result.current.rerollEvent(); });
      act(() => { result.current.rerollEvent(); });
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
      // Seam contract: plains terrain at { q: 1, r: 0 } maps to
      // grassland/desert environments for the generator.
      expect(generateEncounterSuggestions).toHaveBeenCalledWith(expect.objectContaining({
        monsters: [{ name: 'Goblin' }],
        playerLevels: baseArgs.playerLevels,
        environments: ['grassland', 'desert'],
      }));
    });
  });

  describe('computed values', () => {
    it('currentPosition, remainingSteps, and hexesRemaining track the party along the path', () => {
      const { result } = renderHook(() => useTravelManagement(baseArgs));
      expect(result.current.currentPosition).toBeNull();
      expect(result.current.remainingSteps).toEqual([]);
      expect(result.current.hexesRemaining).toBe(0);

      act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
      expect(result.current.currentPosition).toEqual({ q: 0, r: 0 });
      expect(result.current.remainingSteps).toEqual([{ q: 1, r: 0 }, { q: 2, r: 0 }]);
      expect(result.current.hexesRemaining).toBe(2);

      act(() => { result.current.advanceOneHex(); });
      expect(result.current.currentPosition).toEqual({ q: 1, r: 0 });
      expect(result.current.remainingSteps).toEqual([{ q: 2, r: 0 }]);
      expect(result.current.hexesRemaining).toBe(1);

      let res;
      act(() => { res = result.current.advanceOneHex(); });
      expect(res.arrived).toBe(true);
      expect(result.current.hexesRemaining).toBe(0);
    });
  });
});
