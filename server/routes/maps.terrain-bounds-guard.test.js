// @maintained-by-ai
// ─── Lane: outdoor terrain-bounds guard (QD backlog 2026-11-24) ─────────────
// The whole-doc outdoor PUT stored OUT-OF-RANGE terrain keys with a 200 (live:
// a hand-added terrain['39,79'] on a grid-40 doc round-tripped; only a later
// Regenerate pruned it). Cells outside the hexCols×hexRows board (hexCols =
// gridSize × GRID_COLS_MULTIPLIER, hexRows = gridSize — the 2:1 hex geometry
// the generator and centrePartyPosition derive, NOT a square 0..gridSize-1
// grid) can never render, paint-match, or be travelled to. The guard 400s
// BEFORE any write, naming every offending key (capped, counting the rest)
// and the expected bounds, on the GM editor-scope legs (PUT + POST create —
// both builders take body.terrain verbatim). Permission semantics are
// untouched: the visitor all-tab travel lane neither gains nor loses — its
// terrain deltas still 403 via outdoorEditorDelta, and its honest echo of a
// historically-stale stored terrain is NOT policed (it merely carries bytes
// it cannot edit). A body without a trustworthy grid (absent/null gridSize —
// the sanctioned clear) skips the check, the pruneRevealedToGrid asymmetry.
// Harness mirrors maps.outdoor-put-editor-guard.test.js (foreign-Host via
// .set('Host', FOREIGN_HOST)).
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { outdoorTerrainBoundsError } from './maps.js';

const mockFsState = { exists: new Set(), files: new Map() };
let publishedEvents = [];

vi.mock('fs', () => {
    const impl = {
        existsSync: vi.fn((p) => mockFsState.exists.has(p) || mockFsState.files.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); }),
    };
    return { default: impl, ...impl };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    normalizeMapFile: (name) => (name.endsWith('.json') ? name : `${name}.json`),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data, campaign) => { publishedEvents.push({ key, data, campaign }); }),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const FOREIGN_HOST = '192.168.0.224';
const MAPS_DIR = '/mock/campaigns/test-campaign/maps';
const HEX_FILE = `${MAPS_DIR}/wilds.json`;

// Grid-40 outdoor doc shaped like the QD quirk's: effective board 80×40
// (q 0..79, r 0..39). Terrain deliberately sparse — the server never demands
// a fully painted grid, only in-range keys.
const storedOutdoor = (terrain = { '0,0': 'plains', '39,39': 'forest', '79,0': 'water' }) => ({
    displayName: 'Wilds',
    name: 'wilds',
    type: 'outdoor',
    gridSize: 40,
    terrain,
    rivers: [],
    roads: [],
    pois: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    partyPosition: { q: 40, r: 20 },
    weather: null,
    travelState: null,
});

function seedHexDoc(doc = storedOutdoor()) {
    mockFsState.exists.add(MAPS_DIR);
    mockFsState.files.set(HEX_FILE, JSON.stringify(doc));
    return doc;
}

function readStored(p = HEX_FILE) {
    return JSON.parse(mockFsState.files.get(p));
}

const putMap = (slug, body, foreign = false) => {
    const req = request(createTestApp()).put(`/api/campaigns/test-campaign/maps/${slug}`);
    return (foreign ? req.set('Host', FOREIGN_HOST) : req).send(body);
};

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

beforeEach(() => {
    mockFsState.exists.clear();
    mockFsState.files.clear();
    publishedEvents = [];
    vi.clearAllMocks();
});

describe('maps outdoor terrain-bounds guard', () => {
    describe('PUT refusal (GM editor-scope leg)', () => {
        it('400s the QD quirk verbatim: terrain["39,79"] on a grid-40 doc — doc not stored, no echo', async () => {
            const original = seedHexDoc();

            const res = await putMap('wilds', storedOutdoor({
                ...original.terrain,
                '39,79': 'forest',
            }));

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/^Map save rejected: every outdoor terrain key must be a "q,r" hex address/);
            expect(res.body.error).toContain('"39,79"');
            expect(res.body.error).toContain('80×40');
            expect(res.body.error).toContain('q 0..79, r 0..39');
            expect(readStored()).toEqual(original); // zero write
            expect(publishedEvents).toHaveLength(0); // maps/map-data lanes untouched
        });

        it('names EVERY offending key in one refusal (up to the cap, counting the rest)', async () => {
            seedHexDoc();
            const bad = { '40,40': 'swamp', '80,39': 'water', '0,40': 'desert' };

            const res = await putMap('wilds', storedOutdoor({ '1,1': 'hills', ...bad }));

            expect(res.status).toBe(400);
            for (const key of Object.keys(bad)) expect(res.body.error).toContain(`"${key}"`);
            expect(res.body.error).toContain('are outside the grid');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('caps the listing at 5 keys but reports the true count', async () => {
            seedHexDoc();
            const bad = {};
            for (let i = 41; i <= 47; i++) bad[`${i},40`] = 'water'; // 7 off-grid rows

            const res = await putMap('wilds', storedOutdoor(bad));

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('(+2 more)');
            expect(res.body.error.match(/"\d+,\d+"/g)).toHaveLength(5);
        });

        it('refuses keys that are not "q,r" addresses at all (malformed ≠ in-range)', async () => {
            seedHexDoc();

            const res = await putMap('wilds', storedOutdoor({
                '0,0': 'plains',
                'a,b': 'forest',
                '1,2,3': 'water',
                '-1,0': 'swamp',
                '1.5,2': 'hills',
            }));

            expect(res.status).toBe(400);
            for (const key of ['"a,b"', '"1,2,3"', '"-1,0"', '"1.5,2"']) {
                expect(res.body.error).toContain(key);
            }
            expect(readStored().terrain['0,0']).toBe('plains'); // untouched
        });

        it('checks against the EFFECTIVE (post-clamp) grid — a clamped 4 stays 10×5 bounds', async () => {
            const original = seedHexDoc({ ...storedOutdoor({ '9,4': 'plains' }), gridSize: 5 });

            const res = await putMap('wilds', { ...original, gridSize: 4, terrain: { '10,0': 'water' } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('10×5 hex grid (q 0..9, r 0..4)');
            expect(res.body.error).toContain('"10,0"');
        });
    });

    describe('PUT acceptance legs', () => {
        it('round-trips all in-range terrain verbatim', async () => {
            seedHexDoc();
            const terrain = { '0,0': 'plains', '39,20': 'forest', '79,39': 'water' };

            const res = await putMap('wilds', storedOutdoor(terrain));

            expect(res.status).toBe(200);
            expect(readStored().terrain).toEqual(terrain);
        });

        it('accepts the true grid-corner boundary and refuses the one-past legs on BOTH axes', async () => {
            seedHexDoc();

            const corner = await putMap('wilds', storedOutdoor({ '79,39': 'forest', '39,39': 'hills' }));
            expect(corner.status).toBe(200);

            const colOverflow = await putMap('wilds', storedOutdoor({ '80,39': 'forest' }));
            expect(colOverflow.status).toBe(400);
            expect(colOverflow.body.error).toContain('"80,39"');

            const rowOverflow = await putMap('wilds', storedOutdoor({ '79,40': 'forest' }));
            expect(rowOverflow.status).toBe(400);
            expect(rowOverflow.body.error).toContain('"79,40"');
        });

        it('skips the check when the body carries no trustworthy grid (null/absent gridSize sanctioned clear)', async () => {
            const original = seedHexDoc({ ...storedOutdoor(), gridSize: null });

            const res = await putMap('wilds', { ...original, terrain: { '39,79': 'forest' } });

            expect(res.status).toBe(200);
            expect(readStored().terrain).toEqual({ '39,79': 'forest' });
        });

        it('never polices an indoor document (guard is the named outdoor hex lane only)', async () => {
            mockFsState.exists.add(MAPS_DIR);
            mockFsState.files.set(`${MAPS_DIR}/hall.json`, JSON.stringify({
                displayName: 'Hall', name: 'hall', type: 'indoor', gridSize: 5,
                walls: [], placedItems: [], players: [],
            }));

            const res = await putMap('hall', {
                displayName: 'Hall', name: 'hall', type: 'indoor', gridSize: 5,
                walls: [], placedItems: [], players: [],
                terrain: { '99,99': 'forest' },
            });

            expect(res.status).toBe(200);
        });
    });

    describe('visitor all-tab travel lane — permission semantics unchanged', () => {
        it('still accepts the terrain-echoing party-travel PUT even when the STORED doc carries a historical off-grid key (echoes are not policed)', async () => {
            const stale = storedOutdoor({ '0,0': 'plains', '39,79': 'forest' });
            seedHexDoc(stale);

            const res = await putMap('wilds', { ...stale, panX: -40, partyPosition: { q: 9, r: 4 } }, true);

            expect(res.status).toBe(200);
            expect(readStored().panX).toBe(-40);
            expect(readStored().terrain).toEqual(stale.terrain); // carried verbatim, neither pruned nor refused
        });

        it('still 403s a visitor terrain delta with the canonical GM-only copy (refusal never replaces the authority gate)', async () => {
            const original = seedHexDoc();

            const res = await putMap('wilds', storedOutdoor({ ...original.terrain, '5,5': 'swamp' }), true);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(readStored()).toEqual(original);
        });

        it('a visitor cannot smuggle an out-of-range key past the 403 either', async () => {
            seedHexDoc();

            const res = await putMap('wilds', storedOutdoor({ '5,50': 'swamp' }), true);

            expect(res.status).toBe(403); // authority answer first — shape guard never flips the origin face
        });
    });

    describe('POST create lane (builder takes body.terrain verbatim)', () => {
        const postMap = (body) =>
            request(createTestApp()).post('/api/campaigns/test-campaign/maps').send(body);

        it('400s an outdoor create carrying an out-of-range terrain key — no file written', async () => {
            mockFsState.exists.add(MAPS_DIR);

            const res = await postMap({ name: 'QA Bounds', type: 'outdoor', gridSize: 40, terrain: { '39,79': 'forest' } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('"39,79"');
            expect(res.body.error).toContain('q 0..79, r 0..39');
            expect(mockFsState.files.has(`${MAPS_DIR}/qa-bounds.json`)).toBe(false);
        });

        it('201s a create with in-range terrain (boundary corner included)', async () => {
            mockFsState.exists.add(MAPS_DIR);

            const res = await postMap({ name: 'QA Bounds', type: 'outdoor', gridSize: 40, terrain: { '79,39': 'plains' } });

            expect(res.status).toBe(201);
            expect(readStored(`${MAPS_DIR}/qa-bounds.json`).terrain).toEqual({ '79,39': 'plains' });
        });
    });

    describe('outdoorTerrainBoundsError helper', () => {
        it('returns null for absent/non-object terrain and untrusted grids', () => {
            expect(outdoorTerrainBoundsError({ gridSize: 40 })).toBeNull();
            expect(outdoorTerrainBoundsError({ gridSize: 40, terrain: null })).toBeNull();
            expect(outdoorTerrainBoundsError({ gridSize: 40, terrain: [] })).toBeNull();
            expect(outdoorTerrainBoundsError({ gridSize: 0, terrain: { '9,9': 'water' } })).toBeNull();
            expect(outdoorTerrainBoundsError({ gridSize: '40', terrain: { '9,9': 'water' } })).toBeNull();
        });

        it('names the single offender with singular grammar', () => {
            const message = outdoorTerrainBoundsError({ gridSize: 40, terrain: { '39,79': 'forest' } });
            expect(message).toContain('"39,79" is outside the grid.');
        });
    });
});
