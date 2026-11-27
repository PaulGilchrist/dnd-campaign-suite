// @maintained-by-ai 2026-11-26
// Deterministic hook-contract suite: encountersService is fully mocked, so this
// file verifies the hook's state wiring (list/modal/loading state, service
// delegation with call censuses, error propagation) with no network, timers,
// or randomness. Service-level console.error copy is pinned in
// ../../services/encounters/encountersService.test.js; the modal's disabled-row
// rendering is pinned in ../../components/encounter/EncounterModal.loading-gate.test.jsx.
// Update only if the hook's public contract changes.
import { renderHook, act } from '@testing-library/react';
import useEncounterManagement from './useEncounterManagement.js';

const mockLoadEncounters = vi.fn();
const mockSaveEncounter = vi.fn();
const mockLoadEncounter = vi.fn();
const mockUpdateEncounter = vi.fn();
const mockDeleteEncounter = vi.fn();
const mockRenameEncounter = vi.fn();

vi.mock('../../services/encounters/encountersService.js', () => ({
  loadEncounters: (...args) => mockLoadEncounters(...args),
  saveEncounter: (...args) => mockSaveEncounter(...args),
  loadEncounter: (...args) => mockLoadEncounter(...args),
  updateEncounter: (...args) => mockUpdateEncounter(...args),
  deleteEncounter: (...args) => mockDeleteEncounter(...args),
  renameEncounter: (...args) => mockRenameEncounter(...args),
}));

// Mutating operations that follow the same contract: delegate to the service
// with (campaignName, ...args), then reload the encounter list. On failure they
// console.error with their own prefix and re-throw — EXCEPT updateEncounter and
// renameEncounterAction, whose wrappers stay 0-console (c5d784d1f single-layer
// fingerprint, extended to rename by backlog 2026-10-28-U: the service logs
// once, the leaf modal/builder own the user-facing copy).
const mutatingOps = [
  {
    label: 'saveEncounter',
    service: mockSaveEncounter,
    hookFn: 'saveEncounter',
    args: ['goblin-ambush', { monsters: ['goblin'] }],
    logPrefix: 'Failed to save encounter:',
  },
  {
    label: 'updateEncounter',
    service: mockUpdateEncounter,
    hookFn: 'updateEncounter',
    args: ['goblin-ambush', { monsters: ['hobgoblin'], difficulty: 'medium' }],
    reloads: false,
    logs: false,
  },
  {
    label: 'deleteEncounterAction',
    service: mockDeleteEncounter,
    hookFn: 'deleteEncounterAction',
    args: ['goblin-ambush'],
    logPrefix: 'Failed to delete encounter:',
  },
  {
    label: 'renameEncounterAction',
    service: mockRenameEncounter,
    hookFn: 'renameEncounterAction',
    args: ['goblin-ambush', 'goblin-ambush-v2'],
    logs: false,
  },
];

describe('useEncounterManagement', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadEncounters.mockResolvedValue({ encounters: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('defaults to an empty closed surface and does not auto-fetch on mount', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      expect(result.current.encounters).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
      expect(mockLoadEncounters).not.toHaveBeenCalled();
    });
  });

  describe('loadEncounterList', () => {
    it('loads and sets encounters from service', async () => {
      const encountersData = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
        { name: 'Dragon Lair', monsters: ['young-red-dragon'] },
      ];
      mockLoadEncounters.mockResolvedValue({ encounters: encountersData });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(mockLoadEncounters).toHaveBeenCalledTimes(1);
      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
      expect(result.current.encounters).toEqual(encountersData);
    });

    it('does nothing without a campaign: no fetch, no loading window, empty list', async () => {
      const { result } = renderHook(() => useEncounterManagement(''));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(mockLoadEncounters).not.toHaveBeenCalled();
      expect(result.current.encounters).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('defaults to empty array when response has no encounters field', async () => {
      mockLoadEncounters.mockResolvedValue({});

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(result.current.encounters).toEqual([]);
    });

    it('on failure logs once, keeps the previous list, clears loading, and does not re-throw', async () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      // Land a real list first so "keeps previous state" is proven, not vacuous.
      await act(async () => {
        mockLoadEncounters.mockResolvedValue({ encounters: [{ name: 'goblin-ambush' }] });
        await result.current.loadEncounterList();
      });
      expect(result.current.encounters).toEqual([{ name: 'goblin-ambush' }]);

      await act(async () => {
        mockLoadEncounters.mockRejectedValue(new Error('Network error'));
        await expect(result.current.loadEncounterList()).resolves.toBeUndefined();
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load encounter list:',
        expect.any(Error)
      );
      expect(result.current.encounters).toEqual([{ name: 'goblin-ambush' }]);
      // finally-branch gate: no stuck-disabled rows after a failed reload.
      expect(result.current.loading).toBe(false);
    });

    // QA 2026-10-24 backlog: list reloads must expose the `loading` window so
    // EncounterModal can disable stale row actions (silent-close flake gate).
    it('raises loading during the fetch and clears it once the list lands', async () => {
      let resolveList;
      mockLoadEncounters.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          })
      );

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let pending;
      act(() => {
        pending = result.current.loadEncounterList();
      });
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveList({ encounters: [{ name: 'goblin-ambush' }] });
        await pending;
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.encounters).toEqual([{ name: 'goblin-ambush' }]);
    });
  });

  describe('modal state', () => {
    it('openSaveModal opens in save mode and closeModal closes and resets it', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      act(() => {
        result.current.openSaveModal();
      });

      expect(result.current.modalOpen).toBe(true);
      expect(result.current.modalMode).toBe('save');

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
    });

    // QA 2026-10-24 backlog: the load list must fetch INSIDE the open modal
    // (loading=true gates the rows) instead of landing fresh rows straight
    // into an already-clickable surface (silent-close flake).
    it('openLoadModal opens immediately with loading=true, fetches with the campaign, and clears loading when the list lands', async () => {
      let resolveList;
      mockLoadEncounters.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          })
      );

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let pending;
      act(() => {
        pending = result.current.openLoadModal();
      });
      expect(result.current.modalOpen).toBe(true);
      expect(result.current.modalMode).toBe('load');
      expect(result.current.loading).toBe(true);
      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');

      await act(async () => {
        resolveList({ encounters: [{ name: 'goblin-ambush' }] });
        await pending;
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.encounters).toEqual([{ name: 'goblin-ambush' }]);
    });
  });

  describe('loadEncounterData', () => {
    it('loads a single encounter, closes modal, and returns data', async () => {
      const encounterData = { name: 'goblin-ambush', monsters: ['goblin'] };
      mockLoadEncounter.mockResolvedValue(encounterData);

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let data;
      await act(async () => {
        data = await result.current.loadEncounterData('goblin-ambush');
      });

      expect(mockLoadEncounter).toHaveBeenCalledTimes(1);
      expect(mockLoadEncounter).toHaveBeenCalledWith('test-campaign', 'goblin-ambush');
      expect(data).toEqual(encounterData);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
      expect(result.current.loading).toBe(false);
      // Single-encounter reads must not reload the list.
      expect(mockLoadEncounters).not.toHaveBeenCalled();
    });

    it('throws error, logs, and clears loading when load fails', async () => {
      mockLoadEncounter.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.loadEncounterData('test');
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Load failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load encounter:',
        expect.any(Error)
      );
      expect(result.current.loading).toBe(false);
    });
  });

  describe('mutating operations', () => {
    for (const op of mutatingOps) {
      const reloads = op.reloads !== false;
      const logsOnError = op.logs !== false;

      it(`${op.label} calls the service once${reloads ? ' then reloads the list after success' : ' without touching the list or modal state'}`, async () => {
        const updatedEncounters = [{ name: `${op.label}-list` }];
        op.service.mockResolvedValue({ success: true });
        mockLoadEncounters.mockResolvedValue({ encounters: updatedEncounters });

        const { result } = renderHook(() => useEncounterManagement('test-campaign'));

        await act(async () => {
          await result.current[op.hookFn](...op.args);
        });

        expect(op.service).toHaveBeenCalledTimes(1);
        expect(op.service).toHaveBeenCalledWith('test-campaign', ...op.args);
        if (reloads) {
          expect(mockLoadEncounters).toHaveBeenCalledTimes(1);
          expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
          // Ordered census: reload must happen AFTER the write succeeds, never
          // optimistically before it.
          expect(mockLoadEncounters.mock.invocationCallOrder[0]).toBeGreaterThan(
            op.service.mock.invocationCallOrder[0]
          );
          expect(result.current.encounters).toEqual(updatedEncounters);
        } else {
          expect(mockLoadEncounters).not.toHaveBeenCalled();
        }
      });

      it(`${op.label} throws error${logsOnError ? ' and logs' : ' without a wrapper log'} when the service fails`, async () => {
        const failure = new Error(`${op.label} failed`);
        op.service.mockRejectedValue(failure);

        const { result } = renderHook(() => useEncounterManagement('test-campaign'));

        let caughtError;
        await act(async () => {
          try {
            await result.current[op.hookFn](...op.args);
          } catch (err) {
            caughtError = err;
          }
        });

        expect(caughtError).toBe(failure);
        if (logsOnError) {
          expect(consoleSpy).toHaveBeenCalledTimes(1);
          expect(consoleSpy).toHaveBeenCalledWith(op.logPrefix, failure);
        } else {
          // Single-layer logging (c5d784d1f fingerprint): the service owns the
          // one console.error; this wrapper must stay silent.
          expect(consoleSpy).not.toHaveBeenCalled();
        }
        expect(mockLoadEncounters).not.toHaveBeenCalled();
      });
    }
  });
});
