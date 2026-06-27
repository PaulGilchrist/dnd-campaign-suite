// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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

    expect(result.current.monsters).toEqual(mockMonsters);
    expect(result.current.error).toBeNull();
  });

  it('should set error when fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { useMonstersData } = await import('./useMonstersData.js');
    const { result } = renderHook(() => useMonstersData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.monsters).toEqual([]);
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

    expect(result.current.error).toContain('Failed to load monsters');
    expect(result.current.monsters).toEqual([]);
  });

  it('should handle empty monster list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { useMonstersData } = await import('./useMonstersData.js');
    const { result } = renderHook(() => useMonstersData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.monsters).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch with monsters containing many properties', async () => {
    const mockMonsters = [
      {
        name: 'Tarrasque',
        cr: '30',
        size: 'Colossal',
        type: 'Dragon',
        armorClass: 30,
        hitPoints: 676,
        speed: '40 ft., climb 40 ft., swim 40 ft.',
        strength: 30,
        dexterity: 13,
        constitution: 36,
        intelligence: 3,
        wisdom: 11,
        charisma: 11,
        skills: { perception: 20 },
        damageResistances: 'bludgeoning, piercing, and slashing from nonmagical weapons',
        conditionsImmuned: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
      },
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

    expect(result.current.monsters[0].name).toBe('Tarrasque');
    expect(result.current.monsters[0].cr).toBe('30');
    expect(result.current.monsters[0].armorClass).toBe(30);
  });

  it('should clean up on unmount (cancelled flag prevents state update)', async () => {
    let resolveFetch;
    global.fetch = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));

    const { useMonstersData } = await import('./useMonstersData.js');
    const { result, unmount } = renderHook(() => useMonstersData());

    unmount();

    // Resolve the fetch after unmount - should not update state due to cancelled flag
    resolveFetch({
      ok: true,
      json: async () => [{ name: 'Should Not Appear' }],
    });

    // Give timers a chance to run
    await act(async () => {});

    // loading should still be true because state was never updated
    expect(result.current.loading).toBe(true);
    expect(result.current.monsters).toEqual([]);
  });

  it('should return cached data immediately on second render (cache hit path)', async () => {
    const mockMonsters = [{ name: 'Cached Monster', cr: '1' }];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMonsters,
    });

    const { useMonstersData } = await import('./useMonstersData.js');

    // First render triggers fetch and populates cache
    const { result: firstResult } = renderHook(() => useMonstersData());

    await waitFor(() => {
      expect(firstResult.current.loading).toBe(false);
    });
    expect(firstResult.current.monsters).toEqual(mockMonsters);

    // Spy on fetch before second render
    global.fetch.mockClear();

    // Second render in same module scope should use the in-memory cache
    const { result: secondResult } = renderHook(() => useMonstersData());

    // Cache hit: monsters populated via useAsyncData microtask, no fetch called
    await waitFor(() => {
      expect(secondResult.current.loading).toBe(false);
    });
    expect(secondResult.current.monsters).toEqual(mockMonsters);
    expect(secondResult.current.error).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
