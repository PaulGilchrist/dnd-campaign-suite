// Cache-Control pin for the route-served campaign JSON family (run-Q
// stale-GET phantom bug): every GET under /api/campaigns must carry
// `Cache-Control: no-store` (mirroring the static lane), while mutating
// lanes stay header-unchanged. Wires the SAME shared middleware server.js
// mounts (server/utils/noStoreApi.js) with the real campaign routers.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import fs from 'fs';
import campaignsBasic from './campaigns-basic.js';
import campaignsCharacter from './campaigns-character.js';
import { noStoreCampaignGets } from '../utils/noStoreApi.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('fs', () => {
    const m = {
        readdirSync: vi.fn(() => [
            { name: 'AasimarTest.json', isDirectory: () => false, isFile: () => true },
        ]),
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify({ name: 'AasimarTest' })),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        renameSync: vi.fn(),
    };
    globalThis._mockFs = m;
    return { default: m, ...m };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignsRoot: vi.fn(() => '/mock/campaigns/root'),
    campaignDir: vi.fn((campaign) => `/mock/campaigns/root/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/root/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    removeChangeDataKey: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Same composition as server.js: shared middleware path-mounted for the
// campaign family, then the campaign routers.
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/campaigns', noStoreCampaignGets);
    app.use(campaignsBasic);
    app.use(campaignsCharacter);
    return app;
}

// ─── no-store on the campaign JSON GET lanes ──────────────────────────────────

describe('campaign JSON Cache-Control: no-store (shared noStoreCampaignGets middleware)', () => {
    afterEach(() => {
        const mfs = globalThis._mockFs;
        mfs.existsSync.mockReset().mockReturnValue(true);
        mfs.readFileSync.mockReset().mockReturnValue(JSON.stringify({ name: 'AasimarTest' }));
    });

    it('character-file GET lane carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/AasimarTest.json');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('still carries no-store when the character file is gone (404 must not be cached — the phantom lane)', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/Deleted.json');

        expect(res.status).toBe(404);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('campaign character-file list GET carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('campaign list root GET carries no-store', async () => {
        const res = await request(createTestApp()).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('mutating lanes are unchanged — POST carries no Cache-Control directive', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'Probe' } });

        // existsSync(true) trips the duplicate-name guard; the exact status is
        // irrelevant — the pin is that the header lane did not change.
        expect(res.status).toBe(400);
        expect(res.headers['cache-control']).toBeUndefined();
    });
});
