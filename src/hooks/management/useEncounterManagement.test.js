// @maintained-by-ai
// Deterministic hook-contract suite: encountersService is fully mocked, so this
// file verifies the hook's state wiring (list/modal/loading state, service
// delegation, error propagation) with no network, timers, or randomness.
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
// console.error with their own prefix and re-throw.
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
    logPrefix: 'Failed to update encounter:',
    reloads: false,
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
    logPrefix: 'Failed to rename encounter:',
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
    it('sets initial state correctly', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      expect(result.current.encounters).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
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

      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
      expect(result.current.encounters).toEqual(encountersData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useEncounterManagement(''));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(mockLoadEncounters).not.toHaveBeenCalled();
      expect(result.current.encounters).toEqual([]);
    });

    it('defaults to empty array when response has no encounters field', async () => {
      mockLoadEncounters.mockResolvedValue({});

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(result.current.encounters).toEqual([]);
    });

    it('handles error by logging and keeping previous state (does not re-throw)', async () => {
      mockLoadEncounters.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await expect(result.current.loadEncounterList()).resolves.toBeUndefined();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load encounter list:',
        expect.any(Error)
      );
      expect(result.current.encounters).toEqual([]);
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

    it('clears loading when the list fetch fails (no stuck-disabled rows)', async () => {
      mockLoadEncounters.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(result.current.loading).toBe(false);
    });

    it('does not raise loading when campaignName is empty', async () => {
      const { result } = renderHook(() => useEncounterManagement(''));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(result.current.loading).toBe(false);
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

    it('openLoadModal loads encounters, sets mode to load, and opens modal', async () => {
      const encountersData = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
      ];
      mockLoadEncounters.mockResolvedValue({ encounters: encountersData });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.openLoadModal();
      });

      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
      expect(result.current.encounters).toEqual(encountersData);
      expect(result.current.modalMode).toBe('load');
      expect(result.current.modalOpen).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    // QA 2026-10-24 backlog: the load list must fetch INSIDE the open modal
    // (loading=true gates the rows) instead of landing fresh rows straight
    // into an already-clickable surface (silent-close flake).
    it('openLoadModal opens immediately with loading=true and stays loading until the list lands', async () => {
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

      expect(mockLoadEncounter).toHaveBeenCalledWith('test-campaign', 'goblin-ambush');
      expect(data).toEqual(encounterData);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
      expect(result.current.loading).toBe(false);
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
      it(`${op.label} delegates to the service${op.reloads === false ? ' without reloading the list' : ' and reloads the list'}`, async () => {
        const updatedEncounters = [{ name: `${op.label}-list` }];
        op.service.mockResolvedValue({ success: true });
        mockLoadEncounters.mockResolvedValue({ encounters: updatedEncounters });

        const { result } = renderHook(() => useEncounterManagement('test-campaign'));

        await act(async () => {
          await result.current[op.hookFn](...op.args);
        });

        expect(op.service).toHaveBeenCalledWith('test-campaign', ...op.args);
        if (op.reloads === false) {
          expect(mockLoadEncounters).not.toHaveBeenCalled();
        } else {
          expect(mockLoadEncounters).toHaveBeenCalled();
          expect(result.current.encounters).toEqual(updatedEncounters);
        }
      });

      it(`${op.label} throws error and logs when the service fails`, async () => {
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
        expect(consoleSpy).toHaveBeenCalledWith(op.logPrefix, failure);
        expect(mockLoadEncounters).not.toHaveBeenCalled();
      });
    }
  });
});
