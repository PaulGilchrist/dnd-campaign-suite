import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

// ---------------------------------------------------------------------------
// Mock filesystem
// ---------------------------------------------------------------------------

const mockFsState = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsState.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.set(path, true);
        }),
        rmSync: vi.fn((path) => {
            for (const key of [...mockFsState.keys()]) {
                if (key.startsWith(path)) mockFsState.delete(key);
            }
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsState.set(path, data);
        }),
        readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
        unlinkSync: vi.fn((path) => {
            mockFsState.delete(path);
        }),
    },
    existsSync: vi.fn((path) => mockFsState.has(path)),
    mkdirSync: vi.fn((path) => {
        mockFsState.set(path, true);
    }),
    rmSync: vi.fn((path) => {
        for (const key of [...mockFsState.keys()]) {
            if (key.startsWith(path)) mockFsState.delete(key);
        }
    }),
    writeFileSync: vi.fn((path, data) => {
        mockFsState.set(path, data);
    }),
    readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
    unlinkSync: vi.fn((path) => {
        mockFsState.delete(path);
    }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

// Clear mock filesystem state before every test to prevent cross-test contamination
beforeEach(() => {
    mockFsState.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestApp(router) {
    const app = express();
    app.use(express.json());
    app.use(router);
    return app;
}

function dataFileFor(campaign, entityName) {
    return `/mock/campaigns/${campaign}/data/${entityName}.json`;
}

function ensureCampaignDir(campaign) {
    const dir = `/mock/campaigns/${campaign}/data`;
    mockFsState.set(dir, true);
    return dir;
}

function writeEntities(campaign, entityName, entities) {
    const filePath = dataFileFor(campaign, entityName);
    ensureCampaignDir(campaign);
    mockFsState.set(filePath, JSON.stringify(entities, null, 2));
}

function removeEntitiesFile(campaign, entityName) {
    const filePath = dataFileFor(campaign, entityName);
    mockFsState.delete(filePath);
}

function cleanupCampaign(campaign, entityName) {
    removeEntitiesFile(campaign, entityName);
}

function removeCampaignDir(campaign) {
    const campaignDir = `/mock/campaigns/${campaign}`;
    for (const key of [...mockFsState.keys()]) {
        if (key.startsWith(campaignDir)) mockFsState.delete(key);
    }
}

function ensureTestCampaignDir(campaign) {
    ensureCampaignDir(campaign);
}

// ---------------------------------------------------------------------------
// Campaign isolation
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - campaign isolation', () => {
    const entityName = 'isolated';

    beforeEach(() => {
        ensureTestCampaignDir('test-campaign');
        ensureTestCampaignDir('test-campaign-b');
    });

    afterEach(() => {
        cleanupCampaign('test-campaign', entityName);
        cleanupCampaign('test-campaign-b', entityName);
        removeCampaignDir('test-campaign');
        removeCampaignDir('test-campaign-b');
    });

    it('should keep data separate between campaigns', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        writeEntities('test-campaign', entityName, [{ id: 'a1', name: 'Campaign A' }]);
        writeEntities('test-campaign-b', entityName, [{ id: 'b1', name: 'Campaign B' }]);

        const resA = await request(app).get('/api/campaigns/test-campaign/isolated');
        expect(resA.status).toBe(200);
        expect(resA.body.isolated).toHaveLength(1);
        expect(resA.body.isolated[0].name).toBe('Campaign A');

        const resB = await request(app).get('/api/campaigns/test-campaign-b/isolated');
        expect(resB.status).toBe(200);
        expect(resB.body.isolated).toHaveLength(1);
        expect(resB.body.isolated[0].name).toBe('Campaign B');
    });

    it('should allow same id in different campaigns', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        writeEntities('test-campaign', entityName, [{ id: 'same', name: 'A version' }]);
        writeEntities('test-campaign-b', entityName, [{ id: 'same', name: 'B version' }]);

        const resA = await request(app).get('/api/campaigns/test-campaign/isolated/same');
        expect(resA.status).toBe(200);
        expect(resA.body.isolated.name).toBe('A version');

        const resB = await request(app).get('/api/campaigns/test-campaign-b/isolated/same');
        expect(resB.status).toBe(200);
        expect(resB.body.isolated.name).toBe('B version');
    });
});

// ---------------------------------------------------------------------------
// File I/O behavior
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - file I/O behavior', () => {
    const entityName = 'fileio';
    const campaign = 'test-campaign';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, entityName);
        removeCampaignDir(campaign);
    });

    it('should create the data directory if it does not exist on first read', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);
        expect(res.status).toBe(200);
        expect(res.body[entityName]).toEqual([]);
        expect(mockFsState.has(dataFileFor(campaign, entityName))).toBe(true);
    });

    it('should preserve JSON formatting on write (pretty-printed)', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        const entities = [{ id: 'e1', name: 'Entity' }];
        await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ fileio: entities });

        const content = mockFsState.get(dataFileFor(campaign, entityName));
        expect(content).toContain('\n');
        expect(content).toContain('  ');
    });

    it('should handle entities with nested objects', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        const entities = [{
            id: 'e1',
            name: 'Complex',
            nested: { deep: { value: 42 } },
            array: [1, 2, 3],
        }];
        await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ fileio: entities });

        const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e1`);
        expect(res.status).toBe(200);
        expect(res.body.fileio.nested.deep.value).toBe(42);
        expect(res.body.fileio.array).toEqual([1, 2, 3]);
    });

    it('should handle entities with unicode characters', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        const entities = [{
            id: 'e1',
            name: '日本語テスト',
            emoji: '🎉🏰⚔️',
        }];
        await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ fileio: entities });

        const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e1`);
        expect(res.status).toBe(200);
        expect(res.body.fileio.name).toBe('日本語テスト');
        expect(res.body.fileio.emoji).toBe('🎉🏰⚔️');
    });
});

// ---------------------------------------------------------------------------
// Error handling: catch blocks in GET by id and DELETE
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - error handling in route handlers', () => {
    const campaign = 'test-campaign';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'errorentities');
        removeCampaignDir(campaign);
    });

    it('should throw on malformed JSON in GET by id route', async () => {
        const filePath = dataFileFor(campaign, 'errorentities');
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, 'not valid json {{{');

        const router = createJsonEntityRouter('errorentities');
        const app = createTestApp(router);

        const res = await request(app).get(`/api/campaigns/${campaign}/errorentities/e1`);
        // asyncHandler catches the thrown error and returns 500
        expect(res.status).toBe(500);
    });

    it('should throw on malformed JSON in DELETE route', async () => {
        const filePath = dataFileFor(campaign, 'errorentities');
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, '{invalid json}');

        const router = createJsonEntityRouter('errorentities');
        const app = createTestApp(router);

        const res = await request(app).delete(`/api/campaigns/${campaign}/errorentities/e1`);
        expect(res.status).toBe(500);
    });

    it('should throw on malformed JSON in GET list route', async () => {
        const filePath = dataFileFor(campaign, 'errorentities');
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, 'broken json');

        const router = createJsonEntityRouter('errorentities');
        const app = createTestApp(router);

        const res = await request(app).get(`/api/campaigns/${campaign}/errorentities`);
        expect(res.status).toBe(500);
    });

    it('should succeed on POST route with valid data', async () => {
        const router = createJsonEntityRouter('errorentities');
        const app = createTestApp(router);

        const entities = [{ id: 'e1', name: 'Entity' }];
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/errorentities`)
            .send({ errorentities: entities });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });
});

// ---------------------------------------------------------------------------
// Edge cases: entity names that affect routing
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - entity name variations', () => {
    const campaign = 'test-campaign';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'users');
        cleanupCampaign(campaign, 'aliases');
        removeCampaignDir(campaign);
    });

    it('should handle entity names ending in s (users -> user)', async () => {
        const router = createJsonEntityRouter('users');
        const app = createTestApp(router);

        writeEntities(campaign, 'users', [{ id: 'u1', name: 'User' }]);

        const listRes = await request(app).get(`/api/campaigns/${campaign}/users`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.users).toHaveLength(1);

        const itemRes = await request(app).get(`/api/campaigns/${campaign}/users/u1`);
        expect(itemRes.status).toBe(200);
        expect(Object.keys(itemRes.body)).toEqual(['user']);
    });

    it('should handle entity names ending in s but not ies (aliases -> aliase)', async () => {
        const router = createJsonEntityRouter('aliases');
        const app = createTestApp(router);

        writeEntities(campaign, 'aliases', [{ id: 'a1', name: 'Alias' }]);

        const listRes = await request(app).get(`/api/campaigns/${campaign}/aliases`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.aliases).toHaveLength(1);

        const itemRes = await request(app).get(`/api/campaigns/${campaign}/aliases/a1`);
        expect(itemRes.status).toBe(200);
        expect(Object.keys(itemRes.body)).toEqual(['aliase']);
    });

    it('should handle entity names ending in s (items -> item)', async () => {
        const router = createJsonEntityRouter('items');
        const app = createTestApp(router);

        writeEntities(campaign, 'items', [{ id: 'i1', name: 'Item' }]);

        const listRes = await request(app).get(`/api/campaigns/${campaign}/items`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.items).toHaveLength(1);

        const itemRes = await request(app).get(`/api/campaigns/${campaign}/items/i1`);
        expect(itemRes.status).toBe(200);
        expect(Object.keys(itemRes.body)).toEqual(['item']);
    });
});

// ---------------------------------------------------------------------------
// Integration: full CRUD cycle
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - full CRUD cycle', () => {
    const entityName = 'cycle';
    const campaign = 'test-campaign';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, entityName);
        removeCampaignDir(campaign);
    });

    it('should support create, read, update, delete cycle', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        // Create
        const entities = [{ id: 'c1', name: 'Created' }];
        const createRes = await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ cycle: entities });
        expect(createRes.status).toBe(200);

        // Read
        const readRes = await request(app).get(`/api/campaigns/${campaign}/${entityName}/c1`);
        expect(readRes.status).toBe(200);
        expect(readRes.body.cycle.name).toBe('Created');

        // Update (overwrite)
        const updated = [{ id: 'c1', name: 'Updated' }];
        const updateRes = await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ cycle: updated });
        expect(updateRes.status).toBe(200);

        // Verify update
        const verifyRes = await request(app).get(`/api/campaigns/${campaign}/${entityName}/c1`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.cycle.name).toBe('Updated');

        // Delete
        const deleteRes = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/c1`);
        expect(deleteRes.status).toBe(200);

        // Verify delete
        const afterDelete = await request(app).get(`/api/campaigns/${campaign}/${entityName}/c1`);
        expect(afterDelete.status).toBe(404);
    });

    it('should handle multiple operations in sequence', async () => {
        const router = createJsonEntityRouter(entityName);
        const app = createTestApp(router);

        // Create two entities
        await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ cycle: [
                { id: 'c1', name: 'First' },
                { id: 'c2', name: 'Second' },
            ] });

        // Read list
        let listRes = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.cycle).toHaveLength(2);

        // Delete one
        await request(app).delete(`/api/campaigns/${campaign}/${entityName}/c1`);

        // Verify one remains
        listRes = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.cycle).toHaveLength(1);
        expect(listRes.body.cycle[0].name).toBe('Second');

        // Add another
        await request(app)
            .post(`/api/campaigns/${campaign}/${entityName}`)
            .send({ cycle: [
                { id: 'c2', name: 'Second' },
                { id: 'c3', name: 'Third' },
            ] });

        // Verify final state
        listRes = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.cycle).toHaveLength(2);
        expect(listRes.body.cycle.map(e => e.name)).toEqual(['Second', 'Third']);
    });
});
