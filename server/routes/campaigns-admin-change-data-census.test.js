// @maintained-by-ai
/**
 * Admin change-data census lane (GET /api/campaigns/:campaign/admin/change-data-census,
 * backlog 2026-11-17 CD): locks the CLASSIFICATION contract at the server seam —
 * known character-roster buckets and legitimate campaign specials are NEVER
 * flagged; unknown top-level keys (the retired-lane phantom family) are listed
 * with a type + short summary; an empty store reports the honest zero-unknown
 * face. Mount + guard idiom mirrors campaigns-admin-clear-changedata.test.js.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map() };

vi.mock('fs', () => {
    const api = {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        renameSync: vi.fn(),
        rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
        readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
        createWriteStream: vi.fn(() => ({ on: vi.fn(), write: () => {}, end: () => {}, bytesWritten: 0 })),
        statSync: vi.fn(() => ({ isDirectory: () => true })),
    };
    return { default: api, ...api };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    spellOverlayData: new Map(),
    activeMaps: new Map(),
    saveFile: vi.fn(),
    markDirty: vi.fn(),
    publish: vi.fn(),
    readFile: vi.fn(),
}));

vi.mock('./log.js', () => ({ logCache: new Map(), flushLogs: vi.fn() }));
vi.mock('archiver', () => ({ default: { ZipArchive: vi.fn().mockImplementation(() => ({ on: vi.fn().mockReturnThis(), pipe: vi.fn().mockReturnThis(), directory: vi.fn().mockReturnThis(), finalize: vi.fn(), abort: vi.fn() })) } }));
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = { single: vi.fn(() => (req, res, next) => next()), array: vi.fn(() => (req, res, next) => next()), fields: vi.fn(() => (req, res, next) => next()) };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

const { characterChangeData } = await import('../utils/changeData.js');

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }

const CENSUS_URL = '/api/campaigns/test-campaign/admin/change-data-census';

// The test-campaign roster shape (character JSON files + the non-character
// entries the isCharacterJsonFile heuristic must skip) plus a mock folder.
const ROSTER_FILES = [
    'AasimarTest.json', 'ElderPaladin.json', 'War_Cleric.json',
    'npcs.json', 'quests.json', 'factions.json', 'settlements.json',
    'campaign-meta.json', 'data', 'images', 'maps',
];

function ensureCampaign(name, files = ROSTER_FILES) {
    mockFsState.exists.add(`/mock/campaigns/${name}`);
    mockFsState.readdir.set(`/mock/campaigns/${name}`, files);
}

describe('campaignsAdmin - GET /api/campaigns/:campaign/admin/change-data-census', () => {
    afterEach(() => {
        mockFsState.exists.clear();
        mockFsState.readdir.clear();
        characterChangeData.clear();
        vi.clearAllMocks();
    });

    it('rejects non-localhost requests', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'example.com');
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Only available on localhost');
    });

    it('404s for a campaign folder that does not exist', async () => {
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Campaign not found');
    });

    it('empty change-data store reports the honest zero-unknown face', async () => {
        ensureCampaign('test-campaign');
        characterChangeData.set('test-campaign', {});
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ totalKeys: 0, unknownKeys: [] });
    });

    it('campaign with no in-memory entry yet still answers the empty census', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ totalKeys: 0, unknownKeys: [] });
    });

    it('known character buckets and legitimate specials are never flagged', async () => {
        ensureCampaign('test-campaign');
        const store = {
            // Roster buckets: display-name spellings and the underscored
            // filename spelling both slug-match the JSON files on disk.
            AasimarTest: { currentHitPoints: 143 },
            ElderPaladin: { currentHitPoints: 100 },
            War_Cleric: { currentHitPoints: 88 },
            // Canonical campaign specials (utils/changeDataKeys.js).
            combatSummary: { round: 1, creatures: [{ name: 'Goblin' }] },
            __map__: { activeMapName: 'battle-arena' },
            __campaign__: { campaignName: 'test-campaign' },
            music: { mood: 'tavern', playing: false },
            aiConfig: { mode: 'off' },
            enforcement: { mode: 'off' },
            turnState: {},
            sessionState: null,
            activeConditions: ['poisoned'],
            activeCreatureName: 'AasimarTest',
            lastAppliedTurnStartCreature: 'AasimarTest',
            activeCreatureId: 3,
            log: [],
            positioning: {},
            targetEffects: [],
            pendingSavePrompts: [],
            pendingSaveListenerPrompts: [],
            coverRefresh: {},
            warCasterReactions: {},
            quivering_palm: {},
            lastAttack: { attacker: 'AasimarTest' },
            lastCombatResult: { victory: true },
            pendingOAs: [],
            cleavePending: false,
            cleaveSecondTargets: [],
            tacticalMasterPending: null,
            pendingStarryChaliceHeal: null,
            'loot-draft': {},
            leadingEvasionSelections: {},
            'spell-overlay': [],
            // Dynamic families.
            'travel-mode': 'idle',
            'travel-started-by': null,
            'pipeline-pause': false,
            'pipeline-test-campaign-action': { stage: 'hit' },
            'savePrompt-Goblin-7': { promptId: 7 },
            'deathSavePrompt-HexWarlock': {},
            'concentrationPrompt-Elves-2': {},
            'fleshToStonePrompt-FeyRanger': {},
            // Internal automation flags (leading-underscore convention).
            '_activeInvisibility_AasimarTest': 'FeyRanger',
            '_activeFriends_TestMonk': true,
            '_activeGreaterInvisibility_TestMonk': 'FeyRanger',
            '_Vex_appliedTarget': 'Goblin',
            '_cover_shot': true,
            '_fleshToStone_Goblin': {},
            '_Vex_Soulstitch_Spells_active': [],
            // Joined creature bucket (on the combatSummary board).
            Goblin: { monsterLegendaryUses: { max: 3, used: 1 } },
        };
        characterChangeData.set('test-campaign', store);
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.unknownKeys).toEqual([]);
        expect(res.body.totalKeys).toBe(Object.keys(store).length);
    });

    it('a phantom top-level key is listed exactly, siblings stay unflagged', async () => {
        ensureCampaign('test-campaign');
        // The retired-lane shadow shape from the fixed bug: a whole snapshot
        // stored verbatim as a top-level `inventory` bucket. Plus the EffectAdder
        // open flag, RETIRED from the store 2026-11-19 (demoted to per-client
        // useState) — a surviving write is now a phantom, not a special key.
        characterChangeData.set('test-campaign', {
            AasimarTest: { currentHitPoints: 143 },
            combatSummary: { round: 1, creatures: [] },
            inventory: { campaign: 'test-campaign', items: [{ id: 1, qty: 4 }] },
            'combat-ui-effectAdderTarget': null,
        });
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.totalKeys).toBe(4);
        expect(res.body.unknownKeys).toEqual([
            { key: 'combat-ui-effectAdderTarget', type: 'null', summary: 'null' },
            { key: 'inventory', type: 'object', summary: '2 keys: campaign, items' },
        ]);
    });

    it('reports value type + short summary per shape (string/number/boolean/array/null)', async () => {
        ensureCampaign('test-campaign');
        characterChangeData.set('test-campaign', {
            qaString: 'probe',
            qaNumber: 42,
            qaBool: true,
            qaNull: null,
            qaArray: [1, 2, 3],
        });
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.unknownKeys).toEqual([
            { key: 'qaArray', type: 'array', summary: 'array, 3 entries' },
            { key: 'qaBool', type: 'boolean', summary: 'true' },
            { key: 'qaNull', type: 'null', summary: 'null' },
            { key: 'qaNumber', type: 'number', summary: '42' },
            { key: 'qaString', type: 'string', summary: '"probe"' },
        ]);
    });

    it('unknown keys sort deterministically and an over-long key preview is capped', async () => {
        ensureCampaign('test-campaign');
        const blob = {};
        for (let i = 0; i < 8; i += 1) blob[`k${i}`] = i;
        characterChangeData.set('test-campaign', { zzz: blob, aaa: 'x' });
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        const keys = res.body.unknownKeys.map((entry) => entry.key);
        expect(keys).toEqual([...keys].sort());
        const big = res.body.unknownKeys.find((entry) => entry.key === 'zzz');
        expect(big.summary).toMatch(/\+3 more$/);
    });

    it('the deprecated campaign-named top-level bucket is flagged as unknown', async () => {
        ensureCampaign('test-campaign');
        characterChangeData.set('test-campaign', {
            'test-campaign': { targetEffects: [] },
        });
        const res = await request(createTestApp()).get(CENSUS_URL).set('Host', 'localhost');
        expect(res.body.unknownKeys).toEqual([
            { key: 'test-campaign', type: 'object', summary: '1 key: targetEffects' },
        ]);
    });
});
