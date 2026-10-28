// @maintained-by-ai
// ─── Lane: PUT players-clobber guard (backlog 2026-10-27-M) ───────────────────
// The general map PUT is a full-object replace, so a body missing `players`
// silently erased every PC token from a stored indoor map — the exact
// self-destruct lane the run-M ErrorBoundary rig used (GET full object →
// strip players → PUT → reopen crashes the editor at Players.jsx). The route
// now 400s the erase and stays byte-inert; every valid full-object lane
// (fog-merge, token-move, travelState, create-via-PUT) must keep working.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { erasesStoredPlayers } from './maps.js';

// ─── Mocks (mirrors maps.test.js harness) ────────────────────────────────────

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
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

// Mock FS stores raw strings after a write but accepts seeded objects — read
// either shape back (mirrors maps.test.js's readFileSync normalization).
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

const storedIndoor = () => ({
    displayName: 'Test Map',
    name: 'test-map',
    type: 'indoor',
    gridSize: 20,
    walls: [],
    placedItems: [],
    players: [{ id: 'p1', name: 'Thorin', gridX: 3, gridY: 4 }],
    revealed: ['3,4'],
});

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(MAPS_DIR, []);
    vi.clearAllMocks(); // publish-call assertions must be per-test
});

describe('maps - PUT players-clobber guard', () => {
    it('rejects (400) a full-object body missing players on a stored map that has them — disk inert, no echo', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        const original = storedIndoor();
        MOCK_FS.set(file, original);

        const stripped = { ...original };
        delete stripped.players;

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send(stripped);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toMatch(/players array/i);
        // Byte-inert: the stored document still carries its tokens…
        expect(readMockFile(file)).toEqual(original);
        // …and no SSE echo resurrected the clobber client-side.
        const { publish } = await import('../utils/changeData.js');
        expect(publish).not.toHaveBeenCalledWith(
            'map-data-test-campaign-test-map',
            expect.anything(),
            'test-campaign'
        );
    });

    it('rejects (400) a non-array players value (null) — disk inert', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: null });

        expect(res.status).toBe(400);
        expect(readMockFile(file).players).toHaveLength(1);
    });

    it('valid full-object PUT (players array present, token moved) still 200s and writes', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: [{ id: 'p1', name: 'Thorin', gridX: 8, gridY: 9 }] });

        expect(res.status).toBe(200);
        expect(readMockFile(file).players).toEqual([{ id: 'p1', name: 'Thorin', gridX: 8, gridY: 9 }]);
    });

    it('does not over-validate: stored legacy doc without players + body without players still 200s', async () => {
        const file = `${MAPS_DIR}/legacy.json`;
        MOCK_FS.set(file, { displayName: 'Legacy', name: 'legacy', type: 'indoor', gridSize: 20, walls: [] });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/legacy')
            .send({ displayName: 'Legacy', name: 'legacy', type: 'indoor', gridSize: 25, walls: [] });

        expect(res.status).toBe(200);
        expect(readMockFile(file).gridSize).toBe(25);
    });

    it('outdoor hex travelState lane (stored outdoor, body has no players) stays byte-identical', async () => {
        const file = `${MAPS_DIR}/wilds.json`;
        MOCK_FS.set(file, { displayName: 'Wilds', name: 'wilds', type: 'outdoor', gridSize: 50, terrain: {}, travelState: null });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/wilds')
            .send({ displayName: 'Wilds', name: 'wilds', type: 'outdoor', gridSize: 50, terrain: {}, travelState: { travelMode: 'traveling' } });

        expect(res.status).toBe(200);
        expect(readMockFile(file).travelState).toEqual({ travelMode: 'traveling' });
    });

    it('create-via-PUT (no stored file, auto-encounter lane) stays open', async () => {
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/fresh-encounter')
            .send({ type: 'indoor', gridSize: 30, displayName: 'Fresh Encounter', name: 'fresh-encounter', placedItems: [] });

        expect(res.status).toBe(200);
        expect(MOCK_FS.has(`${MAPS_DIR}/fresh-encounter.json`)).toBe(true);
    });

    it('erasesStoredPlayers is a pure key-shape test (no stored doc or no stored players → never erases)', async () => {
        expect(erasesStoredPlayers(null, { type: 'indoor' })).toBe(false);
        expect(erasesStoredPlayers({ type: 'outdoor', terrain: {} }, { type: 'outdoor' })).toBe(false);
        expect(erasesStoredPlayers({ players: [] }, {})).toBe(true);
        expect(erasesStoredPlayers({ players: [] }, { players: null })).toBe(true);
        expect(erasesStoredPlayers({ players: [] }, { players: [] })).toBe(false);
        expect(erasesStoredPlayers({ players: [] }, undefined)).toBe(true);
    });
});
