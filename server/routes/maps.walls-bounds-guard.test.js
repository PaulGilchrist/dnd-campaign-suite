// @maintained-by-ai
// ─── Lane: indoor walls-bounds guard (bug-map-walls-unvalidated-nonstring-row-bricks-map-view) ─
// The whole-doc indoor PUT and the create builder stored ANY `walls` row
// verbatim (live repro: walls + [5] round-tripped with a 200, and one numeric
// row then crashed GridAndWalls `key.split is not a function` on every mount
// and every echo adoption — ErrorBoundary, no in-app recovery while the row
// stayed on disk). The guard mirrors the outdoor terrain convention shipped
// (maps.terrain-bounds-guard.test.js is the pattern twin): refuse BEFORE any
// write with the canonical "Map save rejected: …" 400 naming EVERY offending
// row (capped at 5, rest counted) and the effective (post-clamp) grid bounds,
// rows echoed JSON-stringified so a numeric 5 never reads as the string "5".
// Parse failures and out-of-range strings share the one list. A body with no
// trustworthy grid (absent/null gridSize — the sanctioned clear) keeps the
// SHAPE check but skips BOUNDS (the pruneRevealedToGrid asymmetry). Store
// hygiene rides the same seam (QE backlog 2026-11-24): duplicate rows dedupe
// deterministically (first occurrence wins) on BOTH write lanes instead of
// doubling every payload forever, and a save that SHRINKS (or clamps) the
// stored grid prunes out-of-new-grid wall rows the way pruneRevealedToGrid
// prunes revealed — malformed rows are never silently dropped. The indoor
// whole-doc PUT is already GM-only, so no visitor echo lane exists to protect
// (the outdoor doc's party-travel echo is not policed for walls either — the
// hex builder never stores them). Harness mirrors
// maps.terrain-bounds-guard.test.js (foreign-Host via .set('Host', FOREIGN_HOST)).
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import maps, {
    indoorWallsBoundsError, dedupeWallsRows, pruneWallsToShrunkGrid,
} from './maps.js';

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
const HALL_FILE = `${MAPS_DIR}/hall.json`;

// 12-grid indoor doc shaped like the repro sandbox: a walled x=9 column and a
// single token. walls rows are canonical "gx,gy" strings inside 12×12.
const storedIndoor = (walls = ['9,0', '9,1', '9,2']) => ({
    displayName: 'Hall',
    name: 'hall',
    type: 'indoor',
    gridSize: 12,
    walls,
    placedItems: [],
    items: [],
    players: [{ id: 'feyranger', name: 'FeyRanger', gridX: 2, gridY: 2 }],
    revealed: [],
    fog: [],
});

function seedHallDoc(doc = storedIndoor()) {
    mockFsState.exists.add(MAPS_DIR);
    mockFsState.files.set(HALL_FILE, JSON.stringify(doc));
    return doc;
}

function readStored(p = HALL_FILE) {
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

describe('maps indoor walls-bounds guard', () => {
    describe('PUT refusal (GM whole-doc leg)', () => {
        it('400s the repro verbatim: walls + numeric 5 — doc not stored, no echo', async () => {
            const original = seedHallDoc();

            const res = await putMap('hall', storedIndoor([...original.walls, 5]));

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Map save rejected: every wall must be a "gx,gy" cell address like "7,2" '
                + 'inside the map\'s 12×12 grid (x 0..11, y 0..11) — 5 is malformed or outside the grid.'
            );
            expect(readStored()).toEqual(original); // zero write
            expect(publishedEvents).toHaveLength(0); // maps/map-data lanes untouched
        });

        it('400s out-of-grid strings naming EVERY offender and the bounds (mixed malformed/out-of-range list in one refusal)', async () => {
            const original = seedHallDoc();

            const res = await putMap('hall', storedIndoor([...original.walls, '999,999', '12,0', 5, '9,3']));

            expect(res.status).toBe(400);
            // repro step 6's control body — ALL three offenders named at once;
            // "9,3" is a legal in-bounds string and stays unlisted.
            expect(res.body.error).toContain('"999,999"');
            expect(res.body.error).toContain('"12,0"');
            expect(res.body.error).toContain(', 5 are malformed or outside the grid.');
            expect(res.body.error).not.toContain('"9,3"');
            expect(res.body.error).toContain('12×12 grid (x 0..11, y 0..11)');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('caps the listing at 5 rows but reports the true count', async () => {
            seedHallDoc();
            const bad = ['0,12', '1,12', '2,12', '3,12', '4,12', '5,12', '6,12']; // 7 offenders

            const res = await putMap('hall', storedIndoor(bad));

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('(+2 more)');
            expect(res.body.error).toContain('"4,12"'); // first five listed
            expect(res.body.error).not.toContain('"5,12"'); // rest only counted
            expect(res.body.error).not.toContain('"6,12"');
        });

        it('refuses rows that are not "gx,gy" addresses at all (negatives, floats, junk, null, objects)', async () => {
            seedHallDoc();

            const res = await putMap('hall', storedIndoor(['-1,0', '1.5,2', 'a,b', null, { gx: 1 }]));

            expect(res.status).toBe(400);
            for (const row of ['"-1,0"', '"1.5,2"', '"a,b"', 'null', '{"gx":1}']) {
                expect(res.body.error).toContain(row);
            }
        });

        it('refuses a non-array walls container in the rivers/roads register (rowKind names it)', async () => {
            seedHallDoc();

            const res = await putMap('hall', storedIndoor({ '9,0': true }));

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Map save rejected: "walls" must be a list of "gx,gy" cell strings like "7,2" — got object.'
            );
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('checks against the EFFECTIVE (post-clamp) grid — a clamped 110 stays 100×100 bounds', async () => {
            seedHallDoc();

            const res = await putMap('hall', storedIndoor(['105,0']));
            // body gridSize 110 clamps to 100 before the bounds check.
            const clamped = await putMap('hall', { ...storedIndoor(['105,0']), gridSize: 110 });

            expect(res.status).toBe(400); // 105 outside the stored 12-grid
            expect(clamped.status).toBe(400);
            expect(clamped.body.error).toContain('100×100 grid (x 0..99, y 0..99)');
            expect(clamped.body.error).toContain('"105,0"');
        });
    });

    describe('PUT acceptance legs', () => {
        it('dedupes duplicate rows deterministically on store (first occurrence wins — nothing stores twice forever)', async () => {
            seedHallDoc();
            const walls = ['0,0', '11,11', '9,3', '9,3', '9,3'];

            const res = await putMap('hall', storedIndoor(walls));

            expect(res.status).toBe(200);
            expect(readStored().walls).toEqual(['0,0', '11,11', '9,3']);
            // the SSE echo carries the SAME deduped rows the disk got.
            const echo = publishedEvents.find((e) => e.key === 'map-data-test-campaign-hall');
            expect(echo.data.walls).toEqual(['0,0', '11,11', '9,3']);
        });

        it('dedupes BEFORE the bounds gate so a repeated malformed row is named once, not twice', async () => {
            seedHallDoc();

            const res = await putMap('hall', storedIndoor(['9,0', 5, 5]));

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('— 5 is malformed or outside the grid.');
            expect(res.body.error).not.toContain('5, 5');
        });

        it('accepts the true grid-corner boundary and refuses the one-past legs on BOTH axes', async () => {
            seedHallDoc();

            const corner = await putMap('hall', storedIndoor(['11,11', '0,0']));
            expect(corner.status).toBe(200);

            const colOverflow = await putMap('hall', storedIndoor(['12,0']));
            expect(colOverflow.status).toBe(400);
            expect(colOverflow.body.error).toContain('"12,0"');

            const rowOverflow = await putMap('hall', storedIndoor(['0,12']));
            expect(rowOverflow.status).toBe(400);
            expect(rowOverflow.body.error).toContain('"0,12"');
        });

        it('passes bodies that carry no walls key or the sanctioned null clear', async () => {
            seedHallDoc(storedIndoor([]));

            const nullClear = await putMap('hall', { ...storedIndoor(), walls: null });
            expect(nullClear.status).toBe(200);
            expect(readStored().walls).toBeNull();
        });

        it('skips BOUNDS when the body carries no trustworthy grid (null gridSize sanctioned clear) but still refuses shape', async () => {
            const original = seedHallDoc({ ...storedIndoor(), gridSize: null });

            const outOfRangeString = await putMap('hall', { ...original, walls: ['999,999'] });
            expect(outOfRangeString.status).toBe(200); // no bounds to police

            const numeric = await putMap('hall', { ...original, walls: ['999,999', 5] });
            expect(numeric.status).toBe(400); // shape is policed regardless
            expect(numeric.body.error).toContain('cell address like "7,2" — 5 is malformed.');
        });

        it('never polices an outdoor document (guard is the indoor lane only — the hex builder never stores walls)', async () => {
            mockFsState.exists.add(MAPS_DIR);
            const outdoor = {
                displayName: 'Wilds', name: 'wilds', type: 'outdoor', gridSize: 40,
                terrain: { '0,0': 'plains' }, rivers: [], roads: [], pois: [],
                zoom: 1, panX: 0, panY: 0, partyPosition: { q: 40, r: 20 },
            };
            mockFsState.files.set(`${MAPS_DIR}/wilds.json`, JSON.stringify(outdoor));

            const res = await putMap('wilds', { ...outdoor, walls: [5, '999,999'] });

            expect(res.status).toBe(200);
        });
    });

    describe('PUT grid-shrink walls prune (pruneRevealedToGrid parity — QE backlog 2026-11-24)', () => {
        it('shrinking the grid prunes walls rows outside the new grid instead of 400-locking the shrink', async () => {
            const wide = { ...storedIndoor(['5,5', '15,15', '19,19']), gridSize: 20 };
            seedHallDoc(wide);

            const res = await putMap('hall', { ...wide, gridSize: 10 });

            expect(res.status).toBe(200);
            const saved = readStored();
            expect(saved.gridSize).toBe(10);
            expect(saved.walls).toEqual(['5,5']); // 15,15 and 19,19 pruned
            const echo = publishedEvents.find((e) => e.key === 'map-data-test-campaign-hall');
            expect(echo.data.walls).toEqual(['5,5']); // broadcast sheds the tail too
        });

        it('the 5..100 clamp counts as a shrink — a legacy 110-doc sheds walls outside the clamped 100 grid', async () => {
            const legacy = { ...storedIndoor(['3,3', '105,5']), gridSize: 110 };
            seedHallDoc(legacy);

            const res = await putMap('hall', legacy); // re-saves 110, clamps to 100

            expect(res.status).toBe(200);
            expect(readStored().gridSize).toBe(100);
            expect(readStored().walls).toEqual(['3,3']);
        });

        it('a shrink sweeps legacy out-of-grid poison strings off disk but still REFUSES malformed rows', async () => {
            const wide = { ...storedIndoor(['15,2', '999,999']), gridSize: 20 };
            seedHallDoc(wide);

            const pruned = await putMap('hall', { ...wide, gridSize: 10 });
            expect(pruned.status).toBe(200); // both valid-shape rows outside 10×10 prune
            expect(readStored().walls).toEqual([]);

            seedHallDoc(wide);
            const malformed = await putMap('hall', { ...wide, gridSize: 10, walls: ['15,2', '999,999', 5] });
            // 15,2 / 999,999 prune; numeric 5 is never silently dropped — the
            // bounds gate names it against the shrunk grid.
            expect(malformed.status).toBe(400);
            expect(malformed.body.error).toContain('10×10 grid (x 0..9, y 0..9)');
            expect(malformed.body.error).toContain('5 is malformed or outside the grid.');
            expect(readStored()).toEqual(wide); // zero write on refusal
        });

        it('an unshrunk save keeps the bounds refusal verbatim (same-grid writes and growth never prune)', async () => {
            seedHallDoc(); // stored grid 12

            const sameGrid = await putMap('hall', storedIndoor(['9,0', '13,0']));
            expect(sameGrid.status).toBe(400); // 13,0 outside the unchanged 12-grid
            expect(sameGrid.body.error).toContain('"13,0"');

            const grown = await putMap('hall', { ...storedIndoor(['9,0', '13,0']), gridSize: 15 });
            expect(grown.status).toBe(200); // growth renders 13,0 — it is legal now
            expect(readStored().walls).toEqual(['9,0', '13,0']);

            const grownStillBad = await putMap('hall', { ...storedIndoor(['16,0']), gridSize: 15 });
            expect(grownStillBad.status).toBe(400); // 16,0 fits NEITHER grid — refuse stands
            expect(grownStillBad.body.error).toContain('"16,0"');
        });

        it('no prune without a trustworthy stored grid (create-via-PUT keeps the refusal; the sanctioned null clear stays unpoliced)', async () => {
            // Fresh doc (no stored file): nothing to shrink FROM — refuse stands.
            mockFsState.exists.add(MAPS_DIR);
            const fresh = await putMap('hall', storedIndoor(['999,999']));
            expect(fresh.status).toBe(400);
            expect(mockFsState.files.has(HALL_FILE)).toBe(false);

            // Stored grid null → no trustworthy prior bounds → prune skips,
            // and the body's null grid skips BOUNDS as before.
            const nullGrid = { ...storedIndoor(['999,999']), gridSize: null };
            seedHallDoc(nullGrid);
            const cleared = await putMap('hall', nullGrid);
            expect(cleared.status).toBe(200);
            expect(readStored().walls).toEqual(['999,999']);
        });

        it('never polices an outdoor document for walls on a shrink either (the guard is the indoor lane)', async () => {
            mockFsState.exists.add(MAPS_DIR);
            const outdoor = {
                displayName: 'Wilds', name: 'wilds', type: 'outdoor', gridSize: 40,
                terrain: { '0,0': 'plains' }, rivers: [], roads: [], pois: [],
                zoom: 1, panX: 0, panY: 0, partyPosition: { q: 40, r: 20 },
                walls: ['50,50'],
            };
            mockFsState.files.set(`${MAPS_DIR}/wilds.json`, JSON.stringify(outdoor));

            const res = await putMap('wilds', { ...outdoor, gridSize: 10 });

            expect(res.status).toBe(200);
            expect(readStored(`${MAPS_DIR}/wilds.json`).walls).toEqual(['50,50']);
        });
    });

    describe('visitor origin — authority answer first', () => {
        it('still 403s a foreign-Host indoor PUT carrying malformed walls (shape guard never flips the origin face)', async () => {
            const original = seedHallDoc();

            const res = await putMap('hall', storedIndoor([...original.walls, 5]), true);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(readStored()).toEqual(original);
        });
    });

    describe('POST create lane (indoor builder takes body.walls verbatim)', () => {
        const postMap = (body) =>
            request(createTestApp()).post('/api/campaigns/test-campaign/maps').send(body);

        it('400s an indoor create carrying a malformed/out-of-range walls row — no file written', async () => {
            mockFsState.exists.add(MAPS_DIR);

            const res = await postMap({ name: 'QA Walls', type: 'indoor', gridSize: 12, walls: ['9,0', 5] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('12×12 grid (x 0..11, y 0..11)');
            expect(res.body.error).toContain('5');
            expect(mockFsState.files.has(`${MAPS_DIR}/qa-walls.json`)).toBe(false);
        });

        it('201s a create with in-range walls (boundary corner included) and an absent-walls default', async () => {
            mockFsState.exists.add(MAPS_DIR);

            const corner = await postMap({ name: 'QA Walls', type: 'indoor', gridSize: 12, walls: ['11,11'] });
            expect(corner.status).toBe(201);
            expect(readStored(`${MAPS_DIR}/qa-walls.json`).walls).toEqual(['11,11']);

            const bare = await postMap({ name: 'QA Bare', type: 'indoor' });
            expect(bare.status).toBe(201);
            expect(readStored(`${MAPS_DIR}/qa-bare.json`).walls).toEqual([]);
        });

        it('dedupes duplicate create rows on store (first occurrence wins)', async () => {
            mockFsState.exists.add(MAPS_DIR);

            const res = await postMap({
                name: 'QA Dups', type: 'indoor', gridSize: 12,
                walls: ['3,4', '9,3', '3,4', '9,0', '3,4'],
            });

            expect(res.status).toBe(201);
            expect(readStored(`${MAPS_DIR}/qa-dups.json`).walls).toEqual(['3,4', '9,3', '9,0']);
        });
    });

    describe('indoorWallsBoundsError helper', () => {
        it('returns null for absent/null walls and every clean document', () => {
            expect(indoorWallsBoundsError({ gridSize: 12 })).toBeNull();
            expect(indoorWallsBoundsError({ gridSize: 12, walls: null })).toBeNull();
            expect(indoorWallsBoundsError({ gridSize: 12, walls: [] })).toBeNull();
            expect(indoorWallsBoundsError({ gridSize: 12, walls: ['0,0', '11,11'] })).toBeNull();
            expect(indoorWallsBoundsError({ gridSize: '12', walls: ['999,999'] })).toBeNull(); // untrusted grid, shape clean
        });

        it('names the single offender with singular grammar', () => {
            const message = indoorWallsBoundsError({ gridSize: 12, walls: ['12,0'] });
            expect(message).toContain('"12,0" is malformed or outside the grid.');
        });
    });

    describe('walls store-hygiene helpers', () => {
        it('dedupeWallsRows keeps first occurrences in order and returns the SAME object when nothing changes', () => {
            const clean = { walls: ['1,1', '2,2'] };
            expect(dedupeWallsRows(clean)).toBe(clean);
            expect(dedupeWallsRows({ walls: [] })).toEqual({ walls: [] });
            expect(dedupeWallsRows({ walls: null })).toEqual({ walls: null });
            expect(dedupeWallsRows(undefined)).toBeUndefined();

            const duped = dedupeWallsRows({ walls: ['3,4', '9,3', '3,4'] });
            expect(duped.walls).toEqual(['3,4', '9,3']);
        });

        it('dedupeWallsRows compares by raw value — numeric 5 and string "5" stay distinct for the gate', () => {
            const mixed = dedupeWallsRows({ walls: [5, '5', 5] });
            expect(mixed.walls).toEqual([5, '5']);
        });

        it('pruneWallsToShrunkGrid only fires on a trustworthy shrink (growth, same size, null/absent prior all no-op identity)', () => {
            const doc = { gridSize: 10, walls: ['2,2', '15,15'] };
            expect(pruneWallsToShrunkGrid(doc, 10)).toBe(doc); // no shrink
            expect(pruneWallsToShrunkGrid(doc, 5)).toBe(doc); // growth
            expect(pruneWallsToShrunkGrid(doc, null)).toBe(doc); // no prior bounds
            expect(pruneWallsToShrunkGrid(doc, '20')).toBe(doc); // untrusted prior
            expect(pruneWallsToShrunkGrid({ gridSize: null, walls: ['15,15'] }, 20))
                .toEqual({ gridSize: null, walls: ['15,15'] }); // no effective grid

            const shrunk = pruneWallsToShrunkGrid(doc, 20);
            expect(shrunk.walls).toEqual(['2,2']);
        });

        it('pruneWallsToShrunkGrid never drops malformed rows — they ride on for the bounds gate to name', () => {
            const doc = { gridSize: 10, walls: [5, '999,999', -1] };
            expect(pruneWallsToShrunkGrid(doc, 20).walls).toEqual([5, -1]);
            expect(indoorWallsBoundsError(pruneWallsToShrunkGrid(doc, 20)))
                .toContain('5, -1 are malformed or outside the grid.');
        });
    });
});
