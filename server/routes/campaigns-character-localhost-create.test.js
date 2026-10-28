// Regression lock for bug-player-view-can-create-characters — server-side
// authority guard on the character-CREATE route. Character creation is a
// GM-only write (AGENTS.md localhost-only policy, mirrors the maps.js
// refuseUnlessGm / campaigns-admin.js 403 pattern and the client-side
// Sidebar.jsx Add-Character gate): a non-localhost (network) client POSTing
// a new character must get 403 with NO file written, while the honest
// localhost GM create lane stays byte-identical (201 + file + broadcast).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// Shape-guard-compatible: all six standard abilities with numeric baseScore
// (entry-shape guard in campaigns-character.js).
const standardAbilities = () => (
    ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
        .map((name) => ({ name, baseScore: 10 }))
);

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
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
        unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
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
    unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

let publishedEvents = [];
vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
    removeChangeDataKey: vi.fn(),
}));

import campaignsCharacter from './campaigns-character.js';

const LAN_HOSTS = ['192.168.0.239', '100.92.171.80', 'example.test'];

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishedEvents = [];
});

describe('campaignsCharacter — POST create localhost authority gate', () => {
    it.each(LAN_HOSTS)(
        'POST /api/campaigns/:campaign from %s ⇒ 403, no character file written, no broadcast',
        async (host) => {
            setupFs({});

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .set('Host', host)
                .send({ campaignName: 'test-campaign', character: { name: 'LANProbe', level: 1 } });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/GM-only/i);
            expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/LANProbe.json')).toBe(false);
            expect(publishedEvents).toHaveLength(0);
        }
    );

    it('localhost create still succeeds (201 + file + broadcast) — GM lane unchanged', async () => {
        setupFs({});

        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign')
            .set('Host', 'localhost')
            .send({ campaignName: 'test-campaign', character: { name: 'GMProbe', level: 1, race: { name: 'Human' }, class: { name: 'Fighter', subclass: { name: 'Champion' } }, abilities: standardAbilities(), inventory: { magicItems: [], equipped: [] } } });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('fileName', 'GMProbe.json');
        expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/GMProbe.json')).toBe(true);
        expect(publishedEvents.find((e) => e.key === 'character-create-test-campaign-GMProbe.json')).toBeTruthy();
    });

    it('127.0.0.1 create still succeeds for the loopback GM host', async () => {
        setupFs({});

        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign')
            .set('Host', '127.0.0.1')
            .send({ character: { name: 'LoopbackProbe', level: 1, race: { name: 'Human' }, class: { name: 'Fighter', subclass: { name: 'Champion' } }, abilities: standardAbilities(), inventory: { magicItems: [], equipped: [] } } });

        expect(res.status).toBe(201);
        expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/LoopbackProbe.json')).toBe(true);
    });

    it('existing-character read lane (GET on the .json file) stays reachable from the network view', async () => {
        // Scope pin: this ticket guards CREATE only — the players' read lane
        // and the pre-existing PUT edit lane (intentional player-writes-own-
        // file, see the PUT handler comment) are unchanged (deny-nothing-
        // sibling). DELETE gained its refuseUnlessGm gate later, in
        // bug-character-delete-no-gm-gate.
        setupFs({
            '/mock/campaigns/test-campaign/AasimarTest.json': { name: 'AasimarTest', level: 20 },
        });

        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/AasimarTest.json')
            .set('Host', '192.168.0.239');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('name', 'AasimarTest');
    });
});
