// @maintained-by-ai
// ─── Lane: deleted-campaign ghost reads (backlog 2026-11-03 CL) ──────────────
// App-level folder-existence guard (server/utils/campaignReadGuard.js),
// mounted in server.js BEFORE every campaign router. Pins BOTH faces:
//   • missing folder  → 404 { error: 'Campaign not found' } on every
//     campaign-scoped GET (meta/change-data/log/positioning/wildcard key/
//     character-file/file list/entity lane), and NO disk re-materialization
//     (the entity CRUD lanes used to write empty JSON files on a plain read);
//   • existing-but-empty folder → honest 200 defaults, byte-identical to
//     before the guard ("gone" vs "empty" stay distinguishable).
// Also pins the invalid-name 400 precedence and that the guard is a pure
// passthrough for non-read methods.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

vi.mock('../utils/campaignPaths.js', async () => {
    const path = await import('path');
    const os = await import('os');
    const fs = await import('fs');
    const ROOT = path.join(os.tmpdir(), 'dnd-campaign-read-guard-tests');
    const dir = (campaign) => path.join(ROOT, campaign);
    return {
        campaignsRoot: () => ROOT,
        campaignDir: dir,
        campaignDataDir: (campaign) => path.join(dir(campaign), 'data'),
        campaignDataFile: (campaign, fileName) => path.join(dir(campaign), 'data', fileName),
        campaignMapsDir: (campaign) => path.join(dir(campaign), 'maps'),
        campaignImagesDir: (campaign) => path.join(dir(campaign), 'images'),
        ensureDataDir: (campaign) => {
            const data = path.join(dir(campaign), 'data');
            fs.mkdirSync(data, { recursive: true });
            return data;
        },
    };
});

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    markDirty: vi.fn(),
    removeChangeDataKey: vi.fn(),
    saveFile: vi.fn(),
}));

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMissingCampaignFolderGuard } from '../utils/campaignReadGuard.js';
import { characterChangeData } from '../utils/changeData.js';
import campaignsBasic from './campaigns-basic.js';
import campaignsCharacter from './campaigns-character.js';
import campaignsChangedata from './campaigns-changedata.js';
import campaignsMeta from './campaigns-meta.js';
import npcsRouter from './npcs.js';
import logRouter from './log.js';

const ROOT = path.join(os.tmpdir(), 'dnd-campaign-read-guard-tests');
const GONE = 'gone-campaign';
const EMPTY = 'empty-campaign';

// Same mount family as server.js (guard first, before every campaign router).
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(createMissingCampaignFolderGuard());
    app.use(campaignsBasic);
    app.use(campaignsCharacter);
    app.use(npcsRouter);
    app.use(campaignsMeta);
    app.use(campaignsChangedata);
    app.use(logRouter);
    return app;
}

beforeAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(ROOT, EMPTY), { recursive: true });
});

afterAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
    characterChangeData.clear();
});

// ─── missing folder → 404 ────────────────────────────────────────────────────

describe('missing campaign folder — every campaign-scoped GET 404s', () => {
    it.each([
        ['meta', `/api/campaigns/${GONE}/meta`],
        ['change-data', `/api/campaigns/${GONE}/change-data`],
        ['log', `/api/campaigns/${GONE}/log`],
        ['positioning', `/api/campaigns/${GONE}/positioning`],
        ['wildcard key', `/api/campaigns/${GONE}/combatSummary`],
        ['character file', `/api/campaigns/${GONE}/SomeHero.json`],
        ['file list', `/api/campaigns/${GONE}`],
        ['entity lane (npcs)', `/api/campaigns/${GONE}/npcs`],
    ])('%s answers 404 with the JSON error body', async (_label, url) => {
        const res = await request(createTestApp()).get(url);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Campaign not found' });
    });

    it('HEAD reads take the same 404 face', async () => {
        const res = await request(createTestApp()).head(`/api/campaigns/${GONE}/change-data`);
        expect(res.status).toBe(404);
    });

    it('a read never re-materializes the deleted folder on disk', async () => {
        // The entity CRUD lanes used to ensureDataDir + write [] files on a
        // plain GET — a bookmark tab could resurrect a deleted campaign.
        await request(createTestApp()).get(`/api/campaigns/${GONE}/npcs`);
        await request(createTestApp()).get(`/api/campaigns/${GONE}/change-data`);
        expect(fs.existsSync(path.join(ROOT, GONE))).toBe(false);
    });
});

// ─── invalid-name precedence (existing 400 face must not regress) ────────────

describe('invalid campaign names keep 400 precedence over the 404', () => {
    it.each(['undefined', 'null'])('GET change-data for "%s" answers 400', async (name) => {
        const res = await request(createTestApp()).get(`/api/campaigns/${name}/change-data`);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid campaign name' });
    });

    it('meta (ghost 200 before the backlog fix) now answers the same 400', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/undefined/meta');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid campaign name' });
    });
});

// ─── existing-but-empty folder → honest 200 defaults ─────────────────────────

describe('existing-but-empty campaign folder stays 200 with its defaults', () => {
    it('meta resolves the standard default', async () => {
        const res = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/meta`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ type: 'standard' });
    });

    it('change-data is an empty object, log an empty array', async () => {
        const cd = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/change-data`);
        expect(cd.status).toBe(200);
        expect(cd.body).toEqual({});
        const log = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/log`);
        expect(log.status).toBe(200);
        expect(log.body).toEqual([]);
    });

    it('positioning / wildcard key / file list / npcs keep their defaults', async () => {
        const pos = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/positioning`);
        expect(pos.status).toBe(200);
        expect(pos.body).toEqual({ positioning: {} });
        const key = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/combatSummary`);
        expect(key.status).toBe(200);
        expect(key.body).toEqual({ value: null });
        const files = await request(createTestApp()).get(`/api/campaigns/${EMPTY}`);
        expect(files.status).toBe(200);
        expect(files.body).toEqual({ files: [] });
        const npcs = await request(createTestApp()).get(`/api/campaigns/${EMPTY}/npcs`);
        expect(npcs.status).toBe(200);
        expect(npcs.body).toEqual({ npcs: [] });
    });

    it('the bare collection route still lists existing folders (no name segment to guard)', async () => {
        const res = await request(createTestApp()).get('/api/campaigns');
        expect(res.status).toBe(200);
        expect(res.body.folders).toContain(EMPTY);
    });
});

// ─── writes are a pure passthrough (guard is GET/HEAD-only) ──────────────────

describe('write routes stay untouched by the read guard', () => {
    it('POST change-data for a missing folder keeps today\'s store-and-200 behavior', async () => {
        const res = await request(createTestApp())
            .post(`/api/campaigns/${GONE}/combatSummary`)
            .send({ value: { round: 1, creatures: [] } });
        expect(res.status).toBe(200);
        expect(characterChangeData.get(GONE).combatSummary).toEqual({ round: 1, creatures: [] });
    });
});
