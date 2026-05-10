import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCharacterFolders,
  getCharacterFiles,
  loadCharacters,
  deleteCharacter,
  createCharacter,
  updateCharacter
} from './campaign-service.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('campaignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    });

  describe('getCharacterFolders', () => {
    it('should return folders from API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          folders: ['Campaign 1', 'Campaign 2']
            })
          });

      const result = await getCharacterFolders();

      expect(result).toEqual(['Campaign 1', 'Campaign 2']);
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns');
        });

    it('should return empty array when no folders in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
          });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
        });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
          });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
        });

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
        });

    it('should call fetch with correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: [] })
          });

      await getCharacterFolders();

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns');
        });
      });

  describe('getCharacterFiles', () => {
    it('should return files from API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: ['character1.json', 'character2.json']
            })
          });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual(['character1.json', 'character2.json']);
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign1');
        });

    it('should return empty array when no files in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
          });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
        });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
          });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
        });

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
        });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] })
          });

      await getCharacterFiles('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%20with%20spaces');
        });

    it('should handle special characters in campaign name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] })
          });

      await getCharacterFiles('campaign/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%2Fwith%2Fslashes');
        });
      });

  describe('loadCharacters', () => {
    it('should load all characters from files', async () => {
      const characterFiles = ['char1.json', 'char2.json'];
      
      mockFetch.mockResolvedValueOnce({
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
      expect(mockFetch).toHaveBeenCalledTimes(2);
        });

    it('should encode campaign and file names in URLs', async () => {
      const characterFiles = ['char 1.json'];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'Character 1' })
          });

      await loadCharacters('campaign 1', characterFiles);

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%201/char%201.json');
        });

    it('should return empty array when one character fails to load', async () => {
      const characterFiles = ['char1.json', 'char2.json'];
      
      mockFetch.mockResolvedValueOnce({
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
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([]);
        });

    it('should handle empty character files array', async () => {
      const result = await loadCharacters('campaign1', []);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
        });

    it('should load multiple characters in parallel', async () => {
      const characterFiles = ['char1.json', 'char2.json', 'char3.json'];
      const calls = [];
      
      mockFetch.mockImplementation((url) => {
        calls.push(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: url.split('/').pop() })
            });
          });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toHaveLength(3);
      expect(calls).toHaveLength(3);
        });

    it('should handle characters with complex data', async () => {
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(characterData)
          });

      const result = await loadCharacters('campaign1', characterFiles);

      expect(result).toEqual([characterData]);
        });
      });

  describe('deleteCharacter', () => {
    it('should delete character on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      await expect(deleteCharacter('campaign1', 'char1.json')).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign1/char1.json', { method: 'DELETE' });
    });

    it('should encode campaign and file names in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      await deleteCharacter('campaign with spaces', 'char 1.json');

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%20with%20spaces/char%201.json', { method: 'DELETE' });
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(deleteCharacter('campaign1', 'char1.json')).rejects.toThrow('Failed to delete character: Not Found');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteCharacter('campaign1', 'char1.json')).rejects.toThrow('Network error');
    });
  });

  describe('createCharacter', () => {
    it('should create character and return response', async () => {
      const characterData = { name: 'New Character', level: 1 };
      const responseData = { character: { ...characterData, id: '123' } };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await createCharacter('campaign1', characterData);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: 'campaign1', character: characterData }),
      });
    });

    it('should encode campaign name in URL', async () => {
      const characterData = { name: 'New Character' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData }),
      });

      await createCharacter('campaign with spaces', characterData);

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%20with%20spaces', expect.any(Object));
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(createCharacter('campaign1', { name: 'Test' })).rejects.toThrow('Failed to create character: Bad Request');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(createCharacter('campaign1', { name: 'Test' })).rejects.toThrow('Network error');
    });
  });

  describe('updateCharacter', () => {
    it('should update character and return response', async () => {
      const characterData = { name: 'Updated Character', level: 5 };
      const responseData = { character: characterData };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await updateCharacter('campaign1', 'char1.json', characterData);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign1/char1.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
      });
    });

    it('should encode campaign and file names in URL', async () => {
      const characterData = { name: 'Updated Character' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ character: characterData }),
      });

      await updateCharacter('campaign with spaces', 'char 1.json', characterData);

      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/campaign%20with%20spaces/char%201.json', expect.any(Object));
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
      });

      await expect(updateCharacter('campaign1', 'char1.json', { name: 'Test' })).rejects.toThrow('Failed to update character: Conflict');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(updateCharacter('campaign1', 'char1.json', { name: 'Test' })).rejects.toThrow('Network error');
    });
  });
});
