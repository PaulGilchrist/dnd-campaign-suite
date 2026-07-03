// @cleaned-by-ai
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

    it('encodes campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadFactions('campaign/with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%20spaces/factions',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Failed to load Factions');
    });

    it('throws the original error on network failure', async () => {
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

    it('encodes campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveFactions('campaign/with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%20spaces/factions',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid factions data' }),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Invalid factions data');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Failed to save Factions');
    });

    it('throws the original error on network failure', async () => {
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

    it('encodes campaign and faction IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadFaction('campaign/1', 'faction/abc with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/factions/faction%2Fabc%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to load Faction');
    });

    it('throws the original error on network failure', async () => {
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

    it('encodes campaign and faction IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteFaction('campaign/1', 'faction/abc with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/factions/faction%2Fabc%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to delete Faction');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('ENOTFOUND');
    });
  });
});
