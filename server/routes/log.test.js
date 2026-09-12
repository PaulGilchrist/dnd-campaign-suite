import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import logRouter from './log.js';
import * as logModule from './log.js';

const mockFsState = { exists: new Set(), files: new Map() };

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
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    readFileSync: vi.fn((p) => {
        if (mockFsState.files.has(p)) return mockFsState.files.get(p);
        throw new Error('ENOENT');
    }),
    writeFileSync: vi.fn((p, data) => {
        mockFsState.files.set(p, data);
    }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: vi.fn((name) => {
        mockFsState.exists.add(`/mock/campaigns/${name}/data`);
        return `/mock/campaigns/${name}/data`;
    }),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(logRouter);
    return app;
}

function ensureCampaign(campaign) {
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
}

afterEach(() => {
    clearLogCache();
    clearLogFiles();
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
            { type: 'combat', message: 'Encounter started', timestamp: Date.now() - 1000 },
            { type: 'combat', message: 'Goblin attacked', timestamp: Date.now() - 500 },
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
            entries.push({ type: 'test', message: `Entry ${i}`, timestamp: Date.now() - i });
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
            entries.push({ type: 'test', message: `Entry ${i}`, timestamp: Date.now() - i });
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
            { type: 'test', message: 'Cached entry', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        expect(logModule.logCache.has('test-campaign')).toBe(true);
        expect(logModule.logCache.get('test-campaign')).toHaveLength(1);
    });

    it('should use cached log on subsequent reads without re-reading file', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'test', message: 'Original', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        // Modify the file on disk after caching
        setLogFile('test-campaign', [
            { type: 'test', message: 'Original', timestamp: Date.now() },
            { type: 'test', message: 'New entry', timestamp: Date.now() },
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
                type: 'combat',
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
            type: 'combat',
            message: 'Dragon appeared',
            timestamp: timestamp,
            details: { creature: 'Red Dragon', hp: 250 },
        });
    });

    it('should handle different campaign names independently', async () => {
        ensureCampaign('campaign-a');
        ensureCampaign('campaign-b');
        setLogFile('campaign-a', [
            { type: 'test', message: 'Campaign A entry', timestamp: Date.now() },
        ]);
        setLogFile('campaign-b', [
            { type: 'test', message: 'Campaign B entry', timestamp: Date.now() },
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
            { type: 'test', message: 'Special campaign', timestamp: Date.now() },
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
            .send({ type: 'combat', message: 'Encounter started' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.id).toBe('string');
        expect(typeof res.body.timestamp).toBe('number');
        expect(res.body.type).toBe('combat');
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
            { type: 'combat', message: 'Previous entry', timestamp: Date.now() - 1000 },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'combat', message: 'New entry' });

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
            .send({ type: 'test', message: 'First' });

        const res2 = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'Second' });

        expect(res1.body.id).not.toBe(res2.body.id);
    });

    it('should generate a valid timestamp (Date.now())', async () => {
        ensureCampaign('test-campaign');
        const before = Date.now();
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'Timestamp test' });
        const after = Date.now();

        expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
        expect(res.body.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle empty request body', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('timestamp');
    });

    it('should handle null request body', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(null);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('timestamp');
    });

    it('should handle string request body', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send('plain text');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('should handle array request body', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send([1, 2, 3]);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('should handle nested objects in the entry', async () => {
        ensureCampaign('test-campaign');
        const nestedData = {
            type: 'combat',
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
            .send({ type: 'test', message: 'Cache test' });

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
            .send({ type: 'test', message: 'SSE test' });

        expect(publish).toHaveBeenCalledWith(
            'log-test-campaign',
            expect.objectContaining({
                type: 'test',
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
            .send({ type: 'test', message: 'Special' });

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
            .send({ type: 'test', message: 'Persistence test' });

        // Wait for the debounce timer
        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        expect(writeCalls.length).toBeGreaterThan(0);
        const lastCall = writeCalls[writeCalls.length - 1];
        expect(lastCall[0]).toBe('/mock/campaigns/test-campaign/data/campaign-log.json');
    });

    it('should only save the last 500 entries to disk', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');

        // Pre-populate cache with 510 entries
        const existingEntries = [];
        for (let i = 0; i < 510; i++) {
            existingEntries.push({ type: 'test', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        logModule.logCache.set('test-campaign', existingEntries);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'New entry' });

        // Wait for debounce
        await new Promise((r) => setTimeout(r, 1100));

        const writeCalls = fsMock.default.writeFileSync.mock.calls;
        const lastCall = writeCalls[writeCalls.length - 1];
        const writtenData = JSON.parse(lastCall[1]);
        expect(writtenData).toHaveLength(500);
        expect(writtenData[0].message).toBe('Entry 11');
        expect(writtenData[499].message).toBe('New entry');
    });

    it('should write valid JSON to the file', async () => {
        const fsMock = await import('fs');
        ensureCampaign('test-campaign');
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'Valid JSON' });

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
            .send({ type: 'test', message: 'Indented' });

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
            entries.push({ type: 'test', message: `Entry ${i}`, timestamp: Date.now() - i });
        }
        setLogFile('test-campaign', entries);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.body).toHaveLength(500);
    });
});

// ─── Cache behavior ──────────────────────────────────────────────────────────

describe('Cache behavior', () => {
    it('should return cached entries on subsequent GET requests', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'test', message: 'Cached', timestamp: Date.now() },
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/test-campaign/log');

        // Modify file on disk
        setLogFile('test-campaign', [
            { type: 'test', message: 'Cached', timestamp: Date.now() },
            { type: 'test', message: 'Not cached', timestamp: Date.now() },
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
        setLogFile('campaign-a', [{ type: 'test', message: 'A', timestamp: Date.now() }]);
        setLogFile('campaign-b', [{ type: 'test', message: 'B', timestamp: Date.now() }]);

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
            .send({ type: 'test', message: longMessage });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(longMessage);
    });

    it('should handle entries with unicode characters', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: '🐉 Dragon appeared! 日本語 テスト' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('🐉 Dragon appeared! 日本語 テスト');
    });

    it('should handle entries with emoji', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'combat', message: '⚔️ Battle started 🛡️' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('⚔️ Battle started 🛡️');
    });

    it('should handle entries with special JSON characters', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'Line 1\nLine 2\tTab "quotes" \'apostrophe\'' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Line 1\nLine 2\tTab "quotes" \'apostrophe\'');
    });

    it('should handle entries with boolean, number, and null values', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({
                type: 'test',
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

    it('should handle entries with empty string fields', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: '', message: '', details: '' });

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('');
        expect(res.body.message).toBe('');
    });

    it('should allow entry to provide its own timestamp (spread merges after generated fields)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const customTimestamp = 9999999;
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ type: 'test', message: 'Custom time', timestamp: customTimestamp });

        expect(res.status).toBe(200);
        // The spread operator ...entry comes after id/timestamp, so entry's timestamp wins
        expect(res.body.timestamp).toBe(customTimestamp);
    });

    it('should allow entry to provide its own id (spread merges after generated fields)', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ id: 'my-custom-id', type: 'test', message: 'Custom id' });

        expect(res.status).toBe(200);
        // The spread operator ...entry comes after id/timestamp, so entry's id wins
        expect(res.body.id).toBe('my-custom-id');
    });
});

// ─── Multiple entries ordering ───────────────────────────────────────────────

describe('Entry ordering', () => {
    it('should maintain insertion order in the log', async () => {
        ensureCampaign('test-campaign');
        const app = createTestApp();

        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'test', message: 'First' });
        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'test', message: 'Second' });
        await request(app).post('/api/campaigns/test-campaign/log').send({ type: 'test', message: 'Third' });

        const log = logModule.logCache.get('test-campaign');
        expect(log).toHaveLength(3);
        expect(log[0].message).toBe('First');
        expect(log[1].message).toBe('Second');
        expect(log[2].message).toBe('Third');
    });

    it('should return entries in chronological order from GET', async () => {
        ensureCampaign('test-campaign');
        setLogFile('test-campaign', [
            { type: 'test', message: 'First', timestamp: 1000 },
            { type: 'test', message: 'Second', timestamp: 2000 },
            { type: 'test', message: 'Third', timestamp: 3000 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.body).toHaveLength(3);
        expect(res.body[0].timestamp).toBe(1000);
        expect(res.body[1].timestamp).toBe(2000);
        expect(res.body[2].timestamp).toBe(3000);
    });
});
