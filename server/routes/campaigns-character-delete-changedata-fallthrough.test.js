// Regression for bug-visitor-oa-resolution-strands-marker-double-resolve:
// DELETE /api/campaigns/:campaign/:file in campaigns-character.js ran
// refuseUnlessGm BEFORE its non-`.json` next() fall-through, and because the
// router mounts before campaigns-changedata (server.js route-order law),
// EVERY visitor-origin change-data DELETE (pendingOAs marker clears,
// savePrompt-* drain-to-evict) was captured with 403 "GM-only feature" while
// the same press's POST writes landed — stranding the shared marker so a
// second (GM) press resolved the same provocation twice.
//
// Pins BOTH sides of the restored authority split with the real mount order:
//   - a non-`.json` change-data key DELETE from a network origin FALLS THROUGH
//     the character wildcard and is executed by the change-data router;
//   - a real `.json` character-file DELETE from a network origin is STILL 403
//     (GM-only, bug-character-delete-no-gm-gate) with disk inert.
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
// Shared store the change-data router reads/writes — one mock covers both
// routers (same '../utils/changeData.js' specifier). vi.hoisted: the factory
// reads it at mock-construction time, before module-level consts initialize.
const { CHANGE_STORE } = vi.hoisted(() => ({ CHANGE_STORE: new Map() }));
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
    removeChangeDataKey: vi.fn((campaign, name) => { removedKeys.push(`${campaign}/${name}`); }),
    characterChangeData: CHANGE_STORE,
    markDirty: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
}));

import campaignsCharacter from './campaigns-character.js';
import campaignsChangedata from './campaigns-changedata.js';
import { deleteCharacterImage } from '../utils/imageUtils.js';

const FOREIGN_HOSTS = ['192.168.0.239', '100.92.171.80'];
const CHAR_FILE = '/mock/campaigns/test-campaign/Victim.json';
const MARKER = { Wolf: { defender: 'Wolf', mover: 'ElderPaladin', promptId: 'gb2-repro-1' } };

// Real server.js mount order — the capture only reproduces (and the fall-
// through only lands) with character BEFORE changedata.
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    app.use(campaignsChangedata);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishedEvents = [];
    removedKeys = [];
    deletedImages = [];
    CHANGE_STORE.clear();
});

describe('visitor-origin change-data DELETE falls through the character wildcard', () => {
    it.each(FOREIGN_HOSTS)(
        'from %s: DELETE of an EXISTING pendingOAs bucket is executed by the change-data router (200 + evict + null echo) — never 403',
        async (host) => {
            CHANGE_STORE.set('test-campaign', { pendingOAs: MARKER });

            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/pendingOAs')
                .set('Host', host);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Data deleted successfully');
            expect(CHANGE_STORE.get('test-campaign')).not.toHaveProperty('pendingOAs');
            expect(publishedEvents).toContainEqual({ key: 'change-test-campaign-pendingOAs', data: null });
        }
    );

    it('POST-then-DELETE split gate is gone: a fresh arbitrary key writes AND evicts from a network origin', async () => {
        CHANGE_STORE.set('test-campaign', {});
        const app = createTestApp();

        const post = await request(app)
            .post('/api/campaigns/test-campaign/gb2-capture-probe')
            .set('Host', '192.168.0.239')
            .send({ value: { probe: 1 } });
        expect(post.status).toBe(200);
        expect(CHANGE_STORE.get('test-campaign')).toHaveProperty('gb2-capture-probe');

        const del = await request(app)
            .delete('/api/campaigns/test-campaign/gb2-capture-probe')
            .set('Host', '192.168.0.239');
        expect(del.status).toBe(200);
        expect(CHANGE_STORE.get('test-campaign')).not.toHaveProperty('gb2-capture-probe');
    });

    it('savePrompt-* drain-to-evict sibling: visitor DELETE reaches the change-data router (honest 404, never the GM gate)', async () => {
        // Structural sibling lane (deleteRuntimeKey drain-to-evict): a key the
        // server never held answers with the change-data router's honest 404,
        // NOT the character wildcard's 403 — proof the request fell through.
        CHANGE_STORE.set('test-campaign', {});

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/savePrompt-Wolf-abc123')
            .set('Host', '192.168.0.239');

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Change-data key not found/i);
    });
});

describe('GM-only character-file DELETE guard survives the reorder', () => {
    it.each(FOREIGN_HOSTS)(
        'from %s: DELETE of an EXISTING .json character ⇒ 403, file + image + change-data untouched, no broadcast',
        async (host) => {
            setupFs({ [CHAR_FILE]: { name: 'Victim', imagePath: 'images/Victim.png', level: 20 } });

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

    it('stays existence-blind for a missing .json from a network origin (403 before any fs probe)', async () => {
        setupFs({});

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/__NoSuch_Char__.json')
            .set('Host', '192.168.0.239');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/GM-only/i);
    });

    it('localhost GM lanes unchanged: .json delete unlinks (200) and change-data delete still evicts (200)', async () => {
        setupFs({ [CHAR_FILE]: { name: 'Victim', imagePath: 'images/Victim.png', level: 20 } });
        CHANGE_STORE.set('test-campaign', { pendingOAs: MARKER });
        const app = createTestApp();

        const charDel = await request(app)
            .delete('/api/campaigns/test-campaign/Victim.json')
            .set('Host', 'localhost');
        expect(charDel.status).toBe(200);
        expect(charDel.body.message).toBe('Character deleted successfully');
        expect(FILE_SYSTEM.has(CHAR_FILE)).toBe(false);
        expect(deletedImages).toEqual(['images/Victim.png']);
        expect(removedKeys).toEqual(['test-campaign/Victim']);

        const keyDel = await request(app)
            .delete('/api/campaigns/test-campaign/pendingOAs')
            .set('Host', 'localhost');
        expect(keyDel.status).toBe(200);
        expect(CHANGE_STORE.get('test-campaign')).not.toHaveProperty('pendingOAs');
    });
});
