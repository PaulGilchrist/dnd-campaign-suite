// @maintained-by-ai
// maps.create-display-name.test.js — FZ backlog 2026-11-09: POST create must
// HONOR an authored body.displayName instead of overwriting it with the raw
// name. The list route already prefers mapContent.displayName; the builders
// (buildIndoorMapData / buildOutdoorMapData) never threaded body.displayName,
// so a harness POSTing {name:'fz-oa', displayName:'FZ OA Rig'} stored
// displayName:'fz-oa' and the manager row rendered the kebab slug.
// Without displayName the behavior is byte-for-byte the old one (name wins).
// Mock harness mirrors maps.empty-kebab-create.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps.empty-kebab-create.test.js) ─────────────────────────

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

describe('maps — create honors body.displayName (FZ 2026-11-09)', () => {
    afterEach(clearMocks);

    beforeEach(() => {
        MOCK_FS.set(MAPS_DIR, []);
    });

    it('indoor create stores displayName verbatim, name stays the kebab slug', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'fz-oa', type: 'indoor', displayName: 'FZ OA Rig' });

        expect(res.status).toBe(201);
        const doc = storedDoc('fz-oa.json');
        expect(doc.displayName).toBe('FZ OA Rig');
        expect(doc.name).toBe('fz-oa');
        expect(doc.type).toBe('indoor');
    });

    it('outdoor create honors displayName with the same rule', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'fz-hex', type: 'outdoor', displayName: 'FZ Hex Rig' });

        expect(res.status).toBe(201);
        const doc = storedDoc('fz-hex.json');
        expect(doc.displayName).toBe('FZ Hex Rig');
        expect(doc.name).toBe('fz-hex');
        expect(doc.type).toBe('outdoor');
    });

    it('trims surrounding whitespace but keeps inner text verbatim (rename-lane rule)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'fz-pad', displayName: '  FZ OA Rig  ' });

        expect(res.status).toBe(201);
        expect(storedDoc('fz-pad.json').displayName).toBe('FZ OA Rig');
    });

    it('create WITHOUT displayName falls back to the trimmed name (regression-safe)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Old Habits', type: 'indoor' });

        expect(res.status).toBe(201);
        const doc = storedDoc('old-habits.json');
        expect(doc.displayName).toBe('Old Habits');
        expect(doc.name).toBe('old-habits');
    });

    it.each([
        ['blank string', '   '],
        ['empty string', ''],
        ['null', null],
        ['number', 42],
        ['object', { label: 'nope' }],
    ])('non-usable displayName (%s) falls back to name', async (_label, displayName) => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'fz-fallback', displayName });

        expect(res.status).toBe(201);
        expect(storedDoc('fz-fallback.json').displayName).toBe('fz-fallback');
    });

    it('the list route surfaces the honored displayName on the row', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'fz-oa', type: 'indoor', displayName: 'FZ OA Rig' });
        MOCK_FS.set(MAPS_DIR, [{ name: 'fz-oa.json', isFile: () => true }]);

        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toHaveLength(1);
        expect(res.body.maps[0]).toMatchObject({ name: 'FZ OA Rig', slug: 'fz-oa' });
    });
});
