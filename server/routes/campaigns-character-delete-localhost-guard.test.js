// Regression for bug-character-delete-no-gm-gate: DELETE /api/campaigns/
// :campaign/:file (character JSON + portrait unlink + change-data strip + SSE
// broadcast) executed its route body for ANY client while its create-sibling
// POST carried refuseUnlessGm — one unauthenticated LAN curl irreversibly
// deleted any character. These cases pin the 403 gate + disk-inertness for
// non-localhost Hosts (mirroring campaigns-admin-crud-localhost-guard.test.js
// and campaigns-character-localhost-create.test.js), including the 403-BEFORE-
// existence ordering (a gated route answers 403 even for a missing file —
// existence-blind), while the honest localhost GM delete lane stays
// byte-identical (200 + unlink + broadcast).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    for (const [p, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
}

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
        unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
        renameSync: (oldPath, newPath) => {
            const data = FILE_SYSTEM.get(oldPath);
            if (data !== undefined) {
                FILE_SYSTEM.set(newPath, data);
                FILE_SYSTEM.delete(oldPath);
            }
        },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

let deletedImages = [];
vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn((p) => { deletedImages.push(p); }),
}));

let publishedEvents = [];
let removedKeys = [];
vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
    removeChangeDataKey: vi.fn((campaign, name) => { removedKeys.push(`${campaign}/${name}`); }),
}));

import campaignsCharacter from './campaigns-character.js';
import { deleteCharacterImage } from '../utils/imageUtils.js';

const FOREIGN_HOSTS = ['192.168.0.239', '100.92.171.80', 'example.test'];
const CHAR_FILE = '/mock/campaigns/test-campaign/Victim.json';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishedEvents = [];
    removedKeys = [];
    deletedImages = [];
});

describe('campaignsCharacter — DELETE localhost authority gate', () => {
    it.each(FOREIGN_HOSTS)(
        'DELETE an EXISTING character from %s ⇒ 403, file + image + change-data untouched, no broadcast',
        async (host) => {
            setupFs({
                [CHAR_FILE]: { name: 'Victim', imagePath: 'images/Victim.png', level: 20 },
            });

            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/Victim.json')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/GM-only/i);
            expect(FILE_SYSTEM.has(CHAR_FILE)).toBe(true);
            expect(deleteCharacterImage).not.toHaveBeenCalled();
            expect(removedKeys).toHaveLength(0);
            expect(publishedEvents).toHaveLength(0);
        }
    );

    it('answers 403 BEFORE the existence check for a missing file (existence-blind)', async () => {
        // Pre-fix signature was 404 "Character file not found" — proof the
        // route BODY ran for a network client. A gated route never reveals
        // whether the file exists.
        setupFs({});

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/__NoSuch_Char__.json')
            .set('Host', '192.168.0.239');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/GM-only/i);
    });

    it('localhost delete still succeeds (200 + unlink + image + change-data + broadcast) — GM lane unchanged', async () => {
        setupFs({
            [CHAR_FILE]: { name: 'Victim', imagePath: 'images/Victim.png', level: 20 },
        });

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/Victim.json')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Character deleted successfully');
        expect(FILE_SYSTEM.has(CHAR_FILE)).toBe(false);
        expect(deletedImages).toEqual(['images/Victim.png']);
        expect(removedKeys).toEqual(['test-campaign/Victim']);
        expect(publishedEvents.find((e) => e.key === 'character-delete-test-campaign-Victim.json')).toBeTruthy();
    });

    it('127.0.0.1 delete still succeeds for the loopback GM host', async () => {
        setupFs({
            [CHAR_FILE]: { name: 'Victim', level: 20 },
        });

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/Victim.json')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(FILE_SYSTEM.has(CHAR_FILE)).toBe(false);
    });

    it('localhost DELETE of a genuinely missing file still 404s (behavior below the gate unchanged)', async () => {
        setupFs({});

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/Ghost.json')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Character file not found');
    });

    it('player read lane unchanged: non-localhost GET of a character file still 200', async () => {
        // Scope pin: only the destructive DELETE write gained the gate — the
        // network read view and the intentional player-writes-own-file PUT
        // lane (see PUT handler comment) stay open.
        setupFs({
            [CHAR_FILE]: { name: 'Victim', level: 20 },
        });

        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/Victim.json')
            .set('Host', '192.168.0.239');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('name', 'Victim');
    });
});
