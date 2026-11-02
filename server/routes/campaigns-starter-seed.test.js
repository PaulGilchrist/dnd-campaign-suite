// @maintained-by-ai
// ─── Lane: starter-seed document route (arena-starter plan §3) ───────────────
// GET answers { seed: null } when no document exists (regular campaigns never
// render the first-session checklist, and the client never sees error noise);
// PUT is GM-only (localhost) — network clients 403 and stay disk-inert; the
// payload guard refuses non-object seeds; a successful PUT broadcasts the
// updated document on `starter-seed-<campaign>` so every tab's checklist
// refreshes without reload (mirrors settlements-list broadcasts).
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import starterSeed from './campaigns-starter-seed.js';

const mockFsState = { exists: new Set(), files: new Map() };

vi.mock('fs', () => {
    const impl = {
        existsSync: vi.fn((p) => mockFsState.exists.has(p) || mockFsState.files.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); }),
    };
    return { default: impl, ...impl };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: vi.fn(() => '/mock/campaigns/test-campaign/data'),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    publish: publishSpy,
}));

const FOREIGN_HOST = '100.92.171.80';
const SEED_FILE = '/mock/campaigns/test-campaign/data/starter-seed.json';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(starterSeed);
    return app;
}

beforeEach(() => {
    mockFsState.exists.clear();
    mockFsState.files.clear();
    vi.clearAllMocks();
});

describe('starter-seed GET', () => {
    it('answers { seed: null } when no document exists', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/starter-seed');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ seed: null });
    });

    it('returns the stored document (open to LAN readers too)', async () => {
        mockFsState.files.set(SEED_FILE, JSON.stringify({ version: 1, seed: 42 }));
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/starter-seed')
            .set('Host', FOREIGN_HOST);
        expect(res.status).toBe(200);
        expect(res.body.seed).toEqual({ version: 1, seed: 42 });
    });

    it('reads a corrupt document as absent (never 500s a campaign view)', async () => {
        mockFsState.files.set(SEED_FILE, '{not json');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/starter-seed');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ seed: null });
    });
});

describe('starter-seed PUT', () => {
    it('writes the seed document from localhost', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/starter-seed')
            .send({ seed: { version: 1, seed: 7, entities: { settlement: 'QA Hollow' } } });
        expect(res.status).toBe(200);
        expect(fs.writeFileSync).toHaveBeenCalledWith(SEED_FILE, expect.any(String));
        expect(JSON.parse(mockFsState.files.get(SEED_FILE)).entities.settlement).toBe('QA Hollow');
    });

    it('403s a network client and leaves disk untouched', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/starter-seed')
            .set('Host', FOREIGN_HOST)
            .send({ seed: { version: 1 } });
        expect(res.status).toBe(403);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('refuses a missing/array seed payload with 400', async () => {
        const app = createTestApp();
        const missing = await request(app).put('/api/campaigns/test-campaign/starter-seed').send({});
        expect(missing.status).toBe(400);
        const array = await request(createTestApp()).put('/api/campaigns/test-campaign/starter-seed').send({ seed: [] });
        expect(array.status).toBe(400);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
});

describe('starter-seed PUT live-sync broadcast', () => {
    it('publishes the updated document on starter-seed-<campaign>', async () => {
        const seed = { version: 1, seed: 7, entities: { settlement: 'QA Hollow', dungeonTitle: 'Crypt of Q' } };
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/starter-seed')
            .send({ seed });
        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'starter-seed-test-campaign',
            { action: 'updated', seed },
            'test-campaign'
        );
    });

    it('stays silent when the PUT is rejected (403 network client)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/starter-seed')
            .set('Host', FOREIGN_HOST)
            .send({ seed: { version: 1 } });
        expect(res.status).toBe(403);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('stays silent when the payload is refused (400)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/starter-seed')
            .send({ seed: 'nope' });
        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
