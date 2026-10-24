// Regression lock for bug-vite-proxy-localhost-guard-bypass — the server-side
// private-note authority guard driven by the HOSTNAMES THE DEV PROXY NOW
// FORWARDS HONESTLY. vite.config.js previously proxied /api|/subscribe|
// /spell-overlay with changeOrigin:true, rewriting every LAN client's Host to
// localhost:80, so notes.js isLocalhost(req) never fired and private GM notes
// leaked to players browsing :5173. With changeOrigin:false the proxy forwards
// the browser's real Host (e.g. "192.168.0.239:5173"), so these Host values —
// exactly what Express now sees through the dev proxy — must filter isPrivate
// notes. Mirrors campaigns-character-localhost-create.test.js but exercises
// the REAL jsonEntityCrud factory (only fs + campaign paths mocked), locking
// guard differential end-to-end: forged/LAN Host ⇒ private absent (list) and
// 403 (direct read); honest localhost Host ⇒ visible.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const NOTES_PATH = '/mock/campaigns/test-campaign/notes.json';

const PUBLIC_NOTE = {
    id: 'note-public',
    description: 'Party-friendly recap',
    isPrivate: false,
    partyLocation: 'Skull Creek Cave',
};
const PRIVATE_NOTE = {
    id: 'note-secret',
    description: 'PRIVATE-SECRET-GM-ONLY-XYZ',
    isPrivate: true,
};

function setupNotes(notes) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    FILE_SYSTEM.set(NOTES_PATH, JSON.stringify(notes, null, 2));
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

import notes from './notes.js';

// Host values a client really sends now that the vite proxy stops rewriting
// Host (changeOrigin:false): bare LAN IPs, LAN IP + :5173 (the dev-proxy URL
// the bug report reproduced against), Tailscale IP, and arbitrary hosts.
const LAN_HOSTS = [
    '10.0.0.5',
    '192.168.0.239',
    '192.168.0.239:5173',
    '100.92.171.80',
    '100.92.171.80:5173',
    'example.test',
];

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(notes);
    return app;
}

beforeEach(() => {
    setupNotes([PUBLIC_NOTE, PRIVATE_NOTE]);
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('notes — localhost guard differential (honest dev-proxy Hosts)', () => {
    it.each(LAN_HOSTS)(
        'GET /api/campaigns/:campaign/notes with Host %s ⇒ private notes filtered out',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/notes')
                .set('Host', host);

            expect(res.status).toBe(200);
            expect(res.body.notes.map((n) => n.id)).toEqual(['note-public']);
            expect(JSON.stringify(res.body)).not.toContain('PRIVATE-SECRET-GM-ONLY-XYZ');
        }
    );

    it.each(LAN_HOSTS)(
        'GET private note by id with Host %s ⇒ 403 Access denied',
        async (host) => {
            const res = await request(createTestApp())
                .get('/api/campaigns/test-campaign/notes/note-secret')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: private note');
        }
    );

    it('default Host (loopback supertest bind) ⇒ GM lane, both notes visible', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/notes');

        expect(res.status).toBe(200);
        expect(res.body.notes).toHaveLength(2);
        expect(res.body.notes.map((n) => n.id)).toEqual(['note-public', 'note-secret']);
    });

    it.each(['localhost', 'localhost:5173', '127.0.0.1', '127.0.0.1:5173'])(
        'honest GM host %s ⇒ private note readable in full',
        async (host) => {
            const list = await request(createTestApp())
                .get('/api/campaigns/test-campaign/notes')
                .set('Host', host);
            expect(list.status).toBe(200);
            expect(list.body.notes).toHaveLength(2);

            const one = await request(createTestApp())
                .get('/api/campaigns/test-campaign/notes/note-secret')
                .set('Host', host);
            expect(one.status).toBe(200);
            expect(one.body.note.description).toBe('PRIVATE-SECRET-GM-ONLY-XYZ');
        }
    );

    it('public note stays reachable from the network lane (deny-nothing-sibling)', async () => {
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/notes/note-public')
            .set('Host', '192.168.0.239:5173');

        expect(res.status).toBe(200);
        expect(res.body.note.description).toBe('Party-friendly recap');
    });
});
