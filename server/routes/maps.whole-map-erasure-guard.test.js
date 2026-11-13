// @maintained-by-ai
// ─── Lane: generalized whole-map PUT erasure guard (backlog 2026-11-12 WY) ───
// PUT /maps is a full-object REPLACE, so a body omitting a stored field
// silently erased it — live-observed: an outdoor doc PUT without `type` lost
// it and the LIST builder's `type || 'indoor'` fallback re-routed the hex
// board into the WRONG editor. The players guard pinned the pattern for
// tokens; this lane pins its generalization: per-type required-key sets
// (outdoor type/gridSize/terrain/pois, indoor type/gridSize/walls/
// placedItems) 400 with the same plain-English register and stay byte-inert,
// while an explicit null passes (omission is NOT clearing — same asymmetry),
// the players-guard copy stays byte-identical, and every legitimate full-
// document lane (hex settle envelope, encounter/staging/seed bodies,
// create-via-PUT, legacy docs that never carried a key) keeps working.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { wholeMapErasureError } from './maps.js';

// ─── Mocks (mirrors maps.players-clobber-guard.test.js harness) ──────────────

const MOCK_FS = new Map();

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
    activeMaps: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

function readMockFile(p) {
    const c = MOCK_FS.get(p);
    return JSON.parse(typeof c === 'string' ? c : JSON.stringify(c));
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// Docs shaped like the real stored fixtures (all guarded keys present).
const storedIndoor = () => ({
    displayName: 'Test Map',
    name: 'test-map',
    type: 'indoor',
    gridSize: 20,
    walls: ['10,5'],
    placedItems: [{ id: 'i1', type: 'table', gridX: 3, gridY: 4, visible: true }],
    paintCells: [],
    items: [],
    players: [{ id: 'p1', name: 'Thorin', gridX: 3, gridY: 4 }],
    fog: [],
    revealed: ['3,4'],
});

const storedOutdoor = () => ({
    displayName: 'Wilds',
    name: 'wilds',
    type: 'outdoor',
    gridSize: 20,
    terrain: { '1,1': 'forest' },
    rivers: ['2,2', '3,2'],
    roads: [{ id: 'road-1', hexes: ['4,4', '5,4'] }],
    pois: [{ id: 'poi-1', type: 'town', label: 'Village', q: 6, r: 6, visible: true }],
    zoom: 1,
    panX: 0,
    panY: 0,
    partyPosition: { q: 20, r: 10 },
    weather: null,
    travelState: null,
});

const putMap = (slug, body) =>
    request(createTestApp()).put(`/api/campaigns/test-campaign/maps/${slug}`).send(body);

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(MAPS_DIR, []);
    vi.clearAllMocks(); // publish-call assertions must be per-test
});

describe('maps - generalized whole-map PUT erasure guard', () => {
    describe.each([
        ['indoor', storedIndoor, 'test-map', ['type', 'gridSize', 'walls', 'placedItems']],
        ['outdoor', storedOutdoor, 'wilds', ['type', 'gridSize', 'terrain', 'pois']],
    ])('%s documents', (_type, stored, slug, guardedFields) => {
        it.each(guardedFields)('400s a body omitting "%s" while the stored doc has it — disk byte-inert, no echo', async (field) => {
            const file = `${MAPS_DIR}/${slug}.json`;
            const original = stored();
            MOCK_FS.set(file, original);

            const stripped = { ...original };
            delete stripped[field];

            const res = await putMap(slug, stripped);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/^Map save rejected: a whole-map save must include the /);
            expect(res.body.error).toContain(`"${field}"`);
            expect(readMockFile(file)).toEqual(original); // zero write
            const { publish } = await import('../utils/changeData.js');
            expect(publish).not.toHaveBeenCalledWith(
                `map-data-test-campaign-${slug}`,
                expect.anything(),
                'test-campaign'
            );
        });

        it.each(guardedFields)('passes an explicit null "%s" through (omission is NOT clearing) — 200 + null persisted', async (field) => {
            const file = `${MAPS_DIR}/${slug}.json`;
            MOCK_FS.set(file, stored());

            const res = await putMap(slug, { ...stored(), [field]: null });

            expect(res.status).toBe(200);
            expect(readMockFile(file)[field]).toBeNull();
        });

        it('names EVERY omitted required field in one message', async () => {
            const file = `${MAPS_DIR}/${slug}.json`;
            const original = stored();
            MOCK_FS.set(file, original);

            const stripped = { ...original };
            for (const field of guardedFields) delete stripped[field];

            const res = await putMap(slug, stripped);

            expect(res.status).toBe(400);
            for (const field of guardedFields) expect(res.body.error).toContain(`"${field}"`);
            expect(readMockFile(file)).toEqual(original);
        });

        it('full-document PUT (every guarded key present) still 200s and writes', async () => {
            const file = `${MAPS_DIR}/${slug}.json`;
            MOCK_FS.set(file, stored());

            const res = await putMap(slug, { ...stored(), panX: 7 });

            expect(res.status).toBe(200);
            expect(readMockFile(file).panX).toBe(7);
        });

        it('never polices a key the stored doc never had (legacy minimal doc)', async () => {
            const file = `${MAPS_DIR}/${slug}.json`;
            MOCK_FS.set(file, { displayName: 'Legacy', name: slug, type: originalType(slug), gridSize: 20 });

            const res = await putMap(slug, { displayName: 'Legacy', name: slug, type: originalType(slug), gridSize: 25 });

            expect(res.status).toBe(200);
            expect(readMockFile(file).gridSize).toBe(25);
        });

        it('create-via-PUT (no stored doc) stays open to partial bodies', async () => {
            const res = await putMap('fresh-map', { type: originalType(slug), gridSize: 30, name: 'fresh-map' });

            expect(res.status).toBe(200);
            expect(MOCK_FS.has(`${MAPS_DIR}/fresh-map.json`)).toBe(true);
        });
    });

    it('names the type/gridSize harm in plain English (wrong-editor consequence from the live flatten)', async () => {
        MOCK_FS.set(`${MAPS_DIR}/wilds.json`, storedOutdoor());
        const stripped = { ...storedOutdoor() };
        delete stripped.type;
        delete stripped.gridSize;

        const res = await putMap('wilds', stripped);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(
            'Map save rejected: a whole-map save must include the "type" and "gridSize" fields — '
            + 'without them the map would be reclassified and reopen in the wrong editor; '
            + 'its grid dimensions would be lost.'
        );
    });

    it('players-guard copy stays byte-identical and wins over the general guard', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        const original = storedIndoor();
        MOCK_FS.set(file, original);

        const stripped = { ...original };
        delete stripped.players;
        delete stripped.walls; // both guards would fire — players copy must win verbatim

        const res = await putMap('test-map', stripped);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(
            'Map save rejected: a whole-map save must include the players array — '
            + 'without it every player token would be erased from the map.'
        );
        expect(readMockFile(file)).toEqual(original);
    });

    it('wholeMapErasureError is a pure key-shape test (no stored doc / no missing key → null)', async () => {
        expect(wholeMapErasureError(null, {}, false)).toBeNull();
        expect(wholeMapErasureError({ type: 'indoor' }, { type: 'indoor' }, false)).toBeNull();
        expect(wholeMapErasureError({ type: 'indoor', gridSize: 20 }, { type: 'indoor' }, false))
            .toMatch(/"gridSize"/);
        // Explicit null passes (intentional clear), even for a stored doc that has it.
        expect(wholeMapErasureError({ walls: ['1,1'] }, { walls: null }, false)).toBeNull();
        // Outdoor docs are policed against the OUTDOOR set only (placedItems is indoor-structural).
        expect(wholeMapErasureError({ placedItems: [] }, {}, true)).toBeNull();
        expect(wholeMapErasureError({ pois: [] }, {}, true)).toMatch(/"pois"/);
    });
});

// Slug→type helper for the shared describe.each bodies (keeps the type label
// free so a type/gridSize omission still exercises the OTHER guarded fields).
function originalType(slug) {
    return slug === 'wilds' ? 'outdoor' : 'indoor';
}
