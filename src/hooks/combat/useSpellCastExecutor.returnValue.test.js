// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

function makeSpell(overrides = {}) {
  return { name: 'Fireball', ...overrides };
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

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('return value — behavior', () => {
    it('returns an object with castAction and cachedPosRef', () => {
      const props = makeProps();
      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      expect(result.current).toHaveProperty('castAction');
      expect(result.current).toHaveProperty('cachedPosRef');
      expect(typeof result.current.castAction).toBe('function');
      expect(result.current.cachedPosRef).toHaveProperty('current');
    });

    it('uses the provided cachedPosRef when given', () => {
      const externalRef = { current: { attackerPos: { x: 1, y: 2 } } };
      const props = makeProps();
      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, cachedPosRef: externalRef })
      );

      expect(result.current.cachedPosRef).toBe(externalRef);
    });

    it('creates an internal ref when no cachedPosRef is provided', () => {
      const props = makeProps();
      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      expect(result.current.cachedPosRef).not.toBeNull();
      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('returns the same cachedPosRef object across rerenders when props do not change', () => {
      const props = makeProps();
      const { result, rerender } = renderHook(
        ({ p }) =>
          useSpellCastExecutor(p),
        {
          initialProps: { p: props },
        }
      );

      const firstRef = result.current.cachedPosRef;

      rerender({ p: props });

      expect(result.current.cachedPosRef).toBe(firstRef);
    });

    it('preserves ref.current when executeSpellCast returns a non-promise falsy value (early return)', async () => {
      const props = makeProps();
      executeSpellCast.mockReturnValue(undefined);

      const ref = { current: { attackerPos: { x: 1 } } };

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, cachedPosRef: ref })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(ref.current).toEqual({ attackerPos: { x: 1 } });
    });

    it('clears ref.current after castAction completes even when executeSpellCast resolves undefined', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(undefined);

      const ref = { current: { attackerPos: { x: 1 } } };

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, cachedPosRef: ref })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(ref.current).toBeNull();
    });
  });
});
