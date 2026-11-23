// @maintained-by-ai
// ─── Lane: orphaned token-art prune on the whole-doc PUT (deferred D shipped 2026-11-22) ─
// The /token-image upload lane writes images/token-<ts>-<rand>.<ext> and the
// placedItems row keeps only that relative path; replace ("upload over
// existing art") and "Remove art" both ride the indoor whole-document PUT,
// which used to orphan the superseded file forever. Now the single save seam
// diffs stored rows vs the incoming document and unlinks what nothing
// references anymore. Pinned faces: replace-prunes, clear-prunes (and row
// deletion prunes), echo/shared-reference KEEPS, non-token assets and
// traversal-shaped paths are never prune candidates, and an unlink failure
// (missing file, EPERM) logs via console.error while the save still answers
// its normal success shape. In-memory fs (maps.put-gridsize-clamp.test.js
// idiom) — real disk is never touched.
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
