// Regression: /spell-overlay sits OUTSIDE the /api/campaigns path namespace
// (its campaign is a query param), so the path-based campaign-lock middleware
// never inspects it. While CAMPAIGN_LOCK is active, the route itself must
// refuse every mutating request whose campaign is not the locked one — with
// the same `[campaign-lock] BLOCKED` log line and 403 JSON shape every
// /api/campaigns write lane emits — BEFORE touching spellOverlayData or
// publish(). Garbage campaign names are off-target by definition, so the same
// 403 closes the phantom in-memory entry growth. Reads stay open while locked,
// mirroring the middleware's READ_METHODS pass-through. Unlocked = unchanged.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import { setCampaignLock } from '../utils/campaignLock.js';

// Mock the store module so the route shares these instances and no disk/debounce side-effects fire.
vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    spellOverlayData: new Map(),
    activeMaps: new Map(),
    saveFile: vi.fn(),
    markDirty: vi.fn(),
    publish: vi.fn(),
    readFile: vi.fn(),
}));

import spellOverlay from './spell-overlay.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(spellOverlay);
    return app;
}

describe('spell-overlay - campaign lock (out-of-namespace write guard)', () => {
    let store;
    let publish;
    let markDirty;

    beforeEach(async () => {
        const changeData = await import('../utils/changeData.js');
        store = changeData.spellOverlayData;
        publish = changeData.publish;
        markDirty = changeData.markDirty;
        store.clear();
        vi.clearAllMocks();
        setCampaignLock('test-campaign');
    });

    afterEach(() => {
        setCampaignLock(null);
        store.clear();
        vi.clearAllMocks();
    });

    describe('locked mode', () => {
        it('403s an off-target POST for a nonexistent campaign name, in the lock-canonical shape', async () => {
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=nonexistent-campaign-xyz')
                .send({ action: 'clear' });

            expect(res.status).toBe(403);
            expect(res.body).toEqual({
                error: 'Campaign locked to "test-campaign" — POST /spell-overlay denied',
            });
            expect(errSpy).toHaveBeenCalledWith(
                '[campaign-lock] BLOCKED POST /spell-overlay (locked to "test-campaign")'
            );
            // No phantom Map entry, no SSE broadcast into the fake campaign's
            // room, and the disk-persist lane is never marked dirty.
            expect(store.has('nonexistent-campaign-xyz')).toBe(false);
            expect(publish).not.toHaveBeenCalled();
            expect(markDirty).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('403s an off-target POST naming a real production campaign before any state access', async () => {
            store.set('Frostfall', [{ id: 'live-1', shape: 'cone' }]);
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=Frostfall')
                .send({ action: 'clear' });

            expect(res.status).toBe(403);
            // Production campaign overlays untouched, nothing broadcast
            expect(store.get('Frostfall')).toEqual([{ id: 'live-1', shape: 'cone' }]);
            expect(publish).not.toHaveBeenCalled();
        });

        it('403s every mutating action (add/update/remove), not just clear', async () => {
            const app = createTestApp();
            const legs = [
                { action: 'add', overlays: [{ id: 'x-1' }] },
                { action: 'update', overlays: [{ id: 'x-1' }] },
                { action: 'remove', overlayId: 'x-1' },
            ];
            for (const body of legs) {
                const res = await request(app)
                    .post('/spell-overlay?campaign=other-campaign')
                    .send(body);
                expect(res.status).toBe(403);
            }
            expect(store.size).toBe(0);
            expect(publish).not.toHaveBeenCalled();
        });

        it('allows on-target (locked campaign) POST unchanged', async () => {
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=test-campaign')
                .send({ action: 'add', overlays: [{ id: 'ok-1', name: 'Fireball' }] });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: true });
            expect(store.get('test-campaign')).toEqual([{ id: 'ok-1', name: 'Fireball' }]);
            // On-target writes ride the shared debounced cache→disk lane
            expect(markDirty).toHaveBeenCalledWith('test-campaign');
            expect(publish).toHaveBeenCalledWith(
                'spell-overlay-test-campaign',
                { action: 'add', overlays: [{ id: 'ok-1', name: 'Fireball' }], overlayId: undefined },
                'test-campaign'
            );
        });

        it('403s a locked off-target POST with an UNKNOWN action — lock before validation', async () => {
            // Ordering pin: action validation must never preempt the lock 403;
            // a bad action on an off-target campaign still answers lock-canonical 403.
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=other-campaign')
                .send({ action: 'frobnicate' });

            expect(res.status).toBe(403);
            expect(res.body).toEqual({
                error: 'Campaign locked to "test-campaign" — POST /spell-overlay denied',
            });
            expect(errSpy).toHaveBeenCalledWith(
                '[campaign-lock] BLOCKED POST /spell-overlay (locked to "test-campaign")'
            );
            expect(store.has('other-campaign')).toBe(false);
            expect(publish).not.toHaveBeenCalled();
            expect(markDirty).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('validates actions on on-target writes while locked: unknown action 400s silently', async () => {
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=test-campaign')
                .send({ action: 'frobnicate' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Unknown spell-overlay action: "frobnicate"' });
            expect(store.has('test-campaign')).toBe(false);
            expect(publish).not.toHaveBeenCalled();
            expect(markDirty).not.toHaveBeenCalled();
        });

        it('400s an on-target remove of a missing id while locked, before any mutation', async () => {
            store.set('test-campaign', [{ id: 'ok-1', shape: 'sphere' }]);
            const res = await request(createTestApp())
                .post('/spell-overlay?campaign=test-campaign')
                .send({ action: 'remove', overlayId: 'ghost' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'No overlay with id ghost' });
            expect(store.get('test-campaign')).toEqual([{ id: 'ok-1', shape: 'sphere' }]);
            expect(publish).not.toHaveBeenCalled();
            expect(markDirty).not.toHaveBeenCalled();
        });

        it('still serves reads while locked (GET pass-through doctrine, incl. on-target)', async () => {
            store.set('test-campaign', [{ id: 'ok-1', name: 'Fireball' }]);
            const onTarget = await request(createTestApp())
                .get('/spell-overlay?campaign=test-campaign');
            expect(onTarget.status).toBe(200);
            expect(onTarget.body.overlays).toHaveLength(1);

            // Mirrors campaignLock.js READ_METHODS: GETs are not mutating,
            // so off-target reads keep answering (empty in-memory snapshot).
            const offTarget = await request(createTestApp())
                .get('/spell-overlay?campaign=nonexistent-campaign-xyz');
            expect(offTarget.status).toBe(200);
            expect(offTarget.body.overlays).toEqual([]);
        });
    });

    describe('unlocked mode', () => {
        beforeEach(() => {
            setCampaignLock(null);
        });

        it('accepts writes for any campaign exactly as before', async () => {
            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=any-lan-campaign')
                .send({ action: 'add', overlays: [{ id: 'a-1', name: 'Shield' }] });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: true });
            expect(store.get('any-lan-campaign')).toEqual([{ id: 'a-1', name: 'Shield' }]);
            expect(publish).toHaveBeenCalledWith(
                'spell-overlay-any-lan-campaign',
                { action: 'add', overlays: [{ id: 'a-1', name: 'Shield' }], overlayId: undefined },
                'any-lan-campaign'
            );
        });

        it('keeps the missing-campaign-param 400 ahead of the lock check', async () => {
            const res = await request(createTestApp())
                .post('/spell-overlay')
                .send({ action: 'clear' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('campaign query param required');
        });
    });
});
