// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-put-lane-delete-resurrected on the sessions
// per-entity PUT lane: a stale `updatedAt` echo on a row another tab/session
// deleted used to fall through to the upsert-create leg (200, silently
// reviving the row). It now 409s "created or deleted" via the shared
// isResurrectionAttempt discriminator, mirroring the whole-array POST guard.
// Mirrors the in-memory-fs harness of settlements.concurrent-save.test.js.
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
const { default: sessionRouter } = await import('./sessions.js');

const campaign = 'test-campaign';
const filePath = `/mock/campaigns/${campaign}/data/sessions.json`;

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(sessionRouter);
    return app;
};

const readDisk = () => JSON.parse(FILE_SYSTEM.get(filePath));
const putSession = (app, session, name = session.name) =>
    request(app)
        .put(`/api/campaigns/${campaign}/sessions/${encodeURIComponent(name)}`)
        .send(session);
const session = (overrides = {}) => ({
    name: 'Session 9: QA Probe',
    status: 'planned',
    ...overrides,
});

beforeEach(() => {
    FILE_SYSTEM.clear();
});

describe('sessions PUT — deleted-row resurrection guard', () => {
    it('409s a stale-stamp save of a session deleted elsewhere and keeps it deleted', async () => {
        const app = createApp();
        // Tab A creates the session (genuine create carries no echoed stamp).
        const created = await putSession(app, session());
        expect(created.status).toBe(200);
        const stamp = readDisk()[0].updatedAt;

        // Another session deletes it.
        const del = await request(app).delete(
            `/api/campaigns/${campaign}/sessions/${encodeURIComponent('Session 9: QA Probe')}`
        );
        expect(del.status).toBe(200);
        expect(readDisk()).toEqual([]);

        // Tab A replays the snapshot it read before the delete — the exact
        // repro shape from the bug file.
        const stale = await putSession(app, session({ status: 'played', updatedAt: stamp }));
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toBe(
            'Session "Session 9: QA Probe" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.'
        );

        // The peer's delete survives — nothing was written.
        expect(readDisk()).toEqual([]);
    });

    it('still accepts a genuine create to an unknown name (no echoed stamp)', async () => {
        const app = createApp();
        const res = await putSession(app, session());
        expect(res.status).toBe(200);
        expect(readDisk().map(s => s.name)).toEqual(['Session 9: QA Probe']);
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });

    it('keeps the modified leg intact (stale stamp on a live row still 409s modified)', async () => {
        const app = createApp();
        await putSession(app, session());
        const stamp = readDisk()[0].updatedAt;
        const bSave = await putSession(app, session({ status: 'played', updatedAt: stamp }));
        expect(bSave.status).toBe(200);
        const stale = await putSession(app, session({ status: 'cancelled', updatedAt: stamp }));
        expect(stale.status).toBe(409);
        expect(stale.body.error).toMatch(/modified in another tab or session/);
        expect(readDisk()[0].status).toBe('played');
    });
});
