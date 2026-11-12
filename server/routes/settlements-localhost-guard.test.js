// Regression lock for bug-npcs-factions-settlements-lanes-no-origin-guard —
// the WHOLE Settlements lane (reads AND writes, factory lanes plus the
// custom PUT-upsert) is GM-only (localhost), mirroring sessions-localhost-
// guard.test.js / quests-localhost-guard.test.js (same wrapper face: the
// sidebar marks Settlements localhostOnly and every client consumer of
// /settlements is a GM-only surface — Settlements.jsx, the Sessions planner
// picker, Campaign Admin's AiWorldConsole, and the CampaignBuilder draft
// lane — so there is no visitor read consumer to keep open). Before the gate
// a network client GET 200'd the full GM plan dump and POST/PUT/DELETE rows
// landed outright (visitor write landing live-witnessed on the sibling
// factions lane 2026-11-12). Mirrors quests-localhost-guard.test.js setup
// (real jsonEntityCrud factory; only fs + campaign paths mocked) plus the
// changeData publish spy.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const SETTLEMENTS_PATH = '/mock/campaigns/test-campaign/settlements.json';

const GM_SETTLEMENT = {
    name: 'Ironhaven',
    size: 'town',
    description: 'GM planning row one',
    updatedAt: 1793127696761,
};
const GM_SETTLEMENT_TWO = {
    name: 'Mudport',
    size: 'village',
    description: 'GM planning row two',
    updatedAt: 1793127696800,
};

function setupSettlements(settlements) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    FILE_SYSTEM.set(SETTLEMENTS_PATH, JSON.stringify(settlements, null, 2));
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
        mkdirSync: (p) => { FILE_SYSTEM.set(p, ''); },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    mkdirSync: (p) => { FILE_SYSTEM.set(p, ''); },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: vi.fn((campaign, fileName) => `/mock/campaigns/${campaign}/${fileName}`),
    ensureDataDir: vi.fn((campaign) => { FILE_SYSTEM.set(`/mock/campaigns/${campaign}/data`, ''); }),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: publishSpy,
}));

import settlements from './settlements.js';

// Same honest dev-proxy Host values as quests-localhost-guard.test.js —
// a LAN client browsing http://<en0-ip>:5173 sends these through the :5173
// proxy (changeOrigin:false keeps the real Host), so the server treats them
// as visitors.
const LAN_HOSTS = [
    '10.0.0.5',
    '192.168.0.44',
    '192.168.0.44:5173',
    '100.92.171.80:5173',
    'example.test',
];

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(settlements);
    return app;
}

beforeEach(() => {
    setupSettlements([GM_SETTLEMENT, GM_SETTLEMENT_TWO]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('settlements — GM-only lane gate (visitor-origin 403 on every method)', () => {
    it.each(LAN_HOSTS)(
        'GET list with Host %s ⇒ 403 GM-only (was the full GM plan dump pre-fix)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/settlements')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('Ironhaven');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'GET one row with Host %s ⇒ 403 GM-only (row existence unprobed)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/settlements/Ironhaven')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('Ironhaven');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
        }
    );

    it.each(LAN_HOSTS)(
        'POST full-content append with Host %s ⇒ 403 GM-only, disk inert (pre-fix LANDS)',
        async (host) => {
            // Snapshot echoing both stamped disk rows + a visitor append:
            // pre-fix this SATISFIED the concurrent-save guard and wrote
            // straight into the GM planning file.
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/settlements')
                .set('Host', host)
                .send({
                    settlements: [
                        { ...GM_SETTLEMENT },
                        { ...GM_SETTLEMENT_TWO },
                        { name: 'OP Visitor Hold', size: 'camp', description: 'honest visitor append' },
                    ],
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH))).toEqual([GM_SETTLEMENT, GM_SETTLEMENT_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'PUT upsert with Host %s ⇒ 403 before any conflict logic, disk inert',
        async (host) => {
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/settlements/Ironhaven')
                .set('Host', host)
                .send({ name: 'Ironhaven', size: 'city', description: 'visitor tamper' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH))).toEqual([GM_SETTLEMENT, GM_SETTLEMENT_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a row with Host %s ⇒ 403 GM-only (row survives — pre-fix landed 200)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/settlements/Ironhaven')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH)).map(s => s.name))
                .toEqual(['Ironhaven', 'Mudport']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );
});

describe('settlements — localhost GM lane unchanged (read + write + broadcast)', () => {
    it('localhost GM GET list still returns the full plan (200)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/settlements')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.settlements.map(s => s.name)).toEqual(['Ironhaven', 'Mudport']);
    });

    it('localhost GM GET one row still resolves (200 + settlement wrapper)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/settlements/Ironhaven')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Ironhaven');
    });

    it('localhost GM POST still saves the whole array (stamped + replaced broadcast)', async () => {
        const updated = [
            { ...GM_SETTLEMENT },
            { ...GM_SETTLEMENT_TWO },
            { name: 'Fresh GM Hold', size: 'camp', description: 'New plan row' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/settlements')
            .set('Host', 'localhost')
            .send({ settlements: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH));
        expect(stored.map(s => s.name)).toEqual(['Ironhaven', 'Mudport', 'Fresh GM Hold']);
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(GM_SETTLEMENT.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM PUT upsert still creates a row (200 + created broadcast)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/settlements/New Probe Hold')
            .set('Host', 'localhost')
            .send({ name: 'New Probe Hold', size: 'hamlet' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.settlement.name).toBe('New Probe Hold');
        const stored = JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH));
        expect(stored.map(s => s.name)).toEqual(['Ironhaven', 'Mudport', 'New Probe Hold']);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'created', name: 'New Probe Hold' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/settlements/Ironhaven')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(SETTLEMENTS_PATH)).map(s => s.name)).toEqual(['Mudport']);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'deleted', name: 'Ironhaven' },
            'test-campaign'
        );
    });
});
