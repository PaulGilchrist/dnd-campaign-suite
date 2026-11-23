import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clearRuntimeState, seedTrackedResources, getRuntimeValue } from '../runtime/useRuntimeState.js';
import { useGmCopilot, GM_COPILOT_KEY } from './useGmCopilot.js';

function clearAll() {
  clearRuntimeState('campaign');
}

describe('useGmCopilot', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  it('unsettled tips read false with no stored value', () => {
    const { result } = renderHook(() => useGmCopilot('Test Camp'));
    expect(result.current.isSettled('initiative-flow')).toBe(false);
    expect(result.current.dismissed).toEqual({});
    expect(result.current.seen).toEqual({});
  });

  it('dismiss writes dismissed[tipId] server-first', () => {
    const { result } = renderHook(() => useGmCopilot('Test Camp'));
    act(() => result.current.dismiss('monster-avatars'));
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({
      dismissed: { 'monster-avatars': true },
    });
    expect(result.current.isSettled('monster-avatars')).toBe(true);
  });

  it('markSeen settles alongside existing dismissed entries', () => {
    seedTrackedResources('campaign', {
      [GM_COPILOT_KEY]: { dismissed: { 'map-activate': true } },
    });
    const { result } = renderHook(() => useGmCopilot('Test Camp'));
    act(() => result.current.markSeen('initiative-flow'));
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({
      dismissed: { 'map-activate': true },
      seen: { 'initiative-flow': true },
    });
    expect(result.current.isSettled('map-activate')).toBe(true);
    expect(result.current.isSettled('initiative-flow')).toBe(true);
  });

  it('settled-once: re-settling the same field+tip writes nothing (no second POST)', () => {
    const { result } = renderHook(() => useGmCopilot('Test Camp'));
    act(() => result.current.dismiss('initiative-flow'));
    const postsAfterFirst = global.fetch.mock.calls.length;
    act(() => result.current.dismiss('initiative-flow'));
    expect(global.fetch.mock.calls.length).toBe(postsAfterFirst);
  });

  it('a tip settled via seen reads settled for dismiss too (either lane)', () => {
    seedTrackedResources('campaign', {
      [GM_COPILOT_KEY]: { seen: { 'monster-avatars': true } },
    });
    const { result } = renderHook(() => useGmCopilot('Test Camp'));
    expect(result.current.isSettled('monster-avatars')).toBe(true);
  });
});
