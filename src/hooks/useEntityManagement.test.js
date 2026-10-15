// @maintained-by-ai
// Deterministic hook-contract suite for the generic useEntityManagement hook:
// all load/save/delete dependencies are plain vi.fn() mocks, so there is no
// network, timer, or randomness here. This is the ONLY coverage of the hook
// implementation itself (consumers like Quests/NPCs/Settlements mock it).
// Update only if the hook's public contract changes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityManagement } from './useEntityManagement.js';

describe('useEntityManagement', () => {
  const campaignName = 'test-campaign';

  const createHooks = () => ({
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  });

  // Shorthand render: defaults to manual loading so each test states only
  // the options its behavior actually depends on.
  const render = (
    hooks,
    options = { loadOnMount: false },
    campaign = campaignName
  ) => renderHook(() => useEntityManagement(campaign, hooks, options));

  // Let pending load promises from an effect settle.
  const flush = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with no items, not loading, and exposes the load/save/delete API', () => {
      const { result } = render(createHooks());

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(typeof result.current.loadItems).toBe('function');
      expect(typeof result.current.saveItems).toBe('function');
      expect(typeof result.current.deleteItem).toBe('function');
    });
  });

  describe('loading on mount', () => {
    it('loads items automatically on mount by default', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1 }]);

      const { result } = render(hooks, {});
      await flush();

      expect(hooks.load).toHaveBeenCalledWith(campaignName);
      expect(result.current.items).toEqual([{ id: 1 }]);
    });

    it('does not touch the backend on mount when loadOnMount is false', () => {
      const hooks = createHooks();

      render(hooks, { loadOnMount: false });

      expect(hooks.load).not.toHaveBeenCalled();
    });
  });

  describe('campaign switching', () => {
    it('reloads when the campaign changes', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1 }]);

      const { result, rerender } = renderHook(
        ({ campaign }) => useEntityManagement(campaign, hooks, {}),
        { initialProps: { campaign: campaignName } }
      );
      await flush();
      expect(result.current.items).toEqual([{ id: 1 }]);

      hooks.load.mockResolvedValue([{ id: 2 }]);
      rerender({ campaign: 'test-campaign-2' });
      await flush();

      expect(hooks.load).toHaveBeenLastCalledWith('test-campaign-2');
      expect(result.current.items).toEqual([{ id: 2 }]);
    });
  });

  describe('loadItems', () => {
    it('populates items from an array response', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1, name: 'Entity 1' }]);

      const { result } = render(hooks);
      await act(async () => {
        await result.current.loadItems();
      });

      expect(hooks.load).toHaveBeenCalledWith(campaignName);
      expect(result.current.items).toEqual([{ id: 1, name: 'Entity 1' }]);
    });

    it.each([
      ['the response key is missing', {}],
      ['the response key holds null', { entities: null }],
      ['the response key holds a non-array', { entities: 'not an array' }],
    ])(
      'falls back to an empty list when %s',
      async (_label, response) => {
        const hooks = createHooks();
        hooks.load.mockResolvedValue(response);

        const { result } = render(hooks, { responseKey: 'entities' });
        await act(async () => {
          await result.current.loadItems();
        });

        expect(result.current.items).toEqual([]);
        expect(result.current.loading).toBe(false);
      }
    );

    it('falls back to an empty list when a non-array response has no responseKey', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue('not an array');

      const { result } = render(hooks);
      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([]);
    });

    it('reports loading while a fetch is in flight and clears it afterwards', async () => {
      const hooks = createHooks();
      let resolveLoad;
      hooks.load.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          })
      );

      const { result } = render(hooks);
      let loadPromise;
      await act(async () => {
        loadPromise = result.current.loadItems();
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);

      await act(async () => {
        resolveLoad([{ id: 7 }]);
        await loadPromise;
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual([{ id: 7 }]);
    });

    it('keeps previously loaded items and logs the failure when the backend rejects', async () => {
      const hooks = createHooks();
      hooks.load
        .mockResolvedValueOnce([{ id: 1 }])
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = render(hooks);
      await act(async () => {
        await result.current.loadItems();
      });
      expect(result.current.items).toEqual([{ id: 1 }]);

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([{ id: 1 }]);
      expect(result.current.loading).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load items list:',
        expect.any(Error)
      );
    });
  });

  describe('saveItems', () => {
    it('saves the payload then repopulates items from the server state', async () => {
      const hooks = createHooks();
      const payload = [{ id: 1, name: 'Draft' }];
      const serverState = [{ id: 1, name: 'Saved' }];
      hooks.save.mockResolvedValue(undefined);
      hooks.load.mockResolvedValue(serverState);

      const { result } = render(hooks);
      await act(async () => {
        await result.current.saveItems(payload);
      });

      expect(hooks.save).toHaveBeenCalledWith(campaignName, payload);
      expect(hooks.load).toHaveBeenCalledTimes(1);
      expect(hooks.load).toHaveBeenCalledWith(campaignName);
      expect(result.current.items).toEqual(serverState);
    });

    it('rethrows and logs the failure without reloading when the save fails', async () => {
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      const { result } = render(hooks);
      await expect(
        act(async () => {
          await result.current.saveItems([{ id: 1 }]);
        })
      ).rejects.toThrow('Save failed');

      expect(hooks.load).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to save items:',
        expect.any(Error)
      );
    });
  });

  describe('deleteItem', () => {
    it('deletes by id then repopulates the remaining items from the server state', async () => {
      const hooks = createHooks();
      hooks.delete.mockResolvedValue(undefined);
      hooks.load
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([{ id: 'b' }]);

      const { result } = render(hooks);
      await act(async () => {
        await result.current.loadItems();
      });
      expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }]);

      await act(async () => {
        await result.current.deleteItem('a');
      });

      expect(hooks.delete).toHaveBeenCalledWith(campaignName, 'a');
      expect(hooks.load).toHaveBeenCalledTimes(2);
      expect(result.current.items).toEqual([{ id: 'b' }]);
    });

    it('rethrows and logs the failure without reloading when the delete fails', async () => {
      const hooks = createHooks();
      hooks.delete.mockRejectedValue(new Error('Delete failed'));
      hooks.load.mockResolvedValue([{ id: 'a' }]);

      const { result } = render(hooks);
      await expect(
        act(async () => {
          await result.current.deleteItem('entity-id-123');
        })
      ).rejects.toThrow('Delete failed');

      expect(hooks.load).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to delete item:',
        expect.any(Error)
      );
    });
  });

  describe('without a campaign', () => {
    it.each([
      ['loadItems', (result) => result.loadItems()],
      ['saveItems', (result) => result.saveItems([{ id: 1 }])],
      ['deleteItem', (result) => result.deleteItem('entity-id-123')],
    ])(
      '%s touches no backend endpoint and leaves items empty',
      async (_label, run) => {
        const hooks = createHooks();

        const { result } = render(hooks, { loadOnMount: false }, null);
        await act(async () => {
          await run(result.current);
        });

        expect(hooks.load).not.toHaveBeenCalled();
        expect(hooks.save).not.toHaveBeenCalled();
        expect(hooks.delete).not.toHaveBeenCalled();
        expect(result.current.items).toEqual([]);
      }
    );
  });

  describe('logError: false', () => {
    // The hook's campaign guard is covered above; here every op is wired to
    // reject so each exercises its own silent-failure branch (load swallows,
    // save/delete rethrow without logging).
    it.each([
      ['loadItems', (result) => result.loadItems(), false, undefined],
      ['saveItems', (result) => result.saveItems([{ id: 1 }]), true, 'Save failed'],
      ['deleteItem', (result) => result.deleteItem('entity-id-123'), true, 'Delete failed'],
    ])(
      '%s fails without logging (rethrows: %s)',
      async (_label, run, shouldThrow, message) => {
        const hooks = createHooks();
        hooks.load.mockRejectedValue(new Error('Network error'));
        hooks.save.mockRejectedValue(new Error('Save failed'));
        hooks.delete.mockRejectedValue(new Error('Delete failed'));

        const { result } = render(hooks, { logError: false });
        const attempt = act(async () => {
          await run(result.current);
        });

        if (shouldThrow) {
          // save/delete rethrow the original error to the caller.
          await expect(attempt).rejects.toThrow(message);
        } else {
          // load swallows the rejection.
          await attempt;
        }
        expect(consoleError).not.toHaveBeenCalled();
      }
    );
  });

  describe('error log messages', () => {
    // Each operation names failures differently; responseKey should appear
    // in all of them. Default (responseKey-less) messages and rejection
    // behaviour are asserted per-operation above — here we only check the
    // responseKey naming got logged.
    const messageCases = [
      {
        label: 'loadItems',
        run: (result) => result.loadItems(),
        expected: 'Failed to load entities list:',
      },
      {
        label: 'saveItems',
        run: (result) => result.saveItems([{ id: 1 }]),
        expected: 'Failed to save entities:',
      },
      {
        label: 'deleteItem',
        run: (result) => result.deleteItem('entity-id-123'),
        expected: 'Failed to delete entities:',
      },
    ];

    it.each(messageCases)(
      'names the responseKey when $label fails',
      async ({ run, expected }) => {
        const hooks = createHooks();
        hooks.load.mockRejectedValue(new Error('Network error'));
        hooks.save.mockRejectedValue(new Error('Save failed'));
        hooks.delete.mockRejectedValue(new Error('Delete failed'));

        const { result } = render(hooks, { responseKey: 'entities' });
        await act(async () => {
          await run(result.current).catch(() => {});
        });

        expect(consoleError).toHaveBeenCalledWith(
          expected,
          expect.any(Error)
        );
      }
    );
  });
});
