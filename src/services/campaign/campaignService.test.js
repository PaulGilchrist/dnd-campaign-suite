// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCharacterFolders,
  getCharacterFiles,
  loadCharacters,
  deleteCharacter,
  createCharacter,
  updateCharacter
} from './campaignService.js';

describe('campaignService', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCharacterFolders', () => {
    it('should return folders array from API response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: ['Campaign 1', 'Campaign 2'] })
      });

      const result = await getCharacterFolders();

      expect(result).toEqual(['Campaign 1', 'Campaign 2']);
    });

    it('should return empty array when folders key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
    });

    it('should return empty array when folders key is null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: null })
      });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
    });

    it('should call fetch with the campaigns endpoint', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: [] })
      });

      await getCharacterFolders();

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns');
    });
  });

  describe('getCharacterFiles', () => {
    it('should return files array from API response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: ['char1.json', 'char2.json'] })
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual(['char1.json', 'char2.json']);
    });

    it('should return empty array when files key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
    });

    it('should return empty array when files key is null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: null })
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
    });

    it('should URL-encode campaign name with spaces', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] })
      });

      await getCharacterFiles('campaign with spaces');

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign%20with%20spaces');
    });

    it('should URL-encode campaign name with slashes', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] })
      });

      await getCharacterFiles('campaign/with/slashes');

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign%2Fwith%2Fslashes');
    });
  });

  describe('loadCharacters', () => {
    it('should load all characters from files', async () => {
      const characterFiles = ['char1.json', 'char2.json'];

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 2' })
        });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([
        { name: 'Character 1' },
        { name: 'Character 2' }
      ]);
    });

    it('should return empty array when one character fails to load', async () => {
      const characterFiles = ['char1.json', 'char2.json'];

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 1' })
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found'
        });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      const characterFiles = ['char1.json'];

      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([]);
    });

    it('should return empty array without calling fetch for empty file list', async () => {
      const result = await loadCharacters('campaign1', []);

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should load multiple characters in parallel', async () => {
      const characterFiles = ['char1.json', 'char2.json', 'char3.json'];

      fetchSpy.mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: url.split('/').pop() })
        });
      });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toEqual(['char1.json', 'char2.json', 'char3.json']);
    });

    it('should URL-encode campaign and file names', async () => {
      const characterFiles = ['char 1.json'];

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'Character 1' })
      });

      await loadCharacters('campaign 1', characterFiles);

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign%201/char%201.json');
    });

    it('should handle characters with complex nested data', async () => {
      const characterFiles = ['char1.json'];
      const characterData = {
        name: 'Character 1',
        level: 5,
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        abilities: [
          { name: 'Strength', score: 10 },
          { name: 'Dexterity', score: 14 }
        ],
        spells: ['Fireball', 'Magic Missile']
      };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(characterData)
      });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([characterData]);
    });

    it('should return empty array when json() throws', async () => {
      const characterFiles = ['char1.json'];

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => { throw new SyntaxError('Unexpected token'); }
      });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([]);
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character and return undefined on success', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const result = await deleteCharacter('campaign1', 'char1.json');

      expect(result).toBeUndefined();
    });

    it('should URL-encode campaign and file names', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      await deleteCharacter('campaign with spaces', 'char 1.json');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/char%201.json',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(
        deleteCharacter('campaign1', 'char1.json')
      ).rejects.toThrow('Failed to delete character: Not Found');
    });

    it('should throw and rethrow network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(
        deleteCharacter('campaign1', 'char1.json')
      ).rejects.toThrow('Network error');
    });
  });

  describe('createCharacter', () => {
    it('should create character and return response', async () => {
      const characterData = { name: 'New Character', level: 1 };
      const responseData = { character: { ...characterData, id: '123' } };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData)
      });

      const result = await createCharacter('campaign1', characterData);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: 'campaign1', character: characterData })
      });
    });

    it('should URL-encode campaign name in URL', async () => {
      const characterData = { name: 'New Character' };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData })
      });

      await createCharacter('campaign with spaces', characterData);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      });

      await expect(
        createCharacter('campaign1', { name: 'Test' })
      ).rejects.toThrow('Failed to create character: Bad Request');
    });

    it('should throw and rethrow network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(
        createCharacter('campaign1', { name: 'Test' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('updateCharacter', () => {
    it('should update character and return response', async () => {
      const characterData = { name: 'Updated Character', level: 5 };
      const responseData = { character: characterData };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData)
      });

      const result = await updateCharacter('campaign1', 'char1.json', characterData);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign1/char1.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData)
      });
    });

    it('should URL-encode campaign and file names', async () => {
      const characterData = { name: 'Updated Character' };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData })
      });

      await updateCharacter('campaign with spaces', 'char 1.json', characterData);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/char%201.json',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Conflict'
      });

      await expect(
        updateCharacter('campaign1', 'char1.json', { name: 'Test' })
      ).rejects.toThrow('Failed to update character: Conflict');
    });

    it('should throw and rethrow network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(
        updateCharacter('campaign1', 'char1.json', { name: 'Test' })
      ).rejects.toThrow('Network error');
    });

    it('should include originalFileName in body when renaming', async () => {
      const characterData = { name: 'New Name', level: 5 };
      const responseData = { character: characterData };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData)
      });

      await updateCharacter('campaign1', 'new-name.json', characterData, 'old-name.json');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/new-name.json',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, originalFileName: 'old-name.json' })
        }
      );
    });

    it('should include originalFileName as undefined when not provided', async () => {
      const characterData = { name: 'Same Name', level: 3 };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData })
      });

      await updateCharacter('campaign1', 'char1.json', characterData);

      const callArgs = fetchSpy.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.originalFileName).toBeUndefined();
    });
  });
});
