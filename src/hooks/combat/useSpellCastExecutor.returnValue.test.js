// @maintained-by-ai: 2026-10-14
// Return-value contract + cachedPosRef identity/lifecycle seam for the executor hook.
// The castAction clearing matrix (success / reject / falsy non-promise) is owned by
// useSpellCastExecutor.castAction.test.js; useCallback dep sensitivity lives in
// useSpellCastExecutor.stability.test.js; result routing lives in the automationPopup,
// healResult, modalName and modalRouting siblings. This file only pins what the hook
// RETURNS: { castAction, cachedPosRef } — external-ref adoption, internal fallback,
// stable identity across rerenders, and that the returned ref IS the live ref the
// executor consumes and nulls after a resolved cast.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

describe('useSpellCastExecutor — return value contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { castAction, cachedPosRef }', () => {
    const { result } = renderHook(() => useSpellCastExecutor(makeProps()));

    expect(typeof result.current.castAction).toBe('function');
    expect(result.current.cachedPosRef).toHaveProperty('current');
  });

  it('adopts an external cachedPosRef, or creates an internal ref starting null', () => {
    const externalRef = { current: { attackerPos: { x: 1, y: 2 } } };

    const adopted = renderHook(() =>
      useSpellCastExecutor(makeProps({ cachedPosRef: externalRef }))
    );
    expect(adopted.result.current.cachedPosRef).toBe(externalRef);

    const internal = renderHook(() => useSpellCastExecutor(makeProps()));
    expect(internal.result.current.cachedPosRef).not.toBeNull();
    expect(internal.result.current.cachedPosRef.current).toBeNull();
  });

  it('keeps the same cachedPosRef across rerenders and it is the live ref cleared by castAction', async () => {
    executeSpellCast.mockResolvedValue(undefined);
    const ref = { current: { attackerPos: { x: 1 } } };

    const { result, rerender } = renderHook(
      ({ cachedPosRef }) => useSpellCastExecutor(makeProps({ cachedPosRef })),
      { initialProps: { cachedPosRef: ref } }
    );

    const firstRef = result.current.cachedPosRef;
    rerender({ cachedPosRef: ref });
    expect(result.current.cachedPosRef).toBe(firstRef);

    await act(async () => {
      await result.current.castAction({ name: 'Fireball' }, {});
    });

    // The returned ref is the object the executor consumed — cleared on completion.
    // (Falsy non-promise early-return preserves the ref; see castAction.test.js.)
    expect(result.current.cachedPosRef.current).toBeNull();
  });
});
