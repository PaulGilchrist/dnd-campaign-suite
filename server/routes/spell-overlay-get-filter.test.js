// @maintained-by-ai
// ─── Lane: GET /spell-overlay read-path filter (backlog 2026-11-02 BF) ──
// Malformed rows persisted on disk BEFORE the write guards existed (null /
// bare strings / x-y-radius junk) booted into the transport Map and GET
// echoed them verbatim to every viewer. GET must now screen its snapshot
// through the SAME shape guard the POST write lane rejects with, drop the
// junk from the RESPONSE ONLY (disk doc untouched), and log one line per
// drop mirroring the `[spell-overlay] BLOCKED …` convention. Valid rows
// pass byte-identical.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import { spellOverlayData } from '../utils/changeData.js';

import spellOverlay, { filterRenderableOverlays } from './spell-overlay.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(spellOverlay);
    return app;
}

const get = () => request(createTestApp()).get('/spell-overlay?campaign=test-campaign');

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

const validCone = (overrides = {}) => ({
    id: 'cone-1',
    shape: 'cone',
    startGridX: 6,
    startGridY: 6,
    angle: 90,
    radiusFt: 0,
    coneAngle: 53,
    widthFt: 0,
    distanceFt: 60,
    sizeFt: 0,
    color: 'rgba(80,160,255,0.07)',
    ...overrides,
});

afterEach(() => {
    spellOverlayData.clear();
});

describe('spell-overlay - GET read-path filter', () => {
    it('drops the pre-guard junk (null / bare string / x-y-radius row) and ships ONLY the valid rows, order kept', async () => {
        spellOverlayData.set('test-campaign', [
            validSphere({ id: 'sph-1' }),
            null,
            'a bare string',
            { x: 1, y: 2 },
            validCone({ id: 'cone-1' }),
        ]);

        const res = await get();

        expect(res.status).toBe(200);
        expect(res.body.overlays.map(o => o.id)).toEqual(['sph-1', 'cone-1']);
    });

    it('an all-valid doc is byte-identical passthrough (sphere + cone known shapes keep working)', async () => {
        const doc = [validSphere({ id: 'sph-1' }), validCone({ id: 'cone-1' })];
        spellOverlayData.set('test-campaign', doc);

        const res = await get();

        expect(res.status).toBe(200);
        expect(res.text).toBe(JSON.stringify({ overlays: doc }));
    });

    it('preserves unknown EXTRA keys on a valid row verbatim', async () => {
        const row = validSphere({ name: 'Fireball', level: 3, modifiers: { saveDC: 15 } });
        spellOverlayData.set('test-campaign', [row]);

        const res = await get();

        expect(res.body.overlays).toEqual([row]);
    });

    it('absent campaign and stored-empty keep today\'s 200-with-empty behavior', async () => {
        expect((await get()).body).toEqual({ overlays: [] });

        spellOverlayData.set('test-campaign', []);
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ overlays: [] });
    });

    it('still 400s a missing campaign query param', async () => {
        const res = await request(createTestApp()).get('/spell-overlay');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('campaign query param required');
    });

    it('logs one [spell-overlay] dropped N malformed row(s) line naming the count + campaign, and none when the doc is clean', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            spellOverlayData.set('test-campaign', [validSphere(), null, 'junk', 42, []]);
            await get();
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('[spell-overlay] dropped 4 malformed row(s) GET test-campaign')
            );

            logSpy.mockClear();
            spellOverlayData.set('test-campaign', [validSphere(), validCone()]);
            await get();
            expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('dropped'));
        } finally {
            logSpy.mockRestore();
        }
    });

    it('drops WITHOUT mutating the stored array — disk/memory doc keeps its junk rows for honest removal lanes', async () => {
        const junk = [validSphere(), null, 'a bare string', { x: 1, y: 2 }];
        spellOverlayData.set('test-campaign', junk);

        await get();

        const stored = spellOverlayData.get('test-campaign');
        expect(stored).toHaveLength(4);
        expect(stored).toEqual(junk);
    });
});

describe('spell-overlay - filterRenderableOverlays helper', () => {
    it('treats a non-array store value as empty (never throws)', () => {
        expect(filterRenderableOverlays('c', undefined)).toEqual([]);
        expect(filterRenderableOverlays('c', null)).toEqual([]);
        expect(filterRenderableOverlays('c', { overlays: [] })).toEqual([]);
    });

    it('rejects the shapes the POST guard rejects — one validator, both lanes', () => {
        const bad = [
            null,
            'string',
            42,
            [],
            { id: 'a', shape: 'blob', startGridX: 1, startGridY: 1, color: 'red' },
            { id: 'b', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 0, color: 'red' },
            { id: 'c', shape: 'sphere', startGridX: 'x', startGridY: 1, radiusFt: 5, color: 'red' },
            { id: 'd', shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 5 },
        ];
        expect(filterRenderableOverlays('c', bad)).toEqual([]);
    });
});
