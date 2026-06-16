import { renderHook, act } from '@testing-library/react';
import useNPCsManagement from './useNPCsManagement.js';

const mockLoadNPCs = vi.fn();
const mockSaveNPCs = vi.fn();
const mockDeleteNPC = vi.fn();

vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: (...args) => mockLoadNPCs(...args),
  saveNPCs: (...args) => mockSaveNPCs(...args),
  deleteNPC: (...args) => mockDeleteNPC(...args),
}));

describe('useNPCsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets npcs to empty array and loading to false', () => {
      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      expect(result.current.npcs).toEqual([]);
      expect(result.current.loading).toBe(false);
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

    it('handles error by logging and keeping previous state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadNPCs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNPCsList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load NPCs list:',
        expect.any(Error)
      );
      expect(result.current.npcs).toEqual([]);
      consoleSpy.mockRestore();
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

    it('throws error when save fails', async () => {
      mockSaveNPCs.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNPCsList([{ name: 'Elminster' }]);
        })
      ).rejects.toThrow('Save failed');
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

    it('throws error when delete fails', async () => {
      mockDeleteNPC.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNPCsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteNPCAction('Elminster');
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
