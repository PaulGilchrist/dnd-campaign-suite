// @maintained-by-ai: 2026-10-24
/* Lane: POST /api/campaigns/:campaign/music intent-split merge (backlog 2026-10-24 —
 * editor Save while stopped must not flip playing:true / surprise-autoplay other tabs).
 * Editor PATCH bodies carry { overrides } only → transport fields survive from stored
 * truth; transport writes (full music object, wrapped in { value } like useRuntimeState
 * sends for campaign keys) overwrite as the generic wildcard route always did.
 * Save-time oEmbed title resolution rides the same route (backlog 2026-10-24, second
 * block) — global fetch is stubbed offline by default so raw-ID titles survive untouched
 * here except where a block wires an oEmbed responder. No real YouTube in tests. */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
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

// Default stub: oEmbed "unreachable" → resolveTrackTitles falls back to raw
// IDs (which is what the merge-lane assertions below expect verbatim).
let fetchMock;
beforeEach(() => {
    vi.mocked(markDirty).mockClear();
    vi.mocked(publish).mockClear();
    characterChangeData.clear();
    fetchMock = vi.fn(async () => { throw Object.assign(new Error('offline in tests'), { name: 'TimeoutError' }); });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('campaigns-changedata - POST music intent-split merge', () => {
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

    /* Campaign-specific categories (improve 2026-11-07): customCategories
     * PATCH lane — wholesale map replace, transport fields untouched, key
     * shape/label/icon validated at the API boundary. */
    describe('customCategories PATCH', () => {
        it('create PATCH stores the category map and keeps transport fields', async () => {
            seedMusic({ mood: 'tavern', playing: true, volume: 0.5, overrides: {} });
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ customCategories: { 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } } });

            expect(res.status).toBe(200);
            expect(res.body.music.customCategories).toEqual({ 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } });
            // intent-split: the PATCH never touches what it did not send
            expect(res.body.music.mood).toBe('tavern');
            expect(res.body.music.playing).toBe(true);
            expect(characterChangeData.get('test-campaign').music.customCategories).toEqual({ 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } });
        });

        it('delete PATCH (map minus entry, overrides minus tracks) removes both atomically', async () => {
            seedMusic({ mood: null, playing: false, volume: 0.6, overrides: { 'custom-crypt': [{ videoId: 'aAAAAAAAAAA', title: 'a' }], tavern: [{ videoId: 'b', title: 'b' }] }, customCategories: { 'custom-crypt': { label: 'Crypt' }, 'custom-tar': { label: 'Tar' } } });
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({
                    customCategories: { 'custom-tar': { label: 'Tar' } },
                    overrides: { tavern: [{ videoId: 'b', title: 'b' }] }
                });

            expect(res.status).toBe(200);
            expect(res.body.music.customCategories).toEqual({ 'custom-tar': { label: 'Tar' } });
            expect(res.body.music.overrides).toEqual({ tavern: [{ videoId: 'b', title: 'b' }] });
        });

        it('tracks PATCH for a custom key rides the overrides lane (title resolution included)', async () => {
            seedMusic({ ...STOPPED, customCategories: { 'custom-crypt': { label: 'Crypt' } } });
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ overrides: { 'custom-crypt': [{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }] } });

            expect(res.status).toBe(200);
            expect(res.body.music.overrides['custom-crypt']).toEqual([{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }]);
            expect(res.body.music.customCategories).toEqual({ 'custom-crypt': { label: 'Crypt' } });
        });

        it('transport write carrying customCategories survives round-trip (full-object overwrite)', async () => {
            seedMusic({ ...STOPPED, customCategories: { 'custom-crypt': { label: 'Crypt' } } });
            const full = { mood: 'custom-crypt', playing: true, volume: 0.6, overrides: {}, customCategories: { 'custom-crypt': { label: 'Crypt' } } };
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ value: full });

            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').music).toEqual(full);
        });

        it('rejects malformed maps: non-object, built-in-shadowing key, blank/oversized label, bad icon', async () => {
            seedMusic({ ...STOPPED });
            const bad = [
                { customCategories: 'nope' },
                { customCategories: [] },
                { customCategories: { town: { label: 'Shadow' } } }, // missing custom- prefix
                { customCategories: { 'custom-': { label: 'x' } } }, // empty slug still matches? no — see below
                { customCategories: { 'custom-ok': {} } }, // no label
                { customCategories: { 'custom-ok': { label: '   ' } } },
                { customCategories: { 'custom-ok': { label: 'x'.repeat(41) } } },
                { customCategories: { 'custom-ok': { label: 'ok', icon: 42 } } },
            ];
            for (const body of bad) {
                const res = await request(createTestApp())
                    .post('/api/campaigns/test-campaign/music')
                    .send(body);
                expect(res.status, JSON.stringify(body)).toBe(400);
            }
            expect(characterChangeData.get('test-campaign').music).toEqual({ ...STOPPED });
        });

        it("accepts slug-shaped edge keys but rejects >20 categories", async () => {
            seedMusic({ ...STOPPED });
            // 'custom-c' and even 'custom--' pass /^custom-[a-z0-9-]+$/ —
            // pinned (the client slugger always emits a non-empty slug).
            const ok = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ customCategories: { 'custom--': { label: 'Odd' } } });
            expect(ok.status).toBe(200);

            const many = {};
            for (let i = 0; i < 21; i += 1) many[`custom-cat-${i}`] = { label: `Cat ${i}` };
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ customCategories: many });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('at most 20');
        });
    });
});

/* Save-time oEmbed title resolution (backlog 2026-10-24 — editor stamps
 * title = raw video ID; the route enriches before merge/store/publish). */
describe('campaigns-changedata - POST music oEmbed title resolution', () => {
    const oembedOk = (title) => ({ ok: true, status: 200, json: async () => ({ title }) });
    const timeoutErr = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

    it('editor save resolves raw-ID titles into stored overrides and the echoed response', async () => {
        seedMusic({ ...STOPPED });
        fetchMock.mockImplementation(async (url) =>
            url.includes('vyg5jJrZ42s') ? oembedOk('Medieval Fantasy Tavern (Daydreaming of Persephone)') : oembedOk('Medieval Tavern Ambience (Fantasy Music Studio)'));
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [
                { videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' },
                { videoId: '2P8J7Cx1plA', title: '2P8J7Cx1plA' }
            ] } });

        expect(res.status).toBe(200);
        const expected = [
            { videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' },
            { videoId: '2P8J7Cx1plA', title: 'Medieval Tavern Ambience (Fantasy Music Studio)' }
        ];
        expect(characterChangeData.get('test-campaign').music.overrides.tavern).toEqual(expected);
        expect(res.body.music.overrides.tavern).toEqual(expected);
        expect(publish).toHaveBeenCalledWith('change-test-campaign-music', expect.objectContaining({ overrides: { tavern: expected } }), 'test-campaign');
        // real oEmbed URL, bounded signal — never the browser hitting YouTube
        expect(fetchMock.mock.calls[0][0]).toContain('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dvyg5jJrZ42s');
        expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('mixed save: one good, one timed-out → 200, good resolved, bad keeps raw ID, console.error logged', async () => {
        seedMusic({ ...STOPPED });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock.mockImplementation(async (url) => {
            if (url.includes('vyg5jJrZ42s')) return oembedOk('Medieval Fantasy Tavern (Daydreaming of Persephone)');
            throw timeoutErr(); // invalid/unlisted id, or oEmbed down
        });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [
                { videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' },
                { videoId: 'aAAAAAAAAAA', title: 'aAAAAAAAAAA' }
            ] } });

        expect(res.status).toBe(200);
        expect(res.body.music.overrides.tavern).toEqual([
            { videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' },
            { videoId: 'aAAAAAAAAAA', title: 'aAAAAAAAAAA' } // graceful fallback, save never blocked
        ]);
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('aAAAAAAAAAA'), expect.anything());
        consoleError.mockRestore();
    });

    it('re-save of an already-resolved videoId skips re-fetch (no oEmbed stampede)', async () => {
        seedMusic({ ...STOPPED, overrides: { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' }] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'vyg5jJrZ42s' }] } });

        expect(res.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
        // stored readable title survives the editor's raw-ID re-stamp
        expect(res.body.music.overrides.tavern).toEqual([{ videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' }]);
    });
});
