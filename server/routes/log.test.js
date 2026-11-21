import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import logRouter from './log.js';
import * as logModule from './log.js';

const mockFsState = { exists: new Set(), files: new Map(), dirs: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        writeFileSync: vi.fn((p, data) => {
            mockFsState.files.set(p, data);
        }),
        readdirSync: vi.fn((p) => mockFsState.dirs.get(p) || []),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    readFileSync: vi.fn((p) => {
        if (mockFsState.files.has(p)) return mockFsState.files.get(p);
        throw new Error('ENOENT');
    }),
    writeFileSync: vi.fn((p, data) => {
        mockFsState.files.set(p, data);
    }),
    readdirSync: vi.fn((p) => mockFsState.dirs.get(p) || []),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
    ensureDataDir: vi.fn((name) => {
        mockFsState.exists.add(`/mock/campaigns/${name}/data`);
        return `/mock/campaigns/${name}/data`;
    }),
}));

// characterChangeData is the REAL Map instance the SUT and every test share:
// addEntry's active-session stamp reads sessionState.name from it (server
// change-data cache stand-in).
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    characterChangeData: new Map(),
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(logRouter);
    return app;
}

function ensureCampaign(campaign) {
    // Real campaigns always have the folder itself; the phantom guard in
    // saveLogFile() checks it before persisting.
    mockFsState.exists.add(`/mock/campaigns/${campaign}`);
    mockFsState.exists.add(`/mock/campaigns/${campaign}/data`);
}

function setLogFile(campaign, content) {
    const path = `/mock/campaigns/${campaign}/data/campaign-log.json`;
    mockFsState.exists.add(path);
    mockFsState.files.set(path, JSON.stringify(content));
}

function clearLogCache() {
    logModule.logCache.clear();
}

function clearLogFiles() {
    mockFsState.files.clear();
    mockFsState.exists.clear();
    mockFsState.dirs.clear();
}

// Player-roster fixture for the visitor manual-author gate: readParty
// (server/services/ai/authoring/party.js) reads the campaign ROOT *.json
// files and keeps only character-shaped rows (name + level + class.name).
function setRoster(campaign, names) {
    const base = `/mock/campaigns/${campaign}`;
    mockFsState.exists.add(base);
    mockFsState.dirs.set(base, names.map((n) => `${n}.json`));
    names.forEach((n) => {
        mockFsState.files.set(`${base}/${n}.json`, JSON.stringify({ name: n, level: 1, class: { name: 'Fighter' } }));
    });
}

// Origin faces ride the Host header (gmGuard follows req.hostname, mirroring
// the Vite proxy's changeOrigin:false law): supertest's default Host is the
// 127.0.0.1 bind ⇒ GM; a LAN-style Host header ⇒ network visitor.
const VISITOR_HOST = '192.168.1.50:5173';

afterEach(async () => {
    clearLogCache();
    clearLogFiles();
    const { characterChangeData } = await import('../utils/changeData.js');
    characterChangeData.clear();
    vi.clearAllMocks();
});

// ─── logCache export ─────────────────────────────────────────────────────────

describe('logCache export', () => {
    it('should export an empty Map by default', () => {
        expect(logModule.logCache).toBeInstanceOf(Map);
        expect(logModule.logCache.size).toBe(0);
    });
});

// ─── GET /api/campaigns/:campaign/log ────────────────────────────────────────

describe('GET /api/campaigns/:campaign/log', () => {
    it('should return an empty array when no log exists for campaign', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toEqual([]);
    });

    it('should return log entries when they exist on disk', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'encounter', message: 'Encounter started', timestamp: Date.now() - 1000 },
            { type: 'encounter', message: 'Goblin attacked', timestamp: Date.now() - 500 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].message).toBe('Encounter started');
        expect(res.body[1].message).toBe('Goblin attacked');
    });

    it('should return only the last 500 entries', async () => {
        ensureCampaign('test-campaign');
        const entries = [];
        for (let i = 0; i < 600; i++) {
            entries.push({ type: 'note', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        setLogFile('test-campaign', entries);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(500);
        expect(res.body[0].message).toBe('Entry 100');
        expect(res.body[499].message).toBe('Entry 599');
    });

    it('should return all entries when fewer than 500 exist', async () => {
        ensureCampaign('test-campaign');
        const entries = [];
        for (let i = 0; i < 10; i++) {
            entries.push({ type: 'note', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        setLogFile('test-campaign', entries);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(10);
    });

    it('should handle a log file that is not an array (should return empty)', async () => {
        ensureCampaign('test-campaign');
        const path = `/mock/campaigns/test-campaign/data/campaign-log.json`;
        mockFsState.files.set(path, JSON.stringify({ not: 'an array' }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should handle malformed JSON in log file (should return empty)', async () => {
        ensureCampaign('test-campaign');
        const path = `/mock/campaigns/test-campaign/data/campaign-log.json`;
        mockFsState.files.set(path, 'not valid json {{{');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should cache the log in logCache after first read', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'note', message: 'Cached entry', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        expect(logModule.logCache.has('test-campaign')).toBe(true);
        expect(logModule.logCache.get('test-campaign')).toHaveLength(1);
    });

    it('should use cached log on subsequent reads without re-reading file', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'note', message: 'Original', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        // Modify the file on disk after caching
        setLogFile('test-campaign', [
            { type: 'note', message: 'Original', timestamp: Date.now() },
            { type: 'note', message: 'New entry', timestamp: Date.now() },
        ]);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        // Should still return cached version (1 entry), not the updated file
        expect(res.body).toHaveLength(1);
        expect(res.body[0].message).toBe('Original');
    });

    it('should return entries with all expected fields', async () => {
        const timestamp = Date.now() - 1000;
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            {
                id: 'entry-1',
                type: 'encounter',
                message: 'Dragon appeared',
                timestamp: timestamp,
                details: { creature: 'Red Dragon', hp: 250 },
            },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body[0]).toEqual({
            id: 'entry-1',
            type: 'encounter',
            message: 'Dragon appeared',
            timestamp: timestamp,
            details: { creature: 'Red Dragon', hp: 250 },
        });
    });

    it('should handle different campaign names independently', async () => {
        ensureCampaign('campaign-a');
        ensureCampaign('campaign-b');
        setLogFile('campaign-a', [
            { type: 'note', message: 'Campaign A entry', timestamp: Date.now() },
        ]);
        setLogFile('campaign-b', [
            { type: 'note', message: 'Campaign B entry', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        const resA = await request(app).get('/api/campaigns/campaign-a/log');
        const resB = await request(app).get('/api/campaigns/campaign-b/log');

        expect(resA.body).toHaveLength(1);
        expect(resA.body[0].message).toBe('Campaign A entry');
        expect(resB.body).toHaveLength(1);
        expect(resB.body[0].message).toBe('Campaign B entry');
    });

    it('should handle campaign names with special characters', async () => {
        ensureCampaign('test-campaign-123');
        setLogFile('test-campaign-123', [
            { type: 'note', message: 'Special campaign', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign-123/log');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
});

// ─── POST /api/campaigns/:campaign/log ───────────────────────────────────────

describe('POST /api/campaigns/:campaign/log', () => {
    it('should add a new log entry and return it with id and timestamp', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'encounter', message: 'Encounter started' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.id).toBe('string');
        expect(typeof res.body.timestamp).toBe('number');
        expect(res.body.type).toBe('encounter');
        expect(res.body.message).toBe('Encounter started');
    });

    it('should preserve all fields from the request body', async () => {
        ensureCampaign('test-campaign');
        const entryData = {
            type: 'spell',
            message: 'Fireball cast',
            details: {
                spell: 'Fireball',
                level: 3,
                damage: '8d6 fire',
                save: 'DEX',
                location: { x: 10, y: 20 },
            },
        };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entryData);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('spell');
        expect(res.body.message).toBe('Fireball cast');
        expect(res.body.details).toEqual(entryData.details);
    });

    it('should append the entry to existing log entries', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'encounter', message: 'Previous entry', timestamp: Date.now() - 1000 },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'encounter', message: 'New entry' });

        expect(res.status).toBe(200);

        const log = logModule.logCache.get('test-campaign');
        expect(log).toHaveLength(2);
        expect(log[0].message).toBe('Previous entry');
        expect(log[1].message).toBe('New entry');
    });

    it('should generate a unique ID for each entry', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();

        const res1 = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'First' });

        const res2 = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Second' });

        expect(res1.body.id).not.toBe(res2.body.id);
    });

    it('should generate a valid timestamp (Date.now())', async () => {
        ensureCampaign('test-campaign');
        const before = Date.now();
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Timestamp test' });
        const after = Date.now();

        expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
        expect(res.body.timestamp).toBeLessThanOrEqual(after);
    });

    it('rejects an empty request body with 400 and zero side effects (schema gate)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const { publish } = await import('../utils/changeData.js');
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Log entry requires a "type" string');
        expect(logModule.logCache.get('test-campaign') || []).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('rejects a null request body with 400 (schema gate)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(null);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('must be a JSON object');
    });

    it('rejects a string request body with 400 (schema gate)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send('plain text');

        expect(res.status).toBe(400);
    });

    it('rejects an array request body with 400 (schema gate)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send([1, 2, 3]);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('must be a JSON object');
    });

    it('should handle nested objects in the entry', async () => {
        ensureCampaign('test-campaign');
        const nestedData = {
            type: 'encounter',
            message: 'Complex event',
            combat: {
                round: 5,
                initiative: {
                    creature: 'Goblin',
                    value: 18,
                },
            },
        };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(nestedData);

        expect(res.status).toBe(200);
        expect(res.body.combat.round).toBe(5);
        expect(res.body.combat.initiative.creature).toBe('Goblin');
    });

    it('should cache the entry in logCache', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Cache test' });

        expect(logModule.logCache.has('test-campaign')).toBe(true);
        const log = logModule.logCache.get('test-campaign');
        expect(log).toHaveLength(1);
        expect(log[0].message).toBe('Cache test');
    });

    it('should call publish with the correct SSE key and entry', async () => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'SSE test' });

        expect(publish).toHaveBeenCalledWith(
            'log-test-campaign',
            expect.objectContaining({
                type: 'note',
                message: 'SSE test',
            }),
            'test-campaign'
        );
    });

    it('should publish with campaign name containing special characters', async () => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign-123');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign-123/log')
            .send({ type: 'note', characterName: 'GM', message: 'Special' });

        expect(publish).toHaveBeenCalledWith(
            'log-test-campaign-123',
            expect.any(Object),
            'test-campaign-123'
        );
    });
});

// ─── File persistence (saveLogFile) ──────────────────────────────────────────

describe('File persistence', () => {
    it('should write to the correct file path', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Persistence test' });

        // Wait for the debounce timer
        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        expect(writeCalls.length).toBeGreaterThan(0);
        const lastCall = writeCalls[writeCalls.length - 1];
        expect(lastCall[0]).toBe('/mock/campaigns/test-campaign/data/campaign-log.json');
    });

    it('should persist the FULL log to disk — the file is never trimmed (log-as-memory law, 2026-11-21)', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');

        // Pre-populate cache with 510 entries; the file must carry all 511.
        const existingEntries = [];
        for (let i = 0; i < 510; i++) {
            existingEntries.push({ type: 'note', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        logModule.logCache.set('test-campaign', existingEntries);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'New entry' });

        // Wait for debounce
        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        const lastCall = writeCalls[writeCalls.length - 1];
        const writtenData = JSON.parse(lastCall[1]);
        expect(writtenData).toHaveLength(511);
        expect(writtenData[0].message).toBe('Entry 0');
        expect(writtenData[510].message).toBe('New entry');
    });

    it('should write valid JSON to the file', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Valid JSON' });

        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        const lastCall = writeCalls[writeCalls.length - 1];
        const writtenData = JSON.parse(lastCall[1]);
        expect(Array.isArray(writtenData)).toBe(true);
    });

    it('should write JSON with indentation (pretty print)', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Indented' });

        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        const lastCall = writeCalls[writeCalls.length - 1];
        const writtenContent = lastCall[1];
        // JSON.stringify with indent 2 should contain newlines
        expect(writtenContent).toContain('\n');
    });

    it('should trim entries to last 500 when reading from disk', async () => {
        ensureCampaign('test-campaign');
        const entries = [];
        for (let i = 0; i < 501; i++) {
            entries.push({ type: 'note', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        setLogFile('test-campaign', entries);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.body).toHaveLength(500);
    });
});

// ─── Phantom-campaign guard (saveLogFile) ───────────────────────────────────

describe('Phantom-campaign guard in flush', () => {
    it('should skip and purge a cache key whose campaign directory no longer exists', async () => {
        const fsMock = await import('fs');
        ensureCampaign('live-campaign');
        // 'ghost-campaign' is in memory but its folder was renamed/deleted away
        logModule.logCache.set('ghost-campaign', [{ type: 'note', message: 'Stale entry', timestamp: 1000 }]);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/live-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Live entry' });

        await new Promise((r) => setTimeout(r, 1100));

        // Ghost folder must never be re-created and no file written for it
        expect(mockFsState.exists.has('/mock/campaigns/ghost-campaign')).toBe(false);
        expect(mockFsState.exists.has('/mock/campaigns/ghost-campaign/data')).toBe(false);
        for (const [path] of fsMock.default.writeFileSync.mock.calls) {
            expect(path).not.toContain('ghost-campaign');
        }
        // Memory purged so later sweeps stay quiet
        expect(logModule.logCache.has('ghost-campaign')).toBe(false);
        // Live campaign still persisted normally
        expect(logModule.logCache.has('live-campaign')).toBe(true);
        expect(mockFsState.files.has('/mock/campaigns/live-campaign/data/campaign-log.json')).toBe(true);
    });

    it('should still write when the campaign folder exists but its data subfolder was removed', async () => {
        const fsMock = await import('fs');
        // Campaign folder exists, data dir missing (ensureDataDir legitimately recreates it)
        mockFsState.exists.add('/mock/campaigns/partial-campaign');

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/partial-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Recreate data dir' });

        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        expect(writeCalls.some(([p]) => p === '/mock/campaigns/partial-campaign/data/campaign-log.json')).toBe(true);
        expect(logModule.logCache.has('partial-campaign')).toBe(true);
    });
});

// ─── Cache behavior ──────────────────────────────────────────────────────────

describe('Cache behavior', () => {
    it('should return cached entries on subsequent GET requests', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'note', message: 'Cached', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        // Modify file on disk
        setLogFile('test-campaign', [
            { type: 'note', message: 'Cached', timestamp: Date.now() },
            { type: 'note', message: 'Not cached', timestamp: Date.now() },
        ]);

        const res = await request(app).get('/api/campaigns/test-campaign/log');
        expect(res.body).toHaveLength(1);
        expect(res.body[0].message).toBe('Cached');
    });

    it('should cache empty array for campaigns with no log file', async () => {
        ensureCampaign('test-campaign');
        // No log file set

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        expect(logModule.logCache.has('test-campaign')).toBe(true);
        expect(logModule.logCache.get('test-campaign')).toEqual([]);
    });

    it('should have separate caches for different campaigns', async () => {
        ensureCampaign('campaign-a');
        ensureCampaign('campaign-b');
        setLogFile('campaign-a', [{ type: 'note', message: 'A', timestamp: Date.now() }]);
        setLogFile('campaign-b', [{ type: 'note', message: 'B', timestamp: Date.now() }]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/campaign-a/log');
        await request(app).get('/api/campaigns/campaign-b/log');

        expect(logModule.logCache.get('campaign-a')).toHaveLength(1);
        expect(logModule.logCache.get('campaign-a')[0].message).toBe('A');
        expect(logModule.logCache.get('campaign-b')).toHaveLength(1);
        expect(logModule.logCache.get('campaign-b')[0].message).toBe('B');
    });
});

// ─── Edge cases and error handling ───────────────────────────────────────────

describe('Edge cases and error handling', () => {
    it('should handle very long message strings', async () => {
        ensureCampaign('test-campaign');
        const longMessage = 'a'.repeat(10000);
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: longMessage });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(longMessage);
    });

    it('should handle entries with unicode characters', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: '🐉 Dragon appeared! 日本語 テスト' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('🐉 Dragon appeared! 日本語 テスト');
    });

    it('should handle entries with emoji', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'encounter', message: '⚔️ Battle started 🛡️' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('⚔️ Battle started 🛡️');
    });

    it('should handle entries with special JSON characters', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Line 1\nLine 2\tTab "quotes" \'apostrophe\'' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Line 1\nLine 2\tTab "quotes" \'apostrophe\'');
    });

    it('should handle entries with boolean, number, and null values', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({
                type: 'note',
                characterName: 'GM',
                message: 'Scalar pass-through',
                active: true,
                count: 42,
                nullable: null,
                flag: false,
            });

        expect(res.status).toBe(200);
        expect(res.body.active).toBe(true);
        expect(res.body.count).toBe(42);
        expect(res.body.nullable).toBe(null);
        expect(res.body.flag).toBe(false);
    });

    it('rejects an entry with empty type and empty message (schema gate)', async () => {
        ensureCampaign('test-campaign');
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: '', message: '', details: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Log entry requires a "type" string');
        expect(logModule.logCache.get('test-campaign') || []).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied timestamp: the server Date.now() always wins (bug-log-api-ghost-entries)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const before = Date.now();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', message: 'Custom time', timestamp: 9999999 });

        expect(res.status).toBe(200);
        // Regression pin: the entry spread comes FIRST and id/timestamp are forced
        // after it, so a forged client timestamp can never affect audit ordering.
        expect(res.body.timestamp).not.toBe(9999999);
        expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('rejects a client-supplied id: the server always mints the uuid (bug-log-api-ghost-entries)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ id: 'my-custom-id', type: 'note', characterName: 'GM', message: 'Custom id' });

        expect(res.status).toBe(200);
        // Regression pin: client-forged ids are overridden by the server uuid.
        expect(res.body.id).not.toBe('my-custom-id');
        expect(typeof res.body.id).toBe('string');
        expect(res.body.id.length).toBeGreaterThan(10);
    });

    it('keeps the forged fields out of the stored cache and the SSE broadcast', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const { publish } = await import('../utils/changeData.js');
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ id: 'FORGED-ID', timestamp: 1, type: 'note', characterName: 'GM', message: 'TS FORGE PROBE' });

        expect(res.body.type).toBe('note');
        expect(res.body.message).toBe('TS FORGE PROBE');

        const stored = logModule.logCache.get('test-campaign');
        expect(stored.at(-1)).toMatchObject({
            id: res.body.id,
            timestamp: res.body.timestamp,
            message: 'TS FORGE PROBE',
        });
        expect(stored.at(-1).id).not.toBe('FORGED-ID');
        expect(stored.at(-1).timestamp).not.toBe(1);

        expect(publish).toHaveBeenCalledWith('log-test-campaign', expect.objectContaining({
            id: res.body.id,
            timestamp: res.body.timestamp,
        }), 'test-campaign');
    });
});

// ─── Multiple entries ordering ───────────────────────────────────────────────

describe('Entry ordering', () => {
    it('should maintain insertion order in the log', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();

        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'note', characterName: 'GM', message: 'First' });
        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'note', characterName: 'GM', message: 'Second' });
        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'note', characterName: 'GM', message: 'Third' });

        const log = logModule.logCache.get('test-campaign');
        expect(log).toHaveLength(3);
        expect(log[0].message).toBe('First');
        expect(log[1].message).toBe('Second');
        expect(log[2].message).toBe('Third');
    });

    it('should return entries in chronological order from GET', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'note', message: 'First', timestamp: 1000 },
            { type: 'note', message: 'Second', timestamp: 2000 },
            { type: 'note', message: 'Third', timestamp: 3000 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.body).toHaveLength(3);
        expect(res.body[0].timestamp).toBe(1000);
        expect(res.body[1].timestamp).toBe(2000);
        expect(res.body[2].timestamp).toBe(3000);
    });
});

// ─── Manual-author gate (owner ruling 2026-11-21) ────────────────────────────
// note/narrative compose rows name a real author, never Anonymous; the GM tab
// (localhost Host) may post as GM / any player / any initiative creature; a
// network origin may post ONLY as a player on the roster. Automated rows keep
// their existing visitor-writable shared-table shapes untouched.

const NO_AUTHOR_COPY = 'Log notes and narrative rows must name an author (the GM, a player, or an initiative creature) — Anonymous posting is not allowed';

describe('POST /log — manual-author gate', () => {
    it('GM origin: note as GM, as a creature, and narrative rows all land', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();

        const gmNote = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', 'localhost:80')
            .send({ type: 'note', characterName: 'GM', noteText: 'Goblins at the door' });
        const creatureNote = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', 'localhost:80')
            .send({ type: 'note', characterName: 'Goblin', noteText: 'Me want shiny' });
        const narrative = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', 'localhost:80')
            .send({ type: 'narrative', characterName: 'GM', description: 'The gate groans open…' });

        expect(gmNote.status).toBe(200);
        expect(creatureNote.status).toBe(200);
        expect(narrative.status).toBe(200);
        expect(narrative.body.description).toBe('The gate groans open…');
    });

    it.each([
        ['missing characterName', { type: 'note', noteText: 'hi' }],
        ['blank characterName', { type: 'note', characterName: '   ', noteText: 'hi' }],
        ['Anonymous (the retired default)', { type: 'note', characterName: 'Anonymous', noteText: 'hi' }],
        ['anonymous case-variants', { type: 'narrative', characterName: 'ANONYMOUS', description: 'hi' }],
    ])('400s a compose row with %s from any origin, zero side effects', async (_label, body) => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        const app = createTestApp();

        const asGm = await request(app).post('/api/campaigns/test-campaign/log').set('Host', 'localhost:80').send(body);
        const asVisitor = await request(app).post('/api/campaigns/test-campaign/log').set('Host', VISITOR_HOST).send(body);

        expect(asGm.status).toBe(400);
        expect(asGm.body).toEqual({ error: NO_AUTHOR_COPY });
        expect(asVisitor.status).toBe(400);
        expect(asVisitor.body).toEqual({ error: NO_AUTHOR_COPY });
        expect(logModule.logCache.get('test-campaign') || []).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('visitor origin: posts as a rostered player land (any player, no identity binding)', async () => {
        ensureCampaign('test-campaign');
        setRoster('test-campaign', ['Frodo', 'Aragorn']);
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', VISITOR_HOST)
            .send({ type: 'note', characterName: 'Aragorn', noteText: 'I am Aragorn, son of Arathorn' });

        expect(res.status).toBe(200);
        expect(res.body.characterName).toBe('Aragorn');
    });

    it.each([
        ['GM impersonation', 'GM'],
        ['creature attribution', 'Goblin'],
        ['off-roster name', 'Nobody'],
    ])('403s a visitor note posted as %s with plain-English copy', async (_label, author) => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        setRoster('test-campaign', ['Frodo', 'Aragorn']);
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', VISITOR_HOST)
            .send({ type: 'note', characterName: author, noteText: 'forged' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({
            error: `Visitors may post to the campaign log only as a player character — "${author}" is not on the "test-campaign" roster`,
        });
        expect(logModule.logCache.get('test-campaign') || []).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('403s a visitor narrative row the same way (the compose gate covers both types)', async () => {
        ensureCampaign('test-campaign');
        setRoster('test-campaign', ['Frodo']);
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', VISITOR_HOST)
            .send({ type: 'narrative', characterName: 'GM', description: 'Fake GM prose' });

        expect(res.status).toBe(403);
    });

    it('automated rows are NOT manual-author rows — a visitor chip-combat roll with a creature author still lands', async () => {
        ensureCampaign('test-campaign');
        setRoster('test-campaign', ['Frodo']);
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', VISITOR_HOST)
            .send({ type: 'roll', characterName: 'Goblin', rollType: 'attack', message: 'Goblin attacks Frodo with Scimitar: 15 +4 vs AC 15 — HIT' });

        expect(res.status).toBe(200);
        expect(res.body.characterName).toBe('Goblin');
    });

    it('visitor origin with an empty roster: every named author 403s (a character-less campaign has no player voice)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .set('Host', VISITOR_HOST)
            .send({ type: 'note', characterName: 'Frodo', noteText: 'hello?' });

        expect(res.status).toBe(403);
    });
});

// ─── Active-session stamp (log-as-memory, 2026-11-21) ────────────────────────

describe('POST /log — active-session stamp', () => {
    it('stamps every row with the campaign sessionState.name (server-side, every lane)', async () => {
        const { characterChangeData } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        characterChangeData.set('test-campaign', { sessionState: { phase: 'exploration', name: 'Session 3 — The Long Dark' } });
        const app = createTestApp();

        const compose = await request(app).post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', noteText: 'lantern out' });
        const automated = await request(app).post('/api/campaigns/test-campaign/log')
            .send({ type: 'roll', message: 'initiative 17' });

        expect(compose.body.session).toBe('Session 3 — The Long Dark');
        expect(automated.body.session).toBe('Session 3 — The Long Dark');
    });

    it('stamps null when no active session is tracked', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', noteText: 'no session yet' });

        expect(res.body.session).toBeNull();
    });

    it('a client-forged session field is overwritten — the server owns session attribution', async () => {
        const { characterChangeData } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        characterChangeData.set('test-campaign', { sessionState: { name: 'Real Session' } });
        const app = createTestApp();

        const res = await request(app).post('/api/campaigns/test-campaign/log')
            .send({ type: 'note', characterName: 'GM', noteText: 'forge try', session: 'Forged Session' });

        expect(res.body.session).toBe('Real Session');
        expect(logModule.logCache.get('test-campaign').at(-1).session).toBe('Real Session');
    });
});
