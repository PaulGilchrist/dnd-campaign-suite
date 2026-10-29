// Live-sync broadcast tests (improve settlements-sessions-no-list-sse):
// session list create/update (PUT upsert), whole-list POST replacement, and
// delete must publish `sessions-list-<campaign>` SSE events (mirroring
// npcs-list broadcasts from routes/npcs.js) so other GM tabs' session lists
// update without reload; rejected writes stay silent.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    for (const [p, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
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

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    publish: publishSpy,
}));

import sessions from './sessions.js';

function sessionsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/sessions.json`;
}

const app = express();
app.use(express.json());
app.use(sessions);

describe('Session live-sync broadcasts', () => {
    beforeEach(() => {
        publishSpy.mockClear();
        setupFs({});
    });

    it('publishes sessions-list created event when PUT creates a new session', async () => {
        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/Session%208')
            .send({ name: 'Session 8', date: '2026-11-03' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'created', name: 'Session 8' },
            'test-campaign'
        );
    });

    it('publishes sessions-list updated event when PUT updates an existing session', async () => {
        setupFs({ [sessionsPath('test-campaign')]: [{ name: 'Session 7', date: '2026-10-27' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/Session%207')
            .send({ name: 'Session 7', date: '2026-10-28' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'updated', name: 'Session 7' },
            'test-campaign'
        );
    });

    it('publishes sessions-list deleted event when DELETE removes a session', async () => {
        setupFs({ [sessionsPath('test-campaign')]: [{ name: 'Session 7' }] });

        const res = await request(app).delete('/api/campaigns/test-campaign/sessions/Session%207');

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'deleted', name: 'Session 7' },
            'test-campaign'
        );
    });

    it('publishes sessions-list replaced event when POST overwrites the whole list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/sessions')
            .send({ sessions: [{ name: 'Session 7' }] });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'sessions-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('does not broadcast when PUT is rejected for a duplicate name', async () => {
        setupFs({ [sessionsPath('test-campaign')]: [{ name: 'Session 7' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/Other')
            .send({ name: 'session 7' });

        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('does not broadcast when PUT is rejected for a stale stamp (409)', async () => {
        setupFs({ [sessionsPath('test-campaign')]: [{ name: 'Session 7', updatedAt: 5 }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/Session%207')
            .send({ name: 'Session 7', date: '2026-12-25', updatedAt: 2 });

        expect(res.status).toBe(409);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
