// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-editor-concurrent-save-silently-drops-other-tabs-edits:
// the shared .ct-* save lane must REFUSE blind overwrites. A tab whose echoed
// `updatedAt` stamp is older than disk gets 409 (its save never lands); a
// whole-array POST that would drop a row created elsewhere also gets 409.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import {
  createJsonEntityRouter,
  hasUpdateConflict,
  sameEntityContent,
  stampForSave,
} from '../utils/jsonEntityCrud.js';

// In-memory fs mirroring jsonEntityCrud-options.test.js
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
const entityName = 'conflictitems';

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

describe('jsonEntityCrud — concurrent-save conflict detection', () => {
    it('stamps rows written through the whole-array POST', async () => {
        const app = createApp();
        const res = await postArray(app, [{ id: 'e1', notes: 'first' }]);
        expect(res.status).toBe(200);
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });

    it('409s a stale-stamp save and leaves the newer persisted edit intact', async () => {
        const app = createApp();
        // Tab B creates the row, then Tab B saves a note (fresh stamp).
        await postArray(app, [{ id: 'e1', notes: 'B-1' }]);
        const bSave = await postArray(app, [{ id: 'e1', notes: 'B-EDIT-NOTES' }]);
        expect(bSave.status).toBe(200);
        const freshStamp = readDisk()[0].updatedAt;

        // Tab A saves the row with a stamp from BEFORE B's write (its form
        // was loaded earlier). This is the exact silent-lost-update repro.
        const stale = await postArray(app, [
            { id: 'e1', notes: 'TAB-A-EDIT-DESC', updatedAt: freshStamp - 1000 },
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toMatch(/another tab or session/);
        expect(stale.body.error).toMatch(/reload/);

        // B's persisted data survives — A's blind overwrite never landed.
        expect(readDisk()[0].notes).toBe('B-EDIT-NOTES');
    });

    it('accepts a save that echoes the current stamp and re-stamps the row', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', notes: 'v1' }]);
        const stamp = readDisk()[0].updatedAt;
        const res = await postArray(app, [{ id: 'e1', notes: 'v2', updatedAt: stamp }]);
        expect(res.status).toBe(200);
        expect(readDisk()[0].notes).toBe('v2');
        expect(readDisk()[0].updatedAt).toBeGreaterThan(stamp);
    });

    it('409s a whole-array POST that silently drops a row created elsewhere', async () => {
        const app = createApp();
        // Tab A's snapshot: only e1 exists.
        // Meanwhile Tab B creates e2 on disk.
        await postArray(app, [{ id: 'e1', name: 'one' }, { id: 'e2', name: 'two' }]);
        const stale = await postArray(app, [{ id: 'e1', name: 'one-edited' }]);
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toMatch(/created or deleted/);
        // B's new row is still on disk.
        expect(readDisk().map(e => e.id)).toEqual(['e1', 'e2']);
    });

    it('keeps legacy un-stamped rows writable and stamps them on first save', async () => {
        const app = createApp();
        mockFsState.set(dataFile(), JSON.stringify([{ id: 'legacy', notes: 'old' }]));
        const res = await postArray(app, [{ id: 'legacy', notes: 'updated' }]);
        expect(res.status).toBe(200);
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });

    it('stamps a legacy row even when the first post-fix save changes nothing', async () => {
        const app = createApp();
        mockFsState.set(dataFile(), JSON.stringify([{ id: 'legacy', notes: 'same' }]));
        const res = await postArray(app, [{ id: 'legacy', notes: 'same' }]);
        expect(res.status).toBe(200);
        // Bootstrap closes on the very first save under the fix — no window
        // where a no-op save leaves the row permanently conflict-blind.
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });

    it('does not re-stamp untouched rows, so other tabs never false-conflict', async () => {
        const app = createApp();
        await postArray(app, [{ id: 'e1', name: 'a' }, { id: 'e2', name: 'b' }]);
        const [first, second] = readDisk();

        // A later save that edits e2 only must leave e1's stamp byte-identical
        // (key order differs on purpose — content compare must be order-safe).
        await postArray(app, [{ name: 'a', id: 'e1' }, { id: 'e2', name: 'b2', updatedAt: second.updatedAt }]);
        const [firstAfter, secondAfter] = readDisk();
        expect(firstAfter.updatedAt).toBe(first.updatedAt);
        expect(secondAfter.updatedAt).toBeGreaterThan(first.updatedAt);
    });

    it('rejects via validateList (400) before any conflict check runs', async () => {
        const app = express();
        app.use(express.json());
        app.use(createJsonEntityRouter(entityName, {
            singularDisplayName: 'item',
            validateList: (list) => (list.length > 1 ? 'too many' : null),
        }));
        mockFsState.set(dataFile(), JSON.stringify([{ id: 'e1', updatedAt: 5 }]));
        const res = await request(app)
            .post(url())
            .send({ [entityName]: [{ id: 'e1', x: 1 }, { id: 'e2' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('too many');
    });
});

describe('jsonEntityCrud — conflict helpers (per-entity PUT lanes reuse these)', () => {
    it('hasUpdateConflict: only an echoed stale stamp against a stamped row conflicts', () => {
        expect(hasUpdateConflict({ updatedAt: 2 }, { updatedAt: 1 })).toBe(true);
        expect(hasUpdateConflict({ updatedAt: 2 }, { updatedAt: 2 })).toBe(false);
        expect(hasUpdateConflict({ updatedAt: 2 }, {})).toBe(false); // legacy client
        expect(hasUpdateConflict({}, { updatedAt: 1 })).toBe(false); // unstamped disk
        expect(hasUpdateConflict(null, { updatedAt: 1 })).toBe(false); // new row
    });

    it('sameEntityContent ignores the stamp and key order', () => {
        expect(sameEntityContent({ a: 1, updatedAt: 1 }, { updatedAt: 9, a: 1 })).toBe(true);
        expect(sameEntityContent({ a: 1, b: { c: 2 } }, { b: { c: 3 }, a: 1 })).toBe(false);
    });

    it('stampForSave keeps the old stamp for unchanged content, re-stamps changes', () => {
        expect(stampForSave({ id: 'e', v: 1, updatedAt: 7 }, { id: 'e', v: 1, updatedAt: 7 }, 99))
            .toEqual({ id: 'e', v: 1, updatedAt: 7 });
        expect(stampForSave({ id: 'e', v: 2, updatedAt: 7 }, { id: 'e', v: 1, updatedAt: 7 }, 99))
            .toEqual({ id: 'e', v: 2, updatedAt: 99 });
        expect(stampForSave({ id: 'e', v: 2 }, undefined, 99)).toEqual({ id: 'e', v: 2, updatedAt: 99 });
    });
});
