// Regression for bug-retired-inventory-post-shadowed-by-change-data-wildcard:
// the item-intent fix retired POST /api/campaigns/:campaign/inventory, but the
// 404 pin in inventory.item-intent.test.js mounts the router in isolation —
// invisible to it, the composed server fell THROUGH to the generic change-data
// wildcard (campaigns-changedata.js POST /:campaign/:key; L5 rule: no validator
// registered ⇒ the write passes through), which answered 200 "Data saved
// successfully" and persisted the raw snapshot verbatim as a phantom top-level
// `inventory` change-data key. A stale pre-fix tab got a false success for a
// treasury write that never touched inventory.json, with no UI/log face.
//
// These tests pin the COMPOSED stack in the real server.js mount order (inventory
// BEFORE changedata): the retired path answers the loud 400 naming the replacement
// lanes and creates NO change-data key — while the adjacent lanes (real GET
// /inventory, /inventory/adjust, /inventory/item, legitimate wildcard writes, and
// the wildcard DELETE eviction path for already-poisoned stores) keep working.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const { FILE_SYSTEM, fsMock } = vi.hoisted(() => {
    const FILE_SYSTEM = new Map();
    const fsMock = {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => { FILE_SYSTEM.set(p, c); },
        unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
    };
    return { FILE_SYSTEM, fsMock };
});

vi.mock('fs', () => ({ default: fsMock, ...fsMock }));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

// Shared store both routers read/write — one mock covers both (same
// '../utils/changeData.js' specifier). vi.hoisted: the factory reads it at
// mock-construction time, before module-level consts initialize.
const { CHANGE_STORE, publishedEvents, markDirtyCalls } = vi.hoisted(() => ({
    CHANGE_STORE: new Map(),
    publishedEvents: [],
    markDirtyCalls: [],
}));
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
    characterChangeData: CHANGE_STORE,
    markDirty: vi.fn((campaign) => { markDirtyCalls.push(campaign); }),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
}));

// Transfer audit / write_rejected rows go through the one server log pipeline;
// hermetic noop here (rows themselves are pinned in their own suites).
vi.mock('./log.js', () => ({ addEntry: vi.fn() }));

import inventory from './inventory.js';
import campaignsChangedata from './campaigns-changedata.js';

const CAMPAIGN = 'test-campaign';
const invPath = `/mock/campaigns/${CAMPAIGN}/data/inventory.json`;

const SNAPSHOT_BODY = { currency: { cp: 5 }, items: [] };
const REAL_LEDGER = { currency: { pp: 0, gp: 11, sp: 0, cp: 1 }, items: [] };

function writeInventory(data) {
    FILE_SYSTEM.set(invPath, JSON.stringify(data));
}

function readInventoryFile() {
    return JSON.parse(FILE_SYSTEM.get(invPath));
}

// Real server.js mount order — the shadow only reproduces (and the guard only
// wins) with inventory BEFORE changedata.
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(inventory);
    app.use(campaignsChangedata);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    CHANGE_STORE.clear();
    publishedEvents.length = 0;
    markDirtyCalls.length = 0;
});

describe('composed stack: retired POST /inventory never shadows into the change-data wildcard', () => {
    it('POST /:campaign/inventory answers a plain-English 400 naming both replacement lanes', async () => {
        writeInventory(REAL_LEDGER);

        const res = await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/inventory`)
            .send(SNAPSHOT_BODY);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/snapshot save lane is retired/i);
        expect(res.body.error).toMatch(/\/api\/campaigns\/test-campaign\/inventory\/adjust/);
        expect(res.body.error).toMatch(/\/api\/campaigns\/test-campaign\/inventory\/item/);
        expect(res.body.error).toMatch(/nothing was saved/i);
    });

    it('writes NOTHING: no phantom change-data key, no disk write, no broadcast, store entry not even created', async () => {
        writeInventory(REAL_LEDGER);

        await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/inventory`)
            .send(SNAPSHOT_BODY);

        expect(CHANGE_STORE.has(CAMPAIGN)).toBe(false);
        expect(markDirtyCalls).toHaveLength(0);
        expect(publishedEvents).toHaveLength(0);
        expect(readInventoryFile()).toEqual(REAL_LEDGER);

        const cd = await request(createTestApp()).get(`/api/campaigns/${CAMPAIGN}/change-data`);
        expect(cd.status).toBe(200);
        expect(cd.body).toEqual({});
    });

    it('GET /:campaign/inventory still serves the REAL ledger even while a phantom key sits in the store (the split-face of the bug)', async () => {
        writeInventory(REAL_LEDGER);
        CHANGE_STORE.set(CAMPAIGN, { inventory: SNAPSHOT_BODY });

        const res = await request(createTestApp()).get(`/api/campaigns/${CAMPAIGN}/inventory`);

        expect(res.status).toBe(200);
        expect(res.body.inventory).toEqual(REAL_LEDGER);
    });
});

describe('composed stack: adjacent lanes stay intact around the guard', () => {
    it('the live chip/loot lane POST /inventory/adjust still applies deltas through the composition', async () => {
        writeInventory(REAL_LEDGER);

        const res = await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { cp: 2 } });

        expect(res.status).toBe(200);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 11, sp: 0, cp: 3 });
        expect(publishedEvents).toContainEqual({ key: `inventory-${CAMPAIGN}`, data: readInventoryFile() });
    });

    it('the live item lane POST /inventory/item still adds rows through the composition', async () => {
        writeInventory(REAL_LEDGER);

        const res = await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/inventory/item`)
            .send({ action: 'add', item: { id: 'w1', name: 'QA Torch', quantity: 1, description: '' } });

        expect(res.status).toBe(200);
        expect(readInventoryFile().items).toEqual([
            { id: 'w1', name: 'QA Torch', quantity: 1, description: '' },
        ]);
    });

    it('legitimate wildcard change-data writes still pass through (200 + store + broadcast)', async () => {
        const res = await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/activeCreatureName`)
            .send({ value: 'AasimarTest' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data saved successfully');
        expect(CHANGE_STORE.get(CAMPAIGN).activeCreatureName).toBe('AasimarTest');
        expect(publishedEvents).toContainEqual({
            key: `change-${CAMPAIGN}-activeCreatureName`,
            data: 'AasimarTest',
        });
    });

    it('the deprecated "campaign" key guard still answers its 400 through the composition', async () => {
        const res = await request(createTestApp())
            .post(`/api/campaigns/${CAMPAIGN}/campaign`)
            .send({ enforcement: { mode: 'off' } });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Use \/api\/campaigns\/test-campaign\/enforcement/);
    });

    it('DELETE /:campaign/inventory stays wildcard-owned — the eviction lane for already-poisoned stores', async () => {
        writeInventory(REAL_LEDGER);
        CHANGE_STORE.set(CAMPAIGN, { inventory: SNAPSHOT_BODY });

        const res = await request(createTestApp())
            .delete(`/api/campaigns/${CAMPAIGN}/inventory`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data deleted successfully');
        expect(CHANGE_STORE.get(CAMPAIGN)).not.toHaveProperty('inventory');
        expect(publishedEvents).toContainEqual({ key: `change-${CAMPAIGN}-inventory`, data: null });
        expect(readInventoryFile()).toEqual(REAL_LEDGER);
    });

    it('DELETE of a never-created phantom answers the wildcard honest 404 (no false success either)', async () => {
        CHANGE_STORE.set(CAMPAIGN, {});

        const res = await request(createTestApp())
            .delete(`/api/campaigns/${CAMPAIGN}/inventory`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Change-data key not found/i);
    });
});
