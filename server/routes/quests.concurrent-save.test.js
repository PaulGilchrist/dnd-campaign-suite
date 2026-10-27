// @maintained-by-ai: 2026-10-27
// Run-I backlog close: the Quests whole-array POST 409 must label rows by
// their display name (the same field the list renders as the row title), not
// the raw uuid — e.g. Quest "The Lost Artifact", never Quest "39ee4cc0-…".
// Mirrors the in-memory-fs harness of settlements.concurrent-save.test.js and
// proves the route config actually wires displayField: 'name' into the factory
// (the generic factory coverage lives in jsonEntityCrud.concurrent-save.test.js).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

// Import AFTER mocks so the real route code wires against the in-memory fs.
const { default: questsRouter } = await import('./quests.js');

const campaign = 'test-campaign';
const filePath = `/mock/campaigns/${campaign}/data/quests.json`;
const url = `/api/campaigns/${campaign}/quests`;

const VERBATIM_MODIFIED_COPY = (name) =>
    `Quest "${name}" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`;

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(questsRouter);
    return app;
};

const readDisk = () => JSON.parse(FILE_SYSTEM.get(filePath));
const postArray = (app, quests) => request(app).post(url).send({ quests });

// Row whose uuid id differs from its display name — the exact live repro shape.
const UUID = '39ee4cc0-3472-47b9-ba28-2da57384a801';
const lostArtifact = (overrides = {}) => ({
    id: UUID,
    name: 'The Lost Artifact',
    description: 'Recover the stolen relic',
    ...overrides,
});

beforeEach(() => {
    FILE_SYSTEM.clear();
});

describe('quests array POST — 409 conflict copy labels by display name', () => {
    it('labels the "modified" 409 by the row name, never the raw uuid', async () => {
        const app = createApp();
        // Tab B creates then edits the row (fresh stamp each write).
        const boot = await postArray(app, [lostArtifact()]);
        expect(boot.status).toBe(200);
        const bSave = await postArray(app, [lostArtifact({ description: 'TAB-B-EDIT' })]);
        expect(bSave.status).toBe(200);
        const freshStamp = readDisk()[0].updatedAt;

        // Tab A replays its stale snapshot with a changed field.
        const stale = await postArray(app, [
            lostArtifact({ description: 'TAB-A-EDIT', updatedAt: freshStamp - 1000 }),
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toBe(VERBATIM_MODIFIED_COPY('The Lost Artifact'));
        expect(stale.body.error).not.toContain(UUID);
        // The peer's edit survives — the stale write never landed.
        expect(readDisk()[0].description).toBe('TAB-B-EDIT');
    });

    it('labels the resurrection "created or deleted" 409 by the incoming row name', async () => {
        const app = createApp();
        // Row deleted from disk elsewhere; the stale tab re-sends it echoing
        // its old stamp — refuse and name it by the title the sender holds.
        FILE_SYSTEM.set(filePath, JSON.stringify([]));
        const res = await postArray(app, [lostArtifact({ updatedAt: 123 })]);
        expect(res.status).toBe(409);
        expect(res.body.conflict).toBe(true);
        expect(res.body.error).toContain('Quest "The Lost Artifact" was created or deleted');
        expect(res.body.error).not.toContain(UUID);
    });

    it('labels a dropped-row "created or deleted" 409 by the disk row name', async () => {
        const app = createApp();
        await postArray(app, [
            lostArtifact(),
            { id: 'q2', name: 'Dragon Hunt', v: 1 },
        ]);
        // Sender's snapshot never knew about the second row — drop it, refuse.
        const stale = await postArray(app, [lostArtifact({ description: 'edited' })]);
        expect(stale.status).toBe(409);
        expect(stale.body.error).toContain('Quest "Dragon Hunt" was created or deleted');
        expect(stale.body.error).not.toContain('q2');
    });

    it('falls back to the id for a blank or missing name — never renders ""', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'untitled-uuid', name: '   ', v: 1 }]);
        const stamp = readDisk()[0].updatedAt;
        const stale = await postArray(app, [
            { id: 'untitled-uuid', name: '', v: 2, updatedAt: stamp - 1000 },
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.error).toContain('Quest "untitled-uuid" was modified');
        expect(stale.body.error).not.toContain('Quest ""');
    });
});

describe('quests array POST — unchanged behaviors', () => {
    it('duplicate-name 400 copy stays lowercase and human-readable', async () => {
        const app = createApp();
        const res = await postArray(app, [
            { id: 'q1', name: 'Lost Artifact' },
            { id: 'q2', name: 'lost artifact' },
        ]);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A quest with that name already exists');
    });

    it('a legit save echoing the current stamp still 200s and re-stamps', async () => {
        const app = createApp();
        await postArray(app, [lostArtifact()]);
        const stamp = readDisk()[0].updatedAt;
        const res = await postArray(app, [lostArtifact({ description: 'legit edit', updatedAt: stamp })]);
        expect(res.status).toBe(200);
        expect(readDisk()[0].description).toBe('legit edit');
        expect(readDisk()[0].updatedAt).toBeGreaterThan(stamp);
    });
});
