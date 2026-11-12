// Regression lock for bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels
// — the WHOLE Quests lane (reads AND writes) is GM-only (localhost), mirroring
// sessions-localhost-guard.test.js (same wrapper face: the read lane was
// already fully GM-filtered — transformList [] + authorizeRead 403 — and no
// visitor-facing view renders quests, so the lane 403s every method, not just
// writes; contrast notes.js, whose reads stay open behind the isPrivate
// filter). Before the gate a network client's whole-array POST could never
// include the disk rows its own read was hidden, so the concurrent-save guard
// 409'd NAMING THE HIDDEN GM QUEST TITLE (one-probe-at-a-time label leak,
// unrecoverable via reload), and a visitor DELETE by id landed outright.
// Mirrors sessions-localhost-guard.test.js setup (real jsonEntityCrud factory;
// only fs + campaign paths mocked) plus the changeData publish spy.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const QUESTS_PATH = '/mock/campaigns/test-campaign/quests.json';

const GM_QUEST = {
    id: 'q-lost-artifact',
    name: 'The Lost Artifact',
    status: 'active',
    description: 'GM planning row one',
    updatedAt: 1794497549876,
};
const GM_QUEST_TWO = {
    id: 'q-sunken-shrine',
    name: 'The Sunken Shrine',
    status: 'completed',
    description: 'GM planning row two',
    updatedAt: 1794497549900,
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

import quests from './quests.js';

// Same honest dev-proxy Host values as sessions-localhost-guard.test.js —
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
    app.use(quests);
    return app;
}

beforeEach(() => {
    setupQuests([GM_QUEST, GM_QUEST_TWO]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('quests — GM-only lane gate (visitor-origin 403 on every method)', () => {
    it.each(LAN_HOSTS)(
        'GET list with Host %s ⇒ 403 GM-only (was the filtered [] dump pre-fix)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/quests')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('The Lost Artifact');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'GET one row with Host %s ⇒ 403 GM-only (row existence unprobed)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/quests/q-lost-artifact')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('The Lost Artifact');
            expect(JSON.stringify(res.body)).not.toContain('GM planning row');
        }
    );

    it.each(LAN_HOSTS)(
        'POST empty snapshot with Host %s ⇒ 403 GM-only (pre-fix leaked the hidden title in a 409)',
        async (host) => {
            // The visitor read lane answered {quests:[]}, so re-POSTing that
            // snapshot is the repro's leak leg: pre-fix this 409'd naming
            // "The Lost Artifact" (a row the sender was forbidden to know
            // exists) and could NEVER succeed.
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/quests')
                .set('Host', host)
                .send({ quests: [] });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            // No hidden quest title may surface to a visitor origin.
            expect(JSON.stringify(res.body)).not.toContain('The Lost Artifact');
            expect(JSON.stringify(res.body)).not.toContain('The Sunken Shrine');
            expect(JSON.stringify(res.body)).not.toContain('conflict');
            expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH))).toEqual([GM_QUEST, GM_QUEST_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'POST full-content append with Host %s ⇒ 403 GM-only, disk inert (pre-fix LANDS)',
        async (host) => {
            // Snapshot echoing both stamped disk rows + a visitor append:
            // pre-fix this SATISFIED the concurrent-save guard and wrote
            // straight into the GM planning file.
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/quests')
                .set('Host', host)
                .send({
                    quests: [
                        { ...GM_QUEST },
                        { ...GM_QUEST_TWO },
                        { id: 'op-visitor-quest', name: 'OP Visitor Quest', status: 'active', description: 'honest visitor append' },
                    ],
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH))).toEqual([GM_QUEST, GM_QUEST_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a row with Host %s ⇒ 403 GM-only (row survives — pre-fix landed 200)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/quests/q-lost-artifact')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH)).map(q => q.id))
                .toEqual(['q-lost-artifact', 'q-sunken-shrine']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );
});

describe('quests — localhost GM lane unchanged (read + write + broadcast)', () => {
    it('localhost GM GET list still returns the full plan (200)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests.map(q => q.name)).toEqual(['The Lost Artifact', 'The Sunken Shrine']);
    });

    it('localhost GM GET one row still resolves (200 + quest wrapper)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/quests/q-lost-artifact')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest.name).toBe('The Lost Artifact');
    });

    it('localhost GM POST still saves the whole array (stamped + replaced broadcast)', async () => {
        const updated = [
            { ...GM_QUEST },
            { ...GM_QUEST_TWO },
            { id: 'fresh-gm-quest', name: 'Fresh GM Quest', status: 'active', description: 'New plan row' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost')
            .send({ quests: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(QUESTS_PATH));
        expect(stored.map(q => q.name)).toEqual(['The Lost Artifact', 'The Sunken Shrine', 'Fresh GM Quest']);
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(GM_QUEST.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'quests-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/quests/q-lost-artifact')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(QUESTS_PATH)).map(q => q.id)).toEqual(['q-sunken-shrine']);
        expect(publishSpy).toHaveBeenCalledWith(
            'quests-list-test-campaign',
            { action: 'deleted', name: 'q-lost-artifact' },
            'test-campaign'
        );
    });
});
