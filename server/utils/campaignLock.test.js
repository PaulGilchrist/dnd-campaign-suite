import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import { createCampaignLockMiddleware, createCampaignCreateGuard, createCampaignRenameGuard, parseCampaignLock, campaignLockAllows } from './campaignLock.js';

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
    app.use(createCampaignCreateGuard(campaignLock));
    app.use(createCampaignRenameGuard(campaignLock));
    app.post('/api/campaigns', (req, res) => {
        res.json({ reached: true, created: req.body?.campaignName });
    });
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

describe('campaignLock - set-form lock rename lane (throwaway ↔ allowlisted member)', () => {
    // Owner ruling 2026-11-02 (rename-QA unblock, option B): a set-form lock
    // ("primary,qa-arena,qa-starter,qa-renamed") permits renaming a
    // THROWAWAY member (any member except the primary/first entry) onto
    // another allowlisted name — the only way Arena/Starter verification can
    // exercise the rename lane without ever touching production or stranding
    // the harness campaign. Everything else stays 403.
    const SET_LOCK = 'test-campaign,qa-arena,qa-starter,qa-renamed';

    it('lets a throwaway member rename onto another allowlisted member', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/qa-starter')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-renamed' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ reached: true, campaign: 'qa-starter', newName: 'qa-renamed' });
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('passes a padded allowlisted destination through (route trims identically)', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/qa-starter')
            .set('Content-Type', 'application/json')
            .send({ newName: '  qa-renamed  ' });
        expect(res.status).toBe(200);
    });

    it('passes a no-op rename of a throwaway member through', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/qa-arena')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-arena' });
        expect(res.status).toBe(200);
    });

    it('blocks a throwaway rename onto an OFF-allowlist name (no escape hatch)', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/qa-starter')
            .set('Content-Type', 'application/json')
            .send({ newName: 'Frostfall II' });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('denied');
    });

    it('blocks renaming the PRIMARY/first lock entry even onto a member (harness never renamed)', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-renamed' });
        expect(res.status).toBe(403);
        expect(errorSpy).toHaveBeenCalledWith(
            '[campaign-lock] BLOCKED PUT /api/campaigns/test-campaign (locked to "test-campaign,qa-arena,qa-starter,qa-renamed")'
        );
    });

    it('blocks a non-member source entirely (phase 1, regardless of destination)', async () => {
        const res = await request(createTestApp(SET_LOCK))
            .put('/api/campaigns/Testing G1')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-renamed' });
        expect(res.status).toBe(403);
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

describe('parseCampaignLock / campaignLockAllows', () => {
    it('single name parses to one-element list; membership equals old equality', () => {
        expect(parseCampaignLock('test-campaign')).toEqual(['test-campaign']);
        expect(campaignLockAllows('test-campaign', 'test-campaign')).toBe(true);
        expect(campaignLockAllows('test-campaign', 'qa-arena')).toBe(false);
    });

    it('comma list trims and drops blanks; membership covers every member', () => {
        expect(parseCampaignLock(' test-campaign , qa-arena ,, qa-starter ')).toEqual(['test-campaign', 'qa-arena', 'qa-starter']);
        expect(campaignLockAllows('test-campaign,qa-arena,qa-starter', 'qa-arena')).toBe(true);
        expect(campaignLockAllows('test-campaign,qa-arena,qa-starter', 'Frostfall')).toBe(false);
    });

    it('empty/all-blank lock parses to null (unlocked)', () => {
        expect(parseCampaignLock('')).toBeNull();
        expect(parseCampaignLock('  ,  ')).toBeNull();
        expect(parseCampaignLock(null)).toBeNull();
    });
});

describe('campaignLock - allowlist set (qa throwaways)', () => {
    const LIST = 'test-campaign,qa-arena,qa-starter';

    it('permits nested writes to every member campaign', async () => {
        for (const name of ['test-campaign', 'qa-arena', 'qa-starter']) {
            const res = await request(createTestApp(LIST))
                .post(`/api/campaigns/${name}/change`)
                .set('Content-Type', 'application/json')
                .send({ value: 1 });
            expect(res.status).toBe(200);
            expect(res.body.reached).toBe(true);
        }
    });

    it('still denies production campaigns', async () => {
        const res = await request(createTestApp(LIST))
            .post('/api/campaigns/Frostfall/change')
            .set('Content-Type', 'application/json')
            .send({ value: 1 });
        expect(res.status).toBe(403);
    });

    it('create route accepts a member name and refuses non-members', async () => {
        const ok = await request(createTestApp(LIST))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({ campaignName: 'qa-arena' });
        expect(ok.status).toBe(200);
        expect(ok.body).toEqual({ reached: true, created: 'qa-arena' });

        for (const bad of ['Frostfall', 'my-new-campaign', '']) {
            const locked = await request(createTestApp(LIST))
                .post('/api/campaigns')
                .set('Content-Type', 'application/json')
                .send({ campaignName: bad });
            expect(locked.status).toBe(403);
        }
    });

    // Backlog 2026-11-11 LZ: the create denial must be plain English NAMING
    // the refused campaign — the quick-create modal renders this body inline
    // (typed name preserved) instead of a full-page dead end.
    it('refuses a non-member create with a plain-English body naming the attempted name', async () => {
        const res = await request(createTestApp(LIST))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({ campaignName: 'Starter-20261111' });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Campaign locked to "test-campaign,qa-arena,qa-starter"');
        expect(res.body.error).toContain('named "Starter-20261111" cannot be created while locked');
        expect(res.body.error).toContain('Only these campaign names are allowed: test-campaign, qa-arena, qa-starter');
        expect(errorSpy).toHaveBeenCalledWith(
            '[campaign-lock] BLOCKED POST /api/campaigns (locked to "test-campaign,qa-arena,qa-starter")'
        );
    });

    it('names nothing but the refusal when the create body carries no usable name', async () => {
        const res = await request(createTestApp(LOCK))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('a new campaign cannot be created while locked');
        expect(res.body.error).not.toContain('named ""');
    });

    it('a single-name lock cannot create anything (its only member already exists)', async () => {
        const res = await request(createTestApp(LOCK))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({ campaignName: 'test-campaign' });
        // Even naming the existing campaign: creation of the already-set member
        // is allowed by the guard (route then errors on dup), but a NEW name is
        // hard-refused before the route:
        expect(res.status).toBe(200);
        const fresh = await request(createTestApp(LOCK))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({ campaignName: 'qa-arena' });
        expect(fresh.status).toBe(403);
    });

    it('rename between two throwaways is allowed', async () => {
        const res = await request(createTestApp(LIST))
            .put('/api/campaigns/qa-arena')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-starter' });
        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
    });

    it('renaming the PRIMARY (first) lock entry away is still blocked', async () => {
        const res = await request(createTestApp(LIST))
            .put('/api/campaigns/test-campaign')
            .set('Content-Type', 'application/json')
            .send({ newName: 'qa-arena' });
        expect(res.status).toBe(403);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('BLOCKED PUT /api/campaigns/test-campaign'));
    });

    it('a throwaway renamed to a NON-member name is blocked', async () => {
        const res = await request(createTestApp(LIST))
            .put('/api/campaigns/qa-arena')
            .set('Content-Type', 'application/json')
            .send({ newName: 'Frostfall' });
        expect(res.status).toBe(403);
    });

    it('unlocked still creates any name', async () => {
        const res = await request(createTestApp(null))
            .post('/api/campaigns')
            .set('Content-Type', 'application/json')
            .send({ campaignName: 'literally-anything' });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe('literally-anything');
    });
});
