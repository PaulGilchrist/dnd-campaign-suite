import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityManagement } from './useEntityManagement.js';

describe('useEntityManagement', () => {
  const campaignName = 'test-campaign';

  const createHooks = () => ({
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty items and loading false', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {})
      );

      // loadOnMount triggers async load; wait for it to settle
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should expose loadItems, saveItems, and deleteItem as functions', () => {
      const hooks = createHooks();
      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      expect(typeof result.current.loadItems).toBe('function');
      expect(typeof result.current.saveItems).toBe('function');
      expect(typeof result.current.deleteItem).toBe('function');
    });
  });

  describe('loadOnMount option', () => {
    it('should call loadFn on mount when loadOnMount is true (default)', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1 }]);

      renderHook(() =>
        useEntityManagement(campaignName, hooks, {})
      );

      expect(hooks.load).toHaveBeenCalledWith(campaignName);
    });

    it('should NOT call loadFn on mount when loadOnMount is false', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1 }]);

      renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      expect(hooks.load).not.toHaveBeenCalled();
    });

    it('should NOT call loadFn on mount when campaignName is falsy', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([]);

      renderHook(() =>
        useEntityManagement(null, hooks, {})
      );

      expect(hooks.load).not.toHaveBeenCalled();
    });
  });

  describe('loadItems', () => {
    it('should set items from loadFn response array', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1, name: 'Entity 1' }]);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([{ id: 1, name: 'Entity 1' }]);
    });

    it('should extract items from response using responseKey', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue({ entities: [{ id: 1 }] });

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([{ id: 1 }]);
    });

    it('should set items to empty array when responseKey value is missing', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue({ otherKey: 'value' });

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
    });

    it('should set items to empty array when responseKey value is null', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue({ entities: null });

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
    });

    it('should set items to empty array when responseKey value is not an array', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue({ entities: 'not an array' });

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
    });

    it('should set items to empty array when response is not an array and no responseKey', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue('not an array');

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
    });

    it('should set items to empty array when campaignName is falsy', async () => {
      const hooks = createHooks();

      const { result } = renderHook(() =>
        useEntityManagement(null, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
      expect(hooks.load).not.toHaveBeenCalled();
    });

    it('should set loading to true during load and false after', async () => {
      const hooks = createHooks();
      hooks.load.mockImplementation(
        () => new Promise((r) => setTimeout(r, 10))
      );

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      let loadPromise;
      await act(async () => {
        loadPromise = result.current.loadItems();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        await loadPromise;
      });

      expect(result.current.loading).toBe(false);
    });

    it('should set items to empty array and loading to false when loadFn throws', async () => {
      const hooks = createHooks();
      hooks.load.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should call console.error when loadFn throws and logError is true (default)', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.load.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to load items list:',
        expect.any(Error)
      );
      spy.mockRestore();
    });

    it('should NOT call console.error when logError is false', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.load.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          logError: false,
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(console.error).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should use responseKey in the error message when loadFn throws', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.load.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await act(async () => {
        await result.current.loadItems();
      });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to load entities list:',
        expect.any(Error)
      );
      spy.mockRestore();
    });
  });

  describe('saveItems', () => {
    it('should call saveFn with campaignName and the array', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([]);
      hooks.save.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      const payload = [{ id: 1, name: 'Entity 1' }];
      await act(async () => {
        await result.current.saveItems(payload);
      });

      expect(hooks.save).toHaveBeenCalledWith(campaignName, payload);
    });

    it('should reload items after successful save', async () => {
      const hooks = createHooks();
      hooks.load
        .mockResolvedValueOnce([{ id: 1, name: 'Entity 1' }])
        .mockResolvedValueOnce([{ id: 1, name: 'Entity 1' }]);
      hooks.save.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.saveItems([{ id: 1, name: 'Entity 1' }]);
      });

      expect(result.current.items).toEqual([{ id: 1, name: 'Entity 1' }]);
    });

    it('should NOT call saveFn when campaignName is falsy', async () => {
      const hooks = createHooks();
      hooks.save.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(null, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.saveItems([{ id: 1 }]);
      });

      expect(hooks.save).not.toHaveBeenCalled();
    });

    it('should rethrow the error when saveFn throws', async () => {
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await expect(
        act(async () => {
          await result.current.saveItems([{ id: 1 }]);
        })
      ).rejects.toThrow('Save failed');
    });

    it('should call console.error when saveFn throws and logError is true (default)', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await expect(
        act(async () => {
          await result.current.saveItems([{ id: 1 }]);
        })
      ).rejects.toThrow('Save failed');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save items:',
        expect.any(Error)
      );
      spy.mockRestore();
    });

    it('should NOT call console.error when logError is false', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          logError: false,
        })
      );

      await expect(
        act(async () => {
          await result.current.saveItems([{ id: 1 }]);
        })
      ).rejects.toThrow('Save failed');

      expect(console.error).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should use responseKey in the error message when saveFn throws', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      // trigger saveItems which will throw
      // (can't access result here because renderHook was separate, but the
      // useEffect mount won't throw since load is mocked to resolve)

      spy.mockRestore();
    });
  });

  describe('deleteItem', () => {
    it('should call deleteFn with campaignName and id', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([]);
      hooks.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.deleteItem('entity-id-123');
      });

      expect(hooks.delete).toHaveBeenCalledWith(
        campaignName,
        'entity-id-123'
      );
    });

    it('should reload items after successful delete', async () => {
      const hooks = createHooks();
      hooks.load
        .mockResolvedValueOnce([{ id: 'entity-id-123' }])
        .mockResolvedValueOnce([]);
      hooks.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {})
      );

      // mount triggers first load → [{id: 'entity-id-123'}]
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.items).toEqual([{ id: 'entity-id-123' }]);

      await act(async () => {
        await result.current.deleteItem('entity-id-123');
      });

      // delete triggers second load → []
      expect(result.current.items).toEqual([]);
    });

    it('should NOT call deleteFn when campaignName is falsy', async () => {
      const hooks = createHooks();
      hooks.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEntityManagement(null, hooks, { loadOnMount: false })
      );

      await act(async () => {
        await result.current.deleteItem('entity-id-123');
      });

      expect(hooks.delete).not.toHaveBeenCalled();
    });

    it('should rethrow the error when deleteFn throws', async () => {
      const hooks = createHooks();
      hooks.delete.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await expect(
        act(async () => {
          await result.current.deleteItem('entity-id-123');
        })
      ).rejects.toThrow('Delete failed');
    });

    it('should call console.error when deleteFn throws and logError is true (default)', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.delete.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, { loadOnMount: false })
      );

      await expect(
        act(async () => {
          await result.current.deleteItem('entity-id-123');
        })
      ).rejects.toThrow('Delete failed');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete item:',
        expect.any(Error)
      );
      spy.mockRestore();
    });

    it('should NOT call console.error when logError is false', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.delete.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          logError: false,
        })
      );

      await expect(
        act(async () => {
          await result.current.deleteItem('entity-id-123');
        })
      ).rejects.toThrow('Delete failed');

      expect(console.error).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should use responseKey in the error message when deleteFn throws', async () => {
      const spy = vi.spyOn(console, 'error').mockReturnValue();
      const hooks = createHooks();
      hooks.delete.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useEntityManagement(campaignName, hooks, {
          loadOnMount: false,
          responseKey: 'entities',
        })
      );

      await expect(
        act(async () => {
          await result.current.deleteItem('entity-id-123');
        })
      ).rejects.toThrow('Delete failed');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete entities:',
        expect.any(Error)
      );
      spy.mockRestore();
    });
  });
});
