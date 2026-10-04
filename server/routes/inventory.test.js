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

    it('persists, sorts items, sanitizes currency, and broadcasts via SSE', async () => {
        const res = await request(app).post(`/api/campaigns/${CAMPAIGN}/inventory`).send({
            currency: { gp: 25, sp: -5, cp: 7.9, electrum: 3 },
            items: [
                { name: 'Rope, Hempen', quantity: 2, description: '50 ft' },
                { name: 'Amulet', quantity: 0 },
                { name: '', quantity: 1 },
            ],
        });
        expect(res.status).toBe(200);
        const saved = readInventoryFile();
        expect(saved.currency).toEqual({ pp: 0, gp: 25, sp: 0, cp: 7 });
        expect(saved.items).toHaveLength(1);
        expect(saved.items[0].name).toBe('Rope, Hempen');
        expect(saved.items[0].id).toBeTruthy();
        expect(publishSpy).toHaveBeenCalledWith(`inventory-${CAMPAIGN}`, expect.objectContaining({ currency: saved.currency }), CAMPAIGN);
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
