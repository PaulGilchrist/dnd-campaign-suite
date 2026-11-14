// @maintained-by-ai
// Regression pins for bug-stale-level-down-pool-overshoot: a persisted bucket
// can outlive a shrink of its level-derived max (DM edits a character's level
// down, class resync). The stored-bucket read branch must clamp
// min(stored, maxGetter()) so no badge renders an inverted fraction (95/65)
// and no spend lane bills past the class-derived capacity. Non-numeric and
// HP-family consumers ride their stored value untouched.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  getRuntimeValue,
  setRuntimeValue,
  addStorageChangeListener,
  hasRuntimeValue,
} from './useRuntimeState.js';
import useTrackedResource from './useTrackedResource.js';

vi.mock('./useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn().mockImplementation(() => () => {}),
  hasRuntimeValue: vi.fn(),
}));

describe('useTrackedResource — stored value clamps to derived max', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clamps a stored pool above the level-derived max (95 stored, L13 max 65 → 65)', () => {
    // The exact bug rig: L20 pool seeded at 100, PATCHed to 95, level then
    // dropped to 13 (derived max 5 × 13 = 65). Badge/modal must read 65.
    getRuntimeValue.mockReturnValue(95);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({
        storageKey: 'layOnHandsPool',
        playerName: 'ElderPaladin',
        maxGetter: () => 65,
        deps: 'dep1',
      })
    );

    expect(result.current.current).toBe(65);
    expect(result.current.max).toBe(65);
  });

  it('re-clamps on the storage-change re-read while the level stays lowered', async () => {
    // Live adoption face: an SSE echo of the overshooting bucket re-resolves
    // through the same clamp (the modal dwells and must not adopt 95).
    getRuntimeValue.mockReturnValue(95);
    hasRuntimeValue.mockReturnValue(true);

    let reRead;
    addStorageChangeListener.mockImplementation((name, handler) => {
      reRead = handler;
      return () => {};
    });

    const { result } = renderHook(() =>
      useTrackedResource({
        storageKey: 'layOnHandsPool',
        playerName: 'ElderPaladin',
        maxGetter: () => 65,
        deps: 'dep1',
      })
    );
    expect(result.current.current).toBe(65);

    setRuntimeValue.mockResolvedValue(undefined);
    await act(async () => {
      reRead();
    });
    expect(result.current.current).toBe(65);
  });

  it('leaves a stored value at or below max untouched (normal pool spend unaffected)', () => {
    getRuntimeValue.mockReturnValue(78);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({ storageKey: 'layOnHandsPool', playerName: 'ElderPaladin', maxGetter: () => 100, deps: 'dep1' })
    );

    expect(result.current.current).toBe(78);
  });

  it('does not raise values below max: 0 and negative stored values pass through verbatim', () => {
    getRuntimeValue.mockReturnValue(0);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({ storageKey: 'kiPoints', playerName: 'Monk', maxGetter: () => 10, deps: 'dep1' })
    );
    expect(result.current.current).toBe(0);
  });

  it('leaves non-numeric stored values (boolean latches) unclamped', () => {
    // CharSummary.jsx 'hasInspiration' lane: maxGetter is () => false, so a
    // Math.min recipe would silently poison the boolean into 0.
    getRuntimeValue.mockReturnValue(true);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({ storageKey: 'hasInspiration', playerName: 'Bard', maxGetter: () => false, deps: 'dep1' })
    );

    expect(result.current.current).toBe(true);
  });

  it('exempts the HP family (currentHitPoints) — HP clamp is a separate ruling', () => {
    // The 224/147 level-down side face rides CharHitPoints/store-direct reads
    // with temp-HP semantics; the hook must not start rewriting HP truth.
    getRuntimeValue.mockReturnValue(224);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({ storageKey: 'currentHitPoints', playerName: 'ElderPaladin', maxGetter: () => 147, deps: 'dep1' })
    );

    expect(result.current.current).toBe(224);
  });

  it('leaves a numeric stored value untouched when maxGetter yields no finite number', () => {
    getRuntimeValue.mockReturnValue(95);
    hasRuntimeValue.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTrackedResource({ storageKey: 'mysticArcanumLevel6', playerName: 'Warlock', maxGetter: () => undefined, deps: 'dep1' })
    );

    expect(result.current.current).toBe(95);
  });
});
