// @maintained-by-ai
// ─── Lane: map CREATE gridSize clamp echo (backlog LLL 2026-11-21) ──────────────
// The PUT twin's saveResponse (6572a5456) already reports the STORED post-clamp
// gridSize + a `clamped` flag, but the create lane stayed echo-silent: POSTing
// gridSize 110 stored 100 while the 201 body said nothing. The create response
// now mirrors the same law — `gridSize` carries the stored value, `clamped`
// flags a replaced REQUEST number only. The create builders run the same
// clampGridSize helper, and explicit null is the sanctioned clear on BOTH
// lanes (stored + echoed verbatim). An ABSENT key takes the documented default
// (20) — create is the canonicalization seam, so unlike PUT's never-invent
// omission it always stores (and honestly echoes) a value; `clamped:false`
// there flags that no request number was replaced. The existing 201 +
// {message, map:{name,fileName,slug}} shape is unchanged — fields are ADDED.
// Mock harness mirrors maps.put-gridsize-clamp.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => MOCK_FS.has(path) || MOCK_FS.has(path + '.json')),
        readFileSync: vi.fn((path) => {
            const content = MOCK_FS.get(path);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            // Raw strings pass through verbatim so a write→read round-trip
            // (the GET witnessing the create's writeFileSync bytes) is honest.
            return typeof content === 'string' ? content : JSON.stringify(content);
        }),
        writeFileSync: vi.fn((path, data) => {
            MOCK_FS.set(path, data);
        }),
        mkdirSync: vi.fn((path) => {
            MOCK_FS.set(path, { __directory__: true });
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
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// Parse the document actually persisted by the create route (raw writeFileSync
// bytes — exactly what a later GET serves).
const storedDoc = (slug) => JSON.parse(MOCK_FS.get(`${MAPS_DIR}/${slug}.json`));

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(MAPS_DIR, []);
    vi.clearAllMocks();
});

describe('maps POST create — honest gridSize clamp echo (LLL 2026-11-21)', () => {
    it.each([
        ['110 clamps to 100', 110, 100, true],
        ['2 clamps up to 5', 2, 5, true],
        ['in-range 37 stores verbatim', 37, 37, false],
        ['lower boundary 5 stores verbatim', 5, 5, false],
        ['upper boundary 100 stores verbatim', 100, 100, false],
    ])('%s — body echoes gridSize %i, clamped %s', async (_label, sent, expected, clamped) => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: `ce-${sent}`, type: 'indoor', gridSize: sent });

        expect(res.status).toBe(201);
        // The 201 body echoes the STORED (post-clamp) value — no follow-up GET
        // needed — and never claims the requested value a clamp replaced.
        expect(res.body.gridSize).toBe(expected);
        expect(res.body.clamped).toBe(clamped);

        // Disk agrees with the echo.
        expect(storedDoc(`ce-${sent}`).gridSize).toBe(expected);
        const fetched = await request(createTestApp())
            .get(`/api/campaigns/test-campaign/maps/ce-${sent}`);
        expect(fetched.status).toBe(200);
        expect(fetched.body.gridSize).toBe(expected);
    });

    it('string "80" stores numeric 80 and echoes clamped:false (flag polices numbers only — coercion law shared with PUT)', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'ce-string', type: 'indoor', gridSize: '80' });

        expect(res.status).toBe(201);
        expect(res.body.gridSize).toBe(80);
        expect(res.body.clamped).toBe(false);
        expect(storedDoc('ce-string').gridSize).toBe(80);
    });

    it('explicit null gridSize is the sanctioned clear — stored and echoed null, clamped:false (mirrors PUT)', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'ce-null', type: 'indoor', gridSize: null });

        expect(res.status).toBe(201);
        expect(res.body.gridSize).toBeNull();
        expect(res.body.clamped).toBe(false);
        expect(storedDoc('ce-null').gridSize).toBeNull();
    });

    it('absent gridSize takes the documented default 20 and echoes it honestly (create always canonicalizes)', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'ce-absent', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(storedDoc('ce-absent').gridSize).toBe(20);
        expect(res.body.gridSize).toBe(20);
        expect(res.body.clamped).toBe(false);
    });

    it('the echo ADDS to the existing shape: 201 body keeps message + map {name,fileName,slug}', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Clamp Shape', type: 'indoor', gridSize: 110 });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Map created successfully');
        expect(res.body.map).toEqual({
            name: 'Clamp Shape',
            fileName: 'clamp-shape.json',
            slug: 'clamp-shape',
        });
        expect(res.body.gridSize).toBe(100);
        expect(res.body.clamped).toBe(true);
    });

    it('outdoor create echoes the clamp too, party pin centred on the CLAMPED grid', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'ce-outdoor', type: 'outdoor', gridSize: 110 });

        expect(res.status).toBe(201);
        expect(res.body.gridSize).toBe(100);
        expect(res.body.clamped).toBe(true);
        const doc = storedDoc('ce-outdoor');
        expect(doc.gridSize).toBe(100);
        // Centre of the derived 2×gridSize hexCols × gridSize hexRows grid.
        expect(doc.partyPosition).toEqual({ q: 100, r: 50 });
    });
});
