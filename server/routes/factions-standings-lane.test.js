// Player standings read lane (Item 9 — player quest board): the ONLY
// visitor-open door on the /factions path is GET /factions/standings,
// answering { id, name, influence } ONLY — description/goals/notes are GM
// planning text and never leave the server; draft rows drop for every origin.
// The GM CRUD gate stays byte-unchanged. Mock setup mirrors
// factions-localhost-guard.test.js / quests-board-lane.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();
const FACTIONS_PATH = '/mock/campaigns/test-campaign/factions.json';

const CONSORTIUM = {
    id: 'f-iron',
    name: 'Iron Consortium',
    description: 'Merchant guild of the lower harbor.',
    goals: 'GM PLAN: buy the dockyards, then burn the customs house',
    influence: 7,
    notes: 'GM SECRET: the spymaster sits on the council',
    updatedAt: 1794497549876,
};
const CULT = {
    id: 'f-cult',
    name: 'Cult of the Deep',
    description: 'Salt-worshippers below the tide line.',
    goals: '',
    influence: 2,
    notes: '',
    updatedAt: 1794497549900,
};
const DRAFT_FACTION = {
    id: 'f-draft',
    name: 'AI Draft Faction',
    description: 'Unapproved content',
    goals: 'draft spoiler goals',
    influence: 5,
    draft: true,
    updatedAt: 1794497549950,
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
        writeFileSync: (p, c) => { FILE_SYSTEM.set(p, c); },
        mkdirSync: (p) => { FILE_SYSTEM.set(p, ''); },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => { FILE_SYSTEM.set(p, c); },
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

const LAN_HOSTS = ['10.0.0.5', '192.168.0.44', '192.168.0.44:5173', 'example.test'];
const STANDINGS_URL = '/api/campaigns/test-campaign/factions/standings';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
    return app;
}

beforeEach(() => {
    setupFactions([CONSORTIUM, CULT, DRAFT_FACTION]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('factions /standings lane — player-facing whitelist read', () => {
    it.each(LAN_HOSTS)(
        'GET standings with Host %s ⇒ 200 compact standings only',
        async (host) => {
            const res = await request(createTestApp())
                .get(STANDINGS_URL)
                .set('Host', host);

            expect(res.status).toBe(200);
            expect(res.body.factions).toEqual([
                { id: 'f-iron', name: 'Iron Consortium', influence: 7 },
                { id: 'f-cult', name: 'Cult of the Deep', influence: 2 },
            ]);
            const wire = JSON.stringify(res.body);
            // GM planning text and flags never cross the wire…
            expect(wire).not.toContain('notes');
            expect(wire).not.toContain('goals');
            expect(wire).not.toContain('description');
            expect(wire).not.toContain('GM SECRET');
            expect(wire).not.toContain('burn the customs house');
            // …and unapproved drafts are invisible to every origin.
            expect(wire).not.toContain('AI Draft Faction');
            expect(wire).not.toContain('updatedAt');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it('localhost standings answer the same whitelist (GM-only fields still withheld)', async () => {
        const res = await request(createTestApp())
            .get(STANDINGS_URL)
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.factions.map(f => f.id)).toEqual(['f-iron', 'f-cult']);
        expect(JSON.stringify(res.body)).not.toContain('notes');
    });
});

describe('factions — standings lane opens NO write door and leaves the GM gate intact', () => {
    it.each(LAN_HOSTS)(
        'POST standings with Host %s ⇒ 403 GM-only (the gate covers the sub-path)',
        async (host) => {
            const res = await request(createTestApp())
                .post(STANDINGS_URL)
                .set('Host', host)
                .send({ factions: [] });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(FACTIONS_PATH)).map(f => f.id))
                .toEqual(['f-iron', 'f-cult', 'f-draft']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it('localhost POST on the standings path 404s — no write lane exists there', async () => {
        const res = await request(createTestApp())
            .post(STANDINGS_URL)
            .set('Host', 'localhost')
            .send({ factions: [] });
        expect(res.status).toBe(404);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('the untouched GM CRUD lanes keep answering (visitor /factions still 403, GM /factions still 200 full rows)', async () => {
        const visitor = await request(createTestApp())
            .get('/api/campaigns/test-campaign/factions')
            .set('Host', '10.0.0.5');
        expect(visitor.status).toBe(403);
        expect(visitor.body.error).toBe('Access denied: GM-only feature');

        const gm = await request(createTestApp())
            .get('/api/campaigns/test-campaign/factions')
            .set('Host', 'localhost');
        expect(gm.status).toBe(200);
        expect(gm.body.factions.length).toBe(3);
        expect(gm.body.factions[0].notes).toBe('GM SECRET: the spymaster sits on the council');
    });
});
