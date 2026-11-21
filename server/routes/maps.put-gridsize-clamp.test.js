// @maintained-by-ai
// ─── Lane: whole-doc PUT gridSize clamp (backlog JII 2026-11-21) ───────────────
// create clamps 5..100 (clampGridSize, maps.js) but the whole-document save
// lane used to store any integer VERBATIM — a gridSize of 110 lived on disk, so
// the fog-iteration blow-up the create clamp guards (0..gridSize-1 per render)
// was reachable through PUT: two rules for one field. The PUT now runs the
// same clampGridSize helper before the write. In-range values (boundaries 5
// and 100) store verbatim; out-of-range clamp (110→100, 2→5); the GET and the
// SSE echo both carry the stored (clamped) value; a body that OMITS the key
// keeps it omitted (never-invent, mirroring the erasure-guard asymmetry).
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';

const MOCK_FS = new Map();
let publishedEvents = [];

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => MOCK_FS.has(path)),
        readFileSync: vi.fn((path) => {
            const content = MOCK_FS.get(path);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            // Raw strings pass through verbatim so a write→read round-trip
            // (the clamp + prune reading its own writeFileSync bytes) is honest.
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
    publish: vi.fn((key, data, campaign) => {
        publishedEvents.push({ key, data, campaign });
    }),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const mapsDir = '/mock/campaigns/test-campaign/maps';
const FILE = `${mapsDir}/grid-map.json`;

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// Minimal indoor doc/envelope that every PUT guard passes: stored fields all
// ride the required set (type/gridSize/walls/placedItems), players is an array
// on both sides.
function seedIndoor(stored = {
    displayName: 'Grid Map',
    name: 'grid-map',
    type: 'indoor',
    gridSize: 20,
    walls: [],
    placedItems: [],
    players: [],
}) {
    MOCK_FS.set(mapsDir, []);
    MOCK_FS.set(FILE, stored);
}

function putIndoor(body) {
    return request(createTestApp())
        .put('/api/campaigns/test-campaign/maps/grid-map')
        .send({ displayName: 'Grid Map', name: 'grid-map', type: 'indoor', walls: [], placedItems: [], players: [], ...body });
}

function getIndoor() {
    return request(createTestApp()).get('/api/campaigns/test-campaign/maps/grid-map');
}

beforeEach(() => {
    MOCK_FS.clear();
    publishedEvents = [];
    vi.clearAllMocks();
});

describe('maps PUT — gridSize clamp parity with create (JII 2026-11-21)', () => {
    it.each([
        ['in-range 20 stores verbatim', 20, 20],
        ['lower boundary 5 stores verbatim', 5, 5],
        ['upper boundary 100 stores verbatim', 100, 100],
        ['110 clamps to 100', 110, 100],
        ['2 clamps to 5', 2, 5],
    ])('%s', async (_label, sent, expected) => {
        seedIndoor();

        const res = await putIndoor({ gridSize: sent });
        expect(res.status).toBe(200);

        expect(JSON.parse(MOCK_FS.get(FILE)).gridSize).toBe(expected);

        // The GET reflects the STORED (clamped) value…
        const fetched = await getIndoor();
        expect(fetched.status).toBe(200);
        expect(fetched.body.gridSize).toBe(expected);

        // …and so does the SSE echo (post-guard document is broadcast).
        const echo = publishedEvents.find((e) => e.key === 'map-data-test-campaign-grid-map');
        expect(echo?.data.gridSize).toBe(expected);
    });

    it('clamps the outdoor save lane too (GM whole-doc PUT)', async () => {
        MOCK_FS.set(mapsDir, []);
        MOCK_FS.set(FILE, {
            displayName: 'Grid Map', name: 'grid-map', type: 'outdoor',
            gridSize: 8, terrain: {}, pois: [],
        });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/grid-map')
            .send({
                type: 'outdoor', displayName: 'Grid Map', gridSize: 110,
                terrain: {}, rivers: [], roads: [], pois: [],
                partyPosition: { q: 3, r: 4 },
            });
        expect(res.status).toBe(200);
        expect(JSON.parse(MOCK_FS.get(FILE)).gridSize).toBe(100);
    });

    it('prunes revealed cells against the CLAMPED grid in the same pass', async () => {
        seedIndoor();

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/grid-map')
            .send({
                displayName: 'Grid Map', name: 'grid-map', type: 'indoor',
                gridSize: 110, walls: [], placedItems: [], players: [],
                revealed: ['50,50', '105,3'],
            });
        expect(res.status).toBe(200);

        const saved = JSON.parse(MOCK_FS.get(FILE));
        expect(saved.gridSize).toBe(100);
        // 105,3 is out of bounds for the clamped 100-grid — pruned, not stored.
        expect(saved.revealed).toEqual(['50,50']);
    });

    it('a body that omits gridSize keeps it omitted (never invents the field)', async () => {
        seedIndoor({ displayName: 'Grid Map', name: 'grid-map', type: 'indoor', walls: [], placedItems: [], players: [] });

        const res = await putIndoor({});
        expect(res.status).toBe(200);
        expect(MOCK_FS.get(FILE)).not.toContain('gridSize');
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('an explicit null gridSize stays the sanctioned clear (clamp polices values, not presence)', async () => {
        seedIndoor();

        const res = await putIndoor({ gridSize: null });
        expect(res.status).toBe(200);
        expect(JSON.parse(MOCK_FS.get(FILE)).gridSize).toBeNull();
    });
});
