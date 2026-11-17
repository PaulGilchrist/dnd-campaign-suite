// Audit stamp (backlog 2026-11-17 AB): every ACCEPTED POST /inventory/transfer — either
// direction, currency or items — appends exactly ONE campaign-log `inventory_transfer`
// row SERVER-side (the /transfer lane's client-side addEntry calls were removed with
// this stamp, so a UI transfer lands one row, not two, and a direct-API drain from any
// LAN tab can no longer pass untraceable). Attribution: an optional `contributedBy`
// body field is a CLIENT ASSERTION (no auth exists) — sanitized (whitespace-collapsed,
// 80-char cap) and recorded when sent; absent/garbage falls back to the character name
// the server actually debited/credited. Refused requests (400/404/409) write no row.
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

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
}));

const { addEntrySpy } = vi.hoisted(() => ({ addEntrySpy: vi.fn() }));
vi.mock('./log.js', () => ({ addEntry: addEntrySpy }));

const CAMPAIGN = 'test-campaign';
const invPath = `/mock/campaigns/${CAMPAIGN}/data/inventory.json`;
const charPath = `/mock/campaigns/${CAMPAIGN}/War_Cleric.json`;
const transferUrl = `/api/campaigns/${CAMPAIGN}/inventory/transfer`;

const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(inventory);
    return app;
};

const writeInventory = (data) => mockFsState.set(invPath, JSON.stringify(data));
const writeCharacter = (data) => mockFsState.set(charPath, JSON.stringify(data));

const baseCharacter = () => ({
    name: 'War Cleric',
    inventory: {
        backpack: ['Rope, Hempen'],
        equipped: [],
        gold: 10,
        magicItems: [],
        itemMeta: { 'Rope, Hempen': { quantity: 3, description: '50 ft' } },
    },
});

const richPool = () => ({
    currency: { pp: 5, gp: 50, sp: 2, cp: 1 },
    items: [{ id: 'x', name: 'Torch', quantity: 3, description: 'burns an hour' }],
});

let app;

const postTransfer = (body, host) => {
    const req = request(app).post(transferUrl);
    return (host ? req.set('Host', host) : req).send(body);
};

beforeEach(() => {
    mockFsState.clear();
    addEntrySpy.mockClear();
    writeCharacter(baseCharacter());
    writeInventory(richPool());
    app = makeApp();
});

// ---------------------------------------------------------------------------
// Exactly one row per accepted transfer — both directions, both payload kinds
// ---------------------------------------------------------------------------

describe('accepted transfers append exactly one attributed audit row', () => {
    it('party→player currency: friendly copy preserved, actor falls back to the credited character', async () => {
        const res = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player', currency: { gp: 20 } });

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'inventory_transfer',
            message: '20 gp moved from party inventory to War Cleric',
            contributedBy: 'War Cleric',
        });
    });

    it('party→player multi-coin keeps the client-owned copy order (pp, gp, sp, cp)', async () => {
        const res = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player', currency: { pp: 1, gp: 20 } });

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy.mock.calls[0][1].message)
            .toBe('1 pp, 20 gp moved from party inventory to War Cleric');
    });

    it('party→player item: names quantity, item and destination', async () => {
        const res = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player', itemName: 'torch', quantity: 2 });

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy.mock.calls[0][1].message)
            .toBe('2 × torch moved from party inventory to War Cleric');
    });

    it('player→party currency (open drain lane, LAN host): the debit is never silent', async () => {
        const res = await postTransfer(
            { playerName: 'War Cleric', direction: 'player-to-party', currency: { gp: 4 } },
            '192.168.0.239'
        );

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'inventory_transfer',
            message: '4 gp moved from War Cleric to party inventory',
            contributedBy: 'War Cleric',
        });
    });

    it('player→party item: names quantity, item and source character', async () => {
        const res = await postTransfer({ playerName: 'War Cleric', direction: 'player-to-party', itemName: 'Rope, Hempen', quantity: 2 });

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy.mock.calls[0][1].message)
            .toBe('2 × Rope, Hempen moved from War Cleric to party inventory');
    });
});

// ---------------------------------------------------------------------------
// contributedBy — client assertion, recorded when sent, sanitized + capped
// ---------------------------------------------------------------------------

describe('contributedBy attribution', () => {
    it('records the client-supplied actor string when sent', async () => {
        const res = await postTransfer({
            playerName: 'War Cleric',
            direction: 'player-to-party',
            currency: { gp: 1 },
            contributedBy: 'Player Three',
        });

        expect(res.status).toBe(200);
        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        expect(addEntrySpy.mock.calls[0][1].contributedBy).toBe('Player Three');
        // The movement copy itself stays character-named (attribution is its own field).
        expect(addEntrySpy.mock.calls[0][1].message)
            .toBe('1 gp moved from War Cleric to party inventory');
    });

    it('collapses whitespace and caps the claim at 80 characters', async () => {
        const res = await postTransfer({
            playerName: 'War Cleric',
            direction: 'player-to-party',
            currency: { gp: 1 },
            contributedBy: `  sneaky\t tab   ${'x'.repeat(120)}  `,
        });

        expect(res.status).toBe(200);
        const claim = addEntrySpy.mock.calls[0][1].contributedBy;
        expect(claim).toBe('sneaky tab ' + 'x'.repeat(120).slice(0, 80 - 'sneaky tab '.length));
        expect(claim.length).toBe(80);
    });

    it('falls back to the character name for a non-string or blank claim', async () => {
        const garbage = await postTransfer({
            playerName: 'War Cleric',
            direction: 'player-to-party',
            currency: { gp: 1 },
            contributedBy: '   ',
        });
        expect(garbage.status).toBe(200);

        const object = await postTransfer({
            playerName: 'War Cleric',
            direction: 'player-to-party',
            currency: { gp: 1 },
            contributedBy: { identity: 'the GM' },
        });
        expect(object.status).toBe(200);

        expect(addEntrySpy).toHaveBeenCalledTimes(2);
        expect(addEntrySpy.mock.calls[0][1].contributedBy).toBe('War Cleric');
        expect(addEntrySpy.mock.calls[1][1].contributedBy).toBe('War Cleric');
    });
});

// ---------------------------------------------------------------------------
// Refused requests write nothing
// ---------------------------------------------------------------------------

describe('refused transfers append no row', () => {
    it('400s (bad direction, empty payload, dual payload, all-zero currency) log nothing', async () => {
        const badDirection = await postTransfer({ playerName: 'War Cleric', direction: 'sideways', itemName: 'Torch', quantity: 1 });
        expect(badDirection.status).toBe(400);

        const empty = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player' });
        expect(empty.status).toBe(400);

        const dual = await postTransfer({
            playerName: 'War Cleric', direction: 'party-to-player', itemName: 'Torch', quantity: 1, currency: { gp: 1 },
        });
        expect(dual.status).toBe(400);

        const zeroCurrency = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player', currency: { pp: 0, gp: 0, sp: 0, cp: 0 } });
        expect(zeroCurrency.status).toBe(400);
        expect(zeroCurrency.body.error).toMatch(/positive whole-number/);

        expect(addEntrySpy).not.toHaveBeenCalled();
    });

    it('409 shortfalls (party coin / player coin) log nothing and leave the ledgers untouched', async () => {
        const partyShort = await postTransfer({ playerName: 'War Cleric', direction: 'party-to-player', currency: { gp: 999 } });
        expect(partyShort.status).toBe(409);

        const playerShort = await postTransfer(
            { playerName: 'War Cleric', direction: 'player-to-party', currency: { gp: 999 } },
            '192.168.0.239'
        );
        expect(playerShort.status).toBe(409);

        expect(JSON.parse(mockFsState.get(invPath)).currency.gp).toBe(50);
        expect(JSON.parse(mockFsState.get(charPath)).inventory.gold).toBe(10);
        expect(addEntrySpy).not.toHaveBeenCalled();
    });

    it('404 unknown character and a non-GM party→player 403 log nothing', async () => {
        const missing = await postTransfer({ playerName: 'Nobody', direction: 'party-to-player', itemName: 'Torch', quantity: 1 });
        expect(missing.status).toBe(404);

        const disallowed = await postTransfer(
            { playerName: 'War Cleric', direction: 'party-to-player', currency: { gp: 1 } },
            '192.168.0.239'
        );
        expect(disallowed.status).toBe(403);

        expect(addEntrySpy).not.toHaveBeenCalled();
    });
});
