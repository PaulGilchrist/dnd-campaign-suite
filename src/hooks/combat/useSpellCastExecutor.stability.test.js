// @maintained-by-ai: 2026-10-14
// useCallback stability seam for useSpellCastExecutor: castAction must keep a stable
// reference while props are unchanged (consumers re-render-loop guard) and must be
// recreated whenever any runCast/castAction dependency changes.
// Dep array verified against useSpellCastExecutor.js (castAction: playerStats,
// campaignName, setPopupHtml, ref, runCast; runCast: everything else).
// Result routing lives in automationPopup/healResult/modalName/modalRouting siblings;
// the clear matrix in castAction.test.js; return-value contract in returnValue.test.js.
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
    cachedPosRef: { current: null },
    setModalState: vi.fn(),
    ...overrides,
  };
}

// Fresh value per dependency so each rerender changes exactly one dep.
const DEP_CHANGES = [
  ['rollAttack', () => vi.fn()],
  ['rollDamage', () => vi.fn()],
  ['playerStats', () => makePlayerStats({ name: 'NewCaster' })],
  ['getTargetInfo', () => vi.fn()],
  ['campaignName', () => 'NewCampaign'],
  ['mapName', () => 'NewMap'],
  ['characters', () => [{ name: 'NewChar' }]],
  ['setPopupHtml', () => vi.fn()],
  ['extraMeta', () => ({ newFlag: true })],
  ['cachedPosRef', () => ({ current: null })],
  ['setModalState', () => vi.fn()],
];

describe('useSpellCastExecutor — useCallback stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the same castAction reference when props do not change', () => {
    const props = makeProps();
    const { result, rerender } = renderHook(({ p }) => useSpellCastExecutor(p), {
      initialProps: { p: props },
    });

    const firstAction = result.current.castAction;
    rerender({ p: props });
    expect(result.current.castAction).toBe(firstAction);
  });

  it.each(DEP_CHANGES)(
    'returns a new castAction when %s changes',
    (key, makeValue) => {
      const props = makeProps();
      const { result, rerender } = renderHook(({ p }) => useSpellCastExecutor(p), {
        initialProps: { p: props },
      });

      const firstAction = result.current.castAction;
      rerender({ p: makeProps({ ...props, [key]: makeValue() }) });
      expect(result.current.castAction).not.toBe(firstAction);
    },
  );

  it('mounts and unmounts cleanly', () => {
    const { result, unmount } = renderHook(() => useSpellCastExecutor(makeProps()));
    expect(typeof result.current.castAction).toBe('function');
    expect(() => unmount()).not.toThrow();
  });
});
