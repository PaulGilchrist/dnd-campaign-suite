// @maintained-by-ai
// maps.outdoor-create-party-position.test.js — JT backlog 2026-11-11: POST
// create of an OUTDOOR map used to store no partyPosition (the client only
// seeds a centre at editor-open), so an API-only rig had to follow the create
// with a whole-doc PUT just to place the party. The create now stamps the
// documented centre of the derived hexCols×hexRows grid (cols = gridSize ×
// GRID_COLS_MULTIPLIER, rows = gridSize — gridSize 20 → 40×20 → {q:20,r:10}),
// honours an explicit body.partyPosition verbatim, and leaves INDOOR docs
// untouched (no partyPosition key at all). Mock harness mirrors
// maps.create-display-name.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps.create-display-name.test.js) ────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();
let publishedEvents = [];

function clearMocks() {
    MOCK_FS.clear();
    MOCK_ACTIVE_MAPS.clear();
    publishedEvents = [];
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
    publish: vi.fn((key, data) => {
        publishedEvents.push({ key, data });
    }),
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

// Parse the document actually persisted by the create route.
const storedDoc = (fileName) => JSON.parse(MOCK_FS.get(`${MAPS_DIR}/${fileName}`));

describe('maps — outdoor create stamps centre partyPosition (JT 2026-11-11)', () => {
    afterEach(clearMocks);

    beforeEach(() => {
        MOCK_FS.set(MAPS_DIR, []);
    });

    it('outdoor create WITHOUT partyPosition stamps the grid centre (20 → 40×20 → {q:20,r:10})', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-stamp', type: 'outdoor', gridSize: 20 });

        expect(res.status).toBe(201);
        const doc = storedDoc('jt-stamp.json');
        expect(doc.type).toBe('outdoor');
        expect(doc.gridSize).toBe(20);
        expect(doc.partyPosition).toEqual({ q: 20, r: 10 });
    });

    it.each([
        [5, { q: 5, r: 2 }],
        [15, { q: 15, r: 7 }],
        [100, { q: 100, r: 50 }],
    ])('centre stamp tracks the clamped gridSize (%s → hexCols 2×rows %s)', async (gridSize, centre) => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-size', type: 'outdoor', gridSize });

        expect(res.status).toBe(201);
        expect(storedDoc('jt-size.json').partyPosition).toEqual(centre);
    });

    it('missing gridSize falls back to the create default (20) and stamps its centre', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-default', type: 'outdoor' });

        expect(res.status).toBe(201);
        const doc = storedDoc('jt-default.json');
        expect(doc.gridSize).toBe(20);
        expect(doc.partyPosition).toEqual({ q: 20, r: 10 });
    });

    it('an explicit body.partyPosition is stored verbatim (never overwritten)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({
                name: 'jt-explicit',
                type: 'outdoor',
                gridSize: 20,
                partyPosition: { q: 3, r: 7 },
            });

        expect(res.status).toBe(201);
        expect(storedDoc('jt-explicit.json').partyPosition).toEqual({ q: 3, r: 7 });
    });

    it('null partyPosition counts as absent and gets the centre stamp', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-null', type: 'outdoor', gridSize: 20, partyPosition: null });

        expect(res.status).toBe(201);
        expect(storedDoc('jt-null.json').partyPosition).toEqual({ q: 20, r: 10 });
    });

    it('indoor create is untouched — no partyPosition key on the doc', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-indoor', type: 'indoor', gridSize: 20 });

        expect(res.status).toBe(201);
        const doc = storedDoc('jt-indoor.json');
        expect(doc.type).toBe('indoor');
        expect(doc).not.toHaveProperty('partyPosition');
    });

    it('indoor create ignores an outdoor-style partyPosition in the body', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-indoor-pp', type: 'indoor', partyPosition: { q: 1, r: 2 } });

        expect(res.status).toBe(201);
        expect(storedDoc('jt-indoor-pp.json')).not.toHaveProperty('partyPosition');
    });

    it('marchingOrder is trip data — never stamped at create', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'jt-order', type: 'outdoor', gridSize: 20 });

        expect(res.status).toBe(201);
        expect(storedDoc('jt-order.json')).not.toHaveProperty('marchingOrder');
    });
});
