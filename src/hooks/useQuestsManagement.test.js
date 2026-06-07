import { renderHook, act } from '@testing-library/react';
import useQuestsManagement from './useQuestsManagement.js';

const mockLoadQuests = vi.fn();
const mockSaveQuests = vi.fn();
const mockDeleteQuest = vi.fn();

vi.mock('../services/campaign/questsService.js', () => ({
  loadQuests: (...args) => mockLoadQuests(...args),
  saveQuests: (...args) => mockSaveQuests(...args),
  deleteQuest: (...args) => mockDeleteQuest(...args),
}));

describe('useQuestsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets quests to empty array', () => {
      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      expect(result.current.quests).toEqual([]);
    });

    it('sets loading to false after initial load completes', async () => {
      mockLoadQuests.mockResolvedValue([]);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        // Wait for useEffect auto-load to complete
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('auto-load on campaignName change', () => {
    it('calls loadQuests when campaignName is provided', async () => {
      const questsData = [{ id: 'quest-1', name: 'Find the Ring' }];
      mockLoadQuests.mockResolvedValue(questsData);

      const { result, rerender } = renderHook(
        ({ campaignName }) => useQuestsManagement(campaignName),
        { initialProps: { campaignName: 'test-campaign' } }
      );

      await act(async () => {
        // Wait for useEffect to fire
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('test-campaign');
      expect(result.current.quests).toEqual(questsData);

      // Change campaign name
      const newQuests = [{ id: 'quest-2', name: 'Defeat Sauron' }];
      mockLoadQuests.mockResolvedValue(newQuests);

      rerender({ campaignName: 'new-campaign' });

      await act(async () => {
        // Wait for useEffect to fire on rerender
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('new-campaign');
      expect(result.current.quests).toEqual(newQuests);
    });

    it('does not call loadQuests when campaignName is empty', async () => {
      renderHook(() => useQuestsManagement(''));

      await act(async () => {
        // Wait for any effects
      });

      expect(mockLoadQuests).not.toHaveBeenCalled();
    });
  });

  describe('loadQuestsList', () => {
    it('loads and sets quests from service', async () => {
      const questsData = [
        { id: 'quest-1', name: 'Find the Ring' },
        { id: 'quest-2', name: 'Defeat Sauron' },
      ];
      mockLoadQuests.mockResolvedValue(questsData);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('test-campaign');
      expect(result.current.quests).toEqual(questsData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useQuestsManagement(''));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(mockLoadQuests).not.toHaveBeenCalled();
      expect(result.current.quests).toEqual([]);
    });

    it('defaults to empty array when service returns empty array', async () => {
      mockLoadQuests.mockResolvedValue([]);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(result.current.quests).toEqual([]);
    });

    it('sets loading to true while loading and false after', async () => {
      let resolveLoad;
      mockLoadQuests.mockImplementation(() => new Promise(resolve => {
        resolveLoad = resolve;
      }));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      act(() => {
        result.current.loadQuestsList();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveLoad([{ id: 'quest-1' }]);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.quests).toEqual([{ id: 'quest-1' }]);
    });

    it('sets loading to false even when load fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadQuests.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(result.current.loading).toBe(false);
      consoleSpy.mockRestore();
    });

    it('handles error by logging and keeping previous state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadQuests.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load quests:',
        expect.any(Error)
      );
      expect(result.current.quests).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('saveQuestsList', () => {
    it('saves quests and reloads the list', async () => {
      const questsToSave = [{ id: 'quest-1', name: 'Find the Ring' }];
      mockSaveQuests.mockResolvedValue(undefined);
      mockLoadQuests.mockResolvedValue(questsToSave);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveQuestsList(questsToSave);
      });

      expect(mockSaveQuests).toHaveBeenCalledWith('test-campaign', questsToSave);
      expect(mockLoadQuests).toHaveBeenCalled();
      expect(result.current.quests).toEqual(questsToSave);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useQuestsManagement(''));

      await act(async () => {
        await result.current.saveQuestsList([{ id: 'quest-1' }]);
      });

      expect(mockSaveQuests).not.toHaveBeenCalled();
    });

    it('handles error by logging without rethrowing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSaveQuests.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.saveQuestsList([{ id: 'quest-1' }]);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save quests:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('deleteQuestAction', () => {
    it('deletes a quest and reloads the list', async () => {
      mockDeleteQuest.mockResolvedValue(undefined);
      mockLoadQuests.mockResolvedValue([]);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteQuestAction('quest-1');
      });

      expect(mockDeleteQuest).toHaveBeenCalledWith('test-campaign', 'quest-1');
      expect(mockLoadQuests).toHaveBeenCalled();
      expect(result.current.quests).toEqual([]);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useQuestsManagement(''));

      await act(async () => {
        await result.current.deleteQuestAction('quest-1');
      });

      expect(mockDeleteQuest).not.toHaveBeenCalled();
    });

    it('handles error by logging without rethrowing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteQuest.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteQuestAction('quest-1');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete quest:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('return value', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      expect(result.current).toHaveProperty('quests');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('loadQuestsList');
      expect(result.current).toHaveProperty('saveQuestsList');
      expect(result.current).toHaveProperty('deleteQuestAction');
    });
  });
});
