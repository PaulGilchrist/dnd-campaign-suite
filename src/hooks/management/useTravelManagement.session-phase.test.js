// @maintained-by-ai
// Lane: useTravelManagement's L5 §10.1 session-phase wrapper — PHASE OWNERSHIP
// (bug-autoencounter-travel-phase-clobber). The travel-mode state write itself
// and the travel engine are owned by useTravelManagement.test.js; the phase
// state machine internals (same-phase dedupe, session_phase audit bytes) are
// owned by sessionService.test.js (#1021). THIS file pins only the seam:
// which owner may move the phase, and that the INACTIVE (travel-ended)
// branch never clobbers a phase another engine action already armed.
// Live repro being locked: accepting a travel COMBAT event with
// enforcement.autoEncounters on writes phase `encounter` (autoEncounterService),
// then the battle-map spawn remounts HexMap, whose useTravelToolSync fires
// cancelTravel() → INACTIVE — which must NOT regress the phase to
// 'exploration' while monsters sit on the initiative tracker.
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

// Runtime store mock (same shape as the sibling file): getRuntimeValue is the
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
// sessionService so the phase-ownership gate is exercised end-to-end.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { calculatePath } = await import('../../services/campaign/travelService.js');

const CN = 'test-campaign';

// Arm the phase the way the live lane leaves it: the sessionState runtime key
// (read by readSessionPhase via the mocked store reader).
const phaseIs = (phase) => {
  getRuntimeValue.mockImplementation((who, key) =>
    who === 'campaign' && key === 'sessionState' && phase ? { phase } : null
  );
};

const phaseWrites = () =>
  setRuntimeValue.mock.calls.filter(([who, key]) => who === 'campaign' && key === 'sessionState');

describe('useTravelManagement — session-phase ownership (bug-autoencounter-travel-phase-clobber)', () => {
  const baseArgs = {
    hexCols: 10,
    hexRows: 10,
    terrain: { '1,0': 'plains', '2,0': 'plains' },
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
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
  });

  it('INACTIVE never clobbers an `encounter` phase — cancelTravel keeps the tracker-owned phase and writes no audit', async () => {
    // Mid-route planning, auto-encounter already armed `encounter` (live
    // repro order: Accept → auto phase write → tool-sync cancelTravel).
    phaseIs('encounter');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });

    // async act flushes the setSessionPhase microtasks so the zero-write
    // assertion measures the settled state, not just the synchronous half.
    await act(async () => { result.current.cancelTravel(); });

    // Travel mode itself still goes inactive (that is the tool-sync contract)…
    expect(result.current.travelMode).toBe('inactive');
    // …but the phase is untouched: ZERO sessionState writes, ZERO session_phase
    // audit. (Pre-fix this wrote {phase:'exploration', changedBy:'travel
    // management'} over the auto-encounter's 'encounter'.)
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('arrival (advanceOneHex INACTIVE branch) likewise leaves an `encounter` phase alone', async () => {
    calculatePath.mockReturnValue([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    phaseIs('encounter');
    const { result } = renderHook(() => useTravelManagement({
      ...baseArgs,
      initialTravelState: { travelMode: 'traveling' },
    }));
    act(() => { result.current.setDestinationAndPath({ q: 1, r: 0 }); });

    let res;
    await act(async () => { res = result.current.advanceOneHex(); });

    expect(res.arrived).toBe(true);
    expect(result.current.travelMode).toBe('inactive');
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('travel owns the phase ⇒ travel ended restores exploration exactly once (sibling leg stays wired)', async () => {
    phaseIs('travel');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.cancelTravel(); });

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

  it('phase unset/exploration ⇒ INACTIVE writes nothing (no-op leg byte-quiet)', async () => {
    phaseIs('exploration');
    const { result } = renderHook(() => useTravelManagement(baseArgs));
    act(() => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    setRuntimeValue.mockClear();
    addEntry.mockClear();

    await act(async () => { result.current.cancelTravel(); });

    expect(result.current.travelMode).toBe('inactive');
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('planning/paused transitions still never move the phase', async () => {
    phaseIs('exploration');
    const { result } = renderHook(() => useTravelManagement(baseArgs));

    await act(async () => { result.current.startPlanning(); });
    expect(result.current.travelMode).toBe('planning');
    expect(phaseWrites()).toHaveLength(0);

    await act(async () => { result.current.setDestinationAndPath({ q: 2, r: 0 }); });
    expect(phaseWrites()).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
