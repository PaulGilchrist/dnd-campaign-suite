// Regression (bug-inventory-item-save-concurrent-snapshot-last-writer-wins): the item
// lane used to persist whole item-list snapshots (POST /inventory replaced
// inventory.items verbatim), so two GM windows saving within each other's stale-view
// window were last-writer-wins — an add, edit, step or delete made in window A after
// window B last synced silently vanished when B's POST landed (no revision check, no
// 409, no console error). Item writes are now atomic per-row intents on
// POST /inventory/item — the server re-reads ITS ledger and applies only the intent,
// mirroring the /adjust coin lane that closed the currency half of the clobber class.
// Harness mirrors server/routes/inventory.test.js (in-memory fs + publish spy).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import inventory from './inventory.js';

const { mockFsState, fsMock } = vi.hoisted(() => {
    const mockFsState = new Map();
    const fsMock = {
        existsSync: vi.fn((path) => mockFsState.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.set(path, true);
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsState.set(path, data);
        }),
        readFileSync: vi.fn((path) => mockFsState.get(path)),
        unlinkSync: vi.fn((path) => {
            mockFsState.delete(path);
        }),
    };
    return { mockFsState, fsMock };
});

vi.mock('fs', () => ({ default: fsMock, ...fsMock }));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

const publishSpy = vi.hoisted(() => vi.fn());

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: (...args) => publishSpy(...args),
}));

// inventory.js shares the server log pipeline (routes/log.js); hermetic noop —
// /item intents never write a row (transfer audit pinned in transfer-audit tests).
vi.mock('./log.js', () => ({ addEntry: vi.fn() }));

const CAMPAIGN = 'test-campaign';
const invPath = `/mock/campaigns/${CAMPAIGN}/data/inventory.json`;
const itemUrl = `/api/campaigns/${CAMPAIGN}/inventory/item`;

const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(inventory);
    return app;
};

const writeInventory = (data) => mockFsState.set(invPath, JSON.stringify(data));
const readInventoryFile = () => JSON.parse(mockFsState.get(invPath));

const postIntent = (app, body) => request(app).post(itemUrl).send(body);

const lantern = { id: 'a1', name: 'QA Lantern', quantity: 1, description: 'steady flame' };

let app;

beforeEach(() => {
    mockFsState.clear();
    publishSpy.mockClear();
    app = makeApp();
});

describe('POST inventory/item add', () => {
    it('appends one row, PRESERVES the stored currency ledger, and publishes the merged doc', async () => {
        writeInventory({ currency: { pp: 0, gp: 11, sp: 0, cp: 1 }, items: [lantern] });

        const res = await postIntent(app, {
            action: 'add',
            item: { id: 'b2', name: 'Rope, Hempen', quantity: 2, description: '50 ft' },
        });

        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        // Clobber-class law: an item intent NEVER touches the coins living on the ledger.
        expect(saved.currency).toEqual({ pp: 0, gp: 11, sp: 0, cp: 1 });
        // The client-minted id is KEPT so the writer's optimistic row keeps its key.
        expect(saved.items).toEqual([
            { id: 'a1', name: 'QA Lantern', quantity: 1, description: 'steady flame' },
            { id: 'b2', name: 'Rope, Hempen', quantity: 2, description: '50 ft' },
        ]);
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, saved, CAMPAIGN);
    });

    it('mints a server id for an add that carries none', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await postIntent(app, { action: 'add', item: { name: 'Torch', quantity: 1 } });

        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        expect(saved.items).toHaveLength(1);
        expect(saved.items[0].id).toBeTruthy();
        expect(saved.items[0].description).toBe('');
    });

    it('is idempotent per id — a retried add rewrites the row instead of double-adding', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const first = await postIntent(app, { action: 'add', item: { id: 'b2', name: 'Torch', quantity: 1 } });
        const retry = await postIntent(app, { action: 'add', item: { id: 'b2', name: 'Torch', quantity: 3 } });

        expect(first.status).toBe(200);
        expect(retry.status).toBe(200);
        expect(readInventoryFile().items).toEqual([
            { id: 'b2', name: 'Torch', quantity: 3, description: '' },
        ]);
    });

    it('rejects malformed item bodies with a plain-English 400 and writes nothing', async () => {
        writeInventory({ currency: { pp: 0, gp: 3, sp: 0, cp: 0 }, items: [lantern] });
        const before = mockFsState.get(invPath);

        const noName = await postIntent(app, { action: 'add', item: { quantity: 1 } });
        expect(noName.status).toBe(400);
        expect(noName.body.error).toBe('item.name is required');

        const badQty = await postIntent(app, { action: 'add', item: { name: 'Torch', quantity: 0 } });
        expect(badQty.status).toBe(400);
        expect(badQty.body.error).toBe('quantity must be a positive integer');

        const noItem = await postIntent(app, { action: 'add' });
        expect(noItem.status).toBe(400);

        const badAction = await postIntent(app, { action: 'polish', id: 'a1' });
        expect(badAction.status).toBe(400);
        expect(badAction.body.error).toBe('action must be "add", "update", "setQty" or "delete"');

        expect(mockFsState.get(invPath)).toBe(before);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});

describe('POST inventory/item update', () => {
    it('rewrites the targeted row\'s fields, leaving every other row untouched', async () => {
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [lantern, { id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' }],
        });

        const res = await postIntent(app, {
            action: 'update',
            item: { id: 'a1', name: 'QA Lantern (lit)', quantity: 4, description: 'brighter now' },
        });

        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        expect(saved.items.find(i => i.id === 'a1')).toEqual({
            id: 'a1', name: 'QA Lantern (lit)', quantity: 4, description: 'brighter now',
        });
        expect(saved.items.find(i => i.id === 'c3')).toEqual({ id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' });
    });

    it('409s an update whose row a concurrent window already deleted — labelled by NAME, never the raw id', async () => {
        writeInventory({ currency: { pp: 0, gp: 9, sp: 0, cp: 0 }, items: [] });

        const res = await postIntent(app, {
            action: 'update',
            item: { id: 'a1', name: 'QA Lantern', quantity: 2, description: '' },
        });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe(
            'Party item "QA Lantern" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.'
        );
        expect(res.body.error).not.toContain('a1');
        // The 409 carries the server's current merged doc so the stale view can adopt truth.
        expect(res.body.inventory.items).toEqual([]);
        expect(res.body.inventory.currency).toEqual({ pp: 0, gp: 9, sp: 0, cp: 0 });
        // The stale writer must NOT resurrect the row.
        expect(readInventoryFile().items).toEqual([]);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('400s an update with no id', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [lantern] });
        const res = await postIntent(app, { action: 'update', item: { name: 'QA Lantern', quantity: 1 } });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('item.id is required to update an item');
    });
});

describe('POST inventory/item setQty and delete', () => {
    it('setQty applies the ABSOLUTE quantity to one row and leaves the rest of the ledger', async () => {
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [lantern, { id: 'c3', name: 'Ziggurat Map', quantity: 7, description: '' }],
        });

        const res = await postIntent(app, { action: 'setQty', id: 'a1', quantity: 12, name: 'QA Lantern' });

        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        expect(saved.items.find(i => i.id === 'a1').quantity).toBe(12);
        expect(saved.items.find(i => i.id === 'c3').quantity).toBe(7);
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, saved, CAMPAIGN);
    });

    it('delete removes exactly one row by id', async () => {
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [lantern, { id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' }],
        });

        const res = await postIntent(app, { action: 'delete', id: 'a1', name: 'QA Lantern' });

        expect(res.status).toBe(200);
        expect(readInventoryFile().items).toEqual([{ id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' }]);
    });

    it('409s a setQty/delete whose row a concurrent window already deleted — no resurrection, no ghost audit', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [{ id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' }] });

        const step = await postIntent(app, { action: 'setQty', id: 'a1', quantity: 2, name: 'QA Lantern' });
        expect(step.status).toBe(409);
        expect(step.body.error).toContain('Party item "QA Lantern" was deleted in another tab or session');

        const del = await postIntent(app, { action: 'delete', id: 'a1', name: 'QA Lantern' });
        expect(del.status).toBe(409);
        // A delete that was already performed by another window keeps no id in its copy.
        expect(del.body.error).not.toContain('a1');
        expect(del.body.inventory.items).toEqual([{ id: 'c3', name: 'Ziggurat Map', quantity: 1, description: '' }]);

        expect(readInventoryFile().items).toHaveLength(1);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('falls back to the id for a conflict label when the sender carries no name', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
        const res = await postIntent(app, { action: 'delete', id: 'untitled-row' });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('Party item "untitled-row" was deleted');
    });

    it('400s missing ids and non-whole quantities', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [lantern] });

        expect((await postIntent(app, { action: 'setQty', quantity: 2 })).status).toBe(400);
        expect((await postIntent(app, { action: 'delete' })).status).toBe(400);

        const zero = await postIntent(app, { action: 'setQty', id: 'a1', quantity: 0, name: 'QA Lantern' });
        expect(zero.status).toBe(400);
        expect(zero.body.error).toBe('quantity must be a positive integer');
        expect(readInventoryFile().items[0].quantity).toBe(1);
    });
});

// The exact live repro: window A adds an item, window B (whose view never saw it) then
// saves its own change. Under the snapshot lane B's whole-list POST erased A's row; per
// -row intents BOTH land.
describe('POST inventory/item concurrent-window merge (cross-tab clobber regression)', () => {
    it('a stale setQty from window B lands additively beside window A\'s fresh add (Lantern→2 + Coin survives)', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [lantern] });

        // Window A: Add Item 'QA Concurrent Coin' → Save.
        const a = await postIntent(app, {
            action: 'add',
            item: { id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' },
        });
        expect(a.status).toBe(200);

        // Window B: still holds only {Lantern} — steps its quantity. Its POST must not
        // carry (and therefore cannot replace) the item list.
        const b = await postIntent(app, { action: 'setQty', id: 'a1', quantity: 2, name: 'QA Lantern' });
        expect(b.status).toBe(200);

        const saved = readInventoryFile();
        expect(saved.items.map(i => i.name)).toEqual(['QA Concurrent Coin', 'QA Lantern']);
        expect(saved.items.find(i => i.id === 'a1').quantity).toBe(2);
        // B's ack is the MERGED doc — A's add is visible to B the moment it lands.
        expect(b.body.inventory.items.map(i => i.name)).toEqual(['QA Concurrent Coin', 'QA Lantern']);
    });

    it('a stale delete from window B removes only its target and keeps window A\'s fresh add', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [lantern] });

        await postIntent(app, { action: 'add', item: { id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' } });
        const b = await postIntent(app, { action: 'delete', id: 'a1', name: 'QA Lantern' });

        expect(b.status).toBe(200);
        expect(readInventoryFile().items).toEqual([
            { id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' },
        ]);
    });

    it('cross-window adds of the same name from two windows both land (additive merge, never silent loss)', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const a = await postIntent(app, { action: 'add', item: { id: 'w-a', name: 'Torch', quantity: 1 } });
        const b = await postIntent(app, { action: 'add', item: { id: 'w-b', name: 'Torch', quantity: 1 } });

        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(readInventoryFile().items).toHaveLength(2);
    });
});

// No-backward-compatibility law: the whole-list snapshot lane is GONE — nothing in the
// app may re-introduce a full-item-list replace (it is what let stale windows clobber).
describe('retired POST /inventory snapshot lane', () => {
    it('POST /api/campaigns/:campaign/inventory 404s — the full item-list replace lane no longer exists', async () => {
        writeInventory({ currency: { pp: 0, gp: 11, sp: 0, cp: 1 }, items: [lantern] });

        const res = await request(app)
            .post(`/api/campaigns/${CAMPAIGN}/inventory`)
            .send({ items: [{ name: 'Torch', quantity: 1 }] });

        expect(res.status).toBe(404);
        expect(readInventoryFile().items).toEqual([lantern]);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
