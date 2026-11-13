// @maintained-by-ai
// maps.list-generation-opts.test.js — VX backlog 2026-11-12: the Maps-manager row
// Regenerate face used to lazy-GET every full map document on mount (1800-cell
// terrain docs included) just to read each doc's small generationOpts stamp. The
// list builder now FOLDS that stamp (≤10 keys, verbatim) into the row envelope so
// the face is known at list-render time — while the large doc fields (walls/
// placedItems/terrain/rivers) stay OUT of the list response. Mock harness mirrors
// maps-drafts.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps-drafts.test.js) ───────────────────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p) || MOCK_FS.has(`${p}.json`)),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p) ?? MOCK_FS.get(String(p).replace(/\.json$/, ''));
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return JSON.stringify(c);
        }),
        writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
        readdirSync: vi.fn((dir) => {
            const entries = MOCK_FS.get(dir) || [];
            return entries.map(name => ({ name, isFile: () => name.endsWith('.json') }));
        }),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn((p) => { MOCK_FS.delete(p); }),
        statSync: vi.fn(() => ({ size: 1 })),
        createWriteStream: vi.fn(),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((c) => `/mock/campaigns/${c}/maps`),
    normalizeMapFile: vi.fn((n) => (n.endsWith('.json') ? n : `${n}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    activeMaps: {
        get: vi.fn((c) => MOCK_ACTIVE.get(c)),
        set: vi.fn((c, v) => { MOCK_ACTIVE.set(c, v); }),
        delete: vi.fn((c) => { MOCK_ACTIVE.delete(c); }),
    },
    markDirty: vi.fn(),
    characterChangeData: new Map(),
}));

const MAPS_DIR = '/mock/campaigns/test-campaign/maps';

// The exact effective-opts shape the Room-Adjacent modal stamps (10 keys,
// min/maxRoom already derived) — mirrors the sibling create-side test.
const ADJACENT_OPTS = {
    mode: 'adjacent',
    roomSize: 'standard',
    gridSize: 20,
    density: 0.5,
    seed: 42,
    roomCount: 8,
    corridorLength: 'compact',
    layoutStyle: 'balanced',
    minRoom: 4,
    maxRoom: 8,
};

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

async function listRows() {
    const res = await request(createTestApp())
        .get('/api/campaigns/test-campaign/maps')
        .set('Host', 'localhost');
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.maps.map(m => [m.fileName, m]));
}

describe('maps — GET list folds generationOpts into the row envelope (VX 2026-11-12)', () => {
    beforeEach(() => {
        MOCK_FS.clear();
        MOCK_ACTIVE.clear();
    });

    it('stamped doc: row carries generationOpts verbatim (all 10 keys intact)', async () => {
        MOCK_FS.set(MAPS_DIR, ['gen-cave.json']);
        MOCK_FS.set(`${MAPS_DIR}/gen-cave.json`, {
            displayName: 'Gen Cave',
            type: 'indoor',
            gridSize: 20,
            seed: 42,
            generationOpts: ADJACENT_OPTS,
            walls: [{ x: 1 }],
            placedItems: [{ id: 'i1' }],
        });

        const byFile = await listRows();
        expect(byFile['gen-cave.json'].generationOpts).toEqual(ADJACENT_OPTS);
    });

    it('terrain stamp with seed 0 survives falsy-checks verbatim (3-key shape)', async () => {
        MOCK_FS.set(MAPS_DIR, ['gen-field.json']);
        MOCK_FS.set(`${MAPS_DIR}/gen-field.json`, {
            displayName: 'Gen Field',
            type: 'outdoor',
            gridSize: 30,
            seed: 0,
            generationOpts: { mode: 'terrain', gridSize: 30, seed: 0 },
        });

        const byFile = await listRows();
        expect(byFile['gen-field.json'].generationOpts).toEqual({ mode: 'terrain', gridSize: 30, seed: 0 });
    });

    it('legacy doc without the key: row honestly OMITS generationOpts', async () => {
        MOCK_FS.set(MAPS_DIR, ['battle-arena.json']);
        MOCK_FS.set(`${MAPS_DIR}/battle-arena.json`, {
            displayName: 'Battle Arena',
            type: 'indoor',
            gridSize: 20,
            walls: [],
            revealed: [],
        });

        const byFile = await listRows();
        expect(byFile['battle-arena.json']).not.toHaveProperty('generationOpts');
        expect(byFile['battle-arena.json'].fileName).toBe('battle-arena.json');
    });

    it('big doc fields stay OUT of the list row (whitelisted envelope shape)', async () => {
        MOCK_FS.set(MAPS_DIR, ['gen-field.json']);
        MOCK_FS.set(`${MAPS_DIR}/gen-field.json`, {
            displayName: 'Gen Field',
            type: 'outdoor',
            gridSize: 30,
            generationOpts: { mode: 'terrain', gridSize: 30, seed: 7 },
            terrain: { '0,0': 'forest' },
            rivers: [{ id: 'r1' }],
            walls: [{ x: 1 }],
            placedItems: [{ id: 'i1' }],
        });

        const [row] = Object.values(await listRows());
        for (const big of ['terrain', 'rivers', 'walls', 'placedItems', 'revealed', 'players', 'seed']) {
            expect(row).not.toHaveProperty(big);
        }
        expect(Object.keys(row).sort()).toEqual(
            ['description', 'fileName', 'generationOpts', 'isActive', 'name', 'slug', 'type'],
        );
    });
});
