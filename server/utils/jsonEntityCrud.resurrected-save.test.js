// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-concurrent-delete-resurrected-by-stale-array-save:
// the concurrent-save guard's two original legs were asymmetric — an incoming
// row absent from disk (deleted in another tab/session) that echoes an
// `updatedAt` stamp provably was read BEFORE the delete, so the whole-array
// POST must 409 instead of silently resurrecting it. A brand-new row carries
// no echoed stamp, so creation stays untouched.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import { createJsonEntityRouter, isResurrectionAttempt, isVerbatimClone } from '../utils/jsonEntityCrud.js';

// In-memory fs mirroring jsonEntityCrud.concurrent-save.test.js
const mockFsState = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsState.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.set(path, true);
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsState.set(path, data);
        }),
        readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
    },
    existsSync: vi.fn((path) => mockFsState.has(path)),
    mkdirSync: vi.fn((path) => {
        mockFsState.set(path, true);
    }),
    writeFileSync: vi.fn((path, data) => {
        mockFsState.set(path, data);
    }),
    readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

const campaign = 'test-campaign';
const entityName = 'resurrectitems';

const dataFile = () => `/mock/campaigns/${campaign}/data/${entityName}.json`;
const url = () => `/api/campaigns/${campaign}/${entityName}`;

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(createJsonEntityRouter(entityName, { singularDisplayName: 'item' }));
    return app;
};

const readDisk = () => JSON.parse(mockFsState.get(dataFile()));

const postArray = (app, entities) =>
    request(app).post(url()).send({ [entityName]: entities });

beforeEach(() => {
    mockFsState.clear();
    mockFsState.set(`/mock/campaigns/${campaign}/data`, true);
});

describe('jsonEntityCrud — deleted-row resurrection guard', () => {
    it('409s a stale whole-array save that would resurrect a row deleted elsewhere', async () => {
        const app = createApp();
        // Both rows exist; capture the stamps a stale tab would echo back.
        await postArray(app, [{ id: 'e1', name: 'one' }, { id: 'e2', name: 'two' }]);
        const [one, two] = readDisk();

        // Another session DELETEs e2.
        await request(app).delete(`${url()}/e2`);

        // Tab A's editor was open the whole time (SSE list refresh skipped):
        // it edits e1 and POSTs its stale snapshot — e2 still included with
        // the stamp it read before the delete. This is the exact repro.
        const stale = await postArray(app, [
            { ...one, name: 'TAB-A-EDIT' },
            two,
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toMatch(/created or deleted/);
        expect(stale.body.error).toMatch(/reload/);

        // The peer's delete survives — e2 is NOT resurrected, and Tab A's
        // edit never lands either (the whole write is refused).
        expect(readDisk().map(e => e.id)).toEqual(['e1']);
        expect(readDisk()[0].name).toBe('one');
    });

    it('still accepts a whole-array save that creates a genuinely new row (no echoed stamp)', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one' }]);
        const [one] = readDisk();

        // New rows are built client-side without `updatedAt` — the creation
        // discriminator must keep them flowing.
        const res = await postArray(app, [one, { id: 'e2', name: 'two' }]);
        expect(res.status).toBe(200);
        expect(readDisk().map(e => e.id)).toEqual(['e1', 'e2']);
        expect(typeof readDisk()[1].updatedAt).toBe('number');
    });

    it('409s a resurrection even when the deleted row echoes an up-to-date stamp', async () => {
        const app = createApp();
        // Only e1 exists now; e2 was deleted elsewhere but its stamp was
        // fresh at read time — freshness proves nothing once disk forgot it.
        await postArray(app, [{ id: 'e1', name: 'one' }]);
        const [one] = readDisk();

        const res = await postArray(app, [
            one,
            { id: 'e2', name: 'ghost', updatedAt: one.updatedAt },
        ]);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/"e2" was created or deleted/);
        expect(readDisk().map(e => e.id)).toEqual(['e1']);
    });

    it('keeps legacy un-stamped ghosts writable (indistinguishable from new rows)', async () => {
        const app = createApp();
        // Pre-fix legacy clients never echo stamps — the bootstrap contract
        // from 876f95f33 stays: unstamped incoming rows pass and get stamped.
        await postArray(app, [{ id: 'e1', name: 'one' }]);
        const res = await postArray(app, [{ id: 'e1', name: 'one' }, { id: 'legacy', name: 'old' }]);
        expect(res.status).toBe(200);
        expect(typeof readDisk()[1].updatedAt).toBe('number');
    });
});

// Shared discriminator used by BOTH the whole-array POST (findConcurrentWrite)
// and the per-entity PUT lanes (npcs/sessions/settlements — bug-ct-put-lane-
// delete-resurrected) so the two write paths can never drift apart again.
describe('isResurrectionAttempt — shared PUT/POST discriminator', () => {
    it('flags a stamped incoming row whose disk row is gone', () => {
        expect(isResurrectionAttempt(null, { id: 'e2', updatedAt: 5 }, 'e2')).toBe(true);
    });

    it('never fires when the disk row still exists (modified leg owns it)', () => {
        expect(isResurrectionAttempt({ id: 'e1', updatedAt: 5 }, { id: 'e1', updatedAt: 5 }, 'e1')).toBe(false);
    });

    it('never fires on genuine creates (no echoed stamp) or un-stamped legacy bodies', () => {
        expect(isResurrectionAttempt(null, { id: 'new' }, 'new')).toBe(false);
        expect(isResurrectionAttempt(null, { id: 'legacy', updatedAt: '7' }, 'legacy')).toBe(false);
    });

    it('never fires without a resolvable id', () => {
        expect(isResurrectionAttempt(null, { updatedAt: 5 }, null)).toBe(false);
    });
});

// 2026-10-28 improve (bug-npc-bulk-post-clone-409, 2026-10-28-P backlog): a
// clone/copy row — an existing row copied VERBATIM (only the idField value
// changed, source's CURRENT stamp echoed) — must NOT take the misleading
// 'created or deleted' verdict. The array lane normalizes it (accept + fresh
// stamp via stampForSave) while the ghost lanes above stay byte-identical 409s.
describe('jsonEntityCrud — verbatim clone rows (fresh-stamp normalization)', () => {
    it('accepts a renamed clone echoing the live source row\'s current stamp, re-stamping only the clone', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one', notes: 'src' }]);
        const [source] = readDisk();

        // Rig copies e1 verbatim under a new id (idField is 'id' here, so
        // every other field stays byte-identical), keeping the stamp it read.
        const res = await postArray(app, [
            source,
            { ...source, id: 'e2' },
        ]);
        expect(res.status).toBe(200);

        const [oneAfter, copyAfter] = readDisk();
        // The source row: untouched, stamp NOT churned by the re-post.
        expect(oneAfter).toEqual(source);
        // The clone landed with a FRESH stamp (normalization) — it never
        // ships the source's stamp as a borrowed legacy value; both writes
        // may share a millisecond, so compare with ≥.
        expect(copyAfter).toEqual({ ...source, id: 'e2', updatedAt: copyAfter.updatedAt });
        expect(copyAfter.updatedAt).toBeGreaterThanOrEqual(source.updatedAt);
    });

    it('accepts the verbatim no-op re-post itself (same id + same stamp + same content), stamp untouched', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one', notes: 'src' }]);
        const [source] = readDisk();

        const res = await postArray(app, [source]);
        expect(res.status).toBe(200);
        expect(readDisk()).toEqual([source]);
    });

    it('still 409s an edited copy — same stamp as a live row but content differs beyond the id', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one', notes: 'src' }]);
        const [source] = readDisk();

        // Copy-then-customize at the source's live stamp: the acceptance rule
        // (stamp matches AND content differs) keeps this a genuine conflict —
        // exactly the ghost shape pinned by the up-to-date-stamp test above.
        const res = await postArray(app, [
            source,
            { ...source, id: 'e2', name: 'edited copy', notes: 'CUSTOM' },
        ]);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/"e2" was created or deleted/);
        expect(readDisk().map(e => e.id)).toEqual(['e1']);
    });

    it('still 409s a clone whose echoed stamp matches no live row (deleted twin / unverifiable stamp)', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one' }]);
        const [one] = readDisk();

        // Fresh Date.now()-style stamp (or a deleted twin's gone-from-disk
        // stamp) proves nothing about provenance — the strict guard stands.
        const res = await postArray(app, [
            one,
            { id: 'e2', name: 'one', updatedAt: one.updatedAt + 123456 },
        ]);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/"e2" was created or deleted/);
        expect(readDisk().map(e => e.id)).toEqual(['e1']);
    });

    it('keeps the dropped-row leg strict for clones (omitting the source still 409s)', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'one' }]);
        const [one] = readDisk();

        // A clone POST that also DROPS its source from the envelope would
        // delete e1 — that list collision is still refused, clone or not.
        const res = await postArray(app, [{ ...one, id: 'e2' }]);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/"e1" was created or deleted/);
        expect(readDisk().map(e => e.id)).toEqual(['e1']);
    });
});

describe('isVerbatimClone — clone-vs-ghost discriminator', () => {
    const disk = [{ id: 'e1', name: 'one', notes: 'n', updatedAt: 10 }];

    it('flags a copy of a live row sharing its current stamp (only the id differs)', () => {
        expect(isVerbatimClone(disk, { id: 'e2', name: 'one', notes: 'n', updatedAt: 10 }, 'id')).toBe(true);
        // NPC lane shape: idField is the name, so a renamed copy is verbatim.
        const npcDisk = [{ name: 'Marta', notes: 'n', updatedAt: 10 }];
        expect(isVerbatimClone(npcDisk, { name: 'QA Clone', notes: 'n', updatedAt: 10 }, 'name')).toBe(true);
    });

    it('ignores id + stamp only — any other content difference disqualifies', () => {
        expect(isVerbatimClone(disk, { id: 'e2', name: 'one', notes: 'EDITED', updatedAt: 10 }, 'id')).toBe(false);
        expect(isVerbatimClone(disk, { id: 'e2', name: 'renamed too', notes: 'n', updatedAt: 10 }, 'id')).toBe(false);
    });

    it('requires an exact current-stamp match on the source row', () => {
        expect(isVerbatimClone(disk, { id: 'e2', name: 'one', notes: 'n', updatedAt: 9 }, 'id')).toBe(false);
        expect(isVerbatimClone(disk, { id: 'e2', name: 'one', notes: 'n' }, 'id')).toBe(false);
    });

    it('is key-order safe and never fires on an empty disk', () => {
        const reordered = { notes: 'n', updatedAt: 10, id: 'e2', name: 'one' };
        expect(isVerbatimClone(disk, reordered, 'id')).toBe(true);
        expect(isVerbatimClone([], reordered, 'id')).toBe(false);
    });
});
