import { renderHook, act } from '@testing-library/react';
import useFactionsManagement from './useFactionsManagement.js';

const mockLoadFactions = vi.fn();
const mockSaveFactions = vi.fn();
const mockDeleteFaction = vi.fn();

vi.mock('../services/factionsService.js', () => ({
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
      mockLoadFactions.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadFactionsList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load Factions list:',
        expect.any(Error)
      );
      expect(result.current.factions).toEqual([]);
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

    it('throws error when save fails', async () => {
      mockSaveFactions.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveFactionsList([{ id: 'faction-1' }]);
        })
      ).rejects.toThrow('Save failed');
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

    it('throws error when delete fails', async () => {
      mockDeleteFaction.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useFactionsManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteFactionAction('faction-1');
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
