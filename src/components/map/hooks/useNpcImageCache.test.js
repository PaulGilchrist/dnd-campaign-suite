import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useNpcImageCache from './useNpcImageCache.js';

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
  getMonsterImageUrl: vi.fn(),
}));

import { getMonsterImageUrl } from '../../../services/npcs/monsterUtils.js';

describe('useNpcImageCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getHook = (placedItems) => {
    const { result } = renderHook(() => useNpcImageCache(placedItems));
    return result;
  };

  it('should return empty npcImages initially', () => {
    const result = getHook([]);
    expect(result.current.npcImages).toEqual({});
  });

  it('should return npcImages and setNpcImages', () => {
    const result = getHook([]);
    expect(result.current.npcImages).toBeDefined();
    expect(typeof result.current.setNpcImages).toBe('function');
  });

  it('should filter only npc type items', async () => {
    const placedItems = [
      { type: 'npc', name: 'Goblin' },
      { type: 'token', name: 'Other' },
      { type: 'npc', name: 'Orc' },
    ];
    getMonsterImageUrl.mockResolvedValue('https://example.com/goblin.jpg');

    getHook(placedItems);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
    expect(getMonsterImageUrl).toHaveBeenCalledWith('Goblin');
    expect(getMonsterImageUrl).toHaveBeenCalledWith('Orc');
  });

  it('should resolve URLs and update npcImages', async () => {
    const placedItems = [
      { type: 'npc', name: 'Goblin' },
    ];
    getMonsterImageUrl.mockResolvedValue('https://example.com/goblin.jpg');

    getHook(placedItems);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getMonsterImageUrl).toHaveBeenCalledTimes(1);
    expect(getMonsterImageUrl).toHaveBeenCalledWith('Goblin');
  });

  it('should build npcImages map from resolved URLs', async () => {
    const placedItems = [
      { type: 'npc', name: 'Goblin' },
      { type: 'npc', name: 'Orc' },
    ];
    getMonsterImageUrl
      .mockResolvedValueOnce('https://example.com/goblin.jpg')
      .mockResolvedValueOnce('https://example.com/orc.jpg');

    const result = getHook(placedItems);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.npcImages).toEqual({
      Goblin: 'https://example.com/goblin.jpg',
      Orc: 'https://example.com/orc.jpg',
    });
  });

  it('should handle duplicate NPC names by overwriting', async () => {
    const placedItems = [
      { type: 'npc', name: 'Goblin' },
      { type: 'npc', name: 'Goblin' },
    ];
    getMonsterImageUrl
      .mockResolvedValueOnce('https://example.com/goblin1.jpg')
      .mockResolvedValueOnce('https://example.com/goblin2.jpg');

    const result = getHook(placedItems);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.npcImages).toEqual({
      Goblin: 'https://example.com/goblin2.jpg',
    });
  });

  it('should return null URL for unknown monsters', async () => {
    const placedItems = [
      { type: 'npc', name: 'UnknownMonster' },
    ];
    getMonsterImageUrl.mockResolvedValue(null);

    const result = getHook(placedItems);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.npcImages).toEqual({
      UnknownMonster: null,
    });
  });

  it('should not call getMonsterImageUrl when placedItems is empty', () => {
    getHook([]);
    expect(getMonsterImageUrl).not.toHaveBeenCalled();
  });

  it('should not call getMonsterImageUrl when no npc type items exist', () => {
    const placedItems = [
      { type: 'token', name: 'Token1' },
      { type: 'wall', name: 'Wall1' },
    ];
    getHook(placedItems);
    expect(getMonsterImageUrl).not.toHaveBeenCalled();
  });

  it('should update when placedItems changes', async () => {
    const placedItems1 = [{ type: 'npc', name: 'Goblin' }];
    getMonsterImageUrl.mockResolvedValue('https://example.com/goblin.jpg');

    const { rerender } = renderHook(
      ({ items }) => useNpcImageCache(items),
      { initialProps: { items: placedItems1 } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({ items: placedItems1 });

    expect(getMonsterImageUrl).toHaveBeenCalledTimes(1);
    expect(getMonsterImageUrl).toHaveBeenCalledWith('Goblin');
  });

  it('should call getMonsterImageUrl again with new items on rerender', async () => {
    const placedItems1 = [{ type: 'npc', name: 'Goblin' }];
    const placedItems2 = [{ type: 'npc', name: 'Orc' }];
    getMonsterImageUrl
      .mockResolvedValueOnce('https://example.com/goblin.jpg')
      .mockResolvedValueOnce('https://example.com/orc.jpg');

    const { rerender } = renderHook(({ items }) => useNpcImageCache(items), {
      initialProps: { items: placedItems1 },
    });

    await act(async () => {
      await Promise.resolve();
    });

    rerender({ items: placedItems2 });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
    expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Orc');
  });

  it('should allow setNpcImages to override the cache', () => {
    const result = getHook([]);
    expect(result.current.npcImages).toEqual({});

    act(() => {
      result.current.setNpcImages({ Goblin: 'https://example.com/custom.jpg' });
    });

    expect(result.current.npcImages).toEqual({
      Goblin: 'https://example.com/custom.jpg',
    });
  });

  it('should handle setNpcImages with empty object', () => {
    const result = getHook([]);

    act(() => {
      result.current.setNpcImages({});
    });

    expect(result.current.npcImages).toEqual({});
  });
});
