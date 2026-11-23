/**
 * Deferred plan D — /token-image upload lane: GM-origin gate, campaign
 * existence 404, data-URL + extension guards, and the success shape (bytes
 * land under the campaign images/ dir, response carries ONLY the
 * campaign-relative path — the map row must never receive inline base64).
 * In-memory fs (npcs.test.js idiom) — real disk is never touched.
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
    },
}));

import tokenImageRoutes from './token-image.js';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(tokenImageRoutes);

const CAMPAIGN_DIR = path.resolve(process.cwd(), 'public/campaigns/test-campaign');

beforeEach(() => {
    FS.clear();
    FS.set(CAMPAIGN_DIR, 'dir');
});

const png = 'data:image/png;base64,AAECAw==';

describe('POST /api/campaigns/:campaign/token-image (plan D)', () => {
    it('refuses non-localhost origins with the shared GM-only copy', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/token-image')
            .set('Host', '10.0.0.5')
            .send({ image: png, imageName: 'gob.png' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('404s for a campaign folder that does not exist', async () => {
        const res = await request(app)
            .post('/api/campaigns/nope-campaign/token-image')
            .send({ image: png, imageName: 'gob.png' });
        expect(res.status).toBe(404);
    });

    it('400s a non-data-URL body and a disallowed extension', async () => {
        const bad = await request(app)
            .post('/api/campaigns/test-campaign/token-image')
            .send({ image: 'plain-text', imageName: 'gob.png' });
        expect(bad.status).toBe(400);
        expect(bad.body.error).toMatch(/base64 data URL/);

        const ext = await request(app)
            .post('/api/campaigns/test-campaign/token-image')
            .send({ image: png, imageName: 'gob.exe' });
        expect(ext.status).toBe(400);
        expect(ext.body.error).toMatch(/unsupported image type/);
    });

    it('writes decoded bytes under images/ and answers with the relative path only', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/token-image')
            .send({ image: png, imageName: 'photo.PNG' });
        expect(res.status).toBe(200);
        expect(res.body.imagePath).toMatch(/^images\/token-\d+-[a-z0-9]+\.png$/);
        const written = [...FS.entries()].find(([p]) => p !== CAMPAIGN_DIR && p !== path.join(CAMPAIGN_DIR, 'images'));
        expect(written).toBeTruthy();
        const [file, entry] = written;
        expect(file.startsWith(path.join(CAMPAIGN_DIR, 'images/'))).toBe(true);
        expect(entry.enc).toBe('base64');
        expect(entry.content).toBe('AAECAw==');
    });
});
