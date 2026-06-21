/* @improved-by-ai */
import { act, renderHook } from '@testing-library/react';
import useNPCsManagement from './useNPCsManagement.js';

const mockLoadNPCs = vi.fn();
const mockSaveNPCs = vi.fn();
const mockSaveNPC = vi.fn();
const mockDeleteNPC = vi.fn();

vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: (...args) => mockLoadNPCs(...args),
  saveNPCs: (...args) => mockSaveNPCs(...args),
  saveNPC: (...args) => mockSaveNPC(...args),
  deleteNPC: (...args) => mockDeleteNPC(...args),
}));



describe('useNPCsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Image constructor to avoid real network requests for imagePath preloading.
    // We stub globally here because setup.js afterEach calls vi.restoreAllMocks.
    globalThis.Image = class Image {
      onload = null;
      onerror = null;
      _src = '';
      get src() { return this._src; }
      set src(val) {
        this._src = val;
        // Use setTimeout so onload is already assigned by the caller
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    };
  });

  afterEach(() => {
    // Clean up the Image mock to avoid leaking to other test suites
    delete globalThis.Image;
  });

  describe('initial state', () => {
    it('sets npcs to empty array and loading to false', () => {
      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      expect(result.current.npcs).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('returns no-op loadNPCsList when campaignName is empty', () => {
      const { result } = renderHook(() => useNPCsManagement(''));

      expect(result.current.npcs).toEqual([]);
    });
  });

  describe('loadNPCsList', () => {
    it('loads and sets npcs from service', async () => {
      const npcsData = [
        { name: 'Elminster', role: 'Wizard' },
        { name: 'Drizzt', role: 'Ranger' },
      ];
      mockLoadNPCs.mockResolvedValue({ npcs: npcsData });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(mockLoadNPCs).toHaveBeenCalledWith('test-campaign');
      expect(result.current.npcs).toEqual(npcsData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useNPCsManagement(''));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(mockLoadNPCs).not.toHaveBeenCalled();
      expect(result.current.npcs).toEqual([]);
    });

    it('defaults to empty array when response has no npcs field', async () => {
      mockLoadNPCs.mockResolvedValue({});

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(result.current.npcs).toEqual([]);
    });

    it('defaults to empty array when npcs field is null', async () => {
      mockLoadNPCs.mockResolvedValue({ npcs: null });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(result.current.npcs).toEqual([]);
    });

    it('preserves empty state on failure', async () => {
      mockLoadNPCs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(result.current.npcs).toEqual([]);
    });

    it('preserves previous npcs on failure', async () => {
      const existingNPCs = [{ name: 'Existing NPC' }];
      mockLoadNPCs
        .mockResolvedValueOnce({ npcs: existingNPCs })
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });
      expect(result.current.npcs).toEqual(existingNPCs);

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(result.current.npcs).toEqual(existingNPCs);
    });
  });

  describe('saveNPCsList', () => {
    it('saves npcs and reloads the list', async () => {
      const npcsToSave = [{ name: 'Elminster', role: 'Wizard' }];
      mockSaveNPCs.mockResolvedValue({ success: true });
      mockLoadNPCs.mockResolvedValue({ npcs: npcsToSave });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNPCsList(npcsToSave);
      });

      expect(mockSaveNPCs).toHaveBeenCalledWith('test-campaign', npcsToSave);
      expect(mockLoadNPCs).toHaveBeenCalled();
      expect(result.current.npcs).toEqual(npcsToSave);
    });

    it('rethrows save error', async () => {
      mockSaveNPCs.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNPCsList([{ name: 'Elminster' }]);
        })
      ).rejects.toThrow('Save failed');
    });

    it('does not reload when save fails', async () => {
      const existingNPCs = [{ name: 'Existing' }];

      // First load seeds the state
      mockLoadNPCs.mockResolvedValueOnce({ npcs: existingNPCs });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });
      expect(result.current.npcs).toEqual(existingNPCs);

      // Now make save fail; the rethrow should prevent the reload
      mockSaveNPCs.mockRejectedValueOnce(new Error('Save failed'));

      await expect(
        act(async () => {
          await result.current.saveNPCsList([{ name: 'New' }]);
        })
      ).rejects.toThrow();

      // State should remain unchanged — save failed so loadNPCsList was never called
      expect(result.current.npcs).toEqual(existingNPCs);
      expect(mockLoadNPCs).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteNPCAction', () => {
    it('deletes an NPC and reloads the list', async () => {
      mockDeleteNPC.mockResolvedValue({ success: true });
      mockLoadNPCs.mockResolvedValue({ npcs: [] });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteNPCAction('Elminster');
      });

      expect(mockDeleteNPC).toHaveBeenCalledWith('test-campaign', 'Elminster');
      expect(mockLoadNPCs).toHaveBeenCalled();
      expect(result.current.npcs).toEqual([]);
    });

    it('rethrows delete error', async () => {
      mockDeleteNPC.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteNPCAction('Elminster');
        })
      ).rejects.toThrow('Delete failed');
    });

    it('does not reload when delete fails', async () => {
      const existingNPCs = [{ name: 'Stays' }];

      // First load seeds the state
      mockLoadNPCs.mockResolvedValueOnce({ npcs: existingNPCs });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });
      expect(result.current.npcs).toEqual(existingNPCs);

      // Now make delete fail; the rethrow should prevent the reload
      mockDeleteNPC.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        act(async () => {
          await result.current.deleteNPCAction('Stays');
        })
      ).rejects.toThrow();

      // State should remain unchanged
      expect(result.current.npcs).toEqual(existingNPCs);
      expect(mockLoadNPCs).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveNPCAction', () => {
    it('appends a new NPC when not in existing list', async () => {
      mockSaveNPC.mockResolvedValue({ npc: { name: 'New NPC', role: 'Wizard' } });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      const saved = await act(async () => {
        return result.current.saveNPCAction({ name: 'New NPC', role: 'Wizard' });
      });

      expect(mockSaveNPC).toHaveBeenCalledWith(
        'test-campaign',
        { name: 'New NPC', role: 'Wizard' },
        undefined
      );
      expect(result.current.npcs).toEqual([{ name: 'New NPC', role: 'Wizard' }]);
      expect(saved).toEqual({ npc: { name: 'New NPC', role: 'Wizard' } });
    });

    it('updates an existing NPC by oldName when name changes', async () => {
      const existingNPCs = [{ name: 'Old Name', role: 'Wizard' }];
      mockLoadNPCs.mockResolvedValue({ npcs: existingNPCs });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      mockSaveNPC.mockResolvedValue({ npc: { name: 'New Name', role: 'Wizard' } });

      await act(async () => {
        await result.current.saveNPCAction(
          { name: 'New Name', role: 'Wizard' },
          'Old Name'
        );
      });

      expect(mockSaveNPC).toHaveBeenCalledWith(
        'test-campaign',
        { name: 'New Name', role: 'Wizard' },
        'Old Name'
      );
      expect(result.current.npcs).toEqual([{ name: 'New Name', role: 'Wizard' }]);
    });

    it('updates an existing NPC in-place when name does not change', async () => {
      const existingNPCs = [{ name: 'Elminster', role: 'Wizard' }];
      mockLoadNPCs.mockResolvedValue({ npcs: existingNPCs });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      mockSaveNPC.mockResolvedValue({ npc: { name: 'Elminster', role: 'Archwizard' } });

      await act(async () => {
        await result.current.saveNPCAction({ name: 'Elminster', role: 'Archwizard' });
      });

      expect(result.current.npcs).toEqual([{ name: 'Elminster', role: 'Archwizard' }]);
    });

    it('returns the save result', async () => {
      const saveResult = { npc: { name: 'Baela' }, message: 'Updated' };
      mockSaveNPC.mockResolvedValue(saveResult);

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      const returned = await act(async () => {
        return result.current.saveNPCAction({ name: 'Baela' });
      });

      expect(returned).toBe(saveResult);
    });

    it('rethrows save error', async () => {
      mockSaveNPC.mockRejectedValue(new Error('Save NPC failed'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNPCAction({ name: 'Elminster' });
        })
      ).rejects.toThrow('Save NPC failed');
    });

    it('does not update state when save result has no npc field', async () => {
      mockSaveNPC.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNPCAction({ name: 'Elminster' });
      });

      expect(result.current.npcs).toEqual([]);
    });

    it('does not update state when save result is null', async () => {
      mockSaveNPC.mockResolvedValue(null);

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNPCAction({ name: 'Elminster' });
      });

      expect(result.current.npcs).toEqual([]);
    });

    it('passes imagePath through when present in result', async () => {
      mockSaveNPC.mockResolvedValue({
        npc: { name: 'Elminster', imagePath: '/images/elminster.png' },
      });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNPCAction({ name: 'Elminster' });
      });

      expect(result.current.npcs).toEqual([
        { name: 'Elminster', imagePath: '/images/elminster.png' },
      ]);
    });

    it('passes empty string oldName to service when provided', async () => {
      mockSaveNPC.mockResolvedValue({ npc: { name: 'Grom' } });

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNPCAction({ name: 'Grom' }, '');
      });

      expect(mockSaveNPC).toHaveBeenCalledWith(
        'test-campaign',
        { name: 'Grom' },
        ''
      );
      expect(result.current.npcs).toEqual([{ name: 'Grom' }]);
    });
  });
});
