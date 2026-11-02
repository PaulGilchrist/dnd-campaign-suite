// @maintained-by-ai
// ─── Lane: campaign-type meta route ──────────────────────────────────────────
// GET always answers a resolved type (explicit meta file → legacy starter-seed
// inference → standard); PUT is GM-only (localhost) with an enum guard so only
// known badge types ever land on disk. A corrupt meta file must degrade to
// inference, never 500.
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import campaignsMeta, { resolveCampaignType } from './campaigns-meta.js';

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

const FOREIGN_HOST = '100.92.171.80';
const META_FILE = '/mock/campaigns/test-campaign/data/campaign-meta.json';
const SEED_FILE = '/mock/campaigns/test-campaign/data/starter-seed.json';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsMeta);
    return app;
}

beforeEach(() => {
    mockFsState.exists.clear();
    mockFsState.files.clear();
    vi.clearAllMocks();
});

describe('campaign meta GET', () => {
    it('answers standard when nothing marks the campaign', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'standard' });
    });

    it('returns the stored type (open to LAN readers too)', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'arena' }));
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/meta')
            .set('Host', FOREIGN_HOST);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'arena' });
    });

    it('infers starter from a legacy starter-seed document (no meta file)', async () => {
        mockFsState.exists.add(SEED_FILE);
        expect(resolveCampaignType('test-campaign')).toBe('starter');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.body).toEqual({ type: 'starter' });
    });

    it('reads a corrupt meta file as absent and still infers', async () => {
        mockFsState.files.set(META_FILE, '{not json');
        mockFsState.exists.add(SEED_FILE);
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'starter' });
    });

    it('ignores an unknown stored type (inference wins)', () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'chess-match' }));
        expect(resolveCampaignType('test-campaign')).toBe('standard');
    });
});

describe('campaign meta PUT', () => {
    it('writes the type document from localhost', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ type: 'arena' });
        expect(res.status).toBe(200);
        expect(JSON.parse(mockFsState.files.get(META_FILE))).toEqual({ type: 'arena' });
    });

    it('403s a network client and leaves disk untouched', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .set('Host', FOREIGN_HOST)
            .send({ type: 'starter' });
        expect(res.status).toBe(403);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it.each([['missing', {}], ['unknown enum', { type: 'chess-match' }], ['non-string', { type: 7 }]])(
        'refuses a %s type payload with 400',
        async (_label, body) => {
            const res = await request(createTestApp()).put('/api/campaigns/test-campaign/meta').send(body);
            expect(res.status).toBe(400);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        },
    );
});
