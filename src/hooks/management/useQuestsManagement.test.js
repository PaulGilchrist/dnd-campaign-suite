// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import useQuestsManagement from './useQuestsManagement.js';

const mockLoadQuests = vi.fn();
const mockSaveQuests = vi.fn();
const mockDeleteQuest = vi.fn();

vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: (...args) => mockLoadQuests(...args),
  saveQuests: (...args) => mockSaveQuests(...args),
  deleteQuest: (...args) => mockDeleteQuest(...args),
}));

describe('useQuestsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets quests to empty array and loading to false after auto-load completes', async () => {
      mockLoadQuests.mockResolvedValue([]);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.quests).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('does not load quests when campaignName is empty', () => {
      const { result } = renderHook(() => useQuestsManagement(''));

      expect(result.current.quests).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(mockLoadQuests).not.toHaveBeenCalled();
    });
  });

  describe('auto-load on mount', () => {
    it('calls loadQuests when campaignName is provided', async () => {
      const questsData = [{ id: 'quest-1', name: 'Find the Ring' }];
      mockLoadQuests.mockResolvedValue(questsData);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      // loading should be true during async load
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('test-campaign');
      expect(result.current.loading).toBe(false);
      expect(result.current.quests).toEqual(questsData);
    });

    it('reloads when campaignName changes', async () => {
      const questsData = [{ id: 'quest-1', name: 'Find the Ring' }];
      const newQuests = [{ id: 'quest-2', name: 'Defeat Sauron' }];
      mockLoadQuests.mockResolvedValue(questsData);

      const { result, rerender } = renderHook(
        ({ campaignName }) => useQuestsManagement(campaignName),
        { initialProps: { campaignName: 'test-campaign' } }
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('test-campaign');
      expect(result.current.quests).toEqual(questsData);

      mockLoadQuests.mockResolvedValue(newQuests);
      rerender({ campaignName: 'new-campaign' });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockLoadQuests).toHaveBeenCalledWith('new-campaign');
      expect(result.current.loading).toBe(false);
      expect(result.current.quests).toEqual(newQuests);
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

      // Wait for auto-load to complete first
      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();
      mockLoadQuests.mockResolvedValue(questsData);

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
      expect(result.current.loading).toBe(false);
    });

    it('sets loading to true during load and false after success', async () => {
      let resolveLoad;
      mockLoadQuests.mockImplementation(() => new Promise(resolve => {
        resolveLoad = resolve;
      }));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      // Wait for auto-load setup
      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();

      // Start a manual load
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

    it('sets loading to false and keeps previous quests on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingQuests = [{ id: 'quest-1', name: 'Existing Quest' }];
      mockLoadQuests.mockResolvedValue(existingQuests);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      // Wait for auto-load to set existing quests
      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();
      mockLoadQuests.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.loadQuestsList();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.quests).toEqual(existingQuests);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load items list:',
        expect.any(Error)
      );
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
        await Promise.resolve();
      });
      vi.clearAllMocks();

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
      expect(mockLoadQuests).not.toHaveBeenCalled();
    });

    it('does not reload when save fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingQuests = [{ id: 'quest-1', name: 'Existing Quest' }];
      mockLoadQuests.mockResolvedValue(existingQuests);
      mockSaveQuests.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      // Wait for auto-load to set existing quests
      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();
      mockSaveQuests.mockRejectedValue(new Error('Save failed'));

      await expect(
        act(async () => {
          await result.current.saveQuestsList([{ id: 'new-quest' }]);
        })
      ).rejects.toThrow('Save failed');

      expect(mockSaveQuests).toHaveBeenCalledWith('test-campaign', [{ id: 'new-quest' }]);
      expect(mockLoadQuests).not.toHaveBeenCalled();
      expect(result.current.quests).toEqual(existingQuests);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save items:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('deleteQuestAction', () => {
    it('deletes a quest and reloads the list', async () => {
      const remainingQuests = [{ id: 'quest-2', name: 'Remaining Quest' }];
      mockDeleteQuest.mockResolvedValue(undefined);
      mockLoadQuests.mockResolvedValue(remainingQuests);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();

      await act(async () => {
        await result.current.deleteQuestAction('quest-1');
      });

      expect(mockDeleteQuest).toHaveBeenCalledWith('test-campaign', 'quest-1');
      expect(mockLoadQuests).toHaveBeenCalled();
      expect(result.current.quests).toEqual(remainingQuests);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useQuestsManagement(''));

      await act(async () => {
        await result.current.deleteQuestAction('quest-1');
      });

      expect(mockDeleteQuest).not.toHaveBeenCalled();
      expect(mockLoadQuests).not.toHaveBeenCalled();
    });

    it('does not reload when delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existingQuests = [{ id: 'quest-1', name: 'Existing Quest' }];
      mockLoadQuests.mockResolvedValue(existingQuests);
      mockDeleteQuest.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      // Wait for auto-load to set existing quests
      await act(async () => {
        await Promise.resolve();
      });
      vi.clearAllMocks();
      mockDeleteQuest.mockRejectedValue(new Error('Delete failed'));

      await expect(
        act(async () => {
          await result.current.deleteQuestAction('quest-1');
        })
      ).rejects.toThrow('Delete failed');

      expect(mockDeleteQuest).toHaveBeenCalledWith('test-campaign', 'quest-1');
      expect(mockLoadQuests).not.toHaveBeenCalled();
      expect(result.current.quests).toEqual(existingQuests);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete item:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('return value', () => {
    it('returns all expected properties with correct types', async () => {
      mockLoadQuests.mockResolvedValue([]);

      const { result } = renderHook(() => useQuestsManagement('test-campaign'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toMatchObject({
        quests: expect.any(Array),
        loading: expect.any(Boolean),
        loadQuestsList: expect.any(Function),
        saveQuestsList: expect.any(Function),
        deleteQuestAction: expect.any(Function),
      });
    });
  });
});
