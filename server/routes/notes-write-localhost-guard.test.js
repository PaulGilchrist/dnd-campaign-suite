// Regression lock for bug-players-can-never-save-notes-when-any-private-note-exists
// — the Notes WRITE lanes are GM-only (localhost), mirroring maps.js /
// campaigns-character.js / inventory.js refuseUnlessGm. Before the gate, the
// lane was structurally unsatisfiable for players: the read lane's isPrivate
// filter (notes-localhost-guard.test.js) hides private rows from their
// snapshot, so the whole-array concurrent-save guard read their absence as
// "deleted elsewhere" and 409'd EVERY player save whenever any private note
// existed — unrecoverable via "Reload list" — and the conflict copy LEAKED the
// private row's label (partyLocation / description excerpt) to the player.
// This file pins the replacement contract: non-localhost writes 403 with the
// canonical GM-only copy BEFORE any conflict logic runs (so no private label
// can surface), the request is fully inert (disk untouched), reads keep
// flowing with the visibility filter, and the GM (localhost) write lane is
// byte-unchanged. Mirrors notes-localhost-guard.test.js setup (real
// jsonEntityCrud factory; only fs + campaign paths mocked) plus the
// changeData publish spy from notes-broadcast.test.js (GM writes broadcast).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const NOTES_PATH = '/mock/campaigns/test-campaign/notes.json';

const PUBLIC_NOTE = {
    id: 'note-public',
    description: 'Party-friendly recap',
    isPrivate: false,
    partyLocation: 'The Prairie',
    updatedAt: 1793127496000,
};
const PRIVATE_NOTE = {
    id: 'note-secret',
    description: 'PRIVATE-SECRET-GM-ONLY-XYZ',
    isPrivate: true,
    partyLocation: 'Skull Creek Cave',
    updatedAt: 1793127496025,
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

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: publishSpy,
}));

import notes from './notes.js';

// Same honest dev-proxy Host values as notes-localhost-guard.test.js — a LAN
// client browsing http://<en0-ip>:5173 sends these through the :5173 proxy
// (changeOrigin:false keeps the real Host), so the server treats them as
// visitors.
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
    app.use(notes);
    return app;
}

// Exactly what a player's editor loads and re-posts: the public-only snapshot
// plus their new draft row. Pre-fix this body 409'd with the PRIVATE row's
// label (unrecoverable deadlock + leak); post-fix it 403s before the
// concurrent-save guard ever runs.
const playerSaveSnapshot = () => ([
    { ...PUBLIC_NOTE },
    {
        id: 'note-new-player',
        description: 'Visitor repro probe note',
        isPrivate: false,
        partyLocation: 'Repro Location',
    },
]);

beforeEach(() => {
    setupNotes([PUBLIC_NOTE, PRIVATE_NOTE]);
    publishSpy.mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('notes — GM-only write gate (player-origin 403, no conflict leak)', () => {
    it.each(LAN_HOSTS)(
        'POST whole-array save with Host %s ⇒ 403 GM-only, disk inert, no private label',
        async (host) => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/notes')
                .set('Host', host)
                .send({ notes: playerSaveSnapshot() });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            // The private-row leak leg: conflict copy must NEVER be reached,
            // so nothing names (or hints at) the hidden row.
            expect(JSON.stringify(res.body)).not.toContain('Skull Creek Cave');
            expect(JSON.stringify(res.body)).not.toContain('PRIVATE-SECRET-GM-ONLY-XYZ');
            // Fully inert: disk bytes unchanged, no list broadcast.
            expect(JSON.parse(FILE_SYSTEM.get(NOTES_PATH))).toEqual([PUBLIC_NOTE, PRIVATE_NOTE]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a PUBLIC note with Host %s ⇒ 403 GM-only (row survives)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/notes/note-public')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(NOTES_PATH)).map(n => n.id))
                .toEqual(['note-public', 'note-secret']);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'PUT upsert (no such lane yet) with Host %s ⇒ 403 before any fallthrough',
        async (host) => {
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/notes/note-public')
                .set('Host', host)
                .send({ id: 'note-public', description: 'tampered' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
        }
    );

    it('GET lanes stay open to players (writes-only gate, list filter intact)', async () => {
        const list = await request(createTestApp())
            .get('/api/campaigns/test-campaign/notes')
            .set('Host', '192.168.0.44:5173');
        expect(list.status).toBe(200);
        expect(list.body.notes.map(n => n.id)).toEqual(['note-public']);

        const one = await request(createTestApp())
            .get('/api/campaigns/test-campaign/notes/note-public')
            .set('Host', '192.168.0.44:5173');
        expect(one.status).toBe(200);
    });

    it('localhost GM POST still saves the whole array (lane unchanged, stamped + broadcast)', async () => {
        const updated = [
            { ...PUBLIC_NOTE },
            { ...PRIVATE_NOTE },
            { id: 'note-new-gm', description: 'Fresh GM note', isPrivate: false, partyLocation: 'Watchtower' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/notes')
            .set('Host', 'localhost')
            .send({ notes: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(NOTES_PATH));
        expect(stored.map(n => n.id)).toEqual(['note-public', 'note-secret', 'note-new-gm']);
        // New rows get stamped; untouched stamped rows keep their stamp.
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(PUBLIC_NOTE.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'notes-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/notes/note-public')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(NOTES_PATH)).map(n => n.id)).toEqual(['note-secret']);
        expect(publishSpy).toHaveBeenCalledWith(
            'notes-list-test-campaign',
            { action: 'deleted', name: 'note-public' },
            'test-campaign'
        );
    });
});
