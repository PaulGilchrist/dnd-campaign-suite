// Regression lock for bug-player-clients-can-write-party-inventory — server-side
// authority guard on the durable party-treasury routes. Party inventory is GM-only
// write territory (AGENTS.md read-only-network-client doctrine, mirrors the
// campaigns-character.js refuseUnlessGm / maps.js / quests.js / campaigns-admin.js
// pattern and the client-side PartyInventory.jsx isLocalhost gate): a non-localhost
// (network) client must get 403 with NO inventory file written and NO SSE broadcast
// on every minting/disbursing lane — the items-ledger POST, currency adjust (chip
// flush / loot award), and party→player transfers.
//
// Audited exception: player→party transfers stay OPEN to every client — a player may
// contribute from their OWN resources; the server debits the character file atomically
// (409 when short), so that lane can never mint treasury wealth (playbook: durable
// treasury — writes there are permanent-data integrity events).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
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
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

let publishedEvents = [];
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
}));

// Transfer audit rows: hermetic noop (pinned in inventory.transfer-audit.test.js).
const logEntrySpy = vi.hoisted(() => vi.fn());
vi.mock('./log.js', () => ({ addEntry: logEntrySpy }));

import inventory from './inventory.js';

const CAMPAIGN = 'test-campaign';
const invPath = `/mock/campaigns/${CAMPAIGN}/data/inventory.json`;
const charPath = `/mock/campaigns/${CAMPAIGN}/AasimarTest.json`;
const LAN_HOSTS = ['192.168.0.239', '100.92.171.80', 'example.test'];

const baseInventory = () => ({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
const baseCharacter = () => ({
    name: 'AasimarTest',
    inventory: { backpack: ['Torch'], equipped: [], gold: 10, magicItems: [], itemMeta: { Torch: { quantity: 2, description: '' } } },
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(inventory);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishedEvents = [];
    logEntrySpy.mockClear();
});

describe('inventory — localhost authority gate (GM-only treasury writes)', () => {
    describe.each(LAN_HOSTS)('from LAN host %s', (host) => {
        it('POST /inventory/item (single-row intent) ⇒ 403, disk untouched, no broadcast', async () => {
            setupFs({ [invPath]: baseInventory() });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/item`)
                .set('Host', host)
                .send({ action: 'add', item: { name: 'Torch', quantity: 1, description: '' } });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/GM-only/i);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(0);
            expect(publishedEvents).toHaveLength(0);
        });

        it('POST /inventory/adjust (currency delta mint/removal) ⇒ 403, disk untouched, no broadcast', async () => {
            setupFs({ [invPath]: baseInventory() });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
                .set('Host', host)
                .send({ currency: { gp: 100 } });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/GM-only/i);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(0);
            expect(publishedEvents).toHaveLength(0);
        });

        it('POST /inventory/transfer party-to-player (disbursement) ⇒ 403, no file writes', async () => {
            setupFs({
                [invPath]: { currency: { pp: 0, gp: 50, sp: 0, cp: 0 }, items: [{ id: 'x', name: 'Torch', quantity: 3, description: '' }] },
                [charPath]: baseCharacter(),
            });

            const currency = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
                .set('Host', host)
                .send({ playerName: 'AasimarTest', direction: 'party-to-player', currency: { gp: 50 } });
            expect(currency.status).toBe(403);

            const item = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
                .set('Host', host)
                .send({ playerName: 'AasimarTest', direction: 'party-to-player', itemName: 'Torch', quantity: 3 });
            expect(item.status).toBe(403);

            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(50);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).items).toHaveLength(1);
            expect(JSON.parse(FILE_SYSTEM.get(charPath)).inventory.gold).toBe(10);
            expect(publishedEvents).toHaveLength(0);
            // A refused disbursement writes no audit row either (it never happened).
            expect(logEntrySpy).not.toHaveBeenCalled();
        });

        it('GET /inventory (treasury read lane) stays open', async () => {
            setupFs({ [invPath]: { currency: { pp: 0, gp: 7, sp: 0, cp: 0 }, items: [] } });

            const res = await request(createTestApp())
                .get(`/api/campaigns/${CAMPAIGN}/inventory`)
                .set('Host', host);

            expect(res.status).toBe(200);
            expect(res.body.inventory.currency.gp).toBe(7);
        });

        it('POST /inventory/transfer player-to-party (contribution lane) stays open — server debits the character', async () => {
            setupFs({ [invPath]: baseInventory(), [charPath]: baseCharacter() });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
                .set('Host', host)
                .send({ playerName: 'AasimarTest', direction: 'player-to-party', currency: { gp: 4 } });

            expect(res.status).toBe(200);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(4);
            expect(JSON.parse(FILE_SYSTEM.get(charPath)).inventory.gold).toBe(6);
            // The open drain lane is never silent: the server stamps exactly one
            // attributed audit row per accepted contribution (backlog AB).
            expect(logEntrySpy).toHaveBeenCalledTimes(1);
            expect(logEntrySpy).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'inventory_transfer',
                message: '4 gp moved from AasimarTest to party inventory',
                contributedBy: 'AasimarTest',
            }));

            // Cannot mint via over-contribution either: debit is server-verified.
            const overdraft = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
                .set('Host', host)
                .send({ playerName: 'AasimarTest', direction: 'player-to-party', currency: { gp: 999 } });
            expect(overdraft.status).toBe(409);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(4);
            expect(logEntrySpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('localhost GM lanes unchanged', () => {
        it('POST /inventory/item still appends the row + broadcasts (currency untouched)', async () => {
            setupFs({ [invPath]: { currency: { pp: 0, gp: 7, sp: 0, cp: 0 }, items: [] } });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/item`)
                .set('Host', 'localhost')
                .send({ action: 'add', item: { id: 't1', name: 'Torch', quantity: 2, description: '' } });

            expect(res.status).toBe(200);
            const saved = JSON.parse(FILE_SYSTEM.get(invPath));
            expect(saved.items).toEqual([{ id: 't1', name: 'Torch', quantity: 2, description: '' }]);
            expect(saved.currency.gp).toBe(7);
            expect(publishedEvents.find(e => e.key === `inventory-${CAMPAIGN}`)).toBeTruthy();
        });

        it('POST /inventory/adjust still credits the ledger', async () => {
            setupFs({ [invPath]: baseInventory() });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
                .set('Host', 'localhost')
                .send({ currency: { gp: 25 } });

            expect(res.status).toBe(200);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(25);
        });

        it('POST /inventory/transfer party-to-player still disburses', async () => {
            setupFs({
                [invPath]: { currency: { pp: 0, gp: 50, sp: 0, cp: 0 }, items: [] },
                [charPath]: baseCharacter(),
            });

            const res = await request(createTestApp())
                .post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
                .set('Host', '127.0.0.1')
                .send({ playerName: 'AasimarTest', direction: 'party-to-player', currency: { gp: 20 } });

            expect(res.status).toBe(200);
            expect(JSON.parse(FILE_SYSTEM.get(invPath)).currency.gp).toBe(30);
            expect(JSON.parse(FILE_SYSTEM.get(charPath)).inventory.gold).toBe(30);
        });
    });
});
