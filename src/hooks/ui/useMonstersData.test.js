// @maintained-by-ai
// Stable contract for the useMonstersData wrapper: { monsters, loading, error }
// shape, /data/monsters.json fetch path, non-ok error message, and module-level
// caching. All consumers (EncounterBuilder, HexMap) mock this hook, so this is
// the only suite covering the real implementation.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

describe('useMonstersData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should initialize with empty monsters, loading true, and error null', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { useMonstersData } = await import('./useMonstersData.js');
    const { result } = renderHook(() => useMonstersData());
    expect(result.current.monsters).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should set monsters and loading false after successful fetch', async () => {
    const mockMonsters = [
      { name: 'Goblin', cr: '1/4' },
      { name: 'Orc', cr: '1/2' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMonsters,
    });

    const { useMonstersData } = await import('./useMonstersData.js');
    const { result } = renderHook(() => useMonstersData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith('/data/monsters.json');
    expect(result.current.monsters).toEqual(mockMonsters);
    expect(result.current.error).toBeNull();
  });

  it('should set error when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { useMonstersData } = await import('./useMonstersData.js');
    const { result } = renderHook(() => useMonstersData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load monsters (404 Not Found)');
    expect(result.current.monsters).toEqual([]);
  });

  it('should cache monsters so a second mount does not re-fetch', async () => {
    const mockMonsters = [{ name: 'Goblin', cr: '1/4' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMonsters,
    });

    const { useMonstersData } = await import('./useMonstersData.js');

    const first = renderHook(() => useMonstersData());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    expect(first.result.current.monsters).toEqual(mockMonsters);

    const second = renderHook(() => useMonstersData());
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(second.result.current.monsters).toEqual(mockMonsters);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
