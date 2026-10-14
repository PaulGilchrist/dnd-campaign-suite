import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useNpcImageCache from './useNpcImageCache.js';

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
  getMonsterImageUrl: vi.fn(),
}));

import { getMonsterImageUrl } from '../../../services/npcs/monsterUtils.js';

describe('useNpcImageCache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const getHook = (placedItems, campaignName) => {
    const { result } = renderHook(
      ({ items, campaignName }) => useNpcImageCache(items, campaignName),
      { initialProps: { items: placedItems, campaignName } },
    );
    return result;
  };

  describe('filtering and fetching', () => {
    it('should only fetch URLs for npc type items', async () => {
      const placedItems = [
        { type: 'npc', name: 'Goblin' },
        { type: 'token', name: 'Other' },
        { type: 'npc', name: 'Orc' },
      ];
      getMonsterImageUrl.mockResolvedValue('https://example.com/goblin.jpg');

      getHook(placedItems);

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
      });

      expect(getMonsterImageUrl).toHaveBeenNthCalledWith(1, 'Goblin', null, undefined);
      expect(getMonsterImageUrl).toHaveBeenNthCalledWith(2, 'Orc', null, undefined);
    });

    it('should make no calls when placedItems is empty', () => {
      getHook([]);

      expect(getMonsterImageUrl).not.toHaveBeenCalled();
    });

    it('should store null for npc items without a name property', async () => {
      const placedItems = [
        { type: 'npc' },
        { type: 'npc', name: 'Goblin' },
      ];
      getMonsterImageUrl
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('https://example.com/goblin.jpg');

      const result = getHook(placedItems);

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
        expect(result.current.npcImages).toEqual({
          [undefined]: null,
          Goblin: 'https://example.com/goblin.jpg',
        });
      });
    });
  });

  describe('url resolution', () => {
    it('should build npcImages map from resolved URLs', async () => {
      const placedItems = [
        { type: 'npc', name: 'Goblin' },
        { type: 'npc', name: 'Orc' },
      ];
      getMonsterImageUrl
        .mockResolvedValueOnce('https://example.com/goblin.jpg')
        .mockResolvedValueOnce('https://example.com/orc.jpg');

      const result = getHook(placedItems);

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
        expect(result.current.npcImages).toEqual({
          Goblin: 'https://example.com/goblin.jpg',
          Orc: 'https://example.com/orc.jpg',
        });
      });
    });

    it('should handle duplicate NPC names by keeping the last resolved URL', async () => {
      const placedItems = [
        { type: 'npc', name: 'Goblin' },
        { type: 'npc', name: 'Goblin' },
      ];
      getMonsterImageUrl
        .mockResolvedValueOnce('https://example.com/goblin1.jpg')
        .mockResolvedValueOnce('https://example.com/goblin2.jpg');

      const result = getHook(placedItems);

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
        expect(result.current.npcImages).toEqual({
          Goblin: 'https://example.com/goblin2.jpg',
        });
      });
    });

    it('should store null for unknown monsters', async () => {
      const placedItems = [{ type: 'npc', name: 'UnknownMonster' }];
      getMonsterImageUrl.mockResolvedValue(null);

      const result = getHook(placedItems);

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(1);
        expect(result.current.npcImages).toEqual({
          UnknownMonster: null,
        });
      });
    });
  });

  describe('reactivity', () => {
    it('should re-fetch only new npc items when placedItems changes', async () => {
      const placedItems1 = [{ type: 'npc', name: 'Goblin' }];
      const placedItems2 = [{ type: 'npc', name: 'Orc' }];
      getMonsterImageUrl
        .mockResolvedValueOnce('https://example.com/goblin.jpg')
        .mockResolvedValueOnce('https://example.com/orc.jpg');

      const { rerender } = renderHook(
        ({ items }) => useNpcImageCache(items, undefined),
        { initialProps: { items: placedItems1 } },
      );

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(1);
      });

      rerender({ items: placedItems2 });

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
      });

      expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Orc', null, undefined);
    });

    it('should re-fetch with the new campaignName when it changes', async () => {
      const placedItems = [{ type: 'npc', name: 'Goblin' }];
      getMonsterImageUrl.mockResolvedValue('https://example.com/goblin.jpg');

      const { rerender } = renderHook(
        ({ items, campName }) => useNpcImageCache(items, campName),
        { initialProps: { items: placedItems, campName: 'campaign-a' } },
      );

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(1);
      });

      expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Goblin', null, 'campaign-a');

      rerender({ items: placedItems, campName: 'campaign-b' });

      await waitFor(() => {
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
      });

      expect(getMonsterImageUrl).toHaveBeenLastCalledWith('Goblin', null, 'campaign-b');
    });
  });

  describe('setNpcImages overrides', () => {
    it('should allow setNpcImages to override the cache', () => {
      const { result } = renderHook(() => useNpcImageCache([], undefined));

      expect(result.current.npcImages).toEqual({});

      act(() => {
        result.current.setNpcImages({ Goblin: 'https://example.com/custom.jpg' });
      });

      expect(result.current.npcImages).toEqual({
        Goblin: 'https://example.com/custom.jpg',
      });
    });
  });
});
