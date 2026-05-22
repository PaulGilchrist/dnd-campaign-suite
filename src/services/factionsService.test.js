import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadFactions, saveFactions, loadFaction, deleteFaction } from './factionsService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('factionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFactions', () => {
    it('should return factions from API response', async () => {
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/factions',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadFactions('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/factions',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadFactions('campaign1')).rejects.toThrow('Failed to load Factions');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadFactions('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveFactions', () => {
    it('should save factions and return response', async () => {
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

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveFactions('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/factions',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid factions data' }),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Invalid factions data');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Failed to save Factions');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveFactions('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadFaction', () => {
    it('should return a single faction from API response', async () => {
      const mockFaction = { id: 'faction-1', name: 'Harpers', description: 'Secret society' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFaction),
      });

      const result = await loadFaction('campaign1', 'faction-1');

      expect(result).toEqual(mockFaction);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/factions/faction-1',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign and faction IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadFaction('campaign with spaces', 'faction with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/factions/faction%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to load Faction');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadFaction('campaign1', 'faction-1')).rejects.toThrow('Network error');
    });
  });

  describe('deleteFaction', () => {
    it('should delete a faction and return response', async () => {
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

    it('should encode campaign and faction IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteFaction('campaign with spaces', 'faction with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/factions/faction%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Faction not found' }),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Faction not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Failed to delete Faction');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteFaction('campaign1', 'faction-1')).rejects.toThrow('Network error');
    });
  });
});
