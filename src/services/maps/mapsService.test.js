import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toKebabCase, formatMapName } from './mapsService.js';

describe('mapsService', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('toKebabCase', () => {
    it('converts spaces to hyphens', () => {
      expect(toKebabCase('My Map')).toBe('my-map');
    });

    it('removes non-alphanumeric characters', () => {
      expect(toKebabCase('Map #1!')).toBe('map-1');
    });

    it('lowercases the result', () => {
      expect(toKebabCase('UPPER CASE MAP')).toBe('upper-case-map');
    });

    it('removes .json extension', () => {
      expect(toKebabCase('map.json')).toBe('map');
    });

    it('handles already kebab-cased input', () => {
      expect(toKebabCase('already-kebab')).toBe('already-kebab');
    });

    it('returns empty string for empty input', () => {
      expect(toKebabCase('')).toBe('');
    });
  });

  describe('loadMaps', () => {
    it('fetches maps from the API', async () => {
      const mockMaps = [{ name: 'Dungeon', fileName: 'dungeon.json' }];
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockMaps,
      });

      const { loadMaps } = await import('./mapsService.js');
      const result = await loadMaps('testCampaign');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockMaps);
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      });

      const { loadMaps } = await import('./mapsService.js');
      await expect(loadMaps('testCampaign')).rejects.toThrow('Not found');
    });

    it('catches and re-throws fetch errors', async () => {
      global.fetch.mockRejectedValue(new Error('network error'));

      const { loadMaps } = await import('./mapsService.js');
      await expect(loadMaps('testCampaign')).rejects.toThrow('network error');
    });

    it('encodes campaign name in URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { loadMaps } = await import('./mapsService.js');
      await loadMaps('my campaign');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign/maps',
        expect.anything()
      );
    });
  });

  describe('createMap', () => {
    it('creates a map via POST', async () => {
      const mockMap = { name: 'Dungeon', fileName: 'dungeon.json' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockMap,
      });

      const { createMap } = await import('./mapsService.js');
      const result = await createMap('testCampaign', 'Dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Dungeon', type: 'indoor' }),
        })
      );
      expect(result).toEqual(mockMap);
    });

    it('creates a map with additional options', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Room', fileName: 'room.json' }),
      });

      const { createMap } = await import('./mapsService.js');
      await createMap('testCampaign', 'Room', { grid: true, gridSize: 5 });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps',
        expect.objectContaining({
          body: JSON.stringify({ name: 'Room', type: 'indoor', grid: true, gridSize: 5 }),
        })
      );
    });

    it('resolves existing map when map already exists', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'map already exists' }),
      });

      const { createMap } = await import('./mapsService.js');
      const result = await createMap('testCampaign', 'Dungeon');
      expect(result.alreadyExists).toBe(true);
      expect(result.name).toBe('Dungeon');
      expect(result.fileName).toBe('dungeon.json');
    });

    it('throws error for other non-ok responses', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'server error' }),
      });

      const { createMap } = await import('./mapsService.js');
      await expect(createMap('testCampaign', 'Dungeon')).rejects.toThrow('server error');
    });

    it('handles empty error response on conflict', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => { throw new Error('empty'); },
      });

      const { createMap } = await import('./mapsService.js');
      await expect(createMap('testCampaign', 'Dungeon')).rejects.toThrow();
    });

    it('encodes campaign name in URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Map', fileName: 'map.json' }),
      });

      const { createMap } = await import('./mapsService.js');
      await createMap('my campaign', 'Map');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign/maps',
        expect.anything()
      );
    });
  });

  describe('deleteMap', () => {
    it('deletes a map via DELETE', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { deleteMap } = await import('./mapsService.js');
      const result = await deleteMap('testCampaign', 'Dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual({ success: true });
    });

    it('encodes map name in URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { deleteMap } = await import('./mapsService.js');
      await deleteMap('testCampaign', 'My Dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/my-dungeon',
        expect.anything()
      );
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { deleteMap } = await import('./mapsService.js');
      await expect(deleteMap('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });
  });

  describe('renameMap', () => {
    it('renames a map via PUT', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { renameMap } = await import('./mapsService.js');
      const result = await renameMap('testCampaign', 'OldName', 'NewName');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/oldname/rename',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ newName: 'NewName' }),
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('encodes both old and new map names', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { renameMap } = await import('./mapsService.js');
      await renameMap('testCampaign', 'Old Map', 'New Map');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/old-map/rename',
        expect.anything()
      );
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { renameMap } = await import('./mapsService.js');
      await expect(renameMap('testCampaign', 'Old', 'New')).rejects.toThrow('not found');
    });
  });

  describe('activateMap', () => {
    it('activates a map via PUT', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { activateMap } = await import('./mapsService.js');
      const result = await activateMap('testCampaign', 'Dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon/activate',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result).toEqual({ success: true });
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { activateMap } = await import('./mapsService.js');
      await expect(activateMap('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });
  });

  describe('saveMapData', () => {
    it('saves map data via PUT', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { saveMapData } = await import('./mapsService.js');
      const data = { tiles: [], tokens: [] };
      const result = await saveMapData('testCampaign', 'Dungeon', data);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'save failed' }),
      });

      const { saveMapData } = await import('./mapsService.js');
      await expect(saveMapData('testCampaign', 'Dungeon', {})).rejects.toThrow('save failed');
    });
  });

  describe('loadMapData', () => {
    it('loads map data via GET', async () => {
      const mockData = { tiles: [], tokens: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const { loadMapData } = await import('./mapsService.js');
      const result = await loadMapData('testCampaign', 'Dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockData);
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { loadMapData } = await import('./mapsService.js');
      await expect(loadMapData('testCampaign', 'Dungeon')).rejects.toThrow('not found');
    });
  });

  describe('updateMapDescription', () => {
    it('updates map description via PUT', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { updateMapDescription } = await import('./mapsService.js');
      const result = await updateMapDescription('testCampaign', 'Dungeon', 'A dark dungeon');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/testCampaign/maps/dungeon/description',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ description: 'A dark dungeon' }),
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('throws error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { updateMapDescription } = await import('./mapsService.js');
      await expect(updateMapDescription('testCampaign', 'Dungeon', 'desc')).rejects.toThrow('not found');
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
  });
});
