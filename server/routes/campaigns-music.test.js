// @maintained-by-ai: 2026-10-24
/* Lane: POST /api/campaigns/:campaign/music intent-split merge (backlog 2026-10-24 —
 * editor Save while stopped must not flip playing:true / surprise-autoplay other tabs).
 * Editor PATCH bodies carry { overrides } only → transport fields survive from stored
 * truth; transport writes (full music object, wrapped in { value } like useRuntimeState
 * sends for campaign keys) overwrite as the generic wildcard route always did. */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

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

function seedMusic(music) {
    characterChangeData.set('test-campaign', { music });
}

const STOPPED = { mood: null, playing: false, volume: 0.6, overrides: {} };

describe('campaigns-changedata - POST music intent-split merge', () => {
    beforeEach(() => {
        vi.mocked(markDirty).mockClear();
        vi.mocked(publish).mockClear();
        characterChangeData.clear();
    });

    it('editor overrides PATCH while stopped keeps playing:false and persists overrides', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }] } });

        expect(res.status).toBe(200);
        const saved = characterChangeData.get('test-campaign').music;
        expect(saved.playing).toBe(false);
        expect(saved.mood).toBeNull();
        expect(saved.volume).toBe(0.6);
        expect(saved.overrides.tavern).toEqual([{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }]);
        // response echoes merged truth so the client can pin its local store
        expect(res.body.music).toEqual(saved);
        expect(markDirty).toHaveBeenCalledWith('test-campaign');
        expect(publish).toHaveBeenCalledWith('change-test-campaign-music', saved, 'test-campaign');
    });

    it('editor overrides PATCH never resurrects a stopped player even if a stale client omits playing:false', async () => {
        seedMusic({ ...STOPPED });
        // stale-tab PATCH: no playing key at all in the payload (editor intent)
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ value: { overrides: { town: [{ videoId: 'q9yaKpYS9qc', title: 'x' }] } } });

        expect(res.status).toBe(200);
        expect(res.body.music.playing).toBe(false);
        expect(res.body.music.mood).toBeNull();
    });

    it('reset PATCH (overrides minus mood) clears that mood live and keeps transport fields', async () => {
        seedMusic({ mood: null, playing: false, volume: 0.4, overrides: { tavern: [{ videoId: 'a', title: 'a' }], town: [{ videoId: 'b', title: 'b' }] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { town: [{ videoId: 'b', title: 'b' }] } });

        expect(res.status).toBe(200);
        expect(res.body.music.overrides.tavern).toBeUndefined();
        expect(res.body.music.overrides.town).toHaveLength(1);
        expect(res.body.music.volume).toBe(0.4);
    });

    it('transport write (full object via { value }) overwrites mood/playing exactly as before', async () => {
        seedMusic({ ...STOPPED });
        const playing = { mood: 'tavern', playing: true, volume: 0.6, overrides: {} };
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ value: playing });

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').music).toEqual(playing);
    });

    it('GET /music returns the merged doc without a {value} unwrap quirk', async () => {
        seedMusic({ ...STOPPED, overrides: { tavern: [{ videoId: 'a', title: 'a' }] } });
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/music');
        expect(res.status).toBe(200);
        expect(res.body.music.playing).toBe(false);
        expect(res.body.music.overrides.tavern).toHaveLength(1);
    });

    it('rejects a non-object overrides patch with 400', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: 'tavern-only' });
        expect(res.status).toBe(400);
        expect(characterChangeData.get('test-campaign').music).toEqual({ ...STOPPED });
    });

    it('seeds defaults when the campaign has no stored music yet', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { town: [{ videoId: 'q9yaKpYS9qc', title: 'x' }] } });

        expect(res.status).toBe(200);
        expect(res.body.music).toMatchObject({ mood: null, playing: false, volume: 0.6 });
        expect(res.body.music.overrides.town).toHaveLength(1);
    });
});
