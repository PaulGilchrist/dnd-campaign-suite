// @maintained-by-ai
/**
 * Campaign-authoring plan Phase 3 — draft maps are invisible to players and
 * unactivatable until approved: an AI-drafted map document must never reach
 * the table through the list, a name probe, or the activate lane.
 */
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';

const MOCK_FS = new Map();
const MOCK_ACTIVE = new Map();

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
        statSync: vi.fn(() => ({ size: 1 })),
        createWriteStream: vi.fn(),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((c) => `/mock/campaigns/${c}/maps`),
    normalizeMapFile: vi.fn((n) => (n.endsWith('.json') ? n : `${n}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    activeMaps: {
        get: vi.fn((c) => MOCK_ACTIVE.get(c)),
        set: vi.fn((c, v) => { MOCK_ACTIVE.set(c, v); }),
        delete: vi.fn((c) => { MOCK_ACTIVE.delete(c); }),
    },
    markDirty: vi.fn(),
    characterChangeData: new Map(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';
const PLAIN = { name: 'Test Map', displayName: 'Test Map', type: 'indoor', gridSize: 20, walls: [], revealed: [] };
const DRAFT = { name: 'Cult Hideout', displayName: 'Cult Hideout', type: 'indoor', gridSize: 20, walls: [], revealed: [], draft: true };

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_ACTIVE.clear();
    MOCK_FS.set(MAPS_DIR, ['test-map.json', 'cult-hideout.json']);
    MOCK_FS.set(`${MAPS_DIR}/test-map.json`, PLAIN);
    MOCK_FS.set(`${MAPS_DIR}/cult-hideout.json`, DRAFT);
});

describe('maps route draft handling', () => {
    it('GM list carries the draft flag; LAN list omits draft rows entirely', async () => {
        const gm = await request(createTestApp()).get('/api/campaigns/test-campaign/maps').set('Host', 'localhost');
        expect(gm.body.maps.map(m => m.fileName)).toEqual(['cult-hideout.json', 'test-map.json']);
        expect(gm.body.maps.find(m => m.fileName === 'cult-hideout.json').draft).toBe(true);

        const lan = await request(createTestApp()).get('/api/campaigns/test-campaign/maps').set('Host', '10.0.0.5');
        expect(lan.body.maps.map(m => m.fileName)).toEqual(['test-map.json']);
    });

    it('draft document 404s to LAN exactly like a missing map', async () => {
        const lan = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/cult-hideout').set('Host', '10.0.0.5');
        expect(lan.status).toBe(404);
        expect(lan.body).toEqual({ error: 'Map not found' });
        const gm = await request(createTestApp()).get('/api/campaigns/test-campaign/maps/cult-hideout').set('Host', 'localhost');
        expect(gm.status).toBe(200);
        expect(gm.body.draft).toBe(true);
    });

    it('activate refuses a draft map even for the GM — approve first', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/cult-hideout/activate')
            .set('Host', 'localhost');
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/still a draft/);
        expect(MOCK_ACTIVE.size).toBe(0);
    });

    it('approved maps activate normally for the GM', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/test-map/activate')
            .set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(MOCK_ACTIVE.get('test-campaign')).toBe('test-map');
    });
});
