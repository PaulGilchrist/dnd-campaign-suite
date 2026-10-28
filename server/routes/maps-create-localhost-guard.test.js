// @maintained-by-ai
// ─── Lane: POST /maps create localhost guard (bug-map-create-no-gm-gate) ─────
// POST was the only map mutation without refuseUnlessGm: a network client
// could create arbitrary map files (and mkdir the maps dir) in any campaign.
// Adjudicated GM-only (Paul 2026-10-28): travel/hex-event resolution is
// GM-driven; the hex encounter-spawn lane never needed the player write —
// live two-tab proof showed the spawn POST fires only from the GM tab (the
// passive client's dialog auto-closes via SSE, zero POSTs), and the lane's
// authoritative content write (the indoor full-document PUT) already 403s
// non-localhost. These cases pin the 403 + disk-inertness for foreign Hosts
// (including the spawn-family name "Travel Encounter Stage" — no narrowed
// exception was granted) and prove localhost creation is unchanged.
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';

const mockFsState = { exists: new Set(), files: new Map() };

// vi.mock factories are hoisted, so the fs mock is spelled out inline
// (default + named), mirroring campaigns-admin-crud-localhost-guard.test.js.
vi.mock('fs', () => {
    const impl = {
        existsSync: vi.fn((p) => mockFsState.exists.has(p) || mockFsState.files.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); }),
    };
    return { default: impl, ...impl };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    normalizeMapFile: (name) => (name.endsWith('.json') ? name : `${name}.json`),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const FOREIGN_HOST = '100.92.171.80';
const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

beforeEach(() => {
    mockFsState.exists.clear();
    mockFsState.files.clear();
    mockFsState.exists.add(MAPS_DIR);
    vi.clearAllMocks();
});

describe('maps POST /api/campaigns/:campaign/maps — localhost guard', () => {
    describe('non-localhost (network client)', () => {
        it('rejects an arbitrary create with 403 and creates zero files', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', FOREIGN_HOST)
                .send({ name: 'zz Gate Probe' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(mockFsState.files.has(`${MAPS_DIR}/zz-gate-probe.json`)).toBe(false);
        });

        it('rejects the spawn-family name too (no narrowed player exception)', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', FOREIGN_HOST)
                .send({ name: 'Travel Encounter Stage', type: 'indoor', gridSize: 30 });
            expect(res.status).toBe(403);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(mockFsState.files.has(`${MAPS_DIR}/travel-encounter-stage.json`)).toBe(false);
        });

        it('runs the gate BEFORE body validation (blank name still 403, not 400)', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', FOREIGN_HOST)
                .send({ name: '   ' });
            expect(res.status).toBe(403);
        });
    });

    describe('localhost (GM)', () => {
        it('still creates an indoor map and broadcasts the maps-list row', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', 'localhost')
                .send({ name: 'QA Create Works', type: 'indoor' });
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Map created successfully');
            expect(res.body.map).toEqual({
                name: 'QA Create Works',
                fileName: 'qa-create-works.json',
                slug: 'qa-create-works',
            });
            expect(fs.writeFileSync).toHaveBeenCalled();
            const written = JSON.parse(mockFsState.files.get(`${MAPS_DIR}/qa-create-works.json`));
            expect(written.displayName).toBe('QA Create Works');
            expect(written.type).toBe('indoor');
            expect(Array.isArray(written.players)).toBe(true);
        });

        it('still creates the GM-side hex encounter spawn map (staging lane name)', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', 'localhost')
                .send({ name: 'Travel Encounter Stage', type: 'indoor', gridSize: 30 });
            expect(res.status).toBe(201);
            expect(mockFsState.files.has(`${MAPS_DIR}/travel-encounter-stage.json`)).toBe(true);
        });

        it('keeps the existing validation lanes (blank name 400, duplicate 400)', async () => {
            const blank = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', 'localhost')
                .send({ name: '  ' });
            expect(blank.status).toBe(400);

            await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', 'localhost')
                .send({ name: 'Dupe Me' });
            const dupe = await request(createTestApp())
                .post('/api/campaigns/test-campaign/maps')
                .set('Host', 'localhost')
                .send({ name: 'Dupe Me' });
            expect(dupe.status).toBe(400);
            expect(dupe.body.error).toBe('A map with this name already exists');
        });
    });
});
