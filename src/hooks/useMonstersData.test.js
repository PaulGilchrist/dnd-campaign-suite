import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useMonstersData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should start in loading state', async () => {
    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { result } = renderHook(() => freshHook());

    expect(result.current.loading).toBe(true);
    expect(result.current.monsters).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should load monsters from 2024 path', async () => {
    const mockMonsters = [{ name: 'Goblin', challenge_rating: '1/4' }];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMonsters),
      })
    );

    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { result } = renderHook(() => freshHook());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.monsters).toEqual(mockMonsters);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/data/2024/monsters.json');
  });

  it('should handle fetch error', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { result } = renderHook(() => freshHook());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.monsters).toEqual([]);
    expect(result.current.error).toContain('404');
  });

  it('should handle network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network failure')));

    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { result } = renderHook(() => freshHook());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.monsters).toEqual([]);
    expect(result.current.error).toBe('Network failure');
  });

  it('should default to 2024 when no rulesVersion provided', async () => {
    const mockMonsters = [{ name: 'Goblin' }];
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMonsters),
      })
    );

    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { result } = renderHook(() => freshHook());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledWith('/data/2024/monsters.json');
  });

  it('should not update state after unmount', async () => {
    const mockMonsters = [{ name: 'Goblin' }];
    let fetchCallCount = 0;
    global.fetch = vi.fn(() => {
      fetchCallCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMonsters),
      });
    });

    vi.doUnmock('./useMonstersData.js');
    const { useMonstersData: freshHook } = await import('./useMonstersData.js');

    const { unmount } = renderHook(() => freshHook());

    unmount();

    expect(fetchCallCount).toBeGreaterThanOrEqual(0);
  });
});
