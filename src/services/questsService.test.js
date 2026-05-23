import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadQuests, saveQuests, loadQuest, deleteQuest } from './questsService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('questsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadQuests', () => {
    it('should return quests array from API response', async () => {
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests'
      );
    });

    it('should return empty array when response has no quests field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await loadQuests('campaign1');

      expect(result).toEqual([]);
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: [] }),
      });

      await loadQuests('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests'
      );
    });

    it('should throw on API error with custom message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error field is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Failed to load quests');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadQuests('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveQuests', () => {
    it('should save quests via POST and return undefined on success', async () => {
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

    it('should encode campaign name in URL', async () => {
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

    it('should throw on API error with custom message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid quest data' }),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Invalid quest data');
    });

    it('should throw generic message when error field is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Failed to save quests');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadQuest', () => {
    it('should return a single quest from API response', async () => {
      const mockQuest = { id: 'quest-1', name: 'Find the Ring', description: 'Epic quest' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: mockQuest }),
      });

      const result = await loadQuest('campaign1', 'quest-1');

      expect(result).toEqual(mockQuest);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests/quest-1'
      );
    });

    it('should encode campaign and quest IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: {} }),
      });

      await loadQuest('campaign with spaces', 'quest with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/quests/quest%20with%20spaces'
      );
    });

    it('should throw on API error with custom message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');
    });

    it('should throw generic message when error field is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to load quest');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Network error');
    });
  });

  describe('deleteQuest', () => {
    it('should delete a quest via DELETE and return undefined on success', async () => {
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

    it('should encode campaign and quest IDs in URL', async () => {
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

    it('should throw on API error with custom message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');
    });

    it('should throw generic message when error field is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to delete quest');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Network error');
    });
  });
});
