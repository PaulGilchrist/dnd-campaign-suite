// @maintained-by-ai
// mapsService.test.js — owner lane: maps CRUD transport (exact-fetch canon #1010).
// Every fetch pinned to method + URL + options/body BYTES (no objectContaining);
// responses consumed as the real server envelopes from server/routes/maps.js BY NAME
// (#977/#993 — shapes read from the route file, never transcribed from runtime data).
//
// Domain owners (maps domain map closed): walls → effectiveWalls.test.js (#1169),
// hex math → hexMapUtils.test.js (#1170), rays → lineOfSight.test.js (#1172),
// generators → dungeonGenerator/adjacentDungeonGenerator/hexTerrainGenerator tests
// (#1167/#1168), modal call-tuple transport → Generate*/GenerateTerrainModal tests.
// All sibling consumers (App.*, automation/*, components/map|hex-map/*) vi.mock this
// module — this file is the only place real mapsService transport bytes are pinned.
//
// - No cache/guard lanes exist here: all 8 HTTP lanes fetch exactly once each; the two
//   pure helpers cannot touch the network (zero-fetch proofs not applicable).
// - SSE: mapsService does not import EventSource/sseClient; the @app one-connection
//   rule lives with subscribers, N/A in this lane. No timers in this service.
//
// Old → new consolidation map (41 tests → 11 templates):
//   toKebabCase ×10          → it.each table (each row is one distinct sanitization rule)
//   formatMapName ×10        → it.each table
//   7× per-fn success        → one transport-table it.each ×8 (bytes were unpinned before)
//   createMap default POST   → transport table row (body bytes exact)
//   createMap options passthrough → kept standalone (body-merge behavior)
//   createMap 409 conflict   → conflict table on REAL server 400 'A map with this name
//                              already exists' (maps.js:121 — old 409 fixture was fiction)
//   per-fn non-ok throw ×7   → server-message + generic-fallback tables ×8 (fallback
//                              constants were previously unpinned for 7 of 8 lanes)
//   network reject ×2        → network-reject table ×8 (pins thrown-not-swallowed #945)
//   (new) encode/slug        → campaign percent-encoding + slug-before-encode pin

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toKebabCase, formatMapName, loadMaps, createMap, deleteMap, renameMap, activateMap, saveMapData, loadMapData, updateMapDescription } from './mapsService.js';

const API = '/api/campaigns/testCampaign/maps';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Fixtures mirror server/routes/maps.js response shapes BY NAME (#977/#993).
const MAPS_LIST = { maps: [{ name: 'Dungeon', fileName: 'dungeon.json', slug: 'dungeon', type: 'indoor', isActive: true }] };
const MAP_DATA = { displayName: 'Dungeon', name: 'dungeon', type: 'indoor', gridSize: 20, walls: [], items: [], players: [], fog: [], zoom: 1, panX: 0, panY: 0 };
const http = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('mapsService', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch'); // no default response: an unpinned fetch fails loudly, no real network
    vi.spyOn(console, 'error').mockImplementation(() => {}); // service catch-blocks log; keep suite output clean
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toKebabCase', () => {
    it.each([
      ['My Map', 'my-map'],
      ['UPPER CASE MAP', 'upper-case-map'],
      ['My Map.json', 'my-map'],
      ['map   name', 'map-name'],
      ['Map #1!', 'map-1'],
      ['!my-map!', 'my-map'],
      ['Room 123-A', 'room-123-a'],
      ['already-kebab', 'already-kebab'],
      ['', ''],
      ['!@#$%', ''],
    ])('%s → %s', (input, output) => {
      expect(toKebabCase(input)).toBe(output);
    });
  });

  describe('formatMapName', () => {
    it.each([
      ['dungeon-map', 'Dungeon Map'],
      ['dungeon', 'Dungeon'],
      ['dungeon-map.json', 'Dungeon Map'],
      ['My-Dungeon-Map', 'My Dungeon Map'],
      ['', ''],
      [null, ''],
      [undefined, ''],
    ])('%s → %s', (input, output) => {
      expect(formatMapName(input)).toBe(output);
    });
  });

  describe('transport lanes — fetch bytes exact, envelope consumed verbatim (#1010)', () => {
    it.each([
      ['loadMaps GETs maps-list envelope', () => loadMaps('testCampaign'), API, { method: 'GET', headers: JSON_HEADERS }, 200, MAPS_LIST],
      ['createMap POSTs name with default type indoor', () => createMap('testCampaign', 'Dungeon'), API, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'Dungeon', type: 'indoor' }) }, 201, { message: 'Map created successfully', map: { name: 'Dungeon', fileName: 'dungeon.json' } }],
      ['loadMapData GETs map-data envelope', () => loadMapData('testCampaign', 'Dungeon'), `${API}/dungeon`, { method: 'GET', headers: JSON_HEADERS }, 200, MAP_DATA],
      ['saveMapData PUTs data as exact body bytes', () => saveMapData('testCampaign', 'Dungeon', MAP_DATA), `${API}/dungeon`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(MAP_DATA) }, 200, { message: 'Map saved successfully' }],
      ['deleteMap DELETEs slug with no headers', () => deleteMap('testCampaign', 'Dungeon'), `${API}/dungeon`, { method: 'DELETE' }, 200, { message: 'Map deleted successfully' }],
      ['renameMap PUTs slug/rename with newName body', () => renameMap('testCampaign', 'Old Name', 'New Name'), `${API}/old-name/rename`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ newName: 'New Name' }) }, 200, { message: 'Map renamed successfully', map: { name: 'New Name', fileName: 'new-name.json' } }],
      ['activateMap PUTs slug/activate', () => activateMap('testCampaign', 'Dungeon'), `${API}/dungeon/activate`, { method: 'PUT', headers: JSON_HEADERS }, 200, { message: 'Map activated successfully', activeMap: 'dungeon' }],
      ['updateMapDescription PUTs slug/description', () => updateMapDescription('testCampaign', 'Dungeon', 'A dark dungeon'), `${API}/dungeon/description`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ description: 'A dark dungeon' }) }, 200, { message: 'Map description updated successfully' }],
    ])('%s', async (_title, invoke, url, options, status, body) => {
      global.fetch.mockResolvedValueOnce(http(status, body));

      const result = await invoke();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(url, options);
      expect(result).toEqual(body);
    });

    it('createMap merges options over defaults into the body bytes', async () => {
      const options = { type: 'outdoor', gridSize: 30, terrain: {} };
      global.fetch.mockResolvedValueOnce(http(201, { message: 'Map created successfully', map: { name: 'Wilds', fileName: 'wilds.json' } }));

      await createMap('testCampaign', 'Wilds', options);

      expect(fetch).toHaveBeenCalledWith(
        API,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'Wilds', ...options }) }
      );
    });

    it('percent-encodes campaign names and slugs map names before building the URL', async () => {
      global.fetch.mockResolvedValueOnce(http(200, MAPS_LIST));
      await loadMaps('Ice Cave');
      expect(fetch).toHaveBeenLastCalledWith('/api/campaigns/Ice%20Cave/maps', { method: 'GET', headers: JSON_HEADERS });

      global.fetch.mockResolvedValueOnce(http(200, { message: 'Map deleted successfully' }));
      await deleteMap('Ice Cave', 'Ice Cave');
      expect(fetch).toHaveBeenLastCalledWith('/api/campaigns/Ice%20Cave/maps/ice-cave', { method: 'DELETE' });
    });

    // Backlog maps-list-slug: loadMaps surfaces `slug` on every row — server
    // value passes through verbatim; legacy rows without it gain fileName minus .json.
    it('loadMaps surfaces slug on every row (passthrough + fileName back-fill)', async () => {
      global.fetch.mockResolvedValueOnce(http(200, MAPS_LIST));
      const fresh = await loadMaps('testCampaign');
      expect(fresh.maps[0].slug).toBe('dungeon');
      expect(fresh.maps[0]).toBe(MAPS_LIST.maps[0]); // server rows untouched (identity)

      const legacy = { maps: [{ name: 'Old', fileName: 'old-map.json' }] };
      global.fetch.mockResolvedValueOnce(http(200, legacy));
      const back = await loadMaps('testCampaign');
      expect(back.maps[0].slug).toBe('old-map');
    });
  });

  describe('createMap conflict resolves instead of throwing (#945)', () => {
    it.each([
      ['Dungeon', 'dungeon.json'],
      ['My Map', 'my-map.json'],
    ])('%s → alreadyExists object with sanitized fileName', async (name, fileName) => {
      global.fetch.mockResolvedValueOnce(http(400, { error: 'A map with this name already exists' }));

      // error rides along so UI lanes surface the collision instead of
      // swallowing it (bug-map-name-empty-kebab); encounter lane ignores it.
      await expect(createMap('testCampaign', name)).resolves.toEqual({ name, fileName, alreadyExists: true, error: 'A map with this name already exists' });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to generic message when a failed response body cannot be parsed', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } });

      await expect(createMap('testCampaign', 'Dungeon')).rejects.toThrow('Failed to create map');
    });
  });

  describe('error honesty — every lane throws, never swallows (#945)', () => {
    const LANES = [
      ['loadMaps', () => loadMaps('testCampaign')],
      ['createMap', () => createMap('testCampaign', 'Dungeon')],
      ['loadMapData', () => loadMapData('testCampaign', 'Dungeon')],
      ['saveMapData', () => saveMapData('testCampaign', 'Dungeon', MAP_DATA)],
      ['deleteMap', () => deleteMap('testCampaign', 'Dungeon')],
      ['renameMap', () => renameMap('testCampaign', 'Old Name', 'New Name')],
      ['activateMap', () => activateMap('testCampaign', 'Dungeon')],
      ['updateMapDescription', () => updateMapDescription('testCampaign', 'Dungeon', 'desc')],
    ];
    const FALLBACKS = {
      loadMaps: 'Failed to load maps',
      createMap: 'Failed to create map',
      loadMapData: 'Failed to load map data',
      saveMapData: 'Failed to save map data',
      deleteMap: 'Failed to delete map',
      renameMap: 'Failed to rename map',
      activateMap: 'Failed to activate map',
      updateMapDescription: 'Failed to update map description',
    };

    it.each(LANES)('%s propagates the server error message', async (name, invoke) => {
      global.fetch.mockResolvedValueOnce(http(404, { error: 'Map not found' }));

      await expect(invoke()).rejects.toThrow('Map not found');
    });

    it.each(LANES)('%s throws its own generic message when the body has no error field', async (name, invoke) => {
      global.fetch.mockResolvedValueOnce(http(500, {}));

      await expect(invoke()).rejects.toThrow(FALLBACKS[name]);
    });

    it.each(LANES)('%s re-throws network rejects', async (_name, invoke) => {
      global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(invoke()).rejects.toThrow('Failed to fetch');
    });
  });
});
