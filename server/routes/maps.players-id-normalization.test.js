// @maintained-by-ai
// ─── Lane: players[] token-id normalization (backlog 2026-11-04 CQ) ───────────
// The full-doc map save lanes used to persist `players[]` entries with no
// `id` verbatim — the editor then mounted with React duplicate-key errors
// (Players.jsx keys the token layer on player.id; token hygiene is
// "id = lowercased name"). Both the PUT and the POST create now run the
// shared normalizePlayerIds helper BEFORE the write: id-less entries gain
// their lowercased name, collisions gain a deterministic `-2`/`-3` suffix,
// valid ids pass through byte-unchanged, and an entry from which no id can
// be derived 400s with the canonical "Map save rejected: …" tone and zero
// writes. Harness mirrors maps.players-clobber-guard.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { normalizePlayerIds } from './maps.js';

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
    vi.clearAllMocks();
});

describe('maps - players[] token-id normalization (PUT lane)', () => {
    it('assigns the lowercased name as id to an id-less entry; valid-id entries pass through untouched', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({
                ...storedIndoor(),
                players: [
                    { id: 'p1', name: 'Thorin', gridX: 3, gridY: 4 },
                    { name: 'ElderPaladin', gridX: 5, gridY: 5, type: 'player' },
                ],
            });

        expect(res.status).toBe(200);
        expect(readMockFile(file).players).toEqual([
            { id: 'p1', name: 'Thorin', gridX: 3, gridY: 4 },
            { id: 'elderpaladin', name: 'ElderPaladin', gridX: 5, gridY: 5, type: 'player' },
        ]);
    });

    it('treats empty-string and non-string ids as missing (normalized from name)', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({
                ...storedIndoor(),
                players: [{ id: '', name: 'FeyRanger' }, { id: 7, name: 'KB' }],
            });

        expect(res.status).toBe(200);
        expect(readMockFile(file).players.map(p => p.id)).toEqual(['feyranger', 'kb']);
    });

    it('duplicate names (and duplicate existing ids) get deterministic suffixed unique ids', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({
                ...storedIndoor(),
                players: [
                    { name: 'Thorin', gridX: 1, gridY: 1 },
                    { name: 'Thorin', gridX: 2, gridY: 2 },
                    { name: 'Thorin', gridX: 3, gridY: 3 },
                    { id: 'p1', name: 'A' },
                    { id: 'p1', name: 'B' },
                ],
            });

        expect(res.status).toBe(200);
        const ids = readMockFile(file).players.map(p => p.id);
        expect(ids).toEqual(['thorin', 'thorin-2', 'thorin-3', 'p1', 'p1-2']);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('refuses (400) an entry with neither usable id nor non-empty name — disk inert, no echo', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        const original = storedIndoor();
        MOCK_FS.set(file, original);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...original, players: [{ gridX: 1, gridY: 1 }, { gridX: 2, gridY: 2 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/^Map save rejected: /);
        expect(res.body.error).toMatch(/entry 0/);
        expect(readMockFile(file)).toEqual(original);
        const { publish } = await import('../utils/changeData.js');
        expect(publish).not.toHaveBeenCalled();
    });

    it('refuses (400) a blank-name entry and a non-object entry with the canonical message', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const blank = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: [{ name: '   ' }] });
        expect(blank.status).toBe(400);
        expect(blank.body.error).toMatch(/has neither/);

        const strays = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: ['Thorin'] });
        expect(strays.status).toBe(400);
        expect(strays.body.error).toMatch(/was string/);
        // Disk still carries the original single token (both refusals inert).
        expect(readMockFile(file).players).toEqual([{ id: 'p1', name: 'Thorin', gridX: 3, gridY: 4 }]);
    });

    it('GET after a normalized PUT returns the normalized array (ids persisted to disk)', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: [{ name: 'ElderPaladin', gridX: 5, gridY: 5 }] });
        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(200);
        expect(res.body.players).toEqual([{ name: 'ElderPaladin', gridX: 5, gridY: 5, id: 'elderpaladin' }]);
    });

    it('clean documents are untouched: valid-id PUT writes byte-identical players (same-object pass-through)', async () => {
        const file = `${MAPS_DIR}/test-map.json`;
        MOCK_FS.set(file, storedIndoor());

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ ...storedIndoor(), players: [{ id: 'p1', name: 'Thorin', gridX: 8, gridY: 9 }] });

        expect(res.status).toBe(200);
        expect(readMockFile(file).players).toEqual([{ id: 'p1', name: 'Thorin', gridX: 8, gridY: 9 }]);
    });

    it('normalizePlayerIds is pure: no players key / empty array / clean array return the SAME object', async () => {
        expect(normalizePlayerIds(undefined).mapData).toBeUndefined();
        const noPlayers = { type: 'indoor' };
        expect(normalizePlayerIds(noPlayers).mapData).toBe(noPlayers);
        const empty = { players: [] };
        expect(normalizePlayerIds(empty).mapData).toBe(empty);
        const clean = { players: [{ id: 'a' }, { id: 'b' }] };
        expect(normalizePlayerIds(clean).mapData).toBe(clean);
        expect(normalizePlayerIds(clean).error).toBeNull();
    });
});

describe('maps - players[] token-id normalization (POST create lane)', () => {
    it('create with id-less players writes normalized lowercased-name ids', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({
                name: 'Token Map',
                type: 'indoor',
                players: [{ name: 'ElderPaladin', gridX: 1, gridY: 1 }, { name: 'ElderPaladin', gridX: 2, gridY: 2 }],
            });

        expect(res.status).toBe(201);
        expect(readMockFile(`${MAPS_DIR}/token-map.json`).players.map(p => p.id)).toEqual(['elderpaladin', 'elderpaladin-2']);
    });

    it('create with a name-less, id-less entry 400s and writes no file', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Bad Map', type: 'indoor', players: [{ gridX: 1, gridY: 1 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/^Map save rejected: /);
        expect(MOCK_FS.has(`${MAPS_DIR}/bad-map.json`)).toBe(false);
    });
});
