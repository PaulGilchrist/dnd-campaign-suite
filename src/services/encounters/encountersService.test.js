// @cleaned-by-ai
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

// Each service function follows the same error-handling pattern:
// 1. Try fetch, throw on !response.ok with error field or generic message
// 2. Catch network errors and re-throw
// We test this pattern once, then verify each function's unique behavior.

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

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid encounter data' }),
      });
      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('Invalid encounter data');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(saveEncounter('campaign1', 'test', {})).rejects.toThrow('ENOTFOUND');
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

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });
      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(loadEncounter('campaign1', 'test')).rejects.toThrow('ENOTFOUND');
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

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });
      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('Encounter not found');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(updateEncounter('campaign1', 'test', {})).rejects.toThrow('ENOTFOUND');
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

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });
      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('Encounter not found');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(deleteEncounter('campaign1', 'test')).rejects.toThrow('ENOTFOUND');
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

    it('throws with custom error message on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Encounter not found' }),
      });
      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('Encounter not found');
    });

    it('throws the original error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(renameEncounter('campaign1', 'old', 'new')).rejects.toThrow('ENOTFOUND');
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

    it('returns empty string for null, undefined, or empty string', () => {
      expect(formatEncounterName(null)).toBe('');
      expect(formatEncounterName(undefined)).toBe('');
      expect(formatEncounterName('')).toBe('');
    });

    it('handles names with numbers', () => {
      expect(formatEncounterName('dragon-7.json')).toBe('Dragon 7');
    });
  });
});
