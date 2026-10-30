// @maintained-by-ai
// maps.empty-kebab-create.test.js — regression for bug-map-name-empty-kebab-undeletable-dotfile.
// POST create and PUT rename must REFUSE names whose kebab-case file handle is
// empty (punctuation-only, emoji, non-Latin scripts): such a name writes an
// empty-slug `.json` DOTFILE whose URL segment collapses to '' on every later
// lane (false-200 delete via the change-data wildcard, phantom-blank open,
// 404 rename) — an undeletable one-way door. Mock harness mirrors maps.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';

// ─── Mocks (mirrors maps.test.js) ─────────────────────────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();
let publishedEvents = [];

function clearMocks() {
    MOCK_FS.clear();
    MOCK_ACTIVE_MAPS.clear();
    publishedEvents = [];
}

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => MOCK_FS.has(path) || MOCK_FS.has(path + '.json')),
        readFileSync: vi.fn((path) => {
            const content = MOCK_FS.get(path);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            return typeof content === 'string' ? content : JSON.stringify(content);
        }),
        writeFileSync: vi.fn((path, data) => {
            MOCK_FS.set(path, data);
        }),
        readdirSync: vi.fn((dirPath) => {
            const entries = MOCK_FS.get(dirPath);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        mkdirSync: vi.fn((dirPath) => {
            MOCK_FS.set(dirPath, { __directory__: true });
        }),
        unlinkSync: vi.fn((path) => {
            MOCK_FS.delete(path);
        }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/maps`),
    normalizeMapFile: vi.fn((name) => (name.endsWith('.json') ? name : `${name}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn((key, data) => {
        publishedEvents.push({ key, data });
    }),
    activeMaps: {
        get: vi.fn((campaign) => MOCK_ACTIVE_MAPS.get(campaign)),
        set: vi.fn((campaign, value) => {
            MOCK_ACTIVE_MAPS.set(campaign, value);
        }),
        delete: vi.fn((campaign) => {
            MOCK_ACTIVE_MAPS.delete(campaign);
        }),
    },
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// Names that sanitize to an empty file handle: punctuation-only, emoji,
// full non-Latin scripts.
const EMPTY_KEBAB_NAMES = ['!!!', '???', '@#$', '🎲🎲', 'Привет', '地城'];

describe('maps — empty-kebab name refusal (bug-map-name-empty-kebab)', () => {
    afterEach(clearMocks);

    describe('POST /api/campaigns/:campaign/maps', () => {
        it.each(EMPTY_KEBAB_NAMES)('400s name %s and writes no dotfile', async (name) => {
            const mapsDir = '/mock/campaigns/test-campaign/maps';
            MOCK_FS.set(mapsDir, []);

            const app = createTestApp();
            const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Map name must contain letters or numbers');
            // The one-way door stays shut: NO empty-slug `.json` dotfile on disk.
            expect(MOCK_FS.has(`${mapsDir}/.json`)).toBe(false);
            expect(publishedEvents).toHaveLength(0);
        });

        it('still creates a name that merely contains punctuation (non-empty kebab)', async () => {
            const mapsDir = '/mock/campaigns/test-campaign/maps';
            MOCK_FS.set(mapsDir, []);

            const app = createTestApp();
            const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name: 'Map #1!' });

            expect(res.status).toBe(201);
            expect(MOCK_FS.has(`${mapsDir}/map-1.json`)).toBe(true);
        });
    });

    describe('PUT /api/campaigns/:campaign/maps/:mapname/rename', () => {
        it.each(EMPTY_KEBAB_NAMES)('400s rename of dungeon.json to %s (no dotfile move)', async (name) => {
            const mapsDir = '/mock/campaigns/test-campaign/maps';
            MOCK_FS.set(`${mapsDir}/dungeon.json`, { displayName: 'Dungeon', name: 'dungeon', type: 'indoor' });

            const app = createTestApp();
            const res = await request(app)
                .put('/api/campaigns/test-campaign/maps/dungeon/rename')
                .send({ newName: name });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Map name must contain letters or numbers');
            expect(MOCK_FS.has(`${mapsDir}/.json`)).toBe(false);
            // The original file is untouched — refusal is not partial destruction.
            expect(MOCK_FS.has(`${mapsDir}/dungeon.json`)).toBe(true);
        });
    });
});
