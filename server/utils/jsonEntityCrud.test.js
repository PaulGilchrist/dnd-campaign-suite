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
// Basic CRUD — default options (entityName='testentities')
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - basic CRUD with defaults', () => {
    const entityName = 'testentities';
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, entityName);
        removeCampaignDir(campaign);
    });

    // GET list
    describe('GET /api/campaigns/:campaign/testentities', () => {
        it('should create the file and return empty array when it does not exist', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('testentities');
            expect(Array.isArray(res.body.testentities)).toBe(true);
            expect(res.body.testentities).toEqual([]);
            expect(mockFsState.has(dataFileFor(campaign, entityName))).toBe(true);
        });

        it('should return all entities when file exists', async () => {
            const entities = [
                { id: 'e1', name: 'Entity One' },
                { id: 'e2', name: 'Entity Two' },
            ];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);

            expect(res.status).toBe(200);
            expect(res.body.testentities).toHaveLength(2);
            expect(res.body.testentities[0].name).toBe('Entity One');
            expect(res.body.testentities[1].name).toBe('Entity Two');
        });

        it('should return empty array when file contains non-array data', async () => {
            const filePath = dataFileFor(campaign, entityName);
            ensureCampaignDir(campaign);
            mockFsState.set(filePath, JSON.stringify({ not: 'an array' }));

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);

            expect(res.status).toBe(200);
            expect(res.body.testentities).toEqual([]);
        });

        it('should return empty array when file contains null', async () => {
            const filePath = dataFileFor(campaign, entityName);
            ensureCampaignDir(campaign);
            mockFsState.set(filePath, JSON.stringify(null));

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);

            expect(res.status).toBe(200);
            expect(res.body.testentities).toEqual([]);
        });

        it('should return the correct response wrapper key', async () => {
            const entities = [{ id: 'e1', name: 'Entity One' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}`);

            expect(Object.keys(res.body)).toEqual(['testentities']);
        });
    });

    // POST overwrite
    describe('POST /api/campaigns/:campaign/testentities', () => {
        it('should save entities and return success', async () => {
            const entities = [
                { id: 'e1', name: 'Entity One' },
                { id: 'e2', name: 'Entity Two' },
            ];
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: entities });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('Entity One');
        });

        it('should overwrite existing entities', async () => {
            const existing = [{ id: 'old', name: 'Old Entity' }];
            writeEntities(campaign, entityName, existing);

            const newEntities = [{ id: 'new', name: 'New Entity' }];
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: newEntities });

            expect(res.status).toBe(200);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('New Entity');
        });

        it('should save an empty array', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: [] });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toEqual([]);
        });

        it('should return 400 when body does not contain an array', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: 'not an array' });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Expected an array for testentities');
        });

        it('should return 400 when body is missing the entity key', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ otherKey: [] });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Expected an array for testentities');
        });

        it('should return 400 when entity value is null', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: null });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Expected an array for testentities');
        });

        it('should return 400 when entity value is an object', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app)
                .post(`/api/campaigns/${campaign}/${entityName}`)
                .send({ testentities: { id: 'e1' } });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Expected an array for testentities');
        });
    });

    // GET by id
    describe('GET /api/campaigns/:campaign/testentities/:id', () => {
        it('should return 404 when file does not exist', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'testentity not found');
        });

        it('should return 404 when entity with given id does not exist', async () => {
            const entities = [{ id: 'e1', name: 'Entity One' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/nonexistent`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'testentity not found');
        });

        it('should return the entity when found', async () => {
            const entities = [{ id: 'e1', name: 'Entity One', value: 42 }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('testentity');
            expect(res.body.testentity).toEqual({ id: 'e1', name: 'Entity One', value: 42 });
        });

        it('should return the correct item wrapper key', async () => {
            const entities = [{ id: 'e1', name: 'Entity One' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(Object.keys(res.body)).toEqual(['testentity']);
        });

        it('should handle URL-encoded ids', async () => {
            const entities = [{ id: 'e/1', name: 'Encoded ID Entity' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).get(`/api/campaigns/${campaign}/${entityName}/e%2F1`);

            expect(res.status).toBe(200);
            expect(res.body.testentity.name).toBe('Encoded ID Entity');
        });
    });

    // DELETE by id
    describe('DELETE /api/campaigns/:campaign/testentities/:id', () => {
        it('should return 404 when file does not exist', async () => {
            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'testentity not found');
        });

        it('should delete the entity and return success', async () => {
            const entities = [
                { id: 'e1', name: 'Keep Me' },
                { id: 'e2', name: 'Delete Me' },
            ];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/e2`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('Keep Me');
        });

        it('should return success when deleting non-existent entity (no-op)', async () => {
            const entities = [{ id: 'e1', name: 'Entity One' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/nonexistent`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(1);
        });

        it('should remove only the matching entity', async () => {
            const entities = [
                { id: 'e1', name: 'First' },
                { id: 'e2', name: 'Second' },
                { id: 'e3', name: 'Third' },
            ];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/e2`);

            expect(res.status).toBe(200);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(2);
            expect(stored.map(e => e.name)).toEqual(['First', 'Third']);
        });

        it('should handle deleting the only entity', async () => {
            const entities = [{ id: 'e1', name: 'Only Entity' }];
            writeEntities(campaign, entityName, entities);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(res.status).toBe(200);

            const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, entityName)));
            expect(stored).toHaveLength(0);
        });

        it('should handle deleting from empty array', async () => {
            writeEntities(campaign, entityName, []);

            const router = createJsonEntityRouter(entityName);
            const app = createTestApp(router);
            const res = await request(app).delete(`/api/campaigns/${campaign}/${entityName}/e1`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });
});

// ---------------------------------------------------------------------------
// Custom options: idField, responseWrapper, itemWrapper
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - custom options', () => {
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'myitems');
        removeCampaignDir(campaign);
    });

    it('should use a custom idField for lookups', async () => {
        const router = createJsonEntityRouter('myitems', { idField: 'code' });
        const app = createTestApp(router);

        const entities = [{ code: 'SKU-001', name: 'Widget' }];
        writeEntities(campaign, 'myitems', entities);

        const res = await request(app).get(`/api/campaigns/${campaign}/myitems/SKU-001`);
        expect(res.status).toBe(200);
        expect(res.body.myitem).toEqual({ code: 'SKU-001', name: 'Widget' });
    });

    it('should use a custom responseWrapper for list responses', async () => {
        const router = createJsonEntityRouter('myitems', { responseWrapper: 'items' });
        const app = createTestApp(router);

        writeEntities(campaign, 'myitems', [{ id: 'i1', name: 'Item' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/myitems`);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['items']);
    });

    it('should use a custom itemWrapper for single-item responses', async () => {
        const router = createJsonEntityRouter('myitems', { itemWrapper: 'item' });
        const app = createTestApp(router);

        writeEntities(campaign, 'myitems', [{ id: 'i1', name: 'Item' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/myitems/i1`);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['item']);
    });

    it('should combine custom responseWrapper and itemWrapper', async () => {
        const router = createJsonEntityRouter('myitems', {
            responseWrapper: 'catalog',
            itemWrapper: 'catalogEntry',
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'myitems', [{ id: 'i1', name: 'Item' }]);

        const listRes = await request(app).get(`/api/campaigns/${campaign}/myitems`);
        expect(listRes.status).toBe(200);
        expect(Object.keys(listRes.body)).toEqual(['catalog']);

        const itemRes = await request(app).get(`/api/campaigns/${campaign}/myitems/i1`);
        expect(itemRes.status).toBe(200);
        expect(Object.keys(itemRes.body)).toEqual(['catalogEntry']);
    });
});

// ---------------------------------------------------------------------------
// singularize helper behavior via displayName options
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - singularize and displayName', () => {
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'npcs');
        cleanupCampaign(campaign, 'categories');
        cleanupCampaign(campaign, 'entities');
        removeCampaignDir(campaign);
    });

    it('should use default singularize for plural ending in s (entities -> entity)', async () => {
        const router = createJsonEntityRouter('entities');
        const app = createTestApp(router);

        writeEntities(campaign, 'entities', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/entities/nonexistent`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('entity not found');
    });

    it('should use default singularize for plural ending in ies (categories -> category)', async () => {
        const router = createJsonEntityRouter('categories');
        const app = createTestApp(router);

        writeEntities(campaign, 'categories', [{ id: 'c1', name: 'Category' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/categories/nonexistent`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('category not found');
    });

    it('should use default singularize for npcs -> npc', async () => {
        const router = createJsonEntityRouter('npcs');
        const app = createTestApp(router);

        writeEntities(campaign, 'npcs', [{ id: 'n1', name: 'NPC' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/npcs/nonexistent`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('npc not found');
    });

    it('should allow overriding singularDisplayName', async () => {
        const router = createJsonEntityRouter('entities', {
            singularDisplayName: 'Entity Record',
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'entities', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/entities/nonexistent`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Entity Record not found');
    });
});

// ---------------------------------------------------------------------------
// transformList option
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - transformList option', () => {
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'filtered');
        removeCampaignDir(campaign);
    });

    it('should apply transformList to GET list response', async () => {
        const router = createJsonEntityRouter('filtered', {
            transformList: (entities) => entities.filter(e => e.active),
        });
        const app = createTestApp(router);

        const entities = [
            { id: 'e1', name: 'Active', active: true },
            { id: 'e2', name: 'Inactive', active: false },
        ];
        writeEntities(campaign, 'filtered', entities);

        const res = await request(app).get(`/api/campaigns/${campaign}/filtered`);
        expect(res.status).toBe(200);
        expect(res.body.filtered).toHaveLength(1);
        expect(res.body.filtered[0].name).toBe('Active');
    });

    it('should pass the req object to transformList', async () => {
        const capturedReq = { _captured: false };
        const router = createJsonEntityRouter('filtered', {
            transformList: (entities, req) => {
                capturedReq._captured = true;
                capturedReq.campaign = req.params.campaign;
                return entities;
            },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'filtered', [{ id: 'e1', name: 'Entity' }]);

        await request(app).get(`/api/campaigns/${campaign}/filtered`);
        expect(capturedReq._captured).toBe(true);
        expect(capturedReq.campaign).toBe(campaign);
    });

    it('should not apply transformList to GET by id', async () => {
        const router = createJsonEntityRouter('filtered', {
            transformList: (entities) => entities.filter(e => e.active),
        });
        const app = createTestApp(router);

        const entities = [
            { id: 'e1', name: 'Active', active: true },
            { id: 'e2', name: 'Inactive', active: false },
        ];
        writeEntities(campaign, 'filtered', entities);

        const res = await request(app).get(`/api/campaigns/${campaign}/filtered/e2`);
        expect(res.status).toBe(200);
        expect(res.body.filtered).toEqual({ id: 'e2', name: 'Inactive', active: false });
    });
});

// ---------------------------------------------------------------------------
// authorizeRead option
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - authorizeRead option', () => {
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'secured');
        removeCampaignDir(campaign);
    });

    it('should return 403 when authorizeRead returns false', async () => {
        const router = createJsonEntityRouter('secured', {
            authorizeRead: () => false,
            forbiddenMessage: 'Forbidden',
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'secured', [{ id: 'e1', name: 'Secret' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/secured/e1`);
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    it('should allow access when authorizeRead returns true', async () => {
        const router = createJsonEntityRouter('secured', {
            authorizeRead: () => true,
            forbiddenMessage: 'Forbidden',
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'secured', [{ id: 'e1', name: 'Allowed' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/secured/e1`);
        expect(res.status).toBe(200);
        expect(res.body.secured).toEqual({ id: 'e1', name: 'Allowed' });
    });

    it('should pass entity and req to authorizeRead', async () => {
        let receivedEntity = null;
        let receivedCampaign = null;
        const router = createJsonEntityRouter('secured', {
            authorizeRead: (entity, req) => {
                receivedEntity = entity;
                receivedCampaign = req.params.campaign;
                return true;
            },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'secured', [{ id: 'e1', name: 'Passed Entity' }]);

        await request(app).get(`/api/campaigns/${campaign}/secured/e1`);
        expect(receivedEntity).toEqual({ id: 'e1', name: 'Passed Entity' });
        expect(receivedCampaign).toBe(campaign);
    });

    it('should not apply authorizeRead to GET list', async () => {
        const router = createJsonEntityRouter('secured', {
            authorizeRead: () => false,
            forbiddenMessage: 'Forbidden',
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'secured', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/secured`);
        expect(res.status).toBe(200);
        expect(res.body.secured).toHaveLength(1);
    });

    it('should use default forbiddenMessage when not specified', async () => {
        const router = createJsonEntityRouter('secured', {
            authorizeRead: () => false,
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'secured', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/secured/e1`);
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Access denied');
    });
});

// ---------------------------------------------------------------------------
// onDelete option
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - onDelete option', () => {
    const campaign = 'test-campaign-entities';
    let onDeleteCalls = [];

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'deletable');
        removeCampaignDir(campaign);
        onDeleteCalls = [];
    });

    it('should call onDelete with entity and campaign before removing from file', async () => {
        onDeleteCalls = [];
        const router = createJsonEntityRouter('deletable', {
            onDelete: (entity, campaignName) => {
                onDeleteCalls.push({ entity, campaignName });
            },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'deletable', [
            { id: 'e1', name: 'To Delete' },
            { id: 'e2', name: 'To Keep' },
        ]);

        const res = await request(app).delete(`/api/campaigns/${campaign}/deletable/e1`);
        expect(res.status).toBe(200);
        expect(onDeleteCalls).toHaveLength(1);
        expect(onDeleteCalls[0].entity).toEqual({ id: 'e1', name: 'To Delete' });
        expect(onDeleteCalls[0].campaignName).toBe(campaign);
    });

    it('should NOT call onDelete when entity is not found (no-op delete)', async () => {
        onDeleteCalls = [];
        const router = createJsonEntityRouter('deletable', {
            onDelete: (entity) => {
                onDeleteCalls.push(entity);
            },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'deletable', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).delete(`/api/campaigns/${campaign}/deletable/nonexistent`);
        expect(res.status).toBe(200);
        expect(onDeleteCalls).toHaveLength(0);
    });

    it('should still delete the entity from file when onDelete is provided', async () => {
        const router = createJsonEntityRouter('deletable', {
            onDelete: () => { /* side effect */ },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'deletable', [{ id: 'e1', name: 'To Delete' }]);

        await request(app).delete(`/api/campaigns/${campaign}/deletable/e1`);
        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign, "deletable")));
        expect(stored).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extraRoutes option
// ---------------------------------------------------------------------------

describe('jsonEntityCrud - extraRoutes option', () => {
    const campaign = 'test-campaign-entities';

    beforeEach(() => {
        ensureTestCampaignDir(campaign);
    });

    afterEach(() => {
        cleanupCampaign(campaign, 'extraroute');
        removeCampaignDir(campaign);
    });

    it('should register custom routes via extraRoutes', async () => {
        const router = createJsonEntityRouter('extraroute', {
            extraRoutes: (r) => {
                r.get('/api/campaigns/:campaign/extraroute-extra', (req, res) => {
                    res.json({ custom: true, campaign: req.params.campaign });
                });
            },
        });
        const app = createTestApp(router);

        const res = await request(app).get(`/api/campaigns/${campaign}/extraroute-extra`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ custom: true, campaign });
    });

    it('should allow extraRoutes to add POST endpoints', async () => {
        const router = createJsonEntityRouter('extraroute', {
            extraRoutes: (r) => {
                r.post('/api/campaigns/:campaign/extraroute-double', (req, res) => {
                    const { value } = req.body;
                    res.json({ doubled: value * 2 });
                });
            },
        });
        const app = createTestApp(router);

        const res = await request(app)
            .post(`/api/campaigns/${campaign}/extraroute-double`)
            .send({ value: 21 });

        expect(res.status).toBe(200);
        expect(res.body.doubled).toBe(42);
    });

    it('should not interfere with standard CRUD routes when extraRoutes is used', async () => {
        const router = createJsonEntityRouter('extraroute', {
            extraRoutes: (r) => {
                r.get('/api/campaigns/:campaign/extraroute-extra', (req, res) => {
                    res.json({ extra: true });
                });
            },
        });
        const app = createTestApp(router);

        writeEntities(campaign, 'extraroute', [{ id: 'e1', name: 'Entity' }]);

        const listRes = await request(app).get(`/api/campaigns/${campaign}/extraroute`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.extraroute).toHaveLength(1);

        const itemRes = await request(app).get(`/api/campaigns/${campaign}/extraroute/e1`);
        expect(itemRes.status).toBe(200);
        expect(itemRes.body.extraroute).toEqual({ id: 'e1', name: 'Entity' });
    });

    it('should work with empty extraRoutes (default)', async () => {
        const router = createJsonEntityRouter('extraroute');
        const app = createTestApp(router);

        writeEntities(campaign, 'extraroute', [{ id: 'e1', name: 'Entity' }]);

        const res = await request(app).get(`/api/campaigns/${campaign}/extraroute`);
        expect(res.status).toBe(200);
        expect(res.body.extraroute).toHaveLength(1);
    });
});


