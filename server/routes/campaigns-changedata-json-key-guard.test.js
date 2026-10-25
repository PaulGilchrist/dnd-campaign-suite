import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// ---------------------------------------------------------------------------
// Dotted-key wildcard trap (backlog 2026-10-24): POST /api/campaigns/:c/
// <anything>.json is NOT handled by campaigns-character.js (that router owns
// ".json" paths but registers GET/PUT/PATCH/DELETE only), so it used to fall
// through to the generic change-data wildcard and persist an undeletable junk
// key — the same URL GET/DELETE routes to character files → 404. The wildcard
// now refuses file-suffixed keys with a plain-English 400 and writes nothing.
// These tests pin the rejection AND the untouched pass-through of every
// legitimate unsuffixed runtime key.
// ---------------------------------------------------------------------------

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

beforeEach(() => {
    vi.mocked(markDirty).mockClear();
    vi.mocked(publish).mockClear();
    characterChangeData.clear();
});
afterEach(() => characterChangeData.clear());

describe('campaignsChangedata - POST rejects file-suffixed (.json) keys', () => {
    it('refuses POST /:campaign/PlayerProbe.json with a plain-English 400', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/PlayerProbe.json')
            .send({ value: { junk: true } });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cannot end in \.json/i);
        expect(res.body.error).toMatch(/character file/i);
    });

    it('persists nothing to the change-data store on rejection', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/PlayerProbe.json')
            .send({ value: { junk: true } });
        const data = characterChangeData.get('test-campaign');
        expect(data === undefined || !('PlayerProbe.json' in data)).toBe(true);
        expect(markDirty).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
    });

    it('does not even create the campaign store entry when rejecting an existing-character-named key', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/AasimarTest.json')
            .send({ name: 'AasimarTest' });
        expect(res.status).toBe(400);
        expect(characterChangeData.has('test-campaign')).toBe(false);
    });

    it('leaves no junk key reachable via GET change-data after a rejected probe', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/PlayerProbe.json')
            .send({ value: { junk: true } });
        const res = await request(app).get('/api/campaigns/test-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('PlayerProbe.json');
    });
});

describe('campaignsChangedata - POST pass-through of legitimate unsuffixed keys', () => {
    it('saves a plain runtime key exactly as before (200 + store + broadcast)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/enforcement')
            .send({ value: { mode: 'off' } });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data saved successfully');
        // enforcement is validated + canonicalized: the full 11-key blob stores
        // and broadcasts (subset-clobber fix, backlog 2026-10-25) — the route's
        // raw pass-through is proven by the character-store key below.
        expect(characterChangeData.get('test-campaign').enforcement).toMatchObject({ mode: 'off' });
        expect(Object.keys(characterChangeData.get('test-campaign').enforcement)).toHaveLength(11);
        expect(markDirty).toHaveBeenCalledWith('test-campaign');
        expect(publish).toHaveBeenCalledWith(
            'change-test-campaign-enforcement',
            characterChangeData.get('test-campaign').enforcement,
            'test-campaign',
        );
    });

    it('saves a character store key and campaign-level keys unchanged', async () => {
        const app = createTestApp();
        const charRes = await request(app)
            .post('/api/campaigns/test-campaign/AasimarTest')
            .send({ value: { hitPoints: 42 } });
        expect(charRes.status).toBe(200);
        expect(characterChangeData.get('test-campaign').AasimarTest).toEqual({ hitPoints: 42 });

        const nameRes = await request(app)
            .post('/api/campaigns/test-campaign/activeCreatureName')
            .send({ value: 'AasimarTest' });
        expect(nameRes.status).toBe(200);
        expect(characterChangeData.get('test-campaign').activeCreatureName).toBe('AasimarTest');
    });

    it('still accepts dotted keys that are NOT .json suffixed (guard is suffix-specific)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/saveResult.victim')
            .send({ value: { success: true } });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['saveResult.victim']).toEqual({ success: true });
    });
});
