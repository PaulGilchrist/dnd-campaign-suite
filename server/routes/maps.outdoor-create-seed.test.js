// @maintained-by-ai
// maps.outdoor-create-seed.test.js — SD backlog 2026-11-12: the generate-terrain
// modal now sends the generator's effective seed in the create body, but the
// outdoor create builder is a whitelist and silently DROPPED body.seed, so a
// terrain map could never be reproduced from its document on disk (indoor
// already threaded seed: body.seed). The builder gained the same passthrough.
// Mock harness mirrors maps.outdoor-create-party-position.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps.outdoor-create-party-position.test.js) ──────────────

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

describe('maps — outdoor create threads the generator seed (SD 2026-11-12)', () => {
    afterEach(clearMocks);

    beforeEach(() => {
        MOCK_FS.set(MAPS_DIR, []);
    });

    it('outdoor create stores body.seed verbatim (42)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'sd-seed', type: 'outdoor', gridSize: 30, seed: 42 });

        expect(res.status).toBe(201);
        const doc = storedDoc('sd-seed.json');
        expect(doc.type).toBe('outdoor');
        expect(doc.seed).toBe(42);
    });

    it('outdoor create honours a falsy-but-valid seed 0 (stored as 0, not null)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'sd-zero', type: 'outdoor', gridSize: 30, seed: 0 });

        expect(res.status).toBe(201);
        expect(storedDoc('sd-zero.json').seed).toBe(0);
    });

    it('outdoor create WITHOUT a seed stores no seed key (undefined drops from JSON)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'sd-none', type: 'outdoor', gridSize: 30 });

        expect(res.status).toBe(201);
        expect(storedDoc('sd-none.json')).not.toHaveProperty('seed');
    });

    it('indoor create keeps its existing seed passthrough (twin-modals symmetry)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'sd-indoor', type: 'indoor', gridSize: 20, seed: 0 });

        expect(res.status).toBe(201);
        expect(storedDoc('sd-indoor.json').seed).toBe(0);
    });
});
