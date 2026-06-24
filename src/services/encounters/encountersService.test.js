// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadEncounters,
  saveEncounter,
  loadEncounter,
  updateEncounter,
  deleteEncounter,
  renameEncounter,
  formatEncounterName,
} from './encountersService.js';

describe('encountersService', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadEncounters', () => {
    it('returns encounters array from successful API response', async () => {
      const mockEncounters = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
        { name: 'Dragon Lair', monsters: ['young-red-dragon'] },
      ];
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEncounters),
      });

      const result = await loadEncounters('campaign1');

      expect(result).toEqual(mockEncounters);
    });

    it('returns empty array when no encounters exist', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await loadEncounters('campaign1');

      expect(result).toEqual([]);
    });

    it('encodes campaign name with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadEncounters('campaign with spaces');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters',
        expect.any(Object)
      );
    });

    it('encodes campaign name with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadEncounters('campaign/with/slashes');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/encounters',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadEncounters('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadEncounters('campaign1')).rejects.toThrow('Failed to load encounters');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(loadEncounters('campaign1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(loadEncounters('campaign1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading encounters:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('saveEncounter', () => {
    it('sends POST with encounter name and data and returns response on success', async () => {
      const data = { monsters: ['goblin'], difficulty: 'easy' };
      const responseData = { success: true, name: 'goblin-ambush' };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveEncounter('campaign1', 'goblin-ambush', data);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'goblin-ambush', data }),
        }
      );
    });

    it('encodes campaign and encounter names with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveEncounter('campaign with spaces', 'encounter with spaces', {});

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters',
        expect.any(Object)
      );
    });

    it('encodes campaign and encounter names with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveEncounter('campaign/1', 'encounter/abc', {});

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/encounters',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid encounter data' }),
      });

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Invalid encounter data');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Failed to save encounter');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error saving encounter:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('loadEncounter', () => {
    it('returns a single encounter from API response', async () => {
      const mockEncounter = { name: 'goblin-ambush', monsters: ['goblin'] };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEncounter),
      });

      const result = await loadEncounter('campaign1', 'goblin-ambush');

      expect(result).toEqual(mockEncounter);
    });

    it('encodes campaign and encounter names with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadEncounter('campaign with spaces', 'encounter with spaces');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        expect.any(Object)
      );
    });

    it('encodes campaign and encounter names with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadEncounter('campaign/1', 'encounter/abc');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/encounters/encounter%2Fabc',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Failed to load encounter');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading encounter:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateEncounter', () => {
    it('sends PUT with data and returns response on success', async () => {
      const data = { monsters: ['hobgoblin'], difficulty: 'medium' };
      const responseData = { success: true };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await updateEncounter('campaign1', 'goblin-ambush', data);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
    });

    it('encodes campaign and encounter names with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await updateEncounter('campaign with spaces', 'encounter with spaces', {});

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        expect.any(Object)
      );
    });

    it('encodes campaign and encounter names with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await updateEncounter('campaign/1', 'encounter/abc', {});

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/encounters/encounter%2Fabc',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Encounter not found');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Failed to update encounter');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error updating encounter:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('deleteEncounter', () => {
    it('sends DELETE request and returns response on success', async () => {
      const responseData = { success: true, deleted: 'goblin-ambush' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteEncounter('campaign1', 'goblin-ambush');

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and encounter names with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteEncounter('campaign with spaces', 'encounter with spaces');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/encounter%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and encounter names with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteEncounter('campaign/1', 'encounter/abc');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/encounters/encounter%2Fabc',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Failed to delete encounter');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting encounter:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('renameEncounter', () => {
    it('sends PUT with newName and returns response on success', async () => {
      const responseData = { success: true, newName: 'goblin-ambush-v2' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await renameEncounter('campaign1', 'goblin-ambush', 'goblin-ambush-v2');

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/encounters/goblin-ambush/rename',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'goblin-ambush-v2' }),
        }
      );
    });

    it('encodes campaign and encounter names with spaces in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await renameEncounter('campaign with spaces', 'old encounter', 'new encounter');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/encounters/old%20encounter/rename',
        expect.any(Object)
      );
    });

    it('encodes campaign and encounter names with special characters in URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await renameEncounter('campaign/1', 'old/encounter', 'new/encounter');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/encounters/old%2Fencounter/rename',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Encounter not found');
    });

    it('throws generic message when API error has no error field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Failed to rename encounter');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error renaming encounter:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('formatEncounterName', () => {
    it('converts kebab-case to Title Case', () => {
      expect(formatEncounterName('goblin-ambush')).toBe('Goblin Ambush');
    });

    it('strips .json extension', () => {
      expect(formatEncounterName('dragon-lair.json')).toBe('Dragon Lair');
    });

    it('handles multiple hyphens', () => {
      expect(formatEncounterName('the-return-of-the-king')).toBe('The Return Of The King');
    });

    it('handles single word', () => {
      expect(formatEncounterName('test')).toBe('Test');
    });

    it('returns empty string for null or undefined', () => {
      expect(formatEncounterName(null)).toBe('');
      expect(formatEncounterName(undefined)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(formatEncounterName('')).toBe('');
    });

    it('handles names already in Title Case with hyphens', () => {
      expect(formatEncounterName('Goblin-Ambush')).toBe('Goblin Ambush');
    });

    it('handles .json with multiple hyphens', () => {
      expect(formatEncounterName('the-final-battle.json')).toBe('The Final Battle');
    });

    it('handles double hyphens', () => {
      expect(formatEncounterName('goblin--ambush')).toBe('Goblin  Ambush');
    });

    it('handles leading and trailing hyphens', () => {
      expect(formatEncounterName('-goblin-ambush-')).toBe(' Goblin Ambush ');
    });

    it('handles names with numbers', () => {
      expect(formatEncounterName('dragon-7.json')).toBe('Dragon 7');
    });

    it('handles single character words', () => {
      expect(formatEncounterName('a-b-c')).toBe('A B C');
    });
  });
});
