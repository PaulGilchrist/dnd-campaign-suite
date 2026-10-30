// @maintained-by-ai
// mapsService.empty-kebab.test.js — regression for bug-map-name-empty-kebab-undeletable-dotfile.
// A map name whose kebab handle is empty (punctuation-only like '!!!', emoji,
// non-Latin scripts) collapses the lane URL to `/maps/` — which the runtime-store
// wildcard DELETE/GET `/:campaign/:key` answers with a false 200 (delete lies,
// open phantom-blanks). Every lane must therefore carry a NON-EMPTY segment:
// kebab when bytes exist, raw name (the row's fileName — e.g. the legacy '.json'
// dotfile) otherwise, loud throw when nothing exists at all.
// Fetch-bytes convention mirrors mapsService.test.js (exact URL + options #1010).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMap, deleteMap, renameMap, activateMap, saveMapData, loadMapData, updateMapDescription } from './mapsService.js';

const API = '/api/campaigns/testCampaign/maps';
const http = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('mapsService — empty-kebab lane segments (bug-map-name-empty-kebab)', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fileName rows never collapse to an empty URL segment', () => {
    // A legacy '.json' dotfile row (display name '!!!' kebabbed to '') still
    // carries its fileName — the lanes must send it, not toKebabCase('') → ''.
    it.each([
      ['deleteMap', () => deleteMap('testCampaign', '.json'), `${API}/.json`, { method: 'DELETE' }],
      ['renameMap', () => renameMap('testCampaign', '.json', 'Fixed Name'), `${API}/.json/rename`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName: 'Fixed Name' }) }],
      ['activateMap', () => activateMap('testCampaign', '.json'), `${API}/.json/activate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } }],
      ['loadMapData', () => loadMapData('testCampaign', '.json'), `${API}/.json`, { method: 'GET', headers: { 'Content-Type': 'application/json' } }],
      ['saveMapData', () => saveMapData('testCampaign', '.json', { name: 'x' }), `${API}/.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' }) }],
      ['updateMapDescription', () => updateMapDescription('testCampaign', '.json', 'd'), `${API}/.json/description`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: 'd' }) }],
    ])('%s with the .json dotfile fileName targets %s (no wildcard collapse)', async (_name, invoke, url, options) => {
      global.fetch.mockResolvedValueOnce(http(200, { message: 'ok' }));

      await invoke();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(url, options);
    });

    it.each([
      ['deleteMap', () => deleteMap('testCampaign', '!!!')],
      ['activateMap', () => activateMap('testCampaign', '!!!')],
      ['loadMapData', () => loadMapData('testCampaign', '!!!')],
    ])('%s with a punctuation-only display name still sends a non-empty segment', async (_name, invoke) => {
      global.fetch.mockResolvedValueOnce(http(404, { error: 'Map not found' }));

      // Honest 404 beats the wildcard's false 200 — and the URL never ends in
      // a bare `/maps/` (! is URL-safe, so the raw name rides through verbatim).
      await expect(invoke()).rejects.toThrow('Map not found');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).not.toMatch(/\/maps\/(\/|$)/);
    });
  });

  describe('fully empty names fail loudly, never mis-route', () => {
    it.each([
      ['deleteMap', () => deleteMap('testCampaign', '')],
      ['renameMap', () => renameMap('testCampaign', '', 'New')],
      ['activateMap', () => activateMap('testCampaign', null)],
      ['loadMapData', () => loadMapData('testCampaign', '')],
      ['saveMapData', () => saveMapData('testCampaign', null, {})],
      ['updateMapDescription', () => updateMapDescription('testCampaign', undefined, 'd')],
    ])('%s with an unusable name throws without fetching', async (_name, invoke) => {
      await expect(invoke()).rejects.toThrow('Map name must contain letters or numbers');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('createMap surfaces the server refusal messages', () => {
    it('rejects with the empty-kebab create-gate message (not a swallow)', async () => {
      global.fetch.mockResolvedValueOnce(http(400, { error: 'Map name must contain letters or numbers' }));

      await expect(createMap('testCampaign', '!!!')).rejects.toThrow('Map name must contain letters or numbers');
    });

    it('kebab-collision duplicate resolves with the server message attached', async () => {
      // '??' while '!!!' exists: both sanitize to the same file handle, the
      // client display-name dup-check misses it, the server answers 400 —
      // the message must survive for the UI to show it.
      global.fetch.mockResolvedValueOnce(http(400, { error: 'A map with this name already exists' }));

      await expect(createMap('testCampaign', '??')).resolves.toEqual({
        name: '??',
        fileName: '.json',
        alreadyExists: true,
        error: 'A map with this name already exists',
      });
    });
  });

  describe('normal maps keep the exact pre-fix bytes (regression pin)', () => {
    it('fileName, slug and display-name inputs all resolve to the kebab segment', async () => {
      const calls = [
        [() => deleteMap('testCampaign', 'battle-arena.json'), `${API}/battle-arena`],
        [() => deleteMap('testCampaign', 'battle-arena'), `${API}/battle-arena`],
        [() => deleteMap('testCampaign', 'Battle Arena'), `${API}/battle-arena`],
      ];
      for (const [invoke, url] of calls) {
        fetch.mockClear();
        global.fetch.mockResolvedValueOnce(http(200, { message: 'Map deleted successfully' }));
        await invoke();
        expect(fetch).toHaveBeenCalledWith(url, { method: 'DELETE' });
      }
    });
  });
});
