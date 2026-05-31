import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadNPCs, saveNPCs, loadNPC, deleteNPC } from './npcsService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('npcsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadNPCs', () => {
    it('should return NPCs from API response', async () => {
      const mockNPCs = [{ name: 'NPC 1' }, { name: 'NPC 2' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNPCs),
      });

      const result = await loadNPCs('campaign1');

      expect(result).toEqual(mockNPCs);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadNPCs('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadNPCs('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadNPCs('campaign1')).rejects.toThrow('Failed to load NPCs');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNPCs('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveNPCs', () => {
    it('should save NPCs and return response', async () => {
      const npcs = [{ name: 'NPC 1' }];
      const responseData = { success: true, savedCount: 1 };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveNPCs('campaign1', npcs);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npcs }),
        }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNPCs('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid NPCs data' }),
      });

      await expect(saveNPCs('campaign1', [])).rejects.toThrow('Invalid NPCs data');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveNPCs('campaign1', [])).rejects.toThrow('Failed to save NPCs');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveNPCs('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadNPC', () => {
    it('should return a single NPC from API response', async () => {
      const mockNPC = { name: 'Town Guard' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNPC),
      });

      const result = await loadNPC('campaign1', 'Town Guard');

      expect(result).toEqual(mockNPC);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Town%20Guard',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign and NPC names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadNPC('campaign with spaces', 'NPC with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs/NPC%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'NPC not found' }),
      });

      await expect(loadNPC('campaign1', 'Town Guard')).rejects.toThrow('NPC not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadNPC('campaign1', 'Town Guard')).rejects.toThrow('Failed to load NPC');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNPC('campaign1', 'Town Guard')).rejects.toThrow('Network error');
    });
  });

  describe('deleteNPC', () => {
    it('should delete an NPC and return response', async () => {
      const responseData = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteNPC('campaign1', 'Town Guard');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/npcs/Town%20Guard',
        { method: 'DELETE' }
      );
    });

    it('should encode campaign and NPC names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteNPC('campaign with spaces', 'NPC with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/npcs/NPC%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'NPC not found' }),
      });

      await expect(deleteNPC('campaign1', 'Town Guard')).rejects.toThrow('NPC not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteNPC('campaign1', 'Town Guard')).rejects.toThrow('Failed to delete NPC');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteNPC('campaign1', 'Town Guard')).rejects.toThrow('Network error');
    });
  });
});
