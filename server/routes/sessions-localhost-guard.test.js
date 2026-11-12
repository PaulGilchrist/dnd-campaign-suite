// Regression lock for bug-sessions-lane-no-gm-write-guard — the WHOLE Sessions
// lane (reads AND writes) is GM-only (localhost). Before the gate a network
// client could GET the full GM session plan (200 dump) and POST/PUT/DELETE
// session rows, silently rewriting the GM's planning store; the only thing
// protecting the lane was the hidden sidebar button (localhostOnly). There is
// no legitimate visitor read consumer, so the lane 403s every method, not
// just writes (contrast notes.js, whose reads stay open behind the isPrivate
// filter). Mirrors notes-write-localhost-guard.test.js setup (real
// jsonEntityCrud factory; only fs + campaign paths mocked) plus the
// changeData publish spy (GM writes broadcast).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const SESSIONS_PATH = '/mock/campaigns/test-campaign/sessions.json';

const GM_SESSION = {
    name: 'Opener',
    description: 'GM plan row one',
    status: 'planned',
    updatedAt: 1794497549876,
};
const GM_SESSION_TWO = {
    name: 'The Second Sitting',
    description: 'GM plan row two',
    status: 'done',
    updatedAt: 1794497549900,
};

function setupSessions(sessions) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    FILE_SYSTEM.set(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
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

import sessions from './sessions.js';

// Same honest dev-proxy Host values as notes-write-localhost-guard.test.js —
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
    app.use(sessions);
    return app;
}

beforeEach(() => {
    setupSessions([GM_SESSION, GM_SESSION_TWO]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('sessions — GM-only lane gate (visitor-origin 403 on every method)', () => {
    it.each(LAN_HOSTS)(
        'GET list with Host %s ⇒ 403 GM-only (no plan dump, no label leak)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/sessions')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            // Pre-fix this was a 200 dump of the whole GM plan.
            expect(JSON.stringify(res.body)).not.toContain('Opener');
            expect(JSON.stringify(res.body)).not.toContain('GM plan row');
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'GET one row with Host %s ⇒ 403 GM-only (row existence unprobed)',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/sessions/Opener')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.stringify(res.body)).not.toContain('GM plan row');
        }
    );

    it.each(LAN_HOSTS)(
        'POST whole-array append with Host %s ⇒ 403 GM-only, disk inert',
        async (host) => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/sessions')
                .set('Host', host)
                .send({
                    sessions: [
                        { ...GM_SESSION },
                        { ...GM_SESSION_TWO },
                        { name: 'OP Visitor Session', description: 'honest visitor append', status: 'planned' },
                    ],
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            // Fully inert: disk bytes unchanged, no list broadcast.
            expect(JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH))).toEqual([GM_SESSION, GM_SESSION_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'PUT per-row upsert with Host %s ⇒ 403 GM-only, disk inert',
        async (host) => {
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/sessions/Opener')
                .set('Host', host)
                .send({ name: 'Opener', description: 'visitor tamper via PUT', status: 'done' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH))).toEqual([GM_SESSION, GM_SESSION_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a row with Host %s ⇒ 403 GM-only (row survives)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/sessions/Opener')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH)).map(s => s.name))
                .toEqual(['Opener', 'The Second Sitting']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );
});

describe('sessions — localhost GM lane unchanged (read + write + broadcast)', () => {
    it('localhost GM GET list still returns the full plan (200)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/sessions')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.sessions.map(s => s.name)).toEqual(['Opener', 'The Second Sitting']);
    });

    it('localhost GM GET one row still resolves (200 + session wrapper)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/sessions/Opener')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.session.name).toBe('Opener');
    });

    it('localhost GM POST still saves the whole array (stamped + replaced broadcast)', async () => {
        const updated = [
            { ...GM_SESSION },
            { ...GM_SESSION_TWO },
            { name: 'Fresh GM Session', description: 'New plan row', status: 'planned' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/sessions')
            .set('Host', 'localhost')
            .send({ sessions: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH));
        expect(stored.map(s => s.name)).toEqual(['Opener', 'The Second Sitting', 'Fresh GM Session']);
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(GM_SESSION.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM PUT upsert still creates a row (200 + created broadcast)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/sessions/New%20Row')
            .set('Host', 'localhost')
            .send({ name: 'New Row', description: 'Created via PUT', status: 'planned' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.session.name).toBe('New Row');
        expect(JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH)).map(s => s.name))
            .toEqual(['Opener', 'The Second Sitting', 'New Row']);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'created', name: 'New Row' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/sessions/Opener')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(SESSIONS_PATH)).map(s => s.name)).toEqual(['The Second Sitting']);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'deleted', name: 'Opener' },
            'test-campaign'
        );
    });
});
