import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import inventory from './inventory.js';

// ---------------------------------------------------------------------------
// Mock filesystem
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAMPAIGN = 'test-campaign';
const invPath = `/mock/campaigns/${CAMPAIGN}/data/inventory.json`;
const charPath = `/mock/campaigns/${CAMPAIGN}/War_Cleric.json`;

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(inventory);
    return app;
}

function writeInventory(data) {
    mockFsState.set(invPath, JSON.stringify(data));
}

function writeCharacter(data) {
    mockFsState.set(charPath, JSON.stringify(data));
}

function readInventoryFile() {
    return JSON.parse(mockFsState.get(invPath));
}

function readCharacterFile() {
    return JSON.parse(mockFsState.get(charPath));
}

const baseCharacter = () => ({
    name: 'War Cleric',
    inventory: { backpack: ['Thieves\' Tools'], equipped: ['Mace'], gold: 10, magicItems: [] },
});

let app;

beforeEach(() => {
    mockFsState.clear();
    publishSpy.mockClear();
    app = makeApp();
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:campaign/inventory
// ---------------------------------------------------------------------------

describe('GET inventory', () => {
    it('returns an empty initialized inventory when the file does not exist', async () => {
        const res = await request(app).get(`/api/campaigns/${CAMPAIGN}/inventory`);
        expect(res.status).toBe(200);
        expect(res.body.inventory).toEqual({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [],
        });
    });

    it('returns stored inventory sorted by name', async () => {
        writeInventory({
            currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
            items: [
                { id: 'b', name: 'Torch', quantity: 5, description: '' },
                { id: 'a', name: 'Antitoxin', quantity: 1, description: 'venom' },
            ],
        });
        const res = await request(app).get(`/api/campaigns/${CAMPAIGN}/inventory`);
        expect(res.body.inventory.currency).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 });
        expect(res.body.inventory.items.map(i => i.name)).toEqual(['Antitoxin', 'Torch']);
    });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:campaign/inventory
// ---------------------------------------------------------------------------

describe('POST inventory', () => {
    it('rejects a non-array items payload', async () => {
        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory`).send({ items: 'nope' });
        expect(res.status).toBe(400);
    });

    it('replaces and sorts items while PRESERVING the stored currency (clobber regression)', async () => {
        writeInventory({
            currency: { pp: 0, gp: 11, sp: 0, cp: 1 },
            items: [{ id: 'old', name: 'Old Lantern', quantity: 1, description: '' }],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory`).send({
            items: [
                { name: 'Rope, Hempen', quantity: 2, description: '50 ft' },
                { name: 'Amulet', quantity: 0 },
                { name: '', quantity: 1 },
            ],
        });
        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        // Cross-tab clobber fix: a full items snapshot must never touch the coin
        // ledger — the other window's debounced presses live only there.
        expect(saved.currency).toEqual({ pp: 0, gp: 11, sp: 0, cp: 1 });
        expect(saved.items).toHaveLength(1);
        expect(saved.items[0].name).toBe('Rope, Hempen');
        expect(saved.items[0].id).toBeTruthy();
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, saved, CAMPAIGN);
    });

    it('refuses a snapshot body carrying currency — loud 400, disk untouched', async () => {
        writeInventory({ currency: { pp: 0, gp: 11, sp: 0, cp: 1 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory`).send({
            currency: { pp: 0, gp: 25, sp: 0, cp: 0 },
            items: [],
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/currency is not written by this lane/);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 11, sp: 0, cp: 1 });
        expect(publishSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:campaign/inventory/transfer
// ---------------------------------------------------------------------------

describe('POST inventory transfer', () => {
    it('validates direction and payload', async () => {
        writeCharacter(baseCharacter());
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const bad = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'sideways', itemName: 'Torch', quantity: 1 });
        expect(bad.status).toBe(400);

        const noTarget = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player' });
        expect(noTarget.status).toBe(400);

        const both = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', itemName: 'Torch', quantity: 1, currency: { gp: 1 } });
        expect(both.status).toBe(400);
    });

    it('returns 404 for an unknown player', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'Nobody', direction: 'party-to-player', itemName: 'Torch', quantity: 1 });
        expect(res.status).toBe(404);
    });

    it('moves a party item into a player backpack as a plain string with itemMeta quantity', async () => {
        writeCharacter(baseCharacter());
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [{ id: 'x', name: 'Torch', quantity: 3, description: 'burns an hour' }],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', itemName: 'torch', quantity: 2 });

        expect(res.status).toBe(200);
        const character = readCharacterFile();
        expect(character.inventory.backpack).toContain('Torch');
        expect(character.inventory.backpack.every(n => typeof n === 'string')).toBe(true);
        expect(character.inventory.itemMeta.Torch).toEqual({ quantity: 2, description: 'burns an hour' });

        const inventory = readInventoryFile();
        expect(inventory.items[0].quantity).toBe(1);
        expect(publishSpy).toHaveBeenCalledWith(`character-${CAMPAIGN}-War_Cleric.json`, expect.any(Object), CAMPAIGN);
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, expect.any(Object), CAMPAIGN);
    });

    it('merges with an item the player already carries', async () => {
        writeCharacter(baseCharacter());
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [{ id: 'x', name: 'Thieves\' Tools', quantity: 2, description: '' }],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', itemName: 'Thieves\' Tools', quantity: 2 });

        expect(res.status).toBe(200);
        const character = readCharacterFile();
        expect(character.inventory.backpack.filter(n => n === 'Thieves\' Tools')).toHaveLength(1);
        expect(character.inventory.itemMeta["Thieves' Tools"].quantity).toBe(3);
    });

    it('rejects moving more of an item than the party has', async () => {
        writeCharacter(baseCharacter());
        writeInventory({
            currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
            items: [{ id: 'x', name: 'Torch', quantity: 1, description: '' }],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', itemName: 'Torch', quantity: 5 });

        expect(res.status).toBe(409);
        expect(readInventoryFile().items[0].quantity).toBe(1);
        expect(readCharacterFile().inventory.backpack).not.toContain('Torch');
    });

    it('moves a player item to the party, decrementing itemMeta quantity', async () => {
        const character = baseCharacter();
        character.inventory.backpack.push('Rope, Hempen');
        character.inventory.itemMeta = { 'Rope, Hempen': { quantity: 3, description: '50 ft' } };
        writeCharacter(character);
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'player-to-party', itemName: 'Rope, Hempen', quantity: 2 });

        expect(res.status).toBe(200);
        const updated = readCharacterFile();
        expect(updated.inventory.backpack).toContain('Rope, Hempen');
        expect(updated.inventory.itemMeta['Rope, Hempen'].quantity).toBe(1);
        expect(readInventoryFile().items).toEqual([
            expect.objectContaining({ name: 'Rope, Hempen', quantity: 2, description: '50 ft' }),
        ]);
    });

    it('removes the backpack string when the last of an item is moved', async () => {
        const character = baseCharacter();
        character.inventory.backpack.push('Potion');
        character.inventory.itemMeta = { Potion: { quantity: 1, description: '' } };
        writeCharacter(character);
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'player-to-party', itemName: 'Potion', quantity: 1 });

        expect(res.status).toBe(200);
        const updated = readCharacterFile();
        expect(updated.inventory.backpack).not.toContain('Potion');
        expect(updated.inventory.itemMeta && updated.inventory.itemMeta.Potion).toBeFalsy();
    });

    it('rejects taking more than the player carries', async () => {
        const character = baseCharacter();
        character.inventory.backpack.push('Arrow');
        writeCharacter(character);
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'player-to-party', itemName: 'Arrow', quantity: 2 });

        expect(res.status).toBe(409);
        expect(readInventoryFile().items).toHaveLength(0);
    });

    it('moves currency party-to-player and keeps inventory.gold in sync', async () => {
        writeCharacter(baseCharacter());
        writeInventory({
            currency: { pp: 2, gp: 50, sp: 0, cp: 0 },
            items: [],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', currency: { gp: 20, pp: 1 } });

        expect(res.status).toBe(200);
        const character = readCharacterFile();
        expect(character.inventory.currency).toEqual({ pp: 1, gp: 30, sp: 0, cp: 0 });
        expect(character.inventory.gold).toBe(30);
        expect(readInventoryFile().currency).toEqual({ pp: 1, gp: 30, sp: 0, cp: 0 });
    });

    it('moves currency player-to-party falling back to inventory.gold', async () => {
        writeCharacter(baseCharacter());
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'player-to-party', currency: { gp: 4 } });

        expect(res.status).toBe(200);
        expect(readCharacterFile().inventory.gold).toBe(6);
        expect(readInventoryFile().currency.gp).toBe(4);
    });

    it('rejects currency transfer exceeding the party coffer', async () => {
        writeCharacter(baseCharacter());
        writeInventory({ currency: { pp: 0, gp: 3, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/transfer`)
            .send({ playerName: 'War Cleric', direction: 'party-to-player', currency: { gp: 10 } });

        expect(res.status).toBe(409);
        expect(readInventoryFile().currency.gp).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:campaign/inventory/adjust — atomic signed per-coin delta
// (the +/- chip flush and the loot Award panel; replaced /deposit)
// ---------------------------------------------------------------------------

describe('POST inventory adjust', () => {
    it('rejects an empty or all-zero currency body', async () => {
        writeInventory({ currency: { pp: 0, gp: 5, sp: 0, cp: 0 }, items: [] });

        const empty = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`).send({});
        expect(empty.status).toBe(400);

        const zero = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { pp: 0, gp: 0, sp: 0, cp: 0, electrum: 9 } });
        expect(zero.status).toBe(400);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });

        const nonNumeric = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { gp: 'abc' } });
        expect(nonNumeric.status).toBe(400);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });
    });

    it('credits positive deltas onto the stored ledger, leaves items untouched, and broadcasts', async () => {
        writeInventory({
            currency: { pp: 2, gp: 5, sp: 0, cp: 7 },
            items: [{ id: 'x', name: 'Torch', quantity: 3, description: '' }],
        });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { pp: 70, gp: 3, sp: 0, cp: 0 } });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.inventory.currency).toEqual({ pp: 72, gp: 8, sp: 0, cp: 7 });
        expect(res.body.inventory.items).toEqual([{ id: 'x', name: 'Torch', quantity: 3, description: '' }]);

        const saved = readInventoryFile();
        expect(saved.currency).toEqual({ pp: 72, gp: 8, sp: 0, cp: 7 });
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, saved, CAMPAIGN);
    });

    it('applies negative deltas clamped at zero per coin', async () => {
        writeInventory({ currency: { pp: 0, gp: 5, sp: 2, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { gp: -10, sp: -2 } });

        expect(res.status).toBe(200);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
    });

    it('initializes a missing inventory file and adjusts onto the empty ledger', async () => {
        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { gp: 25 } });

        expect(res.status).toBe(200);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 25, sp: 0, cp: 0 });
    });

    it('truncates non-whole and stringified amounts', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { gp: '10.9', sp: 'abc', cp: 4.5 } });

        expect(res.status).toBe(200);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 10, sp: 0, cp: 4 });
    });

    // Cross-tab full-doc clobber regression (bug-inventory-chip-cross-tab-full-doc-clobber):
    // two GM windows pressing within the same debounce window used to each POST their
    // own whole-document snapshot and the later POST silently erased the earlier press.
    // Every flush is now a server-side delta onto the CURRENT ledger, so both land.
    it('lands concurrent same-coin presses from two sessions additively (2×+1 cp → 2)', async () => {
        writeInventory({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });

        const first = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { cp: 1 } });
        const second = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { cp: 1 } });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(readInventoryFile().currency.cp).toBe(2);
    });

    it('lands concurrent cross-coin presses additively (+100 gp ∥ +10 cp → both)', async () => {
        writeInventory({ currency: { pp: 0, gp: 11, sp: 0, cp: 1 }, items: [] });

        const gold = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { gp: 100 } });
        const copper = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory/adjust`)
            .send({ currency: { cp: 10 } });

        expect(gold.status).toBe(200);
        expect(copper.status).toBe(200);
        expect(readInventoryFile().currency).toEqual({ pp: 0, gp: 111, sp: 0, cp: 11 });
    });
});
