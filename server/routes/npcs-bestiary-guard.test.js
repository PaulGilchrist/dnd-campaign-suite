import path from 'path';
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// ---------------------------------------------------------------------------
// Owner invariant: npcs.json is reserved for CUSTOM NPCs — pre-made monsters
// join via the Encounter Builder and pull real stats from monsters.json.
// Observed live (2026-10-13 playtest): a placeholder all-10s "Goblin" sitting
// in npcs.json shadow-blocked the bestiary Goblin (AC 15, Scimitar/Shortbow)
// in the tracker avatar → MonsterCardModal lane. These tests pin the refusal.
// ---------------------------------------------------------------------------

const FILE_SYSTEM = new Map();

const MOCK_CAMPAIGN = 'test-campaign';
const MOCK_NPCS_PATH = `/mock/campaigns/${MOCK_CAMPAIGN}/data/npcs.json`;
// The guard reads the bestiary from the REAL published location (not the
// mocked campaign data dir) — seed it at the same path the route derives.
const MOCK_BESTIARY_PATH = path.join(process.cwd(), 'public', 'data', 'monsters.json');

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
        renameSync: vi.fn(),
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    renameSync: vi.fn(),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

// Import AFTER mocks so the real route code runs against the mocked fs.
import npcs from './npcs.js';

const GM = { 'X-Client-Id': '11111111-1111-4111-8111-111111111111' };

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(npcs);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set(MOCK_NPCS_PATH, JSON.stringify([{ name: 'Town Guard', armorClass: 13 }]));
    FILE_SYSTEM.set(MOCK_BESTIARY_PATH, JSON.stringify([
        { name: 'Goblin', armor_class: 15 },
        { name: 'Zombie', armor_class: 8 },
    ]));
});

describe('npcs — bestiary-name guard (monsters never live in npcs.json)', () => {
    it('rejects saving a bestiary monster as an NPC (PUT) with a plain-English refusal', async () => {
        const app = createTestApp();
        const res = await request(app).put(`/api/campaigns/${MOCK_CAMPAIGN}/npcs/Goblin`).set(GM)
            .send({ name: 'Goblin', armorClass: 10, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, actions: [] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/published monster/i);
        expect(res.body.error).toMatch(/Encounter Builder/i);
        const saved = JSON.parse(FILE_SYSTEM.get(MOCK_NPCS_PATH));
        expect(saved.find(n => n.name === 'Goblin')).toBeFalsy();
    });

    it('rejects a bulk save (POST) that smuggles any bestiary monster in', async () => {
        const app = createTestApp();
        const res = await request(app).post(`/api/campaigns/${MOCK_CAMPAIGN}/npcs`).set(GM)
            .send({ npcs: [{ name: 'Brix the Tinker', armorClass: 11 }, { name: 'Zombie', armorClass: 8 }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Zombie/i);
    });

    it('still accepts a genuinely custom NPC', async () => {
        const app = createTestApp();
        const res = await request(app).put(`/api/campaigns/${MOCK_CAMPAIGN}/npcs/Gob Ironwhistle`).set(GM)
            .send({ name: 'Gob Ironwhistle', armorClass: 12 });
        expect(res.status).toBe(200);
        const saved = JSON.parse(FILE_SYSTEM.get(MOCK_NPCS_PATH));
        expect(saved.find(n => n.name === 'Gob Ironwhistle')).toBeTruthy();
    });
});
