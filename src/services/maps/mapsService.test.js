// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toKebabCase, formatMapName, loadMaps, createMap, deleteMap, renameMap, activateMap, saveMapData, loadMapData, updateMapDescription } from './mapsService.js';

function createMockResponse(json, options = {}) {
  const status = options.status ?? (json && json.error ? 400 : 200);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  };
}

describe('mapsService', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(createMockResponse([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toKebabCase', () => {
    it('converts spaces to hyphens', () => {
      expect(toKebabCase('My Map')).toBe('my-map');
    });

    it('removes non-alphanumeric characters except hyphens', () => {
      expect(toKebabCase('Map #1!')).toBe('map-1');
    });

    it('lowercases the result', () => {
      expect(toKebabCase('UPPER CASE MAP')).toBe('upper-case-map');
    });

    it('removes .json extension and converts spaces', () => {
      expect(toKebabCase('My Map.json')).toBe('my-map');
    });

    it('handles already kebab-cased input', () => {
      expect(toKebabCase('already-kebab')).toBe('already-kebab');
    });

    it('returns empty string for empty input', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('collapses consecutive spaces into a single hyphen', () => {
      expect(toKebabCase('map   name')).toBe('map-name');
    });

    it('strips leading and trailing special characters', () => {
      expect(toKebabCase('!my-map!')).toBe('my-map');
    });

    it('handles input with only special characters', () => {
      expect(toKebabCase('!@#$%')).toBe('');
    });

    it('handles numbers mixed with letters and spaces', () => {
      expect(toKebabCase('Room 123-A')).toBe('room-123-a');
    });
  });

  describe('formatMapName', () => {
    it('converts kebab-case to title case', () => {
      expect(formatMapName('dungeon-map')).toBe('Dungeon Map');
    });

    it('handles single word', () => {
      expect(formatMapName('dungeon')).toBe('Dungeon');
    });

    it('removes .json extension', () => {
      expect(formatMapName('dungeon-map.json')).toBe('Dungeon Map');
    });

    it('handles empty string', () => {
      expect(formatMapName('')).toBe('');
    });

    it('handles null input', () => {
      expect(formatMapName(null)).toBe('');
    });

    it('handles undefined input', () => {
      expect(formatMapName(undefined)).toBe('');
    });

    it('handles multiple hyphens', () => {
      expect(formatMapName('deep-dungeon-map')).toBe('Deep Dungeon Map');
    });

    it('converts already title-cased input', () => {
      expect(formatMapName('Dungeon-Map')).toBe('Dungeon Map');
    });

    it('handles mixed case kebab-case input', () => {
      expect(formatMapName('My-Dungeon-Map')).toBe('My Dungeon Map');
    });

    it('removes .json from single word', () => {
      expect(formatMapName('dungeon.json')).toBe('Dungeon');
    });
  });

  describe('loadMaps', () => {
    it('fetches maps from the API and returns the JSON body', async () => {
      const mockMaps = [{ name: 'Dungeon', fileName: 'dungeon.json' }];
      global.fetch.mockResolvedValueOnce(createMockResponse(mockMaps));

      const result = await loadMaps('testCampaign');
      expect(result).toEqual(mockMaps);
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'Campaign not found' }, { status: 404 }));

      await expect(loadMaps('badCampaign')).rejects.toThrow('Campaign not found');
    });

    it('throws a generic error when response.json yields no error field', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ other: 'data' }, { status: 500 }));

      await expect(loadMaps('badCampaign')).rejects.toThrow('Failed to load maps');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(loadMaps('testCampaign')).rejects.toThrow('network error');
    });
  });

  describe('createMap', () => {
    it('creates a map via POST with default options', async () => {
      const mockMap = { name: 'Dungeon', fileName: 'dungeon.json' };
      global.fetch.mockResolvedValueOnce(createMockResponse(mockMap));

      const result = await createMap('testCampaign', 'Dungeon');
      expect(result).toEqual(mockMap);
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Dungeon', type: 'indoor' }),
        })
      );
    });

    it('passes additional options to the request body', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ name: 'Room', fileName: 'room.json' }));

      await createMap('testCampaign', 'Room', { grid: true, gridSize: 5 });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps',
        expect.objectContaining({
          body: JSON.stringify({ name: 'Room', type: 'indoor', grid: true, gridSize: 5 }),
        })
      );
    });

    it('returns an alreadyExists object when the server reports map conflict', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'map already exists' }, { status: 409 }));

      const result = await createMap('testCampaign', 'Dungeon');
      expect(result).toEqual({
        name: 'Dungeon',
        fileName: 'dungeon.json',
        alreadyExists: true,
      });
    });

    it('throws a generic error for non-conflict server errors', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'server error' }, { status: 500 }));

      await expect(createMap('testCampaign', 'Dungeon')).rejects.toThrow('server error');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(createMap('testCampaign', 'Dungeon')).rejects.toThrow('network error');
    });
  });

  describe('deleteMap', () => {
    it('deletes a map via DELETE and returns the JSON body', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await deleteMap('testCampaign', 'Dungeon');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'not found' }, { status: 404 }));

      await expect(deleteMap('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });

    it('throws a generic error when response.json yields no error field', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ other: 'data' }, { status: 500 }));

      await expect(deleteMap('testCampaign', 'Dungeon')).rejects.toThrow('Failed to delete map');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(deleteMap('testCampaign', 'Dungeon')).rejects.toThrow('network error');
    });
  });

  describe('renameMap', () => {
    it('renames a map via PUT and returns the JSON body', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await renameMap('testCampaign', 'OldName', 'NewName');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/oldname/rename',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ newName: 'NewName' }),
        })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'not found' }, { status: 404 }));

      await expect(renameMap('testCampaign', 'Old', 'New')).rejects.toThrow('not found');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(renameMap('testCampaign', 'Old', 'New')).rejects.toThrow('network error');
    });
  });

  describe('activateMap', () => {
    it('activates a map via PUT and returns the JSON body', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await activateMap('testCampaign', 'Dungeon');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon/activate',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'not found' }, { status: 404 }));

      await expect(activateMap('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(activateMap('testCampaign', 'Dungeon')).rejects.toThrow('network error');
    });
  });

  describe('saveMapData', () => {
    it('saves map data via PUT and returns the JSON body', async () => {
      const data = { tiles: [], tokens: [] };
      global.fetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await saveMapData('testCampaign', 'Dungeon', data);
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'save failed' }, { status: 400 }));

      await expect(saveMapData('testCampaign', 'Dungeon', {})).rejects.toThrow('save failed');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(saveMapData('testCampaign', 'Dungeon', { tiles: [] })).rejects.toThrow('network error');
    });
  });

  describe('loadMapData', () => {
    it('loads map data via GET and returns the JSON body', async () => {
      const mockData = { tiles: [], tokens: [] };
      global.fetch.mockResolvedValueOnce(createMockResponse(mockData));

      const result = await loadMapData('testCampaign', 'Dungeon');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'not found' }, { status: 404 }));

      await expect(loadMapData('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(loadMapData('testCampaign', 'Dungeon')).rejects.toThrow('network error');
    });
  });

  describe('updateMapDescription', () => {
    it('updates map description via PUT and returns the JSON body', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await updateMapDescription('testCampaign', 'Dungeon', 'A dark dungeon');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon/description',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ description: 'A dark dungeon' }),
        })
      );
    });

    it('throws an error with the server message on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce(createMockResponse({ error: 'not found' }, { status: 404 }));

      await expect(updateMapDescription('testCampaign', 'Dungeon', 'desc')).rejects.toThrow('not found');
    });

    it('re-throws network errors from fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(updateMapDescription('testCampaign', 'Dungeon', 'desc')).rejects.toThrow('network error');
    });
  });
});
