// Regression lock (bug-stray-root-json-ghost-character-poisons-initiative-
// board): GET /api/campaigns/:campaign IS the roster enumeration — every
// listed file is parsed by the client and baked into a persisted combatSummary
// player row on campaign select. A stray non-character JSON at campaign root
// used to mint a `name: null` ghost row that survived the file's deletion and
// hard-crashed every monster join / playtest start. The route must enumerate
// ONLY files that parse as character documents (non-empty string `name`, the
// one field the character create/PUT lanes hard-require).
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsBasic from './campaigns-basic.js';

// ─── Mocks (mirror campaigns-basic.test.js) ────────────────────────────────────

const MOCK_REaddir = new Map();
const MOCK_FILES = new Map();

function setupReaddir(path, entries) {
    MOCK_REaddir.set(path, entries);
}

function dirEntry(name, isDir) {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
    };
}

vi.mock('fs', () => ({
    default: {
        readdirSync: vi.fn((dirPath) => {
            const entries = MOCK_REaddir.get(dirPath);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        existsSync: vi.fn((p) => MOCK_FILES.has(p)),
        readFileSync: vi.fn((p) => {
            if (MOCK_FILES.has(p)) return MOCK_FILES.get(p);
            throw new Error('ENOENT');
        }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignsRoot: vi.fn(() => '/mock/campaigns/root'),
    campaignDir: vi.fn((campaign) => `/mock/campaigns/root/${campaign}`),
    campaignDataFile: vi.fn((campaign, fileName) => `/mock/campaigns/root/${campaign}/data/${fileName}`),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DIR = '/mock/campaigns/root/test-campaign';

function seed(fileName, body) {
    MOCK_FILES.set(`${DIR}/${fileName}`, typeof body === 'string' ? body : JSON.stringify(body));
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsBasic);
    return app;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('campaignsBasic - GET /api/campaigns/:campaign character-shape guard', () => {
    let logSpy;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        MOCK_REaddir.clear();
        MOCK_FILES.clear();
        logSpy.mockRestore();
    });

    it('excludes a stray campaign-meta.json-style document while keeping every real character', async () => {
        setupReaddir(DIR, [
            dirEntry('AasimarTest.json', false),
            dirEntry('ElderPaladin.json', false),
            dirEntry('campaign-meta.json', false),
        ]);
        seed('AasimarTest.json', { name: 'AasimarTest', class: { name: 'Paladin' } });
        seed('ElderPaladin.json', { name: 'ElderPaladin' });
        seed('campaign-meta.json', { type: 'standard', toolbelt: { hiddenViews: ['notes'] } });

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual(['AasimarTest.json', 'ElderPaladin.json']);
        expect(logSpy).toHaveBeenCalledWith(
            '[campaigns-basic] Skipping non-character JSON at test-campaign root: campaign-meta.json'
        );
    });

    it('excludes documents whose name is missing, blank or non-string', async () => {
        setupReaddir(DIR, [
            dirEntry('NoName.json', false),
            dirEntry('BlankName.json', false),
            dirEntry('NumberName.json', false),
            dirEntry('Real.json', false),
        ]);
        seed('NoName.json', { class: { name: 'Fighter' } });
        seed('BlankName.json', { name: '   ' });
        seed('NumberName.json', { name: 42 });
        seed('Real.json', { name: 'Real' });

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual(['Real.json']);
    });

    it('excludes unparseable JSON and non-object JSON, logging each skip', async () => {
        setupReaddir(DIR, [
            dirEntry('Broken.json', false),
            dirEntry('Array.json', false),
            dirEntry('Good.json', false),
        ]);
        seed('Broken.json', '{ not valid json');
        seed('Array.json', [1, 2, 3]);
        seed('Good.json', { name: 'Good' });

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual(['Good.json']);
        expect(logSpy).toHaveBeenCalledWith(
            '[campaigns-basic] Skipping unreadable/unparseable JSON at test-campaign root: Broken.json'
        );
        expect(logSpy).toHaveBeenCalledWith(
            '[campaigns-basic] Skipping non-character JSON at test-campaign root: Array.json'
        );
    });

    it('lists a campaign whose root holds no character files as empty', async () => {
        setupReaddir(DIR, [dirEntry('campaign-meta.json', false)]);
        seed('campaign-meta.json', { type: 'standard' });

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual([]);
    });
});
