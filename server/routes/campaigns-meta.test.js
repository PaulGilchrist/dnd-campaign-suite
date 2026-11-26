// @maintained-by-ai
// ─── Lane: campaign-type meta route ──────────────────────────────────────────
// GET always answers a resolved type (explicit meta file → 'standard' default;
// the meta file is the ONLY type channel since the no-legacy sweep 2026-11-16
// retired the starter-seed-existence inference and stamped every campaign
// folder) plus the sidebar toolbelt (an absent/malformed stored field answers
// the canonical all-visible { hiddenViews: [] }); PUT is GM-only (localhost),
// a PARTIAL upsert of { type } and/or { toolbelt } with an enum guard on type
// and a shape guard on toolbelt, so neither write can clobber the other field.
// A corrupt meta file must degrade to the standard default, never 500.
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

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: publishSpy,
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
        expect(res.body).toEqual({ type: 'standard', toolbelt: { hiddenViews: [] } });
    });

    it('returns the stored type (open to LAN readers too)', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'arena' }));
        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/meta')
            .set('Host', FOREIGN_HOST);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'arena', toolbelt: { hiddenViews: [] } });
    });

    it('a starter-seed document does NOT type the campaign (meta file is the only channel)', async () => {
        mockFsState.exists.add(SEED_FILE);
        expect(resolveCampaignType('test-campaign')).toBe('standard');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.body).toEqual({ type: 'standard', toolbelt: { hiddenViews: [] } });
    });

    it('reads a corrupt meta file as absent and still answers a type', async () => {
        mockFsState.files.set(META_FILE, '{not json');
        mockFsState.exists.add(SEED_FILE);
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'standard', toolbelt: { hiddenViews: [] } });
    });

    it('ignores an unknown stored type (standard default wins)', () => {
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

describe('campaign meta toolbelt lane', () => {
    // The sidebar toolbelt is the per-campaign set of hidden views
    // (learnability backlog Item 1). Absent field = all-visible default;
    // the PUT is a PARTIAL upsert so a toolbelt write never erases the type
    // and a type stamp never erases the toolbelt.
    it('GET passes a stored toolbelt through', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({
            type: 'standard',
            toolbelt: { hiddenViews: ['music', 'partyInventory'] },
        }));
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'standard', toolbelt: { hiddenViews: ['music', 'partyInventory'] } });
    });

    it('a corrupt stored toolbelt degrades to the all-visible default (never 500)', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'standard', toolbelt: { hiddenViews: 'music' } }));
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/meta');
        expect(res.status).toBe(200);
        expect(res.body.toolbelt).toEqual({ hiddenViews: [] });
    });

    it('PUT toolbelt writes the hidden set, dedupes, and keeps the stored type', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'starter' }));
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ toolbelt: { hiddenViews: ['music', 'music', 'campaignLog'] } });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Campaign meta saved successfully',
            type: 'starter',
            toolbelt: { hiddenViews: ['music', 'campaignLog'] },
        });
        expect(JSON.parse(mockFsState.files.get(META_FILE))).toEqual({
            type: 'starter',
            toolbelt: { hiddenViews: ['music', 'campaignLog'] },
        });
    });

    it('an empty hiddenViews array is the canonical all-visible write', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'standard', toolbelt: { hiddenViews: ['music'] } }));
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ toolbelt: { hiddenViews: [] } });
        expect(res.status).toBe(200);
        expect(JSON.parse(mockFsState.files.get(META_FILE))).toEqual({ type: 'standard', toolbelt: { hiddenViews: [] } });
    });

    it('a type-only PUT keeps a stored toolbelt intact', async () => {
        mockFsState.files.set(META_FILE, JSON.stringify({ type: 'standard', toolbelt: { hiddenViews: ['music'] } }));
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ type: 'arena' });
        expect(res.status).toBe(200);
        expect(JSON.parse(mockFsState.files.get(META_FILE))).toEqual({
            type: 'arena',
            toolbelt: { hiddenViews: ['music'] },
        });
    });

    it.each([
        ['missing hiddenViews', { toolbelt: {} }],
        ['non-array hiddenViews', { toolbelt: { hiddenViews: 'music' } }],
        ['non-string entry', { toolbelt: { hiddenViews: [7] } }],
        ['blank entry', { toolbelt: { hiddenViews: ['  '] } }],
        ['non-object toolbelt', { toolbelt: ['music'] }],
    ])('refuses a %s toolbelt payload with 400 and leaves disk untouched', async (_label, body) => {
        const res = await request(createTestApp()).put('/api/campaigns/test-campaign/meta').send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/hiddenViews/);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('403s a network client writing the toolbelt and leaves disk untouched', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .set('Host', FOREIGN_HOST)
            .send({ toolbelt: { hiddenViews: ['music'] } });
        expect(res.status).toBe(403);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('publishes campaigns-list (updated) on a toolbelt write so mounted tabs converge live', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ toolbelt: { hiddenViews: ['music'] } });
        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'campaigns-list',
            { action: 'updated', campaign: 'test-campaign' },
            'test-campaign'
        );
    });
});

describe('campaign meta PUT live-sync broadcast', () => {
    // Quick-create writes the folder first and this meta last, so this event
    // is what lands the Arena/Starter badge on rows open selection tabs just
    // saw appear (campaigns-list doctrine, starter-seed 71f617299 twin).
    it('publishes campaigns-list (updated) on a successful type write', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ type: 'arena' });
        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'campaigns-list',
            { action: 'updated', campaign: 'test-campaign' },
            'test-campaign'
        );
    });

    it('stays silent when the PUT is rejected (403 network client)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .set('Host', FOREIGN_HOST)
            .send({ type: 'starter' });
        expect(res.status).toBe(403);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('stays silent when the payload is refused (400)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/meta')
            .send({ type: 'chess-match' });
        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
