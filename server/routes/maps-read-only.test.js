// @maintained-by-ai
/**
 * Regression lock for bug-player-clients-clobber-fog-reset — server-side
 * defense-in-depth for the map-document route guard. Indoor map documents are
 * GM-authored: a non-localhost (network) client may READ them (players render
 * the fogged grid) but may not WRITE them. Live, a LAN player tab auto-PUT the
 * whole indoor document and silently resurrected fog the GM had reset. The route
 * now 403s indoor PUT/delete/rename/activate/description from non-localhost.
 *
 * Outdoor hex documents keep their whole-document PUT open from any origin: that
 * PUT is the party-travel persistence lane (this bug does not touch outdoor maps),
 * pinned here so the guard stays surgical. GETs stay open to every client.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();
let publishedEvents = [];

function setupFs(path, content) {
  if (content === null) MOCK_FS.delete(path);
  else MOCK_FS.set(path, content);
}

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p) => MOCK_FS.has(p) || MOCK_FS.has(`${p}.json`)),
    readFileSync: vi.fn((p) => {
      const c = MOCK_FS.get(p);
      if (c === undefined) throw new Error(`ENOENT ${p}`);
      return JSON.stringify(c);
    }),
    writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
    readdirSync: vi.fn((dir) => MOCK_FS.get(dir) || []),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn((p) => { MOCK_FS.delete(p); }),
  },
}));

vi.mock('../utils/campaignPaths.js', () => ({
  campaignMapsDir: vi.fn((c) => `/mock/campaigns/${c}/maps`),
  normalizeMapFile: vi.fn((n) => (n.endsWith('.json') ? n : `${n}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
  publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
  activeMaps: {
    get: vi.fn((c) => MOCK_ACTIVE_MAPS.get(c)),
    set: vi.fn((c, v) => { MOCK_ACTIVE_MAPS.set(c, v); }),
    delete: vi.fn((c) => { MOCK_ACTIVE_MAPS.delete(c); }),
  },
  markDirty: vi.fn(),
  characterChangeData: new Map(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(maps);
  return app;
}

beforeEach(() => {
  MOCK_FS.clear();
  MOCK_ACTIVE_MAPS.clear();
  publishedEvents = [];
});

describe('maps route — read-only (non-localhost) authority gate', () => {
  const INDOOR = { name: 'test-map', type: 'indoor', gridSize: 20, walls: ['10,5'], revealed: [] };

  it('GET stays open to a network client (players render the fogged grid)', async () => {
    setupFs(`${MAPS_DIR}/test-map.json`, INDOOR);
    const res = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/test-map').set('Host', '10.0.0.5');
    expect(res.status).toBe(200);
    expect(res.body.revealed).toEqual([]);
  });

  it('PUT of an INDOOR map from a non-localhost client ⇒ 403, document untouched', async () => {
    setupFs(`${MAPS_DIR}/test-map.json`, INDOOR);
    const stale = { ...INDOOR, revealed: ['0,0', '1,1', '2,2'] };

    const res = await request(createTestApp())
      .put('/api/campaigns/test-campaign/maps/test-map')
      .set('Host', '10.0.0.5')
      .send(stale);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/GM-only/i);
    expect(MOCK_FS.get(`${MAPS_DIR}/test-map.json`).revealed).toEqual([]); // NOT clobbered
    expect(publishedEvents.find((e) => e.key === 'map-data-test-campaign-test-map')).toBeUndefined();
  });

  it('PUT of an INDOOR map from localhost (GM) persists and broadcasts', async () => {
    setupFs(`${MAPS_DIR}/test-map.json`, INDOOR);
    const gmEdit = { ...INDOOR, revealed: ['1,1'] };

    const res = await request(createTestApp())
      .put('/api/campaigns/test-campaign/maps/test-map')
      .set('Host', 'localhost')
      .send(gmEdit);

    expect(res.status).toBe(200);
    expect(MOCK_FS.get(`${MAPS_DIR}/test-map.json`).revealed).toEqual(['1,1']);
    expect(publishedEvents.find((e) => e.key === 'map-data-test-campaign-test-map')).toBeTruthy();
  });

  it('PUT of an OUTDOOR hex map from a network client stays open (party-travel lane)', async () => {
    setupFs(`${MAPS_DIR}/wilds.json`, { name: 'wilds', type: 'outdoor', gridSize: 20, partyPosition: { q: 3, r: 4 } });
    const moved = { name: 'wilds', type: 'outdoor', gridSize: 20, partyPosition: { q: 6, r: 8 } };

    const res = await request(createTestApp())
      .put('/api/campaigns/test-campaign/maps/wilds')
      .set('Host', '10.0.0.5')
      .send(moved);

    expect(res.status).toBe(200);
    expect(MOCK_FS.get(`${MAPS_DIR}/wilds.json`).partyPosition).toEqual({ q: 6, r: 8 });
  });

  it.each([
    ['delete', (app) => app.delete('/api/campaigns/test-campaign/maps/test-map')],
    ['rename', (app) => app.put('/api/campaigns/test-campaign/maps/test-map/rename').send({ newName: 'other' })],
    ['activate', (app) => app.put('/api/campaigns/test-campaign/maps/test-map/activate')],
    ['description', (app) => app.put('/api/campaigns/test-campaign/maps/test-map/description').send({ description: 'x' })],
  ])('%s of an INDOOR map from a non-localhost client ⇒ 403', async (_label, run) => {
    setupFs(`${MAPS_DIR}/test-map.json`, INDOOR);
    const res = await run(request(createTestApp())).set('Host', '10.0.0.5');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/GM-only/i);
  });

  it('unknown-type document PUT from a network client is deny-safe (treated as indoor)', async () => {
    // No disk file yet, and the body declares no outdoor type.
    const res = await request(createTestApp())
      .put('/api/campaigns/test-campaign/maps/mystery')
      .set('Host', '10.0.0.5')
      .send({ name: 'mystery', gridSize: 20, walls: [] });
    expect(res.status).toBe(403);
  });
});
