import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadEncounters,
  saveEncounter,
  loadEncounter,
  updateEncounter,
  deleteEncounter,
  renameEncounter,
  formatEncounterName,
} from './encountersService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('encountersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadEncounters', () => {
    it('should return encounters from API response', async () => {
      const mockEncounters = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
        { name: 'Dragon Lair', monsters: ['young-red-dragon'] },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEncounters),
      });

      const result = await loadEncounters('campaign1');

      expect(result).toEqual(mockEncounters);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadEncounters('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadEncounters('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadEncounters('campaign1')).rejects.toThrow('Failed to load encounters');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadEncounters('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveEncounter', () => {
    it('should save encounter and return response', async () => {
      const data = { monsters: ['goblin'], difficulty: 'easy' };
      const responseData = { success: true, name: 'goblin-ambush' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveEncounter('campaign1', 'goblin-ambush', data);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'goblin-ambush', data }),
        }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveEncounter('campaign with spaces', 'encounter-1', {});

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid encounter data' }),
      });

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Invalid encounter data');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Failed to save encounter');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Network error');
    });
  });

  describe('loadEncounter', () => {
    it('should return a single encounter from API response', async () => {
      const mockEncounter = { name: 'goblin-ambush', monsters: ['goblin'] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEncounter),
      });

      const result = await loadEncounter('campaign1', 'goblin-ambush');

      expect(result).toEqual(mockEncounter);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign and encounter names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadEncounter('campaign with spaces', 'encounter with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Failed to load encounter');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Network error');
    });
  });

  describe('updateEncounter', () => {
    it('should update encounter and return response', async () => {
      const data = { monsters: ['hobgoblin'], difficulty: 'medium' };
      const responseData = { success: true };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await updateEncounter('campaign1', 'goblin-ambush', data);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
    });

    it('should encode campaign and encounter names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await updateEncounter('campaign with spaces', 'encounter with spaces', {});

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Encounter not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Failed to update encounter');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Network error');
    });
  });

  describe('deleteEncounter', () => {
    it('should delete an encounter and return response', async () => {
      const responseData = { success: true, deleted: 'goblin-ambush' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteEncounter('campaign1', 'goblin-ambush');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush',
        { method: 'DELETE' }
      );
    });

    it('should encode campaign and encounter names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteEncounter('campaign with spaces', 'encounter with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Failed to delete encounter');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Network error');
    });
  });

  describe('renameEncounter', () => {
    it('should rename an encounter and return response', async () => {
      const responseData = { success: true, newName: 'goblin-ambush-v2' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await renameEncounter('campaign1', 'goblin-ambush', 'goblin-ambush-v2');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush/rename',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'goblin-ambush-v2' }),
        }
      );
    });

    it('should encode campaign and encounter names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await renameEncounter('campaign with spaces', 'old encounter', 'new encounter');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/old%20encounter/rename',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Encounter not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Failed to rename encounter');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Network error');
    });
  });

  describe('formatEncounterName', () => {
    it('should convert kebab-case to Title Case', () => {
      expect(formatEncounterName('goblin-ambush')).toBe('Goblin Ambush');
    });

    it('should strip .json extension', () => {
      expect(formatEncounterName('dragon-lair.json')).toBe('Dragon Lair');
    });

    it('should handle multiple hyphens', () => {
      expect(formatEncounterName('the-return-of-the-king')).toBe('The Return Of The King');
    });

    it('should handle single word', () => {
      expect(formatEncounterName('test')).toBe('Test');
    });

    it('should return empty string for null or undefined', () => {
      expect(formatEncounterName(null)).toBe('');
      expect(formatEncounterName(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(formatEncounterName('')).toBe('');
    });

    it('should handle names already in title case', () => {
      expect(formatEncounterName('Goblin Ambush')).toBe('Goblin Ambush');
    });

    it('should handle .json with multiple hyphens', () => {
      expect(formatEncounterName('the-final-battle.json')).toBe('The Final Battle');
    });
  });
});
