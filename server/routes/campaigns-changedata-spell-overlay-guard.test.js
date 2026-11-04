// @maintained-by-ai
// ─── Lane: wildcard reserved `spell-overlay` key guard (backlog 2026-11-02 BE) ─
// POST /api/campaigns/:c/spell-overlay used to store ANY junk under the
// reserved key ({campaign, overlays:[x/y/radius rows]}, scalars, …) with a
// blanket 200, leaving the key in a shape no board can render. The guarded
// seam was only the /spell-overlay transport (d3e1658c9). The wildcard now
// screens the reserved key through the shared L5 validator: malformed docs
// 400 with "Overlay save rejected: …" copy + a `[spell-overlay] BLOCKED …`
// server-log line (mirroring the [maps] BLOCKED pattern) and write nothing;
// every producer shape (valid rows, legacy dual-write wrapper, [] / null
// clears) still persists byte-as-sent; sibling keys keep wildcard doctrine —
// any shape writes 200, and PUT stays a 404 (no write lane for this verb).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));
vi.mock('./log.js', () => ({ addEntry: vi.fn() }));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

const postKey = (key, body) =>
    request(createTestApp()).post(`/api/campaigns/test-campaign/${key}`).send(body);
const putKey = (key, body) =>
    request(createTestApp()).put(`/api/campaigns/test-campaign/${key}`).send(body);

// createOverlay's real byte-shape (src/models/SpellOverlay.js) — the same
// fixture the transport-guard suite rides (spell-overlay-shape-guard.test.js).
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

// The exact doc BE stored at the wildcard for a 200 — the premise this guard closes.
const JUNK_DOC = { campaign: 'x', overlays: [{ x: 1, y: 2, radius: 3 }] };

let logSpy;
beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(markDirty).mockClear();
    vi.mocked(publish).mockClear();
    characterChangeData.set('test-campaign', {});
});
afterEach(() => {
    logSpy.mockRestore();
    characterChangeData.clear();
});

describe('wildcard POST /:campaign/spell-overlay — reject leg (malformed docs)', () => {
    it('400s the stored BE junk doc with Overlay-save-rejected copy — key never written', async () => {
        const res = await postKey('spell-overlay', JUNK_DOC);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Overlay save rejected/);
        expect(res.body.error).toMatch(/row 0 does not match/);
        expect(res.body.error).toMatch(/known shape, finite startGridX\/startGridY/);

        const getRes = await request(createTestApp()).get('/api/campaigns/test-campaign/change-data');
        expect(getRes.body).not.toHaveProperty('spell-overlay');
        expect(markDirty).not.toHaveBeenCalled();
    });

    it('logs a [spell-overlay] BLOCKED line and broadcasts + audits the denial', async () => {
        await postKey('spell-overlay', JUNK_DOC);

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[spell-overlay] BLOCKED POST test-campaign — Overlay save rejected'));
        expect(publish).toHaveBeenCalledWith(
            'denied-test-campaign-spell-overlay',
            expect.objectContaining({ key: 'spell-overlay' }),
            'test-campaign',
        );
    });

    it.each([
        ['a raw scalar', 'junk'],
        ['a number', 42],
        ['an empty object', {}],
        ['an object without overlays', { campaign: 'x' }],
        ['a bare junk row (no wrapper)', { x: 1, y: 2, radius: 3 }],
        ['a legacy name/level row', [{ id: 'legacy-1', name: 'Fireball', level: 3 }]],
        ['a null row inside the array', [null]],
        ['a string row inside the array', ['Fireball']],
        ['a row with an unknown shape', [{ shape: 'blob', startGridX: 1, startGridY: 1 }]],
        ['a row without color', [{ shape: 'sphere', startGridX: 1, startGridY: 1, radiusFt: 20 }]],
    ])('400s %s under the reserved key', async (_label, value) => {
        const res = await postKey('spell-overlay', { value });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Overlay save rejected/);
        expect(characterChangeData.get('test-campaign')).not.toHaveProperty('spell-overlay');
    });

    it('400s a malformed PUT to the reserved key with the same copy + BLOCKED PUT log', async () => {
        const res = await putKey('spell-overlay', JUNK_DOC);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Overlay save rejected: every overlay needs a known shape/);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[spell-overlay] BLOCKED PUT test-campaign'));
        expect(characterChangeData.get('test-campaign')).not.toHaveProperty('spell-overlay');
        expect(markDirty).not.toHaveBeenCalled();
    });
});

describe('wildcard POST /:campaign/spell-overlay — accept leg (producer byte-shapes)', () => {
    it.each([
        ['the empty-array clear', []],
        ['the null clear', null],
        ['an array of full createOverlay rows', [validSphere(), validSphere({ id: 'sph-2', shape: 'cone', radiusFt: 0, coneAngle: 53, distanceFt: 60 })]],
        ['the legacy dual-write wrapper with valid rows', { campaign: 'test-campaign', overlays: [validSphere()] }],
    ])('200s and persists %s byte-as-sent', async (_label, value) => {
        const res = await postKey('spell-overlay', { value });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data saved successfully');
        expect(characterChangeData.get('test-campaign')['spell-overlay']).toEqual(value);
        expect(markDirty).toHaveBeenCalledWith('test-campaign');
        expect(publish).toHaveBeenCalledWith(
            'change-test-campaign-spell-overlay',
            value,
            'test-campaign',
        );
    });

    it('clearing via [] after a stored doc round-trips (200 + stored [])', async () => {
        await postKey('spell-overlay', { value: [validSphere()] });
        const clearRes = await postKey('spell-overlay', { value: [] });

        expect(clearRes.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['spell-overlay']).toEqual([]);
    });

    it('404s a well-formed PUT (no write lane for that verb — nothing persists)', async () => {
        const res = await putKey('spell-overlay', { value: [validSphere()] });

        expect(res.status).toBe(404);
        expect(characterChangeData.get('test-campaign')).not.toHaveProperty('spell-overlay');
        expect(markDirty).not.toHaveBeenCalled();
    });
});

describe('wildcard sibling keys — UNAFFECTED (wildcard doctrine preserved)', () => {
    it('stores the same junk doc under any other key with a 200', async () => {
        const res = await postKey('boardState', JUNK_DOC);

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').boardState).toEqual(JUNK_DOC);
        expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('BLOCKED'));
    });

    it('keeps arbitrary scalars/objects on sibling keys and stays silent about the reserved guard', async () => {
        for (const value of ['junk', 42, { overlays: [{ x: 1 }] }]) {
            const res = await postKey('someOtherKey', { value });
            expect(res.status).toBe(200);
        }
        expect(characterChangeData.get('test-campaign').someOtherKey).toEqual({ overlays: [{ x: 1 }] });
    });

    it('PUT to an unreserved key keeps today\u2019s honest 404 (the PUT lane is reserved-key-only)', async () => {
        const res = await putKey('boardState', JUNK_DOC);
        expect(res.status).toBe(404);
    });
});
