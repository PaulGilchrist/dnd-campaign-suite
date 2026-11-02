// @maintained-by-ai
// ─── Lane: POST /spell-overlay transport-shape guard (backlog 2026-11-02 BD) ──
// The write route used to answer ok:true for ARBITRARY coord keys (x/y/radius):
// the row then rendered circle cx=NaN (React/SVG error spam) while the panel
// showed a phantom "Active (1)" over an empty board. add/update payloads must
// now carry the canonical transport shape or 400 with the expected-shape copy,
// and a refused request must mutate nothing (memory, disk-debounce, SSE).
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import * as changeDataModule from '../utils/changeData.js';
import { spellOverlayData } from '../utils/changeData.js';

import spellOverlay from './spell-overlay.js';

let markDirtySpy;
let publishSpy;
beforeEach(() => {
    markDirtySpy = vi.spyOn(changeDataModule, 'markDirty').mockImplementation(() => {});
    publishSpy = vi.spyOn(changeDataModule, 'publish').mockImplementation(() => {});
});
afterEach(() => {
    markDirtySpy.mockRestore();
    publishSpy.mockRestore();
    spellOverlayData.clear();
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(spellOverlay);
    return app;
}

const post = (body) =>
    request(createTestApp()).post('/spell-overlay?campaign=test-campaign').send(body);

const validSphere = (overrides = {}) => ({
    id: 'sph-1',
    shape: 'sphere',
    startGridX: 3,
    startGridY: 4,
    angle: 0,
    radiusFt: 20,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(255,80,60,0.07)',
    ...overrides,
});

describe('spell-overlay - transport-shape guard', () => {
    it('400s an add carrying the BD junk probe row (x/y/radius) with expected-shape copy — board, disk lane and SSE untouched', async () => {
        const res = await post({
            action: 'add',
            overlays: [{ id: 'junk-1', shape: 'sphere', x: 5, y: 5, radius: 20, color: 'rgba(255,80,60,0.07)' }],
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Spell overlay rejected/);
        expect(res.body.error).toMatch(/startGridX\/startGridY must be finite numbers/);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
        expect(markDirtySpy).not.toHaveBeenCalled();
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('400s a row whose shape is unknown, naming the offending shape', async () => {
        const res = await post({ action: 'add', overlays: [{ id: 'junk-2', shape: 'blob', startGridX: 1, startGridY: 1 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/"blob" is not a known overlay shape/);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
    });

    it('400s a legacy name/level row with no transport keys at all', async () => {
        const res = await post({ action: 'add', overlays: [{ id: 'legacy-1', name: 'Fireball', level: 3 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not a known overlay shape/);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['cube missing sizeFt', { shape: 'cube' }, /sizeFt must be a positive number for a cube/],
        ['cone missing coneAngle', { shape: 'cone', distanceFt: 60 }, /coneAngle must be a positive number for a cone/],
        ['line missing widthFt', { shape: 'line', distanceFt: 60 }, /widthFt must be a positive number for a line/],
        ['sphere with radiusFt 0', { shape: 'sphere', radiusFt: 0 }, /radiusFt must be a positive number/],
        ['sphere with NaN radiusFt', { shape: 'sphere', radiusFt: 'large' }, /radiusFt must be a positive number/],
        ['sphere missing color', { shape: 'sphere', radiusFt: 20, color: undefined }, /color must be a color string/],
    ])('400s a %s row (per-shape size keys, not a blanket radiusFt)', async (_label, transport, copy) => {
        const res = await post({ action: 'add', overlays: [validSphere(transport)] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(copy);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
    });

    it('400s a non-array overlays value on add/update instead of iterating it', async () => {
        for (const action of ['add', 'update']) {
            const res = await post({ action, overlays: 'not-an-array' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/overlays must be an array/);
        }
        expect(spellOverlayData.has('test-campaign')).toBe(false);
    });

    it('rejects a MIXED valid+malformed payload as a whole — no partial append', async () => {
        spellOverlayData.set('test-campaign', [validSphere({ id: 'keep-1' })]);

        const res = await post({
            action: 'add',
            overlays: [validSphere({ id: 'good-2' }), { id: 'bad-2', shape: 'sphere', x: 1, y: 1, radius: 5 }],
        });

        expect(res.status).toBe(400);
        expect(spellOverlayData.get('test-campaign').map(o => o.id)).toEqual(['keep-1']);
        expect(markDirtySpy).not.toHaveBeenCalled();
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('400s a malformed update payload and leaves the stored row byte-unchanged', async () => {
        const original = validSphere({ id: 'sph-1', radiusFt: 20 });
        spellOverlayData.set('test-campaign', [original]);

        const res = await post({
            action: 'update',
            overlays: [{ id: 'sph-1', shape: 'sphere', startGridX: 'wide', startGridY: 4, radiusFt: 30, color: 'red' }],
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/startGridX\/startGridY must be finite numbers/);
        expect(spellOverlayData.get('test-campaign')).toEqual([original]);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('valid-shape writes are byte-identical in behavior: add appends verbatim, update replaces, remove/clear stay open', async () => {
        const sphere = validSphere();
        const addRes = await post({ action: 'add', overlays: [sphere] });
        expect(addRes.status).toBe(200);
        expect(addRes.body).toEqual({ ok: true });
        expect(spellOverlayData.get('test-campaign')).toEqual([sphere]);
        expect(publishSpy).toHaveBeenCalledWith(
            'spell-overlay-test-campaign',
            { action: 'add', overlays: [sphere], overlayId: undefined },
            'test-campaign'
        );

        const moved = validSphere({ startGridX: 9, startGridY: 9 });
        const updateRes = await post({ action: 'update', overlays: [moved] });
        expect(updateRes.status).toBe(200);
        expect(spellOverlayData.get('test-campaign')).toEqual([moved]);

        const removeRes = await post({ action: 'remove', overlayId: 'sph-1' });
        expect(removeRes.status).toBe(200);
        expect(spellOverlayData.get('test-campaign')).toEqual([]);

        const clearRes = await post({ action: 'clear' });
        expect(clearRes.status).toBe(200);
    });

    it('remove/clear lanes never shape-validate — a legacy corrupt row on the board is still liftable', async () => {
        const legacyJunk = { id: 'legacy-1', name: 'Fireball', level: 3 };
        spellOverlayData.set('test-campaign', [legacyJunk]);

        const removeRes = await post({ action: 'remove', overlayId: 'legacy-1' });
        expect(removeRes.status).toBe(200);
        expect(spellOverlayData.get('test-campaign')).toEqual([]);

        spellOverlayData.set('test-campaign', [legacyJunk]);
        const clearRes = await post({ action: 'clear' });
        expect(clearRes.status).toBe(200);
        expect(spellOverlayData.get('test-campaign')).toEqual([]);
    });

    it('keeps the absent/empty/null overlays no-ops at 200 (never over-validates)', async () => {
        for (const body of [
            { action: 'add' },
            { action: 'add', overlays: null },
            { action: 'add', overlays: [] },
            { action: 'update' },
            { action: 'update', overlays: [] },
        ]) {
            const res = await post(body);
            expect(res.status, JSON.stringify(body)).toBe(200);
        }
        expect(spellOverlayData.get('test-campaign')).toEqual([]);
    });
});
