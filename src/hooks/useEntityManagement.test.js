// @maintained-by-ai 2026-11-26
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

  describe('public contract', () => {
    it('starts with no items, not loading, and exposes loadItems/saveItems/deleteItem', () => {
      const { result } = render(createHooks());

      expect(Object.keys(result.current)).toEqual([
        'items',
        'loading',
        'loadItems',
        'saveItems',
        'deleteItem',
      ]);
      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      for (const fn of ['loadItems', 'saveItems', 'deleteItem']) {
        expect(typeof result.current[fn]).toBe('function');
      }
    });
  });

  describe('loading on mount', () => {
    it('loads items automatically on mount by default', async () => {
      const hooks = createHooks();
      hooks.load.mockResolvedValue([{ id: 1 }]);

      const { result } = render(hooks, {});
      await flush();

      expect(hooks.load.mock.calls).toEqual([[campaignName]]);
      expect(result.current.items).toEqual([{ id: 1 }]);
    });

    it('does not touch the backend on mount when loadOnMount is false', () => {
      const hooks = createHooks();

      render(hooks, { loadOnMount: false });

      expect(hooks.load).not.toHaveBeenCalled();
    });
  });

  describe('campaign switching', () => {
    it('reloads exactly once per campaign, in order, when the campaign changes', async () => {
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

      expect(hooks.load.mock.calls).toEqual([
        [campaignName],
        ['test-campaign-2'],
      ]);
      expect(result.current.items).toEqual([{ id: 2 }]);
    });
  });

  describe('loadItems', () => {
    // Mount-with-default already proves the array happy path; here only the
    // defensive normalization branches that could leak a non-array into
    // items.
    it.each([
      ['responseKey set but the response key is missing', { responseKey: 'entities' }, {}],
      ['responseKey set but the response key holds a non-array', { responseKey: 'entities' }, { entities: 'not an array' }],
      ['no responseKey and a non-array response', {}, 'not an array'],
    ])(
      'falls back to an empty list when %s',
      async (_label, options, response) => {
        const hooks = createHooks();
        hooks.load.mockResolvedValue(response);

        const { result } = render(hooks, options);
        await act(async () => {
          await result.current.loadItems();
        });

        expect(result.current.items).toEqual([]);
        expect(result.current.loading).toBe(false);
      }
    );

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

    it('keeps previously loaded items and stops loading when the backend rejects', async () => {
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
    });
  });

  describe('saveItems', () => {
    it('saves the payload then reloads strictly afterwards to repopulate from server state', async () => {
      const hooks = createHooks();
      const payload = [{ id: 1, name: 'Draft' }];
      const serverState = [{ id: 1, name: 'Saved' }];
      hooks.save.mockResolvedValue(undefined);
      hooks.load.mockResolvedValue(serverState);

      const { result } = render(hooks);
      await act(async () => {
        await result.current.saveItems(payload);
      });

      expect(hooks.save.mock.calls).toEqual([[campaignName, payload]]);
      expect(hooks.load.mock.calls).toEqual([[campaignName]]);
      // Reload-after-write ordering: the refresh must never precede the save.
      expect(hooks.load.mock.invocationCallOrder[0]).toBeGreaterThan(
        hooks.save.mock.invocationCallOrder[0]
      );
      expect(result.current.items).toEqual(serverState);
    });

    it('rethrows without reloading when the save fails', async () => {
      const hooks = createHooks();
      hooks.save.mockRejectedValue(new Error('Save failed'));

      const { result } = render(hooks);
      await expect(
        act(async () => {
          await result.current.saveItems([{ id: 1 }]);
        })
      ).rejects.toThrow('Save failed');

      expect(hooks.load).not.toHaveBeenCalled();
    });

    it('stays silent on a handled 409 conflict — the service layer owns the single warn (improve 2026-10-27-J)', async () => {
      // The editor banner + "Reload list" affordance own user feedback and
      // the service layer logs the one redacted warn, so the hook must add
      // neither a warn nor a red console ERROR for the conflict case.
      const consoleWarn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const conflictMessage =
        'Faction "Harpers" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
      const hooks = createHooks();
      hooks.save.mockRejectedValue(
        Object.assign(new Error(conflictMessage), { conflict: true })
      );

      const { result } = render(hooks, { responseKey: 'factions' });
      await expect(
        act(async () => {
          await result.current.saveItems([]);
        })
      ).rejects.toThrow(conflictMessage);

      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('deletes by id then reloads strictly afterwards to repopulate from server state', async () => {
      const hooks = createHooks();
      hooks.delete.mockResolvedValue(undefined);
      hooks.load.mockResolvedValue([{ id: 'b' }]);

      const { result } = render(hooks);
      await act(async () => {
        await result.current.deleteItem('a');
      });

      expect(hooks.delete.mock.calls).toEqual([[campaignName, 'a']]);
      expect(hooks.load.mock.calls).toEqual([[campaignName]]);
      // Reload-after-delete ordering: the refresh must never precede the delete.
      expect(hooks.load.mock.invocationCallOrder[0]).toBeGreaterThan(
        hooks.delete.mock.invocationCallOrder[0]
      );
      expect(result.current.items).toEqual([{ id: 'b' }]);
    });

    it('rethrows without reloading when the delete fails', async () => {
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
    // Single census of every console.error template the hook can emit, for
    // both the default ('items'/'item') naming and the responseKey naming.
    // Rethrow/no-reload behavior is asserted per-operation above.
    const messageCases = [
      {
        label: 'loadItems default',
        options: {},
        run: (result) => result.loadItems(),
        expected: 'Failed to load items list:',
      },
      {
        label: 'loadItems with responseKey',
        options: { responseKey: 'entities' },
        run: (result) => result.loadItems(),
        expected: 'Failed to load entities list:',
      },
      {
        label: 'saveItems default',
        options: {},
        run: (result) => result.saveItems([{ id: 1 }]),
        expected: 'Failed to save items:',
      },
      {
        label: 'saveItems with responseKey',
        options: { responseKey: 'entities' },
        run: (result) => result.saveItems([{ id: 1 }]),
        expected: 'Failed to save entities:',
      },
      {
        label: 'deleteItem default (singular "item")',
        options: {},
        run: (result) => result.deleteItem('entity-id-123'),
        expected: 'Failed to delete item:',
      },
      {
        label: 'deleteItem with responseKey',
        options: { responseKey: 'entities' },
        run: (result) => result.deleteItem('entity-id-123'),
        expected: 'Failed to delete entities:',
      },
    ];

    it.each(messageCases)(
      'logs $label',
      async ({ options, run, expected }) => {
        const hooks = createHooks();
        hooks.load.mockRejectedValue(new Error('Network error'));
        hooks.save.mockRejectedValue(new Error('Save failed'));
        hooks.delete.mockRejectedValue(new Error('Delete failed'));

        const { result } = render(hooks, options);
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
