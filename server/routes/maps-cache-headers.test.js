// @maintained-by-ai
// Cache-Control pin for the name-keyed map read lanes (backlog 2026-11-03 CN:
// token positions feed isWithinRange aura gates and range math, so a
// browser-cached map document could one day serve stale tokens). The shared
// noStoreCampaignGets middleware server.js mounts at /api/campaigns covers the
// whole campaign JSON family — this sibling pins the MAP routes specifically,
// on BOTH read methods: GET (the browser fetch lane) and HEAD (the `curl -sI`
// probe face; the middleware was GET-only until this run, so the original
// backlog probe read headerless on HEAD). Mutating lanes stay header-unchanged.
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';
import { noStoreCampaignGets } from '../utils/noStoreApi.js';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p) || MOCK_FS.has(`${p}.json`)),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p) ?? MOCK_FS.get(String(p).replace(/\.json$/, ''));
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return JSON.stringify(c);
        }),
        writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
        readdirSync: vi.fn((dir) => {
            const entries = MOCK_FS.get(dir) || [];
            return entries.map(name => ({ name, isFile: () => name.endsWith('.json') }));
        }),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn((p) => { MOCK_FS.delete(p); }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((c) => `/mock/campaigns/${c}/maps`),
    normalizeMapFile: vi.fn((n) => (n.endsWith('.json') ? n : `${n}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    activeMaps: new Map(),
    markDirty: vi.fn(),
    characterChangeData: new Map(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';
const ARENA = {
    name: 'battle-arena',
    displayName: 'Battle Arena',
    type: 'indoor',
    gridSize: 20,
    walls: [],
    revealed: [],
    players: [{ name: 'AasimarTest', gridX: 15, gridY: 9 }],
};

// Same composition as server.js: shared middleware path-mounted for the
// campaign family BEFORE the router (mapsRoutes carries full /api/campaigns
// paths itself).
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/campaigns', noStoreCampaignGets);
    app.use(maps);
    return app;
}

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(MAPS_DIR, ['battle-arena.json']);
    MOCK_FS.set(`${MAPS_DIR}/battle-arena.json`, ARENA);
});

describe('map JSON GET/HEAD carry Cache-Control: no-store (shared noStoreCampaignGets)', () => {
    it('name-keyed map GET carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/battle-arena');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('HEAD probe of the same lane carries no-store (curl -sI face)', async () => {
        const res = await request(createTestApp()).head('/api/campaigns/test-campaign/maps/battle-arena');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('display-name resolve lane (Battle Arena → battle-arena.json) carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/Battle%20Arena');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('maps LIST GET carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('still carries no-store when the map is gone (404 must not be cached)', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/deleted-map');

        expect(res.status).toBe(404);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('mutating lanes are unchanged — map PUT carries no Cache-Control directive', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/battle-arena')
            .send({ ...ARENA, players: [{ name: 'AasimarTest', gridX: 14, gridY: 9 }] });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBeUndefined();
    });
});
