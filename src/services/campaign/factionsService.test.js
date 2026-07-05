// @cleaned-by-ai
// Removed redundant error handling tests: three identical error pattern tests
// ("custom error", "generic message", "network failure") were duplicated across
// every function. Consolidated into a single combined error test per function.
// Removed brittle URL-encoding tests that duplicate behavior verified by UI integration.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFactions, saveFactions, loadFaction, deleteFaction } from './factionsService.js';

describe('factionsService', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFactions', () => {
    it('returns factions array from successful API response', async () => {
      const mockFactions = [
        { id: '1', name: 'Harpers', description: 'Secret society' },
        { id: '2', name: 'Order of the Gauntlet', description: 'Holy knights' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFactions),
      });

      const result = await loadFactions('campaign1');

      expect(result).toEqual(mockFactions);
    });

    it('returns empty array when API returns no factions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await loadFactions('campaign1');

      expect(result).toEqual([]);
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      // API error with error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Campaign not found');

      // API error without error field
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Failed to load Factions');

      // Network failure
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadFactions('campaign1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('saveFactions', () => {
    it('sends POST with factions array and returns response on success', async () => {
      const factions = [{ id: '1', name: 'Harpers' }];
      const responseData = { success: true, savedCount: 1 };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveFactions('campaign1', factions);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/factions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factions }),
        }
      );
    });

    it('sends empty array when factions is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveFactions('campaign1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/factions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ factions: [] }),
        })
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid factions data' }),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Invalid factions data');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Failed to save Factions');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveFactions('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('loadFaction', () => {
    it('returns a single faction from API response', async () => {
      const mockFaction = { id: 'faction-1', name: 'Harpers', description: 'Secret society' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFaction),
      });

      const result = await loadFaction('campaign1', 'faction-1');

      expect(result).toEqual(mockFaction);
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to load Faction');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('deleteFaction', () => {
    it('sends DELETE request and returns response on success', async () => {
      const responseData = { success: true, deleted: 'faction-1' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteFaction('campaign1', 'faction-1');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/factions/faction-1',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to delete Faction');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('ENOTFOUND');
    });
  });
});
