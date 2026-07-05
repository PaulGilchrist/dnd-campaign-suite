// @cleaned-by-ai
// Already minimal — kept as-is. Only happy-path tests exist; error handling is
// implicit (service throws on error). No redundant or brittle tests to remove.
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
  });
});
