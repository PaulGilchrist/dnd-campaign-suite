/**
 * server/routes/campaign-audio.js — campaign audio upload lane
 * (offline-ambience backlog Item 3, 2026-11-25).
 *
 * GM-origin gate (gmGuard), campaign existence, data-URL + extension +
 * subtype-match guards (every refusal names the offender), the success shape
 * (decoded bytes land under the campaign audio/ dir, the response carries
 * ONLY the campaign-relative path + filename title), and the DELETE lane's
 * upload-name gate (no traversal, no arbitrary unlink).
 * In-memory fs (token-image.test.js idiom) — real disk is never touched.
 */
import express from 'express';
import path from 'path';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';

const FS = vi.hoisted(() => new Map());
vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FS.has(p),
        writeFileSync: (p, content, enc) => { FS.set(p, { content, enc }); },
        mkdirSync: (p, opts) => { if (opts?.recursive) FS.set(p, 'dir'); },
        unlinkSync: (p) => { FS.delete(p); },
    },
}));

import campaignAudioRoutes from './campaign-audio.js';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(campaignAudioRoutes);

const CAMPAIGN_DIR = path.resolve(process.cwd(), 'public/campaigns/test-campaign');
const AUDIO_DIR = path.join(CAMPAIGN_DIR, 'audio');

beforeEach(() => {
    FS.clear();
    FS.set(CAMPAIGN_DIR, 'dir');
});

const mp3 = 'data:audio/mpeg;base64,AAECAwT/';

describe('POST /api/campaigns/:campaign/audio (offline ambience)', () => {
    it('refuses non-localhost origins with the shared GM-only copy', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/audio')
            .set('Host', '10.0.0.5')
            .send({ audio: mp3, fileName: 'camp.mp3' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('404s for a campaign folder that does not exist', async () => {
        const res = await request(app)
            .post('/api/campaigns/nope-campaign/audio')
            .send({ audio: mp3, fileName: 'camp.mp3' });
        expect(res.status).toBe(404);
    });

    it('400s a non-data-URL body naming the expected shape', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/audio')
            .send({ audio: 'plain-text', fileName: 'camp.mp3' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/base64 data URL/);
    });

    it('400s a disallowed extension, naming the offender and the allowed list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/audio')
            .send({ audio: mp3, fileName: 'notes.txt' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('notes.txt');
        expect(res.body.error).toContain('mp3/ogg/oga/m4a/wav');
    });

    it('400s a container/extension mismatch naming both sides', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/audio')
            .send({ audio: 'data:audio/wav;base64,AAEC', fileName: 'fake.mp3' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('audio/wav');
        expect(res.body.error).toContain('.mp3');
    });

    it('accepts the supported families (mp3/ogg/m4a/wav)', async () => {
        const cases = [
            ['data:audio/mpeg;base64,AAEC', 'a.mp3'],
            ['data:audio/ogg;base64,AAEC', 'b.ogg'],
            ['data:audio/mp4;base64,AAEC', 'c.m4a'],
            ['data:audio/x-wav;base64,AAEC', 'd.wav'],
        ];
        for (const [audio, fileName] of cases) {
            const res = await request(app)
                .post('/api/campaigns/test-campaign/audio')
                .send({ audio, fileName });
            expect(res.status, fileName).toBe(200);
        }
    });

    it('writes decoded bytes under audio/ and answers with the relative src + filename title only', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/audio')
            .send({ audio: mp3, fileName: 'sub/Camp Fire Night.mp3' });
        expect(res.status).toBe(200);
        expect(res.body.src).toMatch(/^audio\/amb-\d+-[a-z0-9]{6}\.mp3$/);
        expect(res.body.title).toBe('Camp Fire Night');
        const file = res.body.src.slice('audio/'.length);
        expect(FS.get(path.join(AUDIO_DIR, file))).toEqual({ content: 'AAECAwT/', enc: 'base64' });
    });
});

describe('DELETE /api/campaigns/:campaign/audio/:file', () => {
    const uploadName = () => {
        const src = 'audio/amb-1700000000000-abcdef.mp3';
        FS.set(AUDIO_DIR, 'dir');
        FS.set(path.join(AUDIO_DIR, src.slice('audio/'.length)), 'bytes');
        return src.slice('audio/'.length);
    };

    it('refuses non-localhost origins with the shared GM-only copy', async () => {
        const file = uploadName();
        const res = await request(app)
            .delete(`/api/campaigns/test-campaign/audio/${file}`)
            .set('Host', '192.168.0.44');
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    // Item 3b: bundled CC0 beds live at the APP root (/audio/…), not in any
    // campaign folder — this lane can never reach them from either origin.
    // LAN origin hits the GM gate first; GM origin hits the upload-name gate.
    it('can never delete a bundled bed — LAN 403 (GM gate), GM 400 (upload-name gate)', async () => {
        for (const host of ['192.168.0.44', 'localhost']) {
            const res = await request(app)
                .delete('/api/campaigns/test-campaign/audio/town-theme.mp3')
                .set('Host', host);
            if (host !== 'localhost') {
                expect(res.status, host).toBe(403);
                expect(res.body.error).toBe('Access denied: GM-only feature');
            } else {
                expect(res.status, host).toBe(400);
                expect(res.body.error).toContain('not a campaign audio upload name');
            }
        }
    });

    it('400s a foreign name (traversal or arbitrary file) and unlinks nothing', async () => {
        uploadName();
        for (const bad of ['..%2Fdata%2Fnpcs.json', 'ElderPaladin.png', 'amb-hack.mp3']) {
            const res = await request(app).delete(`/api/campaigns/test-campaign/audio/${bad}`);
            expect(res.status, bad).toBe(400);
            expect(res.body.error).toContain('not a campaign audio upload name');
        }
        expect(FS.has(path.join(AUDIO_DIR, 'amb-1700000000000-abcdef.mp3'))).toBe(true);
    });

    it('404s a well-shaped name that is not on disk', async () => {
        FS.set(AUDIO_DIR, 'dir');
        const res = await request(app).delete('/api/campaigns/test-campaign/audio/amb-1700000000000-zzzzzz.mp3');
        expect(res.status).toBe(404);
    });

    it('unlinks the upload', async () => {
        const file = uploadName();
        const res = await request(app).delete(`/api/campaigns/test-campaign/audio/${file}`);
        expect(res.status).toBe(200);
        expect(res.body.deleted).toBe(true);
        expect(FS.has(path.join(AUDIO_DIR, file))).toBe(false);
    });
});
