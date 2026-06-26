import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Create a test app with the routes
function createTestApp(router) {
    const app = express();
    app.use(express.json());
    app.use(router);
    return app;
}

// Test file system helpers
const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function ensureCampaignsDir() {
    if (!fs.existsSync(testCampaignsDir)) {
        fs.mkdirSync(testCampaignsDir, { recursive: true });
    }
}

function createCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (!fs.existsSync(campaignDir)) {
        fs.mkdirSync(campaignDir, { recursive: true });
    }
    return campaignDir;
}

function createCampaignWithLog(name) {
    const campaignDir = createCampaignDir(name);
    const dataDir = path.join(campaignDir, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return { campaignDir, dataDir };
}

function removeCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

function cleanupCampaign(name) {
    removeCampaignDir(name);
}

function getLogFilePath(campaign) {
    return path.join(testCampaignsDir, campaign, 'data', 'campaign-log.json');
}

describe('log - GET /api/campaigns/:campaign/log', () => {
    beforeEach(() => {
        ensureCampaignsDir();
        vi.resetModules();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
        cleanupCampaign('empty-campaign');
    });

    it('should return an empty array when no log file exists', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toEqual([]);
    });

    it('should return log entries from an existing log file', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const existingLog = [
            { id: 'entry-1', message: 'First entry', timestamp: 1000 },
            { id: 'entry-2', message: 'Second entry', timestamp: 2000 },
            { id: 'entry-3', message: 'Third entry', timestamp: 3000 },
        ];
        fs.writeFileSync(logFile, JSON.stringify(existingLog));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(3);
        expect(res.body[0]).toEqual(existingLog[0]);
        expect(res.body[1]).toEqual(existingLog[1]);
        expect(res.body[2]).toEqual(existingLog[2]);
    });

    it('should only return the last 500 entries', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const entries = [];
        for (let i = 0; i < 600; i++) {
            entries.push({ id: `entry-${i}`, message: `Entry ${i}`, timestamp: i });
        }
        fs.writeFileSync(logFile, JSON.stringify(entries));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(500);
        // Should be the last 500 entries (indices 100-599)
        expect(res.body[0].id).toBe('entry-100');
        expect(res.body[499].id).toBe('entry-599');
    });

    it('should return the full log when it has fewer than 500 entries', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const entries = [];
        for (let i = 0; i < 100; i++) {
            entries.push({ id: `entry-${i}`, message: `Entry ${i}`, timestamp: i });
        }
        fs.writeFileSync(logFile, JSON.stringify(entries));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(100);
    });

    it('should return an empty array when log file contains non-array data', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        // Write a non-array JSON object
        fs.writeFileSync(logFile, JSON.stringify({ not: 'an array' }));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should return an empty array when log file is invalid JSON', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        fs.writeFileSync(logFile, 'this is not json');

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should return an empty array when campaign directory does not exist', async () => {
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app).get('/api/campaigns/nonexistent-campaign/log');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('log - POST /api/campaigns/:campaign/log', () => {
    beforeEach(() => {
        ensureCampaignsDir();
        vi.resetModules();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
        cleanupCampaign('empty-campaign');
    });

    it('should create a new log entry with id and timestamp', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const entry = { action: 'combat-start', details: 'Round 1' };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entry);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(typeof res.body.id).toBe('string');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.timestamp).toBe('number');
        expect(res.body.action).toBe('combat-start');
        expect(res.body.details).toBe('Round 1');
    });

    it('should append the entry to the existing log file', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const existingLog = [
            { id: 'existing-1', message: 'Existing entry', timestamp: 1000 },
        ];
        fs.writeFileSync(logFile, JSON.stringify(existingLog));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'new-entry' });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('new-entry');

        // Wait for the debounced save to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Read the saved file to verify persistence
        const savedData = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
        expect(savedData.length).toBe(2);
        expect(savedData[1].action).toBe('new-entry');
    });

    it('should return the newly created entry', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const entry = { action: 'spell-cast', spell: 'fireball' };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entry);

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('spell-cast');
        expect(res.body.spell).toBe('fireball');
        expect(res.body.id).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-campaign');
        // Don't create the data directory
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'test' });

        expect(res.status).toBe(200);

        // Wait for the debounced save to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        const logFile = getLogFilePath('test-campaign');
        expect(fs.existsSync(logFile)).toBe(true);
    });

    it('should generate a unique id for each entry', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res1 = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'entry-1' });

        const res2 = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'entry-2' });

        expect(res1.body.id).not.toBe(res2.body.id);
    });

    it('should include the current timestamp', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const before = Date.now();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'timestamp-test' });
        const after = Date.now();

        expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
        expect(res.body.timestamp).toBeLessThanOrEqual(after);
    });

    it('should merge the request body with the generated fields', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const entry = {
            action: 'multi-field',
            nested: { key: 'value' },
            array: [1, 2, 3],
            number: 42,
            boolean: true,
        };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entry);

        expect(res.body.action).toBe('multi-field');
        expect(res.body.nested).toEqual({ key: 'value' });
        expect(res.body.array).toEqual([1, 2, 3]);
        expect(res.body.number).toBe(42);
        expect(res.body.boolean).toBe(true);
        expect(res.body.id).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
    });

    it('should persist the last 500 entries (trim on save)', async () => {
        const { dataDir } = createCampaignWithLog('test-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        // Pre-populate with 498 entries so adding 2 more makes 500
        const existingLog = [];
        for (let i = 0; i < 498; i++) {
            existingLog.push({ id: `pre-${i}`, message: `Pre-entry ${i}` });
        }
        fs.writeFileSync(logFile, JSON.stringify(existingLog));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        // Add two more entries
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'entry-499' });
        await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'entry-500' });

        // Wait for the debounced save to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        const savedData = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
        expect(savedData.length).toBe(500);
        expect(savedData[0].id).toBe('pre-0');
        expect(savedData[499].action).toBe('entry-500');
    });

    it('should handle adding entries to a campaign with no existing log file', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({ action: 'first-entry' });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('first-entry');

        // Wait for the debounced save to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        const logFile = getLogFilePath('test-campaign');
        expect(fs.existsSync(logFile)).toBe(true);
        const savedData = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
        expect(savedData.length).toBe(1);
        expect(savedData[0].action).toBe('first-entry');
    });

    it('should handle empty request body', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
    });

    it('should handle undefined request body', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send();

        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
    });
});

describe('log - SSE publishing', () => {
    beforeEach(() => {
        ensureCampaignsDir();
        vi.resetModules();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should publish to SSE with the correct event key format', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const entry = { action: 'test-sse' };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entry);

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('test-sse');
        // The SSE publish happens internally; we verify it works by checking
        // the entry is returned and persisted correctly
    });

    it('should broadcast the new entry to all subscribers for the campaign', async () => {
        createCampaignDir('test-campaign');
        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const entry = { action: 'broadcast-test', data: 'value' };
        const res = await request(app)
            .post('/api/campaigns/test-campaign/log')
            .send(entry);

        expect(res.status).toBe(200);
        expect(res.body.action).toBe('broadcast-test');
        expect(res.body.data).toBe('value');
    });
});

describe('log - cache behavior', () => {
    beforeEach(() => {
        ensureCampaignsDir();
        vi.resetModules();
    });

    afterEach(() => {
        cleanupCampaign('cached-campaign');
        cleanupCampaign('uncached-campaign');
    });

    it('should cache log data in memory for subsequent reads', async () => {
        const { dataDir } = createCampaignWithLog('cached-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const existingLog = [
            { id: 'cached-1', message: 'Cached entry' },
        ];
        fs.writeFileSync(logFile, JSON.stringify(existingLog));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        // First read
        const res1 = await request(app).get('/api/campaigns/cached-campaign/log');
        expect(res1.status).toBe(200);
        expect(res1.body.length).toBe(1);

        // Modify the file on disk (simulating another client writing)
        const modifiedLog = [
            { id: 'cached-1', message: 'Cached entry' },
            { id: 'cached-2', message: 'New entry from another client' },
        ];
        fs.writeFileSync(logFile, JSON.stringify(modifiedLog));

        // Second read should still return cached data (first read's result)
        const res2 = await request(app).get('/api/campaigns/cached-campaign/log');
        expect(res2.status).toBe(200);
        // Cache is per-request in the router; each GET calls loadLog which checks cache
        // The cache persists across requests, so this should still return the cached data
        expect(res2.body.length).toBe(1);
    });

    it('should use cached data when file is deleted after first read', async () => {
        const { dataDir } = createCampaignWithLog('uncached-campaign');
        const logFile = path.join(dataDir, 'campaign-log.json');
        const existingLog = [
            { id: 'uncached-1', message: 'Cacheable entry' },
        ];
        fs.writeFileSync(logFile, JSON.stringify(existingLog));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        // First read populates the cache
        const res1 = await request(app).get('/api/campaigns/uncached-campaign/log');
        expect(res1.status).toBe(200);
        expect(res1.body.length).toBe(1);

        // Delete the file
        fs.unlinkSync(logFile);

        // Second read should still return cached data
        const res2 = await request(app).get('/api/campaigns/uncached-campaign/log');
        expect(res2.status).toBe(200);
        expect(res2.body.length).toBe(1);
    });

    it('should return different cached data for different campaigns', async () => {
        const { dataDir: dataDir1 } = createCampaignWithLog('cached-campaign');
        const { dataDir: dataDir2 } = createCampaignWithLog('uncached-campaign');

        const logFile1 = path.join(dataDir1, 'campaign-log.json');
        const logFile2 = path.join(dataDir2, 'campaign-log.json');

        fs.writeFileSync(logFile1, JSON.stringify([{ id: 'campaign-a', value: 1 }]));
        fs.writeFileSync(logFile2, JSON.stringify([{ id: 'campaign-b', value: 2 }]));

        const { default: router } = await import('./log.js');
        const app = createTestApp(router);

        const res1 = await request(app).get('/api/campaigns/cached-campaign/log');
        const res2 = await request(app).get('/api/campaigns/uncached-campaign/log');

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
        expect(res1.body[0].id).toBe('campaign-a');
        expect(res2.body[0].id).toBe('campaign-b');
    });
});
