// @maintained-by-ai
/**
 * Campaign-authoring plan Phase 3 — draft invisibility at the CRUD factory
 * choke point. AI drafts (draft:true) are GM planning surfaces; every entity
 * sharing createJsonEntityRouter must hide them from non-localhost callers
 * (owner ruling), while the GM machine sees them badged for review.
 */
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';
import { createJsonEntityRouter } from './jsonEntityCrud.js';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p)),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p);
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return JSON.stringify(c);
        }),
        writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn((p) => { MOCK_FS.delete(p); }),
    },
}));

vi.mock('./campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

const ROUTER = createJsonEntityRouter('quests', { singularDisplayName: 'Quest' });
const app = express();
app.use(express.json());
app.use(ROUTER);

const FILE = '/mock/campaigns/test-campaign/data/quests.json';
const get = (path, host) => request(app).get(path).set('Host', host);

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(FILE, [
        { id: 'live-1', name: 'Approved Quest' },
        { id: 'draft-1', name: 'The Traitor Is Marta', draft: true },
    ]);
});

describe('CRUD factory draft filtering (campaign-authoring Phase 3)', () => {
    it('GM list includes drafts; LAN list omits them entirely', async () => {
        const gm = await get('/api/campaigns/test-campaign/quests', 'localhost');
        expect(gm.body.quests.map(q => q.name)).toEqual(['Approved Quest', 'The Traitor Is Marta']);
        expect(gm.body.quests.find(q => q.draft).draft).toBe(true);

        const lan = await get('/api/campaigns/test-campaign/quests', '10.0.0.5');
        expect(lan.body.quests.map(q => q.name)).toEqual(['Approved Quest']);
    });

    it('a draft single-read 404s to LAN exactly like an absent row', async () => {
        const lan = await get('/api/campaigns/test-campaign/quests/draft-1', '10.0.0.5');
        expect(lan.status).toBe(404);
        expect(lan.body).toEqual({ error: 'Quest not found' });

        const gm = await get('/api/campaigns/test-campaign/quests/draft-1', 'localhost');
        expect(gm.status).toBe(200);
        expect(gm.body.quest.name).toBe('The Traitor Is Marta');
    });

    it('GM whole-array round-trip preserves drafts (approve is the ONLY clearer)', async () => {
        const current = MOCK_FS.get(FILE);
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost')
            .send({ quests: current });
        expect(res.status).toBe(200);
        expect(MOCK_FS.get(FILE).find(q => q.id === 'draft-1').draft).toBe(true);
    });

    it('127.0.0.1 counts as the GM machine', async () => {
        const res = await get('/api/campaigns/test-campaign/quests', '127.0.0.1');
        expect(res.body.quests).toHaveLength(2);
    });
});
