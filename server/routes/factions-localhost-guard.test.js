// Regression lock for bug-npcs-factions-settlements-lanes-no-origin-guard —
// the WHOLE Factions lane (reads AND writes) is GM-only (localhost), mirroring
// sessions-localhost-guard.test.js / quests-localhost-guard.test.js (same
// wrapper face: the sidebar marks Factions localhostOnly and the only client
// consumers of /factions are GM-only surfaces — Factions.jsx itself and the
// CampaignBuilder Drafts lane in draftActions.js — so there is no visitor
// read consumer to keep open). Before the gate a network client GET 200'd the
// full GM plan dump and a whole-array POST with an honestly-echoed snapshot
// LANDED (live-witnessed 2026-11-12: visitor POST 200 + row persisted to
// factions.json); a snapshot the visitor could never load likewise 409'd
// NAMING the hidden GM faction title. Mirrors quests-localhost-guard.test.js
// setup (real jsonEntityCrud factory; only fs + campaign paths mocked) plus
// the changeData publish spy.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const FACTIONS_PATH = '/mock/campaigns/test-campaign/factions.json';

const GM_FACTION = {
    id: 'qa-faction-one',
    name: 'The Lost Cabal',
    description: 'GM planning row one',
    influence: 3,
    updatedAt: 1793127696761,
};
const GM_FACTION_TWO = {
    id: 'qa-faction-two',
    name: 'The Sunken Court',
    description: 'GM planning row two',
    influence: 1,
    updatedAt: 1793127696800,
};

function setupFactions(factions) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    FILE_SYSTEM.set(FACTIONS_PATH, JSON.stringify(factions, null, 2));
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

import factions from './factions.js';

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
    app.use(factions);
    return app;
}

beforeEach(() => {
    setupFactions([GM_FACTION, GM_FACTION_TWO]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('factions — GM-only lane gate (visitor-origin 403 on every method)', () => {
    it.each(LAN_HOSTS)(
        'GET list with Host %s ⇒ 403 GM-only (was the full GM plan dump pre-fix)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/factions')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('The Lost Cabal');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'GET one row with Host %s ⇒ 403 GM-only (row existence unprobed)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/factions/qa-faction-one')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('The Lost Cabal');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
        }
    );

    it.each(LAN_HOSTS)(
        'POST empty snapshot with Host %s ⇒ 403 GM-only (pre-fix leaked the hidden title in a 409)',
        async (host) => {
            // Pre-fix a visitor POST omitting disk rows 409'd naming
            // "The Lost Cabal" (the displayField-labelled concurrent-save
            // conflict) — the gate must refuse BEFORE any conflict logic runs.
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/factions')
                .set('Host', host)
                .send({ factions: [] });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('The Lost Cabal');
            expect(JSON.stringify(res.body)).not.toContain('The Sunken Court');
            expect(JSON.stringify(res.body)).not.toContain('conflict');
            expect(JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH))).toEqual([GM_FACTION, GM_FACTION_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'POST full-content append with Host %s ⇒ 403 GM-only, disk inert (pre-fix LANDS)',
        async (host) => {
            // Snapshot echoing both stamped disk rows + a visitor append:
            // pre-fix this SATISFIED the concurrent-save guard and wrote
            // straight into the GM planning file (live-witnessed repro).
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/factions')
                .set('Host', host)
                .send({
                    factions: [
                        { ...GM_FACTION },
                        { ...GM_FACTION_TWO },
                        { id: 'op-visitor-faction', name: 'OP Visitor Faction', description: 'honest visitor append' },
                    ],
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH))).toEqual([GM_FACTION, GM_FACTION_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a row with Host %s ⇒ 403 GM-only (row survives — pre-fix landed 200)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/factions/qa-faction-one')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH)).map(f => f.id))
                .toEqual(['qa-faction-one', 'qa-faction-two']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );
});

describe('factions — localhost GM lane unchanged (read + write + broadcast)', () => {
    it('localhost GM GET list still returns the full plan (200)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/factions')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.factions.map(f => f.name)).toEqual(['The Lost Cabal', 'The Sunken Court']);
    });

    it('localhost GM GET one row still resolves (200 + faction wrapper)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/factions/qa-faction-one')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('The Lost Cabal');
    });

    it('localhost GM POST still saves the whole array (stamped + replaced broadcast)', async () => {
        const updated = [
            { ...GM_FACTION },
            { ...GM_FACTION_TWO },
            { id: 'fresh-gm-faction', name: 'Fresh GM Faction', description: 'New plan row' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/factions')
            .set('Host', 'localhost')
            .send({ factions: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH));
        expect(stored.map(f => f.name)).toEqual(['The Lost Cabal', 'The Sunken Court', 'Fresh GM Faction']);
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(GM_FACTION.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'factions-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/factions/qa-faction-one')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH)).map(f => f.id)).toEqual(['qa-faction-two']);
        expect(publishSpy).toHaveBeenCalledWith(
            'factions-list-test-campaign',
            { action: 'deleted', name: 'qa-faction-one' },
            'test-campaign'
        );
    });
});
