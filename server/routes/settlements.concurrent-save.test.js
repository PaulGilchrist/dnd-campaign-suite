// @maintained-by-ai: 2026-10-27
// Run-G backlog close: settlements conflict copy must read with the display
// noun "Settlement" (NPC lane reads "NPC"), and the PUT lane must resolve the
// existing row by id-or-name so PUT-by-id reaches the concurrent-save guard
// instead of self-colliding the duplicate-name 400. Mirrors the in-memory-fs
// harness of npcs.concurrent-save.test.js.
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
const { default: settlementRouter, resolveSettlementIndex } = await import('./settlements.js');

const campaign = 'test-campaign';
const filePath = `/mock/campaigns/${campaign}/data/settlements.json`;

const VERBATIM_MODIFIED_COPY = (name) =>
    `Settlement "${name}" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`;

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(settlementRouter);
    return app;
};

const readDisk = () => JSON.parse(FILE_SYSTEM.get(filePath));
const putSettlement = (app, settlement, urlValue = settlement.name) =>
    request(app)
        .put(`/api/campaigns/${campaign}/settlements/${encodeURIComponent(urlValue)}`)
        .send(settlement);
const ironhaven = (overrides = {}) => ({
    name: 'Ironhaven',
    size: 'town',
    description: 'A bustling mining town',
    ...overrides,
});

beforeEach(() => {
    FILE_SYSTEM.clear();
});

describe('resolveSettlementIndex — id-or-name resolution', () => {
    const rows = [{ name: 'Ironhaven' }, { id: 'qa-set-id-1', name: 'QA Set Id' }];

    it('matches by exact name first (client contract)', () => {
        expect(resolveSettlementIndex(rows, 'Ironhaven')).toBe(0);
        expect(resolveSettlementIndex(rows, 'QA Set Id')).toBe(1);
    });

    it('falls back to the id field when no name matches', () => {
        expect(resolveSettlementIndex(rows, 'qa-set-id-1')).toBe(1);
    });

    it('returns -1 for an unknown name/id (upsert-create leg)', () => {
        expect(resolveSettlementIndex(rows, 'Nope')).toBe(-1);
    });
});

describe('settlements PUT — conflict copy casing', () => {
    it('409s a stale by-name save with the verbatim capitalized copy', async () => {
        const app = createApp();
        const boot = await putSettlement(app, ironhaven());
        expect(boot.status).toBe(200);
        const stamp = readDisk()[0].updatedAt;

        // Tab B saves → stamp moves on.
        const bSave = await putSettlement(app, ironhaven({ notes: 'TAB-B', updatedAt: stamp }));
        expect(bSave.status).toBe(200);

        // Tab A replays its stale stamp.
        const stale = await putSettlement(app, ironhaven({ notes: 'TAB-A', updatedAt: stamp }));
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toBe(VERBATIM_MODIFIED_COPY('Ironhaven'));
        // Rejected save is inert.
        expect(readDisk()[0].notes).toBe('TAB-B');
    });

    it('factory whole-array POST 409s also read "Settlement" (display noun)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([ironhaven({ updatedAt: 1 })]));
        // Sender never knew about Ironhaven → created-or-deleted leg.
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/settlements`)
            .send({ settlements: [{ name: 'Newville' }] });
        expect(res.status).toBe(409);
        expect(res.body.conflict).toBe(true);
        expect(res.body.error).toBe(
            'Settlement "Ironhaven" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.'
        );
    });
});

describe('settlements PUT — id-or-name route contract', () => {
    const seededIdRow = (overrides = {}) => ({
        id: 'qa-set-id-1',
        name: 'QA Set Id',
        size: 'village',
        ...overrides,
    });

    it('PUT-by-id with a stale-stamp echo of its own name 409s (was a 400 self-collision)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([seededIdRow({ updatedAt: 123 })]));

        const res = await putSettlement(
            app,
            { ...seededIdRow({ size: 'town' }), updatedAt: 122 }, // stale echo, own name
            'qa-set-id-1'
        );
        expect(res.status).toBe(409);
        expect(res.body.conflict).toBe(true);
        // Label shows the row's display name, not the raw id from the URL.
        expect(res.body.error).toBe(VERBATIM_MODIFIED_COPY('QA Set Id'));
        expect(readDisk()[0].size).toBe('village'); // inert
    });

    it('PUT-by-id with a fresh stamp updates the row (200)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([seededIdRow({ updatedAt: 123 })]));

        const res = await putSettlement(
            app,
            { ...seededIdRow({ size: 'town' }), updatedAt: 123 },
            'qa-set-id-1'
        );
        expect(res.status).toBe(200);
        expect(res.body.settlement.size).toBe('town');
        expect(res.body.settlement.updatedAt).toBeGreaterThan(123);
        expect(readDisk()).toHaveLength(1); // no duplicate row appended
    });

    it('PUT-by-id rename-collision with ANOTHER row still 400s (cross-row guard)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([
            { name: 'Rival' },
            seededIdRow({ updatedAt: 123 }),
        ]));

        const res = await putSettlement(
            app,
            { ...seededIdRow({ name: 'rival' }), updatedAt: 123 },
            'qa-set-id-1'
        );
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A settlement with that name already exists');
    });

    it('PUT-by-id to an unknown id upsert-creates (200, backward-compatible)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([{ name: 'Rival' }]));

        const res = await putSettlement(app, seededIdRow(), 'brand-new-id');
        expect(res.status).toBe(200);
        expect(readDisk()).toHaveLength(2);
        expect(readDisk()[1].name).toBe('QA Set Id');
    });
});

describe('settlements PUT — by-name backward compatibility', () => {
    it('happy-path update stays 200', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([ironhaven()]));
        const res = await putSettlement(app, ironhaven({ size: 'city' }));
        expect(res.status).toBe(200);
        expect(readDisk()[0].size).toBe('city');
    });

    it('rename-collision still 400s (case-insensitive, other row)', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([ironhaven()]));
        const res = await putSettlement(app, { name: 'ironhaven', size: 'town' }, 'ironhaven');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A settlement with that name already exists');
        expect(readDisk()[0].name).toBe('Ironhaven');
    });

    it('empty name still 400s', async () => {
        const app = createApp();
        const res = await putSettlement(app, { name: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Settlement name is required');
    });

    it('legacy un-stamped row stays writable (bootstrap) and gets stamped', async () => {
        const app = createApp();
        FILE_SYSTEM.set(filePath, JSON.stringify([ironhaven()])); // no updatedAt
        const res = await putSettlement(app, ironhaven({ notes: 'legacy write' }));
        expect(res.status).toBe(200);
        expect(readDisk()[0].notes).toBe('legacy write');
        expect(typeof readDisk()[0].updatedAt).toBe('number');
    });
});
