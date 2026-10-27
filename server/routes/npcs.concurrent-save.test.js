// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-editor-concurrent-save-silently-drops-other-tabs-edits
// on the hand-rolled NPC per-entity PUT lane: a stale `updatedAt` echo gets
// 409 (rejected BEFORE image side effects) and the other tab's persisted
// field survives. Mirrors the in-memory-fs harness of npcs.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const IMAGE_OPS = { deleted: [], uploaded: [] };

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
        renameSync: (oldPath, newPath) => {
            if (FILE_SYSTEM.has(oldPath)) {
                FILE_SYSTEM.set(newPath, FILE_SYSTEM.get(oldPath));
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
    renameSync: (oldPath, newPath) => {
        if (FILE_SYSTEM.has(oldPath)) {
            FILE_SYSTEM.set(newPath, FILE_SYSTEM.get(oldPath));
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn((campaign, name, npc) => {
        IMAGE_OPS.uploaded.push({ campaign, name });
        npc.imagePath = `images/${name}.png`;
    }),
    deleteCharacterImage: vi.fn((imagePath) => {
        IMAGE_OPS.deleted.push(imagePath);
    }),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
}));

// Import AFTER mocks so the real route code wires against the in-memory fs.
const { default: npcRouter } = await import('./npcs.js');

const campaign = 'test-campaign';
const npcPath = `/mock/campaigns/${campaign}/data/npcs.json`;

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(npcRouter);
    return app;
};

const readDisk = () => JSON.parse(FILE_SYSTEM.get(npcPath));
const marta = (overrides = {}) => ({
    name: 'Marta Copperkettle',
    notes: '',
    appearance: '',
    imagePath: 'images/Marta Copperkettle.png',
    ...overrides,
});

beforeEach(() => {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set(`/mock/campaigns/${campaign}/data`, true);
    IMAGE_OPS.deleted = [];
    IMAGE_OPS.uploaded = [];
});

const putNpc = (app, npc, name = npc.name) =>
    request(app)
        .put(`/api/campaigns/${campaign}/npcs/${encodeURIComponent(name)}`)
        .send(npc);

describe('npcs PUT — concurrent-save conflict detection', () => {
    it('stamps the NPC on every real write and returns the stamped row', async () => {
        const app = createApp();
        const res = await putNpc(app, marta({ notes: 'B-EDIT-NOTES' }));
        expect(res.status).toBe(200);
        expect(res.body.npc.name).toBe('Marta Copperkettle');
        expect(typeof res.body.npc.updatedAt).toBe('number');
        expect(readDisk()[0].updatedAt).toBe(res.body.npc.updatedAt);
    });

    it('409s a stale-form save and keeps the other tab\'s persisted notes', async () => {
        const app = createApp();
        // Baseline write (also bootstraps the stamp on this legacy row).
        await putNpc(app, marta());
        // Tab B saves notes → disk + fresh stamp.
        const bStamp = readDisk()[0].updatedAt;
        const bSave = await putNpc(app, marta({ notes: 'TAB-B-EDIT-NOTES', updatedAt: bStamp }));
        expect(bSave.status).toBe(200);

        // Tab A — form populated BEFORE B's save (stale stamp) — saves its
        // own field; the exact repro from the bug file.
        const aSave = await putNpc(app, marta({
            notes: 'TAB-A-EDIT-DESC',
            appearance: 'TAB-A-EDIT-APPEARANCE',
            updatedAt: bStamp,
        }));
        expect(aSave.status).toBe(409);
        expect(aSave.body.conflict).toBe(true);
        expect(aSave.body.error).toMatch(/modified in another tab or session/);
        expect(aSave.body.error).toMatch(/NOT saved/);

        // B's persisted notes survive untouched.
        expect(readDisk()[0].notes).toBe('TAB-B-EDIT-NOTES');
        expect(readDisk()[0].appearance).toBe('');
    });

    it('leaves a rejected stale save fully inert (no image side effects)', async () => {
        const app = createApp();
        await putNpc(app, marta());
        const freshStamp = readDisk()[0].updatedAt;
        // Stale stamp + an image removal request: the 409 must fire BEFORE
        // handleImageChange deletes the image file.
        const res = await putNpc(app, marta({ imagePath: '', updatedAt: freshStamp - 1 }));
        expect(res.status).toBe(409);
        expect(IMAGE_OPS.deleted).toEqual([]);
        expect(readDisk()[0].imagePath).toBe('images/Marta Copperkettle.png');
    });

    it('accepts saves that echo the current stamp (normal single-tab flow)', async () => {
        const app = createApp();
        await putNpc(app, marta());
        const stamp = readDisk()[0].updatedAt;
        const res = await putNpc(app, marta({ notes: 'v2', updatedAt: stamp }));
        expect(res.status).toBe(200);
        expect(readDisk()[0].notes).toBe('v2');
        expect(readDisk()[0].updatedAt).toBeGreaterThan(stamp);
    });

    it('re-saving identical content does not churn the stamp', async () => {
        const app = createApp();
        await putNpc(app, marta({ notes: 'same' }));
        const stamp = readDisk()[0].updatedAt;
        const res = await putNpc(app, marta({ notes: 'same', updatedAt: stamp }));
        expect(res.status).toBe(200);
        expect(readDisk()[0].updatedAt).toBe(stamp);
    });

    it('keeps legacy un-stamped rows writable (bootstrap) and stamps them', async () => {
        const app = createApp();
        FILE_SYSTEM.set(npcPath, JSON.stringify([marta()])); // no updatedAt on disk
        const res = await putNpc(app, { name: 'Marta Copperkettle', notes: 'legacy write', imagePath: 'images/Marta Copperkettle.png' });
        expect(res.status).toBe(200);
        expect(readDisk()[0].notes).toBe('legacy write');
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });
});
