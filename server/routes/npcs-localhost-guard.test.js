// Regression lock for bug-npcs-factions-settlements-lanes-no-origin-guard —
// the NPC WRITE lanes are GM-only (localhost), mirroring the notes.js
// refuseUnlessGm wrapper shape. Before the gate a network client's whole-
// array POST with an honestly-echoed snapshot landed straight into the GM's
// npcs.json (live-witnessed 2026-11-12: visitor POST 200 + row persisted),
// and visitor PUT/DELETE landed too. READS stay open: player-side runtime
// features legitimately consume GET /npcs from visitor tabs (Initiative.jsx
// mount effect + the attack pipeline in contextBuilder-map.js /
// damageRoll.js loadNPCs calls), so this lane is the notes face, not the
// sessions/quests whole-lane face. Mirrors notes-write-localhost-guard.test.js
// setup (real jsonEntityCrud factory; only fs + campaign paths + imageUtils
// mocked) plus the changeData publish spy (GM writes broadcast).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

const NPCS_PATH = '/mock/campaigns/test-campaign/data/npcs.json';

const GM_NPC_ONE = {
    name: 'Marta Copperkettle',
    attitude: 'friendly',
    notes: 'GM fixture row one',
    updatedAt: 1793124887756,
};
const GM_NPC_TWO = {
    name: 'Oldhem the Ferryman',
    attitude: 'neutral',
    notes: 'GM fixture row two',
    updatedAt: 1793124887800,
};

function setupNPCs(npcs) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign/data', '');
    FILE_SYSTEM.set(NPCS_PATH, JSON.stringify(npcs, null, 2));
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
        renameSync: (oldPath, newPath) => {
            const data = FILE_SYSTEM.get(oldPath);
            if (data !== undefined) {
                FILE_SYSTEM.set(newPath, data);
                FILE_SYSTEM.delete(oldPath);
            }
        },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    mkdirSync: (p) => { FILE_SYSTEM.set(p, ''); },
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: vi.fn((campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`),
    ensureDataDir: vi.fn((campaign) => { FILE_SYSTEM.set(`/mock/campaigns/${campaign}/data`, ''); }),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

const imageOps = vi.hoisted(() => ({ uploaded: [], deleted: [] }));
vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn((campaign, name, npc) => {
        imageOps.uploaded.push({ campaign, name });
        npc.imagePath = `images/${name}.png`;
    }),
    deleteCharacterImage: vi.fn((imagePath) => {
        imageOps.deleted.push(imagePath);
    }),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: publishSpy,
}));

import npcs from './npcs.js';

// Same honest dev-proxy Host values as quests-localhost-guard.test.js — a LAN
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
    app.use(npcs);
    return app;
}

beforeEach(() => {
    setupNPCs([GM_NPC_ONE, GM_NPC_TWO]);
    publishSpy.mockClear();
    imageOps.uploaded.length = 0;
    imageOps.deleted.length = 0;
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('npcs — GM-only write gate (visitor-origin 403, reads stay open)', () => {
    it.each(LAN_HOSTS)(
        'POST full-content append with Host %s ⇒ 403 GM-only, disk inert (pre-fix LANDS)',
        async (host) => {
            // Snapshot echoing both stamped disk rows + a visitor append —
            // exactly the body that SATISFIED the concurrent-save guard and
            // wrote straight into the GM planning file pre-fix.
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/npcs')
                .set('Host', host)
                .send({
                    npcs: [
                        { ...GM_NPC_ONE },
                        { ...GM_NPC_TWO },
                        { name: 'OP Visitor Probe', attitude: 'hostile', notes: 'visitor write repro' },
                    ],
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(NPCS_PATH))).toEqual([GM_NPC_ONE, GM_NPC_TWO]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'DELETE a row with Host %s ⇒ 403 GM-only (row survives — pre-fix landed 200)',
        async (host) => {
            const res = await request(createTestApp())
                .delete('/api/campaigns/test-campaign/npcs/Marta Copperkettle')
                .set('Host', host);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(NPCS_PATH)).map(n => n.name))
                .toEqual(['Marta Copperkettle', 'Oldhem the Ferryman']);
            // Inert: no image delete side effect, no broadcast.
            expect(imageOps.deleted).toEqual([]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it.each(LAN_HOSTS)(
        'PUT upsert with Host %s ⇒ 403 before any image/conflict logic, disk inert',
        async (host) => {
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/npcs/Marta Copperkettle')
                .set('Host', host)
                .send({ name: 'Marta Copperkettle', notes: 'visitor tamper', attitude: 'hostile' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(JSON.parse(FILE_SYSTEM.get(NPCS_PATH))).toEqual([GM_NPC_ONE, GM_NPC_TWO]);
            expect(imageOps.uploaded).toEqual([]);
            expect(imageOps.deleted).toEqual([]);
            expect(publishSpy).not.toHaveBeenCalled();
        }
    );

    it('GET lanes stay open to visitors (notes face — runtime consumers need the list)', async () => {
        // Initiative.jsx mount + the player attack pipeline (contextBuilder-
        // map.js / damageRoll.js) fetch GET /npcs from visitor-origin tabs;
        // a 403 here would silently degrade map-aware combat math.
        const list = await request(createTestApp())
            .get('/api/campaigns/test-campaign/npcs')
            .set('Host', '192.168.0.44:5173');
        expect(list.status).toBe(200);
        expect(list.body.npcs.map(n => n.name)).toEqual(['Marta Copperkettle', 'Oldhem the Ferryman']);

        const one = await request(createTestApp())
            .get('/api/campaigns/test-campaign/npcs/Marta Copperkettle')
            .set('Host', '192.168.0.44:5173');
        expect(one.status).toBe(200);
        expect(one.body.npc.name).toBe('Marta Copperkettle');
    });
});

describe('npcs — localhost GM lane unchanged (read + write + broadcast)', () => {
    it('localhost GM POST still saves the whole array (stamped + replaced broadcast)', async () => {
        const updated = [
            { ...GM_NPC_ONE },
            { ...GM_NPC_TWO },
            { name: 'Fresh GM NPC', attitude: 'friendly', notes: 'New plan row' },
        ];
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/npcs')
            .set('Host', 'localhost')
            .send({ npcs: updated });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        const stored = JSON.parse(FILE_SYSTEM.get(NPCS_PATH));
        expect(stored.map(n => n.name)).toEqual(['Marta Copperkettle', 'Oldhem the Ferryman', 'Fresh GM NPC']);
        expect(typeof stored[2].updatedAt).toBe('number');
        expect(stored[0].updatedAt).toBe(GM_NPC_ONE.updatedAt);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('localhost GM PUT upsert still creates a row (200 + created broadcast)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/npcs/New Probe NPC')
            .set('Host', 'localhost')
            .send({ name: 'New Probe NPC', attitude: 'neutral' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.npc.name).toBe('New Probe NPC');
        const stored = JSON.parse(FILE_SYSTEM.get(NPCS_PATH));
        expect(stored.map(n => n.name)).toEqual(['Marta Copperkettle', 'Oldhem the Ferryman', 'New Probe NPC']);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'created', name: 'New Probe NPC' },
            'test-campaign'
        );
    });

    it('localhost GM DELETE still removes the row (200 + deleted broadcast)', async () => {
        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/npcs/Marta Copperkettle')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(JSON.parse(FILE_SYSTEM.get(NPCS_PATH)).map(n => n.name)).toEqual(['Oldhem the Ferryman']);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'deleted', name: 'Marta Copperkettle' },
            'test-campaign'
        );
    });
});
