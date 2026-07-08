// @cleaned-by-ai
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

    it('returns empty array when API returns no quests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: [] }),
      });

      const result = await loadQuests('campaign1');

      expect(result).toEqual([]);
    });

    it('URL-encodes the campaign name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quests: [] }),
      });

      await loadQuests('my campaign/1');

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/my%20campaign%2F1/quests');
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      // API error with error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Campaign not found');

      // API error without error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuests('campaign1')).rejects.toThrow('Failed to load quests');

      // Network failure
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuests('campaign1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('saveQuests', () => {
    it('sends POST with quests array on success', async () => {
      const quests = [{ id: 'quest-1', name: 'Find the Ring' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveQuests('campaign1', quests);

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
        json: () => Promise.resolve({ success: true }),
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

    it('URL-encodes the campaign name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveQuests('my campaign/1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/quests',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid quests data' }),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Invalid quests data');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveQuests('campaign1', [])).rejects.toThrow('Failed to save quests');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveQuests('campaign1', [])).rejects.toThrow('ENOTFOUND');
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

    it('URL-encodes both campaign name and quest ID', async () => {
      const mockQuest = { id: 'quest-1', name: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ quest: mockQuest }),
      });

      await loadQuest('my campaign/1', 'quest%2Fwith%2Fslashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/quests/quest%252Fwith%252Fslashes'
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to load quest');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadQuest('campaign1', 'quest-1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('deleteQuest', () => {
    it('sends DELETE request on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteQuest('campaign1', 'quest-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/quests/quest-1',
        { method: 'DELETE' }
      );
    });

    it('URL-encodes both campaign name and quest ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteQuest('my campaign/1', 'quest%2Fwith%2Fslashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/quests/quest%252Fwith%252Fslashes',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Quest not found' }),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Quest not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('Failed to delete quest');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteQuest('campaign1', 'quest-1')).rejects.toThrow('ENOTFOUND');
    });
  });
});
