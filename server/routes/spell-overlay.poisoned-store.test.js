// @maintained-by-ai
// ─── Lane: POST write lanes survive a poisoned store (bug 2026-11-02 BG) ──
// The sibling GET filter (spell-overlay-get-filter.test.js) sanitized only the
// RESPONSE; the raw disk doc used to boot into spellOverlayData and every
// stored-row traversal dereferenced `.id`, so a single null row 500-wedged
// every VALID add/update/remove too: "TypeError: Cannot read properties of
// null (reading 'id')" (spell-overlay.js :133 remove-validate, :150 add,
// :162 update, :167 remove filter). The boot load now screens disk docs
// (changeData.overlay-boot-screen.test.js), and the traversals carry `?.id`
// defense-in-depth so a legacy-poisoned store can never obstruct unrelated
// writes: request rows pass overlayShapeProblem, malformed STORED rows are
// skipped (kept, never dereferenced), valid rows act normally, 200s.
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

// The BG repro store: one renderable row + the four legacy-bad shapes
// (null, bare string, x/y/radius junk, partial cone).
const poisonStore = () => {
    spellOverlayData.set('test-campaign', [
        validSphere({ id: 'bg-valid' }),
        null,
        'a bare string',
        { x: 1, y: 2, radius: 3 },
        { shape: 'cone', startGridX: 5 },
    ]);
};

const junkRows = () => [null, 'a bare string', { x: 1, y: 2, radius: 3 }, { shape: 'cone', startGridX: 5 }];

describe('spell-overlay - poisoned store never obstructs valid writes', () => {
    it('add 200s over [valid, null, junk…]: the new row lands, junk rows stay untouched', async () => {
        poisonStore();

        const res = await post({ action: 'add', overlays: [validSphere({ id: 'bg-add-1' })] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        const stored = spellOverlayData.get('test-campaign');
        expect(stored.some(o => o && o.id === 'bg-add-1')).toBe(true);
        // defense-in-depth: skipped, never dereferenced, never silently evicted
        expect(stored).toHaveLength(6);
        expect(markDirtySpy).toHaveBeenCalled();
        expect(publishSpy).toHaveBeenCalled();
    });

    it('remove of a VALID id 200s over the poison (used to crash the :133 some / :167 filter)', async () => {
        poisonStore();

        const res = await post({ action: 'remove', overlayId: 'bg-valid' });

        expect(res.status).toBe(200);
        const stored = spellOverlayData.get('test-campaign');
        expect(stored.some(o => o && o.id === 'bg-valid')).toBe(false);
        expect(stored).toEqual(junkRows());
    });

    it('remove of an id absent from the poisoned store still answers the honest 400 (no crash)', async () => {
        poisonStore();

        const res = await post({ action: 'remove', overlayId: 'nope-404' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No overlay with id nope-404');
        expect(markDirtySpy).not.toHaveBeenCalled();
    });

    it('update of a valid row 200s over the poison: the row is replaced, junk rows byte-kept', async () => {
        poisonStore();

        const res = await post({ action: 'update', overlays: [validSphere({ id: 'bg-valid', radiusFt: 30 })] });

        expect(res.status).toBe(200);
        const stored = spellOverlayData.get('test-campaign');
        expect(stored).toHaveLength(5);
        expect(stored.find(o => o && o.id === 'bg-valid').radiusFt).toBe(30);
        expect(stored.filter(o => !o || typeof o !== 'object' || !o.id)).toEqual(junkRows());
    });

    it('clear still blanket-resets a poisoned store to [] with a 200', async () => {
        poisonStore();

        const res = await post({ action: 'clear' });

        expect(res.status).toBe(200);
        expect(spellOverlayData.get('test-campaign')).toEqual([]);
    });
});
