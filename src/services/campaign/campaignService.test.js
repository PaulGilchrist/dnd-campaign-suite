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
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCharacterFolders', () => {
    it('should return filtered folders array from API response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: ['Campaign 1', 'Campaign 2', 'test-campaign'] })
      });

      const result = await getCharacterFolders();

      expect(result).toEqual(['Campaign 1', 'Campaign 2', 'test-campaign']);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns');
    });

    it('should return empty array when folders key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
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
  });

  describe('getCharacterFiles', () => {
    it('should return files array from API response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: ['char1.json', 'char2.json'] })
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual(['char1.json', 'char2.json']);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign1');
    });

    it('should URL-encode the campaign name in the request', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: ['char1.json'] })
      });

      await getCharacterFiles('My Campaign');

      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/My%20Campaign');
    });

    it('should return empty array when files key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
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
  });

  describe('loadCharacters', () => {
    it('should load all characters from files', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 2' })
        });

      const result = await loadCharacters('campaign1', ['char1.json', 'char2.json']);

      expect(result).toEqual([
        { name: 'Character 1' },
        { name: 'Character 2' }
      ]);
    });

    it('should URL-encode campaigns and filenames in fetch URLs', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Hero' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Villain' })
        });

      await loadCharacters('My Campaign', ['hero.json', 'villain.json']);

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        '/api/campaigns/My%20Campaign/hero.json'
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        '/api/campaigns/My%20Campaign/villain.json'
      );
    });

    it('should return empty array when one character fails to load', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Character 1' })
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found'
        });

      const result = await loadCharacters('campaign1', ['char1.json', 'char2.json']);

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await loadCharacters('campaign1', ['char1.json']);

      expect(result).toEqual([]);
    });

    it('should return empty array without calling fetch for empty file list', async () => {
      const result = await loadCharacters('campaign1', []);

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character without throwing on success', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      await expect(
        deleteCharacter('campaign1', 'char1.json')
      ).resolves.toBeUndefined();
    });

    it('should URL-encode the campaign name and filename', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      await deleteCharacter('My Campaign', 'char 1.json');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/My%20Campaign/char%201.json',
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

    it('should URL-encode the campaign name', async () => {
      const characterData = { name: 'Test' };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData })
      });

      await createCharacter('My Campaign', characterData);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/My%20Campaign',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ campaignName: 'My Campaign', character: characterData })
        })
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
        body: JSON.stringify({ ...characterData, originalFileName: undefined })
      });
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

    it('should URL-encode the campaign name and filename', async () => {
      const characterData = { name: 'Test' };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData })
      });

      await updateCharacter('My Campaign', 'new name.json', characterData, 'old name.json');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/My%20Campaign/new%20name.json',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ ...characterData, originalFileName: 'old name.json' })
        })
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
  });
});
