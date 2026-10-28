import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import { createCampaignLockMiddleware, createCampaignRenameGuard } from './campaignLock.js';

// Regression for bug-campaign-lock-ignores-rename-target: the lock
// middleware only validated the :campaign SOURCE segment, so while locked
// to test-campaign, `PUT /api/campaigns/test-campaign {newName:"zz"}`
// slipped past the lock and renamed the folder (live incident 2026-10-28).
// Phase 2 (createCampaignRenameGuard) must 403 any rename of the locked
// campaign whose trimmed newName is not the locked name itself, with the
// same `[campaign-lock] BLOCKED …` log line — while every other request
// shape behaves exactly as the original middleware did.

const LOCK = 'test-campaign';

// Mirrors server.js mount order: phase 1 → express.json → phase 2 → routes.
// Sentinel stub routes prove whether a request reached the router.
function createTestApp(campaignLock = LOCK) {
    const app = express();
    app.use(createCampaignLockMiddleware(campaignLock));
    app.use(express.json({ limit: '5mb' }));
    app.use(createCampaignRenameGuard(campaignLock));
    app.put('/api/campaigns/:campaign', (req, res) => {
        res.json({ reached: true, campaign: req.params.campaign, newName: req.body?.newName });
    });
    app.post('/api/campaigns/:campaign/change', (req, res) => {
        res.json({ reached: true, value: req.body?.value });
    });
    app.get('/api/campaigns/:campaign', (req, res) => {
        res.json({ reached: true });
    });
    return app;
}

let errorSpy;
beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    errorSpy.mockRestore();
});

describe('campaignLock - phase 2 rename guard (PUT /api/campaigns/:campaign)', () => {
    it('blocks renaming the locked campaign to another name, with the BLOCKED log line', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'zz-lock-probe' });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Campaign locked to "test-campaign"');
        expect(res.body.error).toContain('PUT /api/campaigns/test-campaign denied');
        expect(errorSpy).toHaveBeenCalledWith(
            '[campaign-lock] BLOCKED PUT /api/campaigns/test-campaign (locked to "test-campaign")'
        );
    });

    it('blocks a trailing-slash rename too (Express matches the route either way)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/')
            .set('Content-Type', 'application/json')
            .send({ newName: 'zz-lock-probe' });
        expect(res.status).toBe(403);
    });

    it('blocks percent-encoded rename destinations that decode outside the lock', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'zz%2Dlock%2Dprobe' });
        // The route trims but does not URL-decode; either way it is not the
        // locked name, so the guard must refuse it before the route runs.
        expect(res.status).toBe(403);
    });

    it('passes a no-op rename (newName === locked name) through to the route', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'test-campaign' });
        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
    });

    it('passes a whitespace-padded no-op rename through (route trims identically)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: '  test-campaign  ' });
        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
    });

    it('passes non-rename PUTs into the locked campaign unchanged', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ description: 'just metadata' });
        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
    });

    it('passes a body-less PUT into the locked campaign unchanged', async () => {
        const res = await request(createTestApp()).put('/api/campaigns/test-campaign');
        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
    });
});

describe('campaignLock - phase 1 behavior preserved', () => {
    it('still 403s PUT renames of a NON-locked campaign (source check)', async () => {
        const res = await request(createTestApp())
            .put('/api/campaigns/Frostfall')
            .set('Content-Type', 'application/json')
            .send({ newName: 'anything' });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Campaign locked to "test-campaign"');
    });

    it('passes mutating requests into the locked campaign (nested writes)', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/change')
            .set('Content-Type', 'application/json')
            .send({ value: 42 });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ reached: true, value: 42 });
    });

    it('lets GET/HEAD/OPTIONS through untouched, locked campaign or not', async () => {
        const locked = await request(createTestApp()).get('/api/campaigns/test-campaign');
        expect(locked.status).toBe(200);
        const other = await request(createTestApp()).get('/api/campaigns/Frostfall');
        expect(other.status).toBe(200);
    });

    it('ignores non-campaign paths', async () => {
        const res = await request(createTestApp())
            .post('/api/spell-overlay')
            .set('Content-Type', 'application/json')
            .send({ anything: true });
        expect(res.status).toBe(404); // reaches the router (no such route), not 403
    });
});

describe('campaignLock - unlocked passthrough', () => {
    it('renames of any campaign reach the route when the lock is unset', async () => {
        const res = await request(createTestApp(null))
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'renamed-freely' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ reached: true, campaign: 'test-campaign', newName: 'renamed-freely' });
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
