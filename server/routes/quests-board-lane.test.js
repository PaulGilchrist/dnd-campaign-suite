// Player board read lane (Item 9 — player quest board): the ONLY visitor-open
// door on the /quests path is GET /quests/board, answering a field WHITELIST
// (name/status/description/rewards — GM `notes` NEVER leave the server) with
// draft rows dropped for every origin. The GM CRUD gate must stay byte-
// unchanged: every other method on every /quests path (the planner lanes AND
// this sub-path) still 403s non-localhost and never gained a write lane.
// Mock setup mirrors quests-localhost-guard.test.js (real jsonEntityCrud +
// fs/campaignPaths mocks + publish spy).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();
const QUESTS_PATH = '/mock/campaigns/test-campaign/quests.json';

const BOARD_QUEST = {
    id: 'q-artifact',
    name: 'The Lost Artifact',
    status: 'active',
    description: 'Recover the stolen relic.',
    rewards: '500 gp and a **signed** letter',
    notes: 'GM SECRET: the patron is the thief',
    updatedAt: 1794497549876,
};
const DONE_QUEST = {
    id: 'q-shrine',
    name: 'The Sunken Shrine',
    status: 'completed',
    description: 'Calm the drowned choir.',
    rewards: '',
    notes: '',
    updatedAt: 1794497549900,
};
const DRAFT_QUEST = {
    id: 'q-draft',
    name: 'AI Draft Quest',
    status: 'active',
    description: 'Unapproved content',
    notes: 'draft spoiler notes',
    draft: true,
    updatedAt: 1794497549950,
};

function setupQuests(quests) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    FILE_SYSTEM.set(QUESTS_PATH, JSON.stringify(quests, null, 2));
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

import quests from './quests.js';

const LAN_HOSTS = ['10.0.0.5', '192.168.0.44', '192.168.0.44:5173', 'example.test'];
const BOARD_URL = '/api/campaigns/test-campaign/quests/board';
const WHITELIST = ['id', 'name', 'status', 'description', 'rewards'];

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(quests);
    return app;
}

beforeEach(() => {
    setupQuests([BOARD_QUEST, DONE_QUEST, DRAFT_QUEST]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('quests /board lane — player-facing whitelist read', () => {
    it.each(LAN_HOSTS)(
        'GET board with Host %s ⇒ 200 whitelisted rows only (notes never leave the server)',
        async (host) => {
            const res = await request(createTestApp())
                .get(BOARD_URL)
                .set('Host', host);

            expect(res.status).toBe(200);
            expect(res.body.quests.map(q => q.id)).toEqual(['q-artifact', 'q-shrine']);
            res.body.quests.forEach(row => {
                expect(Object.keys(row).sort()).toEqual(
                    WHITELIST.filter(field => row[field] !== undefined).sort()
                );
            });
            expect(res.body.quests[0].name).toBe('The Lost Artifact');
            expect(res.body.quests[0].status).toBe('active');
            // GM notes bytes: absent as KEYS and anywhere in the serialized body.
            const wire = JSON.stringify(res.body);
            expect(wire).not.toContain('notes');
            expect(wire).not.toContain('GM SECRET');
            expect(wire).not.toContain('the patron is the thief');
            // Draft rows never reach the board — from ANY origin, even by probe.
            expect(wire).not.toContain('AI Draft Quest');
            expect(wire).not.toContain('draft spoiler');
            // Stamps/draft flags are not part of the board shape.
            expect(wire).not.toContain('updatedAt');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it('localhost board read returns the SAME approved rows (GM-only fields still withheld)', async () => {
        const res = await request(createTestApp())
            .get(BOARD_URL)
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests.map(q => q.id)).toEqual(['q-artifact', 'q-shrine']);
        expect(JSON.stringify(res.body)).not.toContain('AI Draft Quest');
        expect(JSON.stringify(res.body)).not.toContain('notes');
    });

    it('missing quests file answers an empty board (200 { quests: [] })', async () => {
        setupQuests(null);
        FILE_SYSTEM.delete(QUESTS_PATH);
        const res = await request(createTestApp())
            .get(BOARD_URL)
            .set('Host', '10.0.0.5');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ quests: [] });
    });
});

describe('quests — board lane opens NO write door and leaves the GM gate intact', () => {
    it.each(LAN_HOSTS)(
        'POST board with Host %s ⇒ 403 GM-only (the gate covers the sub-path)',
        async (host) => {
            const res = await request(createTestApp())
                .post(BOARD_URL)
                .set('Host', host)
                .send({ quests: [] });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH)).map(q => q.id))
                .toEqual(['q-artifact', 'q-shrine', 'q-draft']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it('localhost POST/DELETE on the board path 404s — no write lane exists there', async () => {
        const posted = await request(createTestApp())
            .post(BOARD_URL)
            .set('Host', 'localhost')
            .send({ quests: [] });
        expect(posted.status).toBe(404);

        const deleted = await request(createTestApp())
            .delete(BOARD_URL)
            .set('Host', 'localhost');
        expect(deleted.status).toBe(404);

        expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH)).map(q => q.id))
            .toEqual(['q-artifact', 'q-shrine', 'q-draft']);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('the untouched GM CRUD lanes keep answering (visitor /quests still 403, GM /quests still 200 full rows)', async () => {
        const visitor = await request(createTestApp())
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', '10.0.0.5');
        expect(visitor.status).toBe(403);
        expect(visitor.body.error).toBe('Access denied: GM-only feature');

        const gm = await request(createTestApp())
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');
        expect(gm.status).toBe(200);
        // The planner keeps seeing everything: full fields + the badgeable
        // draft row (DraftFlag lane) — the board lane is the ONLY whitelist.
        expect(gm.body.quests.length).toBe(3);
        expect(gm.body.quests[0].notes).toBe('GM SECRET: the patron is the thief');
    });
});
