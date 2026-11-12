// @maintained-by-ai
// maps.create-generation-opts.test.js — UF backlog 2026-11-12: map docs kept only
// seed + generationMode, so the Room-Adjacent/Terrain options used to author a
// map evaporated with the modal and the document alone could never re-derive
// its own dungeon. The modals now stamp the full EFFECTIVE options object in
// the create body, and both create builders (whitelists) pass `generationOpts`
// through verbatim. Mock harness mirrors maps.outdoor-create-seed.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps.outdoor-create-seed.test.js) ─────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();

function clearMocks() {
    MOCK_FS.clear();
    MOCK_ACTIVE_MAPS.clear();
}

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => MOCK_FS.has(path) || MOCK_FS.has(path + '.json')),
        readFileSync: vi.fn((path) => {
            const content = MOCK_FS.get(path);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            return typeof content === 'string' ? content : JSON.stringify(content);
        }),
        writeFileSync: vi.fn((path, data) => {
            MOCK_FS.set(path, data);
        }),
        readdirSync: vi.fn((dirPath) => {
            const entries = MOCK_FS.get(dirPath);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        mkdirSync: vi.fn((dirPath) => {
            MOCK_FS.set(dirPath, { __directory__: true });
        }),
        unlinkSync: vi.fn((path) => {
            MOCK_FS.delete(path);
        }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/maps`),
    normalizeMapFile: vi.fn((name) => (name.endsWith('.json') ? name : `${name}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    activeMaps: {
        get: vi.fn((campaign) => MOCK_ACTIVE_MAPS.get(campaign)),
        set: vi.fn((campaign, value) => {
            MOCK_ACTIVE_MAPS.set(campaign, value);
        }),
        delete: vi.fn((campaign) => {
            MOCK_ACTIVE_MAPS.delete(campaign);
        }),
    },
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

// Parse the document actually persisted by the create route (raw writeFileSync
// bytes — exactly what a later GET serves).
const storedDoc = (fileName) => JSON.parse(MOCK_FS.get(`${MAPS_DIR}/${fileName}`));

// The exact effective-opts shape the Room-Adjacent modal stamps (min/maxRoom
// spans already derived, density already divided by 100).
const ADJACENT_OPTS = {
    mode: 'adjacent',
    roomSize: 'spacious',
    gridSize: 20,
    density: 0.6,
    seed: 42,
    roomCount: 10,
    corridorLength: 'sprawling',
    layoutStyle: 'winding',
    minRoom: 5,
    maxRoom: 15,
};

describe('maps — create threads generationOpts (UF 2026-11-12)', () => {
    afterEach(clearMocks);

    beforeEach(() => {
        MOCK_FS.set(MAPS_DIR, []);
    });

    it('indoor create stores body.generationOpts verbatim (nested keys intact)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'uf-adjacent', type: 'indoor', gridSize: 20, seed: 42, generationOpts: ADJACENT_OPTS });

        expect(res.status).toBe(201);
        const doc = storedDoc('uf-adjacent.json');
        expect(doc.generationOpts).toEqual(ADJACENT_OPTS);
        // Existing top-level laws untouched: seed/generationMode stay as before.
        expect(doc.seed).toBe(42);
    });

    it('outdoor create stores body.generationOpts verbatim (terrain twin)', async () => {
        const app = createTestApp();
        const terrainOpts = { mode: 'terrain', gridSize: 35, seed: 7 };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'uf-terrain', type: 'outdoor', gridSize: 35, seed: 7, generationOpts: terrainOpts });

        expect(res.status).toBe(201);
        const doc = storedDoc('uf-terrain.json');
        expect(doc.generationOpts).toEqual(terrainOpts);
        expect(doc.seed).toBe(7);
    });

    it('create WITHOUT generationOpts stores no generationOpts key (honest absence, undefined drops from JSON)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'uf-plain', type: 'indoor', gridSize: 20 });

        expect(res.status).toBe(201);
        expect(storedDoc('uf-plain.json')).not.toHaveProperty('generationOpts');
    });

    it('generationOpts seed 0 survives falsy-checks verbatim (both builders)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({
                name: 'uf-zero',
                type: 'outdoor',
                gridSize: 30,
                generationOpts: { mode: 'terrain', gridSize: 30, seed: 0 },
            });

        expect(res.status).toBe(201);
        expect(storedDoc('uf-zero.json').generationOpts.seed).toBe(0);
    });
});
