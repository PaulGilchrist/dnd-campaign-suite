// @maintained-by-ai: 2026-11-25
/* Lane: canonical music track rows + superseded-audio prune (offline-ambience
 * backlog Item 3). POST /api/campaigns/:campaign/music now validates EVERY
 * override row against the one canonical shape
 *   { kind:'youtube', src:<11-char id>, title } | { kind:'local', src:'audio/amb-…' | '/audio/<bundled bed>', title }
 * — a legacy {videoId} row or a forged local src is refused with a 400 naming
 * the offender, no leniency. When a save DROPS local rows (track removed,
 * Reset, category delete), the campaign audio/ files they referenced are
 * unlinked after the merged doc lands (token-art prune discipline).
 * In-memory fs (token-image.test.js idiom) — real disk is never touched. */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import path from 'path';

const FS = vi.hoisted(() => new Map());
vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FS.has(p),
        unlinkSync: (p) => { FS.delete(p); },
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

const AUDIO_DIR = path.resolve(process.cwd(), 'public/campaigns/test-campaign/audio');
const LOCAL_A = 'audio/amb-1700000000000-aaaaaa.mp3';
const LOCAL_B = 'audio/amb-1700000000001-bbbbbb.ogg';
const localRow = (src, title = src) => ({ kind: 'local', src, title });
const ytRow = (src = 'vyg5jJrZ42s', title = src) => ({ kind: 'youtube', src, title });
const STOPPED = { mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {} };

function seedMusic(music) {
    characterChangeData.set('test-campaign', { music });
}
function placeAudio(...srcs) {
    FS.set(AUDIO_DIR, 'dir');
    srcs.forEach((src) => FS.set(path.join(AUDIO_DIR, src.slice('audio/'.length)), 'bytes'));
}

beforeEach(() => {
    FS.clear();
    characterChangeData.clear();
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('offline in tests'), { name: 'TimeoutError' }); }));
});
afterEach(() => vi.unstubAllGlobals());

describe('POST /music — canonical track row validation', () => {
    it('accepts a mixed mood of YouTube + local rows', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [ytRow(), localRow(LOCAL_A, 'Campfire')] } });
        expect(res.status).toBe(200);
        expect(res.body.music.overrides.tavern).toEqual([ytRow(), localRow(LOCAL_A, 'Campfire')]);
    });

    it('refuses a legacy {videoId} row — the discriminator is mandatory, copy names the offender', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [{ videoId: 'vyg5jJrZ42s', title: 'x' }] } });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('music.overrides.tavern[0]');
        expect(res.body.error).toContain('kind');
        expect(characterChangeData.get('test-campaign').music).toEqual({ ...STOPPED });
    });

    it('refuses unknown kind, short youtube src, forged local src, and non-string title', async () => {
        seedMusic({ ...STOPPED });
        const bad = [
            [{ kind: 'bandcamp', src: 'vyg5jJrZ42s', title: 'x' }, 'kind'],
            [{ kind: 'youtube', src: 'short', title: 'x' }, '11-character'],
            [{ kind: 'local', src: '../../secret.mp3', title: 'x' }, 'campaign audio upload'],
            [{ kind: 'local', src: 'audio/evil.TXT', title: 'x' }, 'campaign audio upload'],
            [{ kind: 'local', src: LOCAL_A, title: 42 }, 'title'],
            [{ kind: 'local', src: LOCAL_A, title: '   ' }, 'title'],
            'not-an-object',
        ];
        for (const [row, needle] of bad) {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ overrides: { town: [row] } });
            expect(res.status, JSON.stringify(row)).toBe(400);
            expect(res.body.error, JSON.stringify(row)).toContain('music.overrides.town[0]');
            if (typeof needle === 'string') expect(res.body.error).toContain(needle);
        }
    });

    it('refuses a non-array overrides bucket per mood', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { town: 'q9yaKpYS9qc' } });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('music.overrides.town');
    });
});

describe('POST /music — superseded-audio prune', () => {
    it('unlinks the dropped local row\'s file after the save lands', async () => {
        placeAudio(LOCAL_A);
        seedMusic({ ...STOPPED, overrides: { tavern: [localRow(LOCAL_A)] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [ytRow()] } });
        expect(res.status).toBe(200);
        expect(FS.has(path.join(AUDIO_DIR, 'amb-1700000000000-aaaaaa.mp3'))).toBe(false);
    });

    it('keeps files still referenced by ANY mood (id-set keep law)', async () => {
        placeAudio(LOCAL_A, LOCAL_B);
        seedMusic({ ...STOPPED, overrides: { tavern: [localRow(LOCAL_A)], town: [localRow(LOCAL_B)] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { tavern: [localRow(LOCAL_A)] } }); // town mood dropped entirely
        expect(res.status).toBe(200);
        expect(FS.has(path.join(AUDIO_DIR, 'amb-1700000000000-aaaaaa.mp3'))).toBe(true);
        expect(FS.has(path.join(AUDIO_DIR, 'amb-1700000000001-bbbbbb.ogg'))).toBe(false);
    });

    it('transport writes (no overrides change) prune nothing', async () => {
        placeAudio(LOCAL_A);
        seedMusic({ ...STOPPED, overrides: { tavern: [localRow(LOCAL_A)] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ value: { ...STOPPED, mood: 'tavern', playing: true, overrides: { tavern: [localRow(LOCAL_A)] } } });
        expect(res.status).toBe(200);
        expect(FS.has(path.join(AUDIO_DIR, 'amb-1700000000000-aaaaaa.mp3'))).toBe(true);
    });

    it('a foreign stored src (not the upload shape) is never unlinked', async () => {
        FS.set(AUDIO_DIR, 'dir');
        const sneaky = 'audio/important.txt';
        FS.set(path.join(AUDIO_DIR, 'important.txt'), 'not-mine');
        seedMusic({ ...STOPPED, overrides: { tavern: [{ kind: 'local', src: sneaky, title: 'x' }] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: {} });
        expect(res.status).toBe(200);
        expect(FS.has(path.join(AUDIO_DIR, 'important.txt'))).toBe(true);
    });
});

// Item 3b: the second honest local-src home — a root-ABSOLUTE bundled bed
// ('/audio/<kebab>.mp3', the repo-owned CC0 pack under public/audio/).
describe('POST /music — bundled app-audio beds (Item 3b)', () => {
    const BUNDLED = '/audio/dungeon-ambient.mp3';

    it('accepts bundled rows (saved verbatim, no oEmbed touched)', async () => {
        seedMusic({ ...STOPPED });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { dungeon: [{ kind: 'local', src: BUNDLED, title: 'Dungeon Ambience (Jaggedstone, CC0)' }] } });
        expect(res.status).toBe(200);
        expect(res.body.music.overrides.dungeon).toEqual([
            { kind: 'local', src: BUNDLED, title: 'Dungeon Ambience (Jaggedstone, CC0)' },
        ]);
    });

    it('refuses hostile or malformed bundled srcs — traversal, foreign folders, wrong extensions, casing, nested paths', async () => {
        seedMusic({ ...STOPPED });
        const bad = [
            '/audio/../secret.mp3',
            '/audio/..%2Fnpcs.json',
            '/campaigns/test-campaign/audio/amb-1700000000000-aaaaaa.mp3',
            '/etc/passwd',
            '/audio/bed.wav',
            '/audio/bed.ogg',
            '/audio/Town-Theme.mp3',
            '/audio/sub/dir.mp3',
            '/audio/.hidden.mp3',
            '//audio/x.mp3',
        ];
        for (const src of bad) {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/music')
                .send({ overrides: { town: [{ kind: 'local', src, title: 'x' }] } });
            expect(res.status, src).toBe(400);
            expect(res.body.error).toContain('music.overrides.town[0]');
        }
    });

    it('accepts the m4a bundled extension (Safari-safe family) but nothing else', async () => {
        seedMusic({ ...STOPPED });
        const ok = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: { town: [{ kind: 'local', src: '/audio/tavern-loop.m4a', title: 'x' }] } });
        expect(ok.status).toBe(200);
    });

    it('dropping a saved bundled row prunes NOTHING — bundled beds are repo-owned, never unlinked', async () => {
        FS.set(AUDIO_DIR, 'dir');
        // A campaign-file namesake of the bundled bed must survive too (the
        // prune slice could otherwise be steered into the campaign folder).
        FS.set(path.join(AUDIO_DIR, 'dungeon-ambient.mp3'), 'lookalike');
        seedMusic({ ...STOPPED, overrides: { dungeon: [{ kind: 'local', src: BUNDLED, title: 'x' }] } });
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/music')
            .send({ overrides: {} });
        expect(res.status).toBe(200);
        expect(FS.has(path.join(AUDIO_DIR, 'dungeon-ambient.mp3'))).toBe(true);
    });
});
