// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { renderHook } from '@testing-library/react';
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

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCallback stability — castAction reference equality', () => {
    it('returns the same castAction reference when props do not change', () => {
      const props = makeProps();
      const extraMeta = {};
      const ref = { current: null };

      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: props, em: extraMeta, r: ref } },
      );

      const firstAction = result.current.castAction;
      rerender({ p: props, em: extraMeta, r: ref });
      expect(result.current.castAction).toBe(firstAction);
    });

    it('returns a new castAction when rollAttack changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), rollAttack: vi.fn() },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when rollDamage changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), rollDamage: vi.fn() },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when playerStats changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), playerStats: makePlayerStats({ name: 'NewCaster' }) },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when campaignName changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), campaignName: 'NewCampaign' },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when mapName changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), mapName: 'NewMap' },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when characters array changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), characters: [{ name: 'NewChar' }] },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when setPopupHtml changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: { ...makeProps(), setPopupHtml: vi.fn() },
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when extraMeta object changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: makeProps(),
        em: { newFlag: true },
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when cachedPosRef changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null } } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: makeProps(),
        em: {},
        r: { current: null },
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });

    it('returns a new castAction when setModalState changes', () => {
      const { result, rerender } = renderHook(
        ({ p, em, r, ms }) =>
          useSpellCastExecutor({ ...p, extraMeta: em, cachedPosRef: r, setModalState: ms }),
        { initialProps: { p: makeProps(), em: {}, r: { current: null }, ms: vi.fn() } },
      );

      const firstAction = result.current.castAction;
      rerender({
        p: makeProps(),
        em: {},
        r: { current: null },
        ms: vi.fn(),
      });
      expect(result.current.castAction).not.toBe(firstAction);
    });
  });
});
