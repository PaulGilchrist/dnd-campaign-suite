// @maintained-by-ai
// ─── Lane: map rivers/roads row-shape guard (backlog 2026-11-02 BD) ──────────
// PUT /maps accepted object rows in `rivers`: the doc persisted, RiverLayer's
// parseHexKey threw `key.split is not a function` on EVERY later open, and the
// ErrorBoundary "Reload the view" loop could only be healed by API surgery
// (POST create silently accepted anything too). The write seams now 400 with
// the canonical shape spelled out and leave the stored doc byte-unchanged;
// every valid editor/party lane must round-trip exactly as before.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { outdoorRowsShapeError } from './maps.js';

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

const storedOutdoor = () => ({
    displayName: 'Wilds',
    name: 'wilds',
    type: 'outdoor',
    gridSize: 10,
    terrain: { '1,1': 'forest' },
    rivers: ['2,2', '3,2'],
    roads: [{ id: 'road-1', hexes: ['4,4', '5,4'] }],
    pois: [{ id: 'poi-1', type: 'town', label: 'Village', q: 6, r: 6, visible: true }],
    zoom: 1,
    panX: 0,
    panY: 0,
});

const putWilds = (body) =>
    request(createTestApp()).put('/api/campaigns/test-campaign/maps/wilds').send(body);

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(MAPS_DIR, []);
    vi.clearAllMocks(); // publish-call assertions must be per-test
});

describe('maps - outdoor rivers/roads row-shape guard (PUT)', () => {
    it('400s an object row in rivers with the expected-shape copy — stored doc byte-unchanged, no echo', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        const original = storedOutdoor();
        MOCK_FS.set(file, original);

        const res = await putWilds({ ...original, rivers: [{ q: 3, r: 2 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Map save rejected/);
        expect(res.body.error).toMatch(/every river must be a "q,r" hex-key string like "7,2" — entry 0 was object/);
        expect(readMockFile(file)).toEqual(original);
        const { publish } = await import('../utils/changeData.js');
        expect(publish).not.toHaveBeenCalled();
    });

    it('400s a non-array rivers value and comma-less / non-integer rows', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        MOCK_FS.set(file, storedOutdoor());

        const legs = [
            [riversAs('not-an-array'), /"rivers" must be a list of hex keys/],
            [riversAs(['ab,cd']), /entry 0 was string/],
            [riversAs(['1.5,2']), /entry 0 was string/],
            [riversAs(['1']), /entry 0 was string/],
        ];
        for (const [body, copy] of legs) {
            const res = await putWilds(body);
            expect(res.status, JSON.stringify(body.rivers)).toBe(400);
            expect(res.body.error).toMatch(copy);
        }
        expect(readMockFile(file).rivers).toEqual(['2,2', '3,2']);
    });

    it('400s malformed roads rows: string row, object row without hexes, object hex in hexes', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        const original = storedOutdoor();
        MOCK_FS.set(file, original);

        const legs = [
            [{ roads: ['4,4,5,4'] }, /every road must be an object shaped \{ id, hexes/],
            [{ roads: [{ id: 'road-1' }] }, /road entry 0 must carry "hexes"/],
            [{ roads: [{ id: 'road-1', hexes: [{ q: 4, r: 4 }, '5,4'] }] }, /road hex must be a "q,r" hex-key string .* — road entry 0 hex 0 was object/],
            [{ roads: 'x' }, /"roads" must be a list of objects/],
        ];
        for (const [patch, copy] of legs) {
            const res = await putWilds({ ...original, ...patch });
            expect(res.status, JSON.stringify(patch)).toBe(400);
            expect(res.body.error).toMatch(copy);
        }
        expect(readMockFile(file)).toEqual(original);
    });

    it('valid editor round-trip (terrain + rivers + roads + pois) still 200s and writes verbatim', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        MOCK_FS.set(file, storedOutdoor());

        const edited = {
            ...storedOutdoor(),
            terrain: { '1,1': 'forest', '2,3': 'hills' },
            rivers: ['2,2', '3,2', '-1,4'],
            roads: [{ id: 'road-1', hexes: ['4,4', '5,4', '6,4'] }, { hexes: ['0,0', '1,0'] }],
            pois: [...storedOutdoor().pois, { id: 'poi-2', type: 'dungeon', label: 'Vault', q: 0, r: 9, visible: true }],
        };
        const res = await putWilds(edited);

        expect(res.status).toBe(200);
        expect(readMockFile(file)).toEqual(edited);
    });

    it('does not over-validate: party-lane echo without rivers/roads keys stays open (200)', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        MOCK_FS.set(file, storedOutdoor());

        const body = storedOutdoor();
        delete body.rivers;
        delete body.roads;
        const res = await putWilds({ ...body, partyPosition: { q: 2, r: 2 } });

        expect(res.status).toBe(200);
        expect(readMockFile(file).partyPosition).toEqual({ q: 2, r: 2 });
    });

    it('id-less legacy road rows and negative integer keys pass the guard', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        MOCK_FS.set(file, storedOutdoor());

        const res = await putWilds({
            ...storedOutdoor(),
            rivers: ['-3,-4'],
            roads: [{ hexes: ['-1,-1', '0,0'] }],
        });
        expect(res.status).toBe(200);
        expect(readMockFile(file).rivers).toEqual(['-3,-4']);
    });
});

describe('maps - outdoor rivers/roads row-shape guard (POST create)', () => {
    it('400s a create whose body carries a malformed rivers/roads row — no file written', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'QA Junk Hex', type: 'outdoor', gridSize: 10, rivers: [{ q: 1, r: 2 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/every river must be a "q,r" hex-key string/);
        expect(MOCK_FS.has(`${MAPS_DIR}/qa-junk-hex.json`)).toBe(false);
    });

    it('valid create bodies (with or without rivers keys) still 201', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'QA Good Hex', type: 'outdoor', gridSize: 10, rivers: ['1,2'], roads: [{ id: 'r', hexes: ['1,2', '2,2'] }] });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(`${MAPS_DIR}/qa-good-hex.json`)).toBe(true);
    });
});

describe('maps - outdoorRowsShapeError is a pure row-shape probe', () => {
    it('nulls for absent bodies, never mutates, names the first offender', () => {
        expect(outdoorRowsShapeError(undefined)).toBeNull();
        expect(outdoorRowsShapeError({})).toBeNull();
        expect(outdoorRowsShapeError({ rivers: null, roads: undefined })).toBeNull();
        expect(outdoorRowsShapeError({ rivers: [], roads: [] })).toBeNull();
        expect(outdoorRowsShapeError({ rivers: ['1,2'], roads: [{ id: 'a', hexes: ['1,2'] }] })).toBeNull();
        expect(outdoorRowsShapeError({ rivers: [42] })).toMatch(/entry 0 was number/);
        // rivers is reported before roads when both are malformed
        expect(outdoorRowsShapeError({ rivers: [{}], roads: ['x'] })).toMatch(/every river must be/);
    });
});

// helper: full outdoor doc with rivers replaced
function riversAs(rivers) {
    return { ...storedOutdoor(), rivers };
}
