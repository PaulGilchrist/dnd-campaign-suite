// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import useFactionsManagement from './useFactionsManagement.js';

const mockLoadFactions = vi.fn();
const mockSaveFactions = vi.fn();
const mockDeleteFaction = vi.fn();

vi.mock('../../services/campaign/factionsService.js', () => ({
  loadFactions: (...args) => mockLoadFactions(...args),
  saveFactions: (...args) => mockSaveFactions(...args),
  deleteFaction: (...args) => mockDeleteFaction(...args),
}));

describe('useFactionsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets factions to empty array and loading to false', () => {
      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      expect(result.current.factions).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('does not load factions when campaignName is empty', () => {
      const { result } = renderHook(() => useFactionsManagement(''));

      expect(result.current.factions).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(mockLoadFactions).not.toHaveBeenCalled();
    });
  });

  describe('loadFactionsList', () => {
    it('loads and sets factions from service', async () => {
      const factionsData = [
        { id: 'faction-1', name: 'The Fellowship' },
        { id: 'faction-2', name: 'Mordor' },
      ];
      mockLoadFactions.mockResolvedValue({ factions: factionsData });

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(mockLoadFactions).toHaveBeenCalledWith('test-campaign');
      expect(result.current.factions).toEqual(factionsData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useFactionsManagement(''));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(mockLoadFactions).not.toHaveBeenCalled();
      expect(result.current.factions).toEqual([]);
    });

    it('defaults to empty array when response has no factions field', async () => {
      mockLoadFactions.mockResolvedValue({});

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(result.current.factions).toEqual([]);
    });

    it('handles error by logging and keeping previous state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingFactions = [{ id: 'faction-1', name: 'Existing Faction' }];
      mockLoadFactions.mockResolvedValue({ factions: existingFactions });

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      // Load factions first so there is existing state
      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(result.current.factions).toEqual(existingFactions);
      vi.clearAllMocks();
      mockLoadFactions.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      // Factions should remain at the previously loaded value
      expect(result.current.factions).toEqual(existingFactions);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load Factions list:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('handles error when no previous state exists', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadFactions.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(result.current.factions).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load Factions list:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('saveFactionsList', () => {
    it('saves factions and reloads the list', async () => {
      const factionsToSave = [{ id: 'faction-1', name: 'The Fellowship' }];
      mockSaveFactions.mockResolvedValue({ success: true });
      mockLoadFactions.mockResolvedValue({ factions: factionsToSave });

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveFactionsList(factionsToSave);
      });

      expect(mockSaveFactions).toHaveBeenCalledWith('test-campaign', factionsToSave);
      expect(mockLoadFactions).toHaveBeenCalled();
      expect(result.current.factions).toEqual(factionsToSave);
    });

    it('saves factions when campaignName is provided', async () => {
      const factionsToSave = [{ id: 'faction-1', name: 'The Fellowship' }];
      mockSaveFactions.mockResolvedValue({ success: true });
      mockLoadFactions.mockResolvedValue({ factions: factionsToSave });

      const { result } = renderHook(() => useFactionsManagement('my-campaign'));

      await act(async () => {
        await result.current.saveFactionsList(factionsToSave);
      });

      expect(mockSaveFactions).toHaveBeenCalledWith('my-campaign', factionsToSave);
      expect(result.current.factions).toEqual(factionsToSave);
    });

    it('throws error when save fails', async () => {
      mockSaveFactions.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveFactionsList([{ id: 'faction-1' }]);
        })
      ).rejects.toThrow('Save failed');
    });

    it('does not reload when save fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingFactions = [{ id: 'faction-1', name: 'Existing Faction' }];
      mockLoadFactions.mockResolvedValue({ factions: existingFactions });
      mockSaveFactions.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      // Load factions first so there is existing state
      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(result.current.factions).toEqual(existingFactions);
      vi.clearAllMocks();
      mockSaveFactions.mockRejectedValue(new Error('Save failed'));

      await expect(
        act(async () => {
          await result.current.saveFactionsList([{ id: 'new-faction' }]);
        })
      ).rejects.toThrow('Save failed');

      expect(mockLoadFactions).not.toHaveBeenCalled();
      expect(result.current.factions).toEqual(existingFactions);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save Factions:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('deleteFactionAction', () => {
    it('deletes a faction and reloads the list', async () => {
      mockDeleteFaction.mockResolvedValue({ success: true });
      mockLoadFactions.mockResolvedValue({ factions: [] });

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteFactionAction('faction-1');
      });

      expect(mockDeleteFaction).toHaveBeenCalledWith('test-campaign', 'faction-1');
      expect(mockLoadFactions).toHaveBeenCalled();
      expect(result.current.factions).toEqual([]);
    });

    it('deletes with correct campaign name', async () => {
      mockDeleteFaction.mockResolvedValue({ success: true });
      mockLoadFactions.mockResolvedValue({ factions: [] });

      const { result } = renderHook(() => useFactionsManagement('another-campaign'));

      await act(async () => {
        await result.current.deleteFactionAction('faction-42');
      });

      expect(mockDeleteFaction).toHaveBeenCalledWith('another-campaign', 'faction-42');
    });

    it('throws error when delete fails', async () => {
      mockDeleteFaction.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteFactionAction('faction-1');
        })
      ).rejects.toThrow('Delete failed');
    });

    it('does not reload when delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingFactions = [{ id: 'faction-1', name: 'Existing Faction' }];
      mockLoadFactions.mockResolvedValue({ factions: existingFactions });
      mockDeleteFaction.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      // Load factions first so there is existing state
      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(result.current.factions).toEqual(existingFactions);
      vi.clearAllMocks();
      mockDeleteFaction.mockRejectedValue(new Error('Delete failed'));

      await expect(
        act(async () => {
          await result.current.deleteFactionAction('faction-1');
        })
      ).rejects.toThrow('Delete failed');

      expect(mockLoadFactions).not.toHaveBeenCalled();
      expect(result.current.factions).toEqual(existingFactions);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete Faction:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('return value', () => {
    it('returns all expected properties with correct types', async () => {
      mockLoadFactions.mockResolvedValue({ factions: [] });

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toMatchObject({
        factions: expect.any(Array),
        loading: expect.any(Boolean),
        loadFactionsList: expect.any(Function),
        saveFactionsList: expect.any(Function),
        deleteFactionAction: expect.any(Function),
      });
    });

    it('returns functions that are stable across renders', () => {
      const { result, rerender } = renderHook(
        ({ campaignName }) => useFactionsManagement(campaignName),
        { initialProps: { campaignName: 'test-campaign' } }
      );

      const { loadFactionsList, saveFactionsList, deleteFactionAction } = result.current;

      rerender({ campaignName: 'test-campaign' });

      expect(result.current.loadFactionsList).toBe(loadFactionsList);
      expect(result.current.saveFactionsList).toBe(saveFactionsList);
      expect(result.current.deleteFactionAction).toBe(deleteFactionAction);
    });
  });
});
