// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuests, saveQuests, loadQuest, deleteQuest } from './questsService.js';

describe('questsService', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadQuests', () => {
    it('returns quests array from successful API response', async () => {
      const mockQuests = [
        { id: 'quest-1', name: 'Find the Ring' },
        { id: 'quest-2', name: 'Defeat Sauron' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: mockQuests }),
      });

      const result = await loadQuests('campaign1');

      expect(result).toEqual(mockQuests);
    });

    it('returns empty array when response has no quests field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await loadQuests('campaign1');

      expect(result).toEqual([]);
    });

    it('returns empty array when quests field is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: undefined }),
      });

      const result = await loadQuests('campaign1');

      expect(result).toEqual([]);
    });

    it('encodes campaign name with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: [] }),
      });

      await loadQuests('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests'
      );
    });

    it('encodes campaign name with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: [] }),
      });

      await loadQuests('campaign/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/quests'
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Failed to load quests');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuests('campaign1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadQuests('campaign1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading quests:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('saveQuests', () => {
    it('sends POST with quests array and returns undefined on success', async () => {
      const quests = [{ id: 'quest-1', name: 'Find the Ring' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await saveQuests('campaign1', quests);

      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quests }),
        }
      );
    });

    it('sends empty array when quests is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await saveQuests('campaign1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ quests: [] }),
        })
      );
    });

    it('encodes campaign name with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await saveQuests('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid quest data' }),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Invalid quest data');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Failed to save quests');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveQuests('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error saving quests:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('loadQuest', () => {
    it('returns a single quest from API response', async () => {
      const mockQuest = { id: 'quest-1', name: 'Find the Ring', description: 'Epic quest' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: mockQuest }),
      });

      const result = await loadQuest('campaign1', 'quest-1');

      expect(result).toEqual(mockQuest);
    });

    it('returns undefined when quest field is missing from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await loadQuest('campaign1', 'quest-1');

      expect(result).toBeUndefined();
    });

    it('encodes campaign and quest IDs with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: {} }),
      });

      await loadQuest('campaign with spaces', 'quest with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests/quest%20with%20spaces'
      );
    });

    it('encodes campaign and quest IDs with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: {} }),
      });

      await loadQuest('campaign/1', 'quest/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/quests/quest%2Fabc'
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to load quest');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading quest:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('deleteQuest', () => {
    it('sends DELETE request and returns undefined on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteQuest('campaign1', 'quest-1');

      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests/quest-1',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and quest IDs with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await deleteQuest('campaign with spaces', 'quest with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests/quest%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and quest IDs with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await deleteQuest('campaign/1', 'quest/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/quests/quest%2Fabc',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to delete quest');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting quest:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
