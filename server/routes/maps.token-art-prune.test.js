// @maintained-by-ai
// ─── Lane: orphaned token-art prune on the whole-doc PUT + DELETE seam (deferred D shipped 2026-11-22; DELETE sweep shipped on bug-map-delete-regenerate-strand-token-art-forever) ─
// The /token-image upload lane writes images/token-<ts>-<rand>.<ext> and the
// placedItems row keeps only that relative path; replace ("upload over
// existing art") and "Remove art" both ride the indoor whole-document PUT,
// which used to orphan the superseded file forever. Now the single save seam
// diffs stored rows vs the incoming document and unlinks what nothing
// references anymore. Pinned faces: replace-prunes, clear-prunes (and row
// deletion prunes), echo/shared-reference KEEPS, non-token assets and
// traversal-shaped paths are never prune candidates, and an unlink failure
// (missing file, EPERM) logs via console.error while the save still answers
// its normal success shape. The map DELETE route (inherited by the Admin
// Regenerate roll through the client's deleteMap) additionally sweeps the
// images dir disk-wide after unlinking the document — the row-diff is blind
// once the doc is gone, so files nothing references anymore are reclaimed
// there. Pinned DELETE faces: last-reference prunes, live cross-map and
// character-document references keep, orphan reclaim, non-token assets
// survive, unreadable live docs fail the whole sweep closed, and no disk
// condition ever fails the delete. In-memory fs
// (maps.put-gridsize-clamp.test.js idiom) — real disk is never touched.
import express from 'express';
import path from 'path';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';
import maps, { orphanedTokenArt } from './maps.js';

const MOCK_FS = new Map();
const unlinkCalls = [];

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p)),
        readFileSync: vi.fn((p) => {
            const content = MOCK_FS.get(p);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${p}'`);
            }
            return typeof content === 'string' ? content : JSON.stringify(content);
        }),
        writeFileSync: vi.fn((p, data) => {
            MOCK_FS.set(p, data);
        }),
        mkdirSync: vi.fn((p) => {
            MOCK_FS.set(p, { __directory__: true });
        }),
        // Lists the BASENAMES of every MOCK_FS entry living inside `p`
        // (files and seeded sub-directory keys alike — callers filter).
        readdirSync: vi.fn((p) => {
            const names = [];
            for (const key of MOCK_FS.keys()) {
                if (key !== p && path.posix.dirname(key) === p) names.push(path.posix.basename(key));
            }
            return names;
        }),
        unlinkSync: vi.fn((p) => {
            unlinkCalls.push(p);
            if (!MOCK_FS.has(p)) {
                throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
            }
            MOCK_FS.delete(p);
        }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/maps`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
    normalizeMapFile: vi.fn((name) => (name.endsWith('.json') ? name : `${name}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const mapsDir = '/mock/campaigns/test-campaign/maps';
const imagesDir = '/mock/campaigns/test-campaign/images';
const campaignRoot = '/mock/campaigns/test-campaign';
const dataDir = `${campaignRoot}/data`;
const FILE = `${mapsDir}/art-map.json`;

const ART_A = 'images/token-1-aaa.png';
const ART_B = 'images/token-2-bbb.png';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// Indoor doc/envelope that every PUT guard passes; `placedItems` carries the
// token rows whose art the prune follows.
function seedIndoor(placedItems = []) {
    MOCK_FS.set(mapsDir, []);
    MOCK_FS.set(FILE, {
        displayName: 'Art Map',
        name: 'art-map',
        type: 'indoor',
        gridSize: 20,
        walls: [],
        placedItems,
        players: [],
    });
}

function putIndoor(body) {
    return request(createTestApp())
        .put('/api/campaigns/test-campaign/maps/art-map')
        .send({
            displayName: 'Art Map',
            name: 'art-map',
            type: 'indoor',
            gridSize: 20,
            walls: [],
            placedItems: [],
            players: [],
            ...body,
        });
}

const tokenRow = (id, imagePath) => ({
    id,
    name: `Token ${id}`,
    type: 'npc',
    x: 1,
    y: 1,
    visible: true,
    ...(imagePath ? { imagePath } : {}),
});

// Seed an upload file on the mock disk so the executor sees it exist.
function seedFile(rel) {
    MOCK_FS.set(path.posix.join(imagesDir, rel.replace(/^images\//, '')), 'PNG');
}

let errorSpy;

beforeEach(() => {
    MOCK_FS.clear();
    unlinkCalls.length = 0;
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

describe('maps PUT — orphaned token-art prune (deferred D)', () => {
    it('replace: swapping a row\'s token upload for a new one unlinks the SUPERSEDED file and saves', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        seedFile(ART_B);

        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_B)] });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map saved successfully');
        expect(unlinkCalls).toEqual([`${imagesDir}/token-1-aaa.png`]);
        // The replacement stays on disk; the document carries the new path.
        expect(MOCK_FS.get(`${imagesDir}/token-2-bbb.png`)).toBe('PNG');
        expect(JSON.parse(MOCK_FS.get(FILE)).placedItems[0].imagePath).toBe(ART_B);
    });

    it('clear: "Remove art" (imagePath stripped from the row) unlinks the upload', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);

        const res = await putIndoor({ placedItems: [tokenRow('t1')] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([`${imagesDir}/token-1-aaa.png`]);
        expect(JSON.parse(MOCK_FS.get(FILE)).placedItems[0]).not.toHaveProperty('imagePath');
    });

    it('row deletion prunes too: a removed placedItems row orphans its upload', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);

        const res = await putIndoor({ placedItems: [] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([`${imagesDir}/token-1-aaa.png`]);
    });

    it('shared reference: a file another row in the SAME payload still points at is NEVER unlinked', async () => {
        seedIndoor([tokenRow('t1', ART_A), tokenRow('t2', ART_A)]);
        seedFile(ART_A);
        seedFile(ART_B);

        // t1 replaces its art; t2 still references A → A must survive.
        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_B), tokenRow('t2', ART_A)] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(true);
    });

    it('shared reference across players[] rows also keeps the file', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);

        // placedItems drops the row, but a players[] row carries the same path.
        const res = await putIndoor({
            placedItems: [],
            players: [{ id: 'p1', name: 'Paladin', imagePath: ART_A }],
        });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
    });

    it('an unchanged echo save unlinks NOTHING (no-op saves never touch the images dir)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);

        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_A)] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(true);
    });

    it('two rows orphaned onto the same path prune it exactly ONCE', async () => {
        seedIndoor([tokenRow('t1', ART_A), tokenRow('t2', ART_A)]);
        seedFile(ART_A);

        const res = await putIndoor({ placedItems: [tokenRow('t1'), tokenRow('t2')] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([`${imagesDir}/token-1-aaa.png`]);
    });

    it('non-token assets are never prune candidates (ElderPaladin.png, urls, emoji-only rows)', async () => {
        seedIndoor([
            tokenRow('t1', 'images/ElderPaladin.png'),
            tokenRow('t2', 'https://cdn.example.com/token-9-zzz.png'),
            tokenRow('t3', 'images/portraits/token-nested.png'),
        ]);
        ['images/ElderPaladin.png', 'images/portraits/token-nested.png'].forEach(seedFile);

        const res = await putIndoor({ placedItems: [tokenRow('t1'), tokenRow('t2'), tokenRow('t3')] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
        expect(MOCK_FS.has(`${imagesDir}/ElderPaladin.png`)).toBe(true);
        expect(MOCK_FS.has(`${imagesDir}/portraits/token-nested.png`)).toBe(true);
    });

    it('traversal-shaped imagePaths refuse to prune (never unlink, never crash the save)', async () => {
        seedIndoor([
            tokenRow('t1', 'images/token-../../outside.png'),
            tokenRow('t2', '../images/token-3-ccc.png'),
            tokenRow('t3', 'images/token-..'),
        ]);
        // Poison targets that MUST survive untouched.
        MOCK_FS.set('/mock/campaigns/outside.png', 'PNG');
        MOCK_FS.set('/images/token-3-ccc.png', 'PNG');
        seedFile('token-..');

        const res = await putIndoor({ placedItems: [] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
        expect(MOCK_FS.has('/mock/campaigns/outside.png')).toBe(true);
    });

    it('an unlink error is console.error\'d and the save still answers success', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        // The file exists, but the OS refuses the unlink (EPERM).
        const fs = (await import('fs')).default;
        fs.unlinkSync.mockImplementationOnce(() => {
            throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
        });

        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_B)] });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map saved successfully');
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls.some((args) => String(args[0]).includes('token-art prune failed'))).toBe(true);
    });

    it('a missing superseded file is tolerated (no unlink crash, save still succeeds)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]); // ART_A is NOT on the mock disk

        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_B)] });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map saved successfully');
        expect(unlinkCalls).toEqual([]); // absent file is skipped before unlink
    });

    it('create-via-PUT (no stored document) never prunes', async () => {
        MOCK_FS.set(mapsDir, []);
        seedFile(ART_A);

        const res = await putIndoor({ placedItems: [tokenRow('t1', ART_A)] });

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([]);
    });
});

// ─── DELETE seam ─
// The route unlinks the map document then sweeps the images dir disk-wide
// (candidates = files matching the token-upload naming gate; a file survives
// when any REMAINING live document — maps/, character files at the campaign
// root, data/*.json — still names its path). The same mocked unlinkSync records
// the map-file unlink FIRST, so token assertions expect it as a prefix.
function seedImagesDir() {
    MOCK_FS.set(imagesDir, { __directory__: true });
}

// Extra map document (the cross-map shared-reference keep face needs a live
// sibling doc; seedIndoor already covers the one being deleted).
function seedSiblingMap(slug, placedItems) {
    MOCK_FS.set(`${mapsDir}/${slug}.json`, {
        displayName: slug,
        name: slug,
        type: 'indoor',
        gridSize: 20,
        walls: [],
        placedItems,
        players: [],
    });
}

function deleteMap(slug = 'art-map') {
    return request(createTestApp()).delete(`/api/campaigns/test-campaign/maps/${slug}`);
}

describe('maps DELETE — stranded token-art sweep (map-delete + Admin Regenerate seam)', () => {
    it('deleting the LAST document that names a token upload unlinks the file', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        seedImagesDir();

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map deleted successfully');
        expect(unlinkCalls).toEqual([FILE, `${imagesDir}/token-1-aaa.png`]);
        expect(MOCK_FS.has(FILE)).toBe(false);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(false);
    });

    it('a sibling live map still naming the path keeps it — and it prunes when that doc goes too', async () => {
        // art-map references A (shared) + B (exclusive); sibling references A.
        seedIndoor([tokenRow('t1', ART_A), tokenRow('t2', ART_B)]);
        seedSiblingMap('sibling-map', [tokenRow('t3', ART_A)]);
        seedFile(ART_A);
        seedFile(ART_B);
        seedImagesDir();

        const first = await deleteMap();
        expect(first.status).toBe(200);
        // Only the map file + the exclusive B prune; A lives on the sibling.
        expect(unlinkCalls).toEqual([FILE, `${imagesDir}/token-2-bbb.png`]);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(true);

        const second = await deleteMap('sibling-map');
        expect(second.status).toBe(200);
        expect(unlinkCalls[unlinkCalls.length - 1]).toBe(`${imagesDir}/token-1-aaa.png`);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(false);
    });

    it('the sweep reclaims token files NO document names (pre-fix strays and PUT-seam misses)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A); // referenced by the doc being deleted
        seedFile(ART_B); // stray: nothing on disk names it anymore
        seedImagesDir();

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([FILE, `${imagesDir}/token-1-aaa.png`, `${imagesDir}/token-2-bbb.png`]);
    });

    it('non-token assets are never sweep candidates (ElderPaladin.png survives every map delete)', async () => {
        seedIndoor([]);
        seedFile('ElderPaladin.png');
        seedFile('portraits/token-nested.png'); // nested path fails the gate
        seedFile(ART_A); // lone token → reclaimed
        seedImagesDir();

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([FILE, `${imagesDir}/token-1-aaa.png`]);
        expect(MOCK_FS.has(`${imagesDir}/ElderPaladin.png`)).toBe(true);
        expect(MOCK_FS.has(`${imagesDir}/portraits/token-nested.png`)).toBe(true);
    });

    it('a character document still naming the path keeps the upload', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        seedImagesDir();
        MOCK_FS.set(campaignRoot, { __directory__: true });
        MOCK_FS.set(`${campaignRoot}/Elder.json`, JSON.stringify({ name: 'Elder', imagePath: ART_A }));

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([FILE]);
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(true);
    });

    it('an unreadable live document fails the whole sweep closed (delete still answers success)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        seedImagesDir();
        // A data/ entry that exists in the listing but throws on read.
        MOCK_FS.set(dataDir, { __directory__: true });
        MOCK_FS.set(`${dataDir}/npcs.json`, undefined);

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map deleted successfully');
        expect(unlinkCalls).toEqual([FILE]); // nothing token-related unlinked
        expect(MOCK_FS.has(`${imagesDir}/token-1-aaa.png`)).toBe(true);
        expect(errorSpy.mock.calls.some((args) => String(args[0]).includes('strand sweep skipped'))).toBe(true);
    });

    it('an unlink error never fails the delete (console.error, success shape intact)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        seedFile(ART_A);
        seedImagesDir();
        const fs = (await import('fs')).default;
        fs.unlinkSync
            .mockImplementationOnce((p) => {
                unlinkCalls.push(p);
                MOCK_FS.delete(p); // the map file itself
            })
            .mockImplementationOnce(() => {
                throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
            });

        const res = await deleteMap();

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Map deleted successfully');
        expect(errorSpy.mock.calls.some((args) => String(args[0]).includes('token-art prune failed'))).toBe(true);
    });

    it('a campaign without an images dir deletes cleanly (sweep no-ops)', async () => {
        seedIndoor([tokenRow('t1', ART_A)]);
        // imagesDir intentionally NOT seeded.
        const res = await deleteMap();
        expect(res.status).toBe(200);
        expect(unlinkCalls).toEqual([FILE]);
    });
});

describe('orphanedTokenArt — pure diff helper (no fs)', () => {
    const doc = (placedItems = [], extra = {}) => ({ type: 'indoor', placedItems, ...extra });

    it('names superseded and cleared token uploads, deduped', () => {
        expect(orphanedTokenArt(
            doc([tokenRow('t1', ART_A), tokenRow('t2', ART_A), tokenRow('t3', ART_B)]),
            doc([tokenRow('t1', ART_B)])
        )).toEqual([ART_A]);
    });

    it('keeps anything the incoming document still references', () => {
        expect(orphanedTokenArt(
            doc([tokenRow('t1', ART_A)], { players: [{ id: 'p1', imagePath: ART_B }] }),
            doc([], { players: [{ id: 'p1', imagePath: ART_B }] })
        )).toEqual([ART_A]);
    });

    it('only the token-upload naming is a candidate', () => {
        expect(orphanedTokenArt(
            doc([
                tokenRow('t1', 'images/ElderPaladin.png'),
                tokenRow('t2', 'images/token-1-aaa.PNG'),
                tokenRow('t3', 'images/token-2-bbb.webp'),
                tokenRow('t4', 'images/token-x.exe'),
                tokenRow('t5', 'images/token-../../etc/passwd'),
                tokenRow('t6', 'images/token-..'),
            ]),
            doc([])
        )).toEqual(['images/token-1-aaa.PNG', 'images/token-2-bbb.webp']);
    });

    it('missing/malformed documents yield []', () => {
        expect(orphanedTokenArt(null, doc([]))).toEqual([]);
        expect(orphanedTokenArt(doc([null, 'x', 7]), doc([]))).toEqual([]);
        expect(orphanedTokenArt(doc([tokenRow('t1', ART_A)]), null)).toEqual([ART_A]);
    });
});
