// @maintained-by-ai
/**
 * useMapHistory.test.js — history-source pin (backlog 2026-11-11 JV):
 * the stack stays a ref (synchronous push/pop, navigation semantics of the
 * old mapHistoryRef), while `top` — the toolbars' dynamic "Back to <map>"
 * label mirror — re-renders reactively at every mutation and reverts to
 * null (⇒ byte-identical "Back to maps") when the stack drains or clears.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMapHistory from './useMapHistory.js';

describe('useMapHistory (dynamic Back-label mirror)', () => {
  it('starts unarmed with a null top', () => {
    const { result } = renderHook(() => useMapHistory());
    expect(result.current.top).toBeNull();
    expect(result.current.armed()).toBe(false);
  });

  it('push arms the stack and mirrors the new top reactively', () => {
    const { result } = renderHook(() => useMapHistory());
    const entry = { mapName: 'dungeon-1', mapDisplayName: 'Dungeon 1' };
    act(() => result.current.push(entry));
    expect(result.current.armed()).toBe(true);
    expect(result.current.top).toBe(entry);
  });

  it('top tracks every push/pop and reverts to null after the final pop — no remount', () => {
    const { result } = renderHook(() => useMapHistory());
    const outer = { mapName: 'outer' };
    const inner = { mapName: 'inner-cave' };
    act(() => {
      result.current.push(outer);
      result.current.push(inner);
    });
    expect(result.current.top).toBe(inner);

    // Pop is synchronous and returns the popped entry (press semantics unchanged)
    let popped;
    act(() => { popped = result.current.pop(); });
    expect(popped).toBe(inner);
    expect(result.current.top).toBe(outer);

    act(() => { popped = result.current.pop(); });
    expect(popped).toBe(outer);
    // Stack drained: mirror reverts without a remount...
    expect(result.current.top).toBeNull();
    expect(result.current.armed()).toBe(false);
    // ...and an empty-stack pop stays honest (undefined, still unarmed).
    act(() => { popped = result.current.pop(); });
    expect(popped).toBeUndefined();
    expect(result.current.top).toBeNull();
  });

  it('clear empties the stack and drops the mirror to null', () => {
    const { result } = renderHook(() => useMapHistory());
    act(() => {
      result.current.push({ mapName: 'a' });
      result.current.push({ mapName: 'b' });
    });
    act(() => result.current.clear());
    expect(result.current.top).toBeNull();
    expect(result.current.armed()).toBe(false);
  });
});
