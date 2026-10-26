// @maintained-by-ai
// Lane: useTravelManagement's L5 §10.1 session-phase producer (bug-travel-phase-
// traveling-never-set). The phase-OWNERSHIP seam (who may clobber an armed
// phase) is owned by useTravelManagement.session-phase.test.js; the phase state
// machine internals by sessionService.test.js. THIS file pins the missing
// producer itself: a successful mid-route `Advance One Hex` must write
// travel-mode 'traveling' (the producer call site of MODES.TRAVELING; the
// skip-after-mid-route-event restore below is the second) and arm
// sessionState.phase='travel' with its session_phase audit line, and the
// arrival/cancel INACTIVE branches must then restore 'exploration' with an
// entry of its own. Pre-fix: travel ran entirely in 'planning'/'paused', the
// key never existed, and the whole cycle logged ZERO session_phase entries.
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

// Runtime store mock (same shape as the sibling files): getRuntimeValue is the
// read readSessionPhase consults; setRuntimeValue calls are the assertions.
var _stores;
var _listeners;

vi.mock('../runtime/useRuntimeState.js', () => {
  if (!_stores) {
    _stores = new Map();
    _listeners = new Map();
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
      if (store) store.set(propertyName, value);
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

// sessionService's audit transport — the hook stays REAL through
// sessionService so the producer → phase → audit chain is exercised
// end-to-end.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { calculatePath } = await import('../../services/campaign/travelService.js');

const CN = 'test-campaign';

// Seed the sessionState runtime key the way a prior phase move would leave it
// (null ⇒ key unset ⇒ readSessionPhase defaults to 'exploration').
const phaseIs = (phase) => {
  getRuntimeValue.mockImplementation((who, key) =>
    who === 'campaign' && key === 'sessionState' && phase ? { phase } : null
  );
};

const phaseWrites = () =>
  setRuntimeValue.mock.calls.filter(([who, key]) => who === 'campaign' && key === 'sessionState');

const modeWrites = (value) =>
  setRuntimeValue.mock.calls.filter(
    ([who, key, v]) => who === 'campaign' && key === 'travel-mode' && (value === undefined || v === value)
  );

describe('useTravelManagement — MODES.TRAVELING producer arms the travel phase (bug-travel-phase-traveling-never-set)', () => {
  const baseArgs = {
    hexCols: 10,
    hexRows: 10,
    terrain: { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' },
    partyPosition: { q: 0, r: 0 },
    onPartyMove: vi.fn(),
    weather: null,
    monsters: [],
    playerLevels: [19],
    roads: [],
    characters: [{ name: 'Hero' }],
    campaignName: CN,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _stores.clear();
    _listeners.clear();
    phaseIs(null);
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
  });

  it('mid-route advance writes travel-mode traveling and arms phase travel + session_phase audit', async () => {
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    let res;
    await act(async () => { res = result.current.advanceOneHex(); });

    expect(res).toEqual({ moved: true });
    // The broken fingerprint: this write NEVER happened (mode stayed planning).
    expect(result.current.travelMode).toBe('traveling');
    expect(modeWrites('traveling')).toEqual([['campaign', 'travel-mode', 'traveling', CN]]);
    // …and neither did the phase arm: sessionState never existed app-wide.
    expect(phaseWrites()).toEqual([
      ['campaign', 'sessionState', expect.objectContaining({ phase: 'travel', changedBy: 'travel management' }), CN],
    ]);
    expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
      type: 'session_phase',
      phase: 'travel',
      previousPhase: 'exploration',
      changedBy: 'travel management',
      description: 'Session phase: exploration → travel (travel started) — travel management.',
    }));
  });

  it('repeated mid-route advances churn travel-mode exactly once (same-value guard, phase deduped)', async () => {
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }]);
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 3, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.advanceOneHex(); }); // idx 1 — traveling armed
    await act(async () => { result.current.advanceOneHex(); }); // idx 2 — still mid-route

    expect(result.current.travelMode).toBe('traveling');
    expect(modeWrites('traveling')).toHaveLength(1);
    expect(phaseWrites()).toHaveLength(1);
  });

  it('arrival from traveling restores exploration with its own session_phase entry', async () => {
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.advanceOneHex(); }); // idx 1 — mid-route
    let res;
    await act(async () => { res = result.current.advanceOneHex(); }); // idx 2 — arrival

    expect(res.arrived).toBe(true);
    expect(result.current.travelMode).toBe('inactive');
    expect(phaseWrites()).toEqual([
      ['campaign', 'sessionState', expect.objectContaining({ phase: 'exploration', changedBy: 'travel management' }), CN],
    ]);
    expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
      type: 'session_phase',
      phase: 'exploration',
      previousPhase: 'travel',
      changedBy: 'travel management',
      description: 'Session phase: travel → exploration (travel ended) — travel management.',
    }));
  });

  it('cancel from traveling restores exploration (phase-ownership guard now reachable)', async () => {
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.advanceOneHex(); }); // mid-route → traveling
    await act(async () => { result.current.cancelTravel(); });

    expect(result.current.travelMode).toBe('inactive');
    expect(phaseWrites()).toEqual([
      ['campaign', 'sessionState', expect.objectContaining({ phase: 'exploration', changedBy: 'travel management' }), CN],
    ]);
    expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
      type: 'session_phase',
      phase: 'exploration',
      previousPhase: 'travel',
    }));
  });

  it('event advance stays a single mode write (paused, no traveling churn, phase untouched)', async () => {
    const { shouldTriggerEvent } = await import('../../services/campaign/randomEventService.js');
    shouldTriggerEvent.mockReturnValue(true);
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    let res;
    await act(async () => { res = result.current.advanceOneHex(); });

    expect(res.event).toBeTruthy();
    expect(result.current.travelMode).toBe('paused');
    // One mode write for the whole advance — never TRAVELING-then-PAUSED in
    // the same tick (same-endpoint POSTs race, see advanceOneHex comment).
    expect(setRuntimeValue.mock.calls.filter(([who, key]) => who === 'campaign' && key === 'travel-mode'))
      .toEqual([['campaign', 'travel-mode', 'paused', CN]]);
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  // Improve 2026-10-26 (run-E backlog): an event that fires MID-ROUTE must not
  // demote the party to 'planning' when it is skipped — it restores the mode
  // the pause interrupted (TRAVELING) with zero session_phase churn (the phase
  // is already 'travel'; sessionService dedupes same-phase writes).
  it('mid-route event → skip restores traveling with zero session_phase churn, next advance moves on', async () => {
    const { shouldTriggerEvent } = await import('../../services/campaign/randomEventService.js');
    // beforeEach uses clearAllMocks, which KEEPS implementations — disarm
    // explicitly (a prior test leaves shouldTriggerEvent → true).
    shouldTriggerEvent.mockReturnValue(false);
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }]);
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 4, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    // Advance 1: plain move — arms TRAVELING (phase write deduped by phaseIs).
    await act(async () => { result.current.advanceOneHex(); });
    // Advance 2: fires the event — parks PAUSED.
    shouldTriggerEvent.mockReturnValue(true);
    let res;
    await act(async () => { res = result.current.advanceOneHex(); });
    expect(res.event).toBeTruthy();
    expect(result.current.travelMode).toBe('paused');

    // Skip: pre-fix landed PLANNING mid-trip (the cosmetic defect).
    act(() => { result.current.skipEvent(); });
    expect(result.current.pendingEvent).toBeNull();
    expect(result.current.travelMode).toBe('traveling');
    expect(result.current.hexesRemaining).toBe(2);
    expect(modeWrites()).toEqual([
      ['campaign', 'travel-mode', 'traveling', CN],
      ['campaign', 'travel-mode', 'paused', CN],
      ['campaign', 'travel-mode', 'traveling', CN],
    ]);
    // AC2: no spurious phase churn anywhere in the cycle.
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();

    // AC1: the next Advance moves the party normally — traveling guard skips a
    // redundant mode write.
    shouldTriggerEvent.mockReturnValue(false);
    let next;
    await act(async () => { next = result.current.advanceOneHex(); });
    expect(next).toEqual({ moved: true });
    expect(modeWrites('traveling')).toHaveLength(2);
  });

  it('first-advance event → skip restores planning (planning-stays-planning edge)', async () => {
    const { shouldTriggerEvent } = await import('../../services/campaign/randomEventService.js');
    shouldTriggerEvent.mockReturnValue(true);
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.advanceOneHex(); });
    expect(result.current.travelMode).toBe('paused');
    act(() => { result.current.skipEvent(); });

    // Mode was PLANNING when the event paused travel — skip keeps it there and
    // never writes TRAVELING (no session_phase arm either).
    expect(result.current.travelMode).toBe('planning');
    expect(modeWrites('traveling')).toHaveLength(0);
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('accept leg keeps its PLANNING restore (skip-only mode resume)', async () => {
    const { shouldTriggerEvent } = await import('../../services/campaign/randomEventService.js');
    shouldTriggerEvent.mockReturnValue(false); // clearAllMocks keeps impls
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }]);
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 4, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.advanceOneHex(); }); // traveling
    shouldTriggerEvent.mockReturnValue(true);
    await act(async () => { result.current.advanceOneHex(); }); // paused (event)
    shouldTriggerEvent.mockReturnValue(false);

    // The accept leg navigates away to the encounter map — its mode handling
    // is a separate lane and must NOT resume TRAVELING (unchanged bytes).
    let evt;
    await act(async () => { evt = result.current.acceptEvent(); });
    expect(evt).toBeTruthy();
    expect(result.current.travelMode).toBe('planning');
    expect(modeWrites()).toEqual([
      ['campaign', 'travel-mode', 'traveling', CN],
      ['campaign', 'travel-mode', 'paused', CN],
      ['campaign', 'travel-mode', 'planning', CN],
    ]);
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
