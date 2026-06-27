import request from 'supertest';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
}));

import { characterChangeData } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

// Clear the in-memory store between tests
function clearChangeData() {
    characterChangeData.clear();
}

describe('campaignsChangedata - Invalid campaign name rejection middleware', () => {
    afterEach(clearChangeData);

    it('should reject GET change-data for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/undefined/change-data');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject GET change-data for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/null/change-data');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject GET generic key for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/undefined/somekey');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject GET generic key for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/null/somekey');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject POST for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/undefined/somekey').send({ value: 'test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject POST for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/null/somekey').send({ value: 'test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should allow valid campaign names through', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/my-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });
});

describe('campaignsChangedata - GET /api/campaigns/:campaign/change-data', () => {
    afterEach(clearChangeData);

    it('should return empty object when campaign has no change data', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('should return the full change data object for a campaign', async () => {
        characterChangeData.set('test-campaign', { hp: 10, spells: ['fireball'] });
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ hp: 10, spells: ['fireball'] });
    });

    it('should return empty object for campaign not in store', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/unknown-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('should return complex nested data', async () => {
        const complexData = {
            character1: { hp: 25, maxHp: 30 },
            character2: { hp: 10, maxHp: 20, spellSlots: { level1: 3, level2: 1 } },
        };
        characterChangeData.set('complex-campaign', complexData);
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/complex-campaign/change-data');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(complexData);
    });
});

describe('campaignsChangedata - GET /api/campaigns/:campaign/:key', () => {
    beforeEach(() => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
            character2: { hp: 10 },
            combatSummary: { rounds: 5 },
        });
    });
    afterEach(clearChangeData);

    it('should return { value: null } when campaign has no data', async () => {
        characterChangeData.clear();
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/empty-campaign/somekey');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ value: null });
    });

    it('should return { value: null } when key does not exist in data', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/nonexistent');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ value: null });
    });

    it('should return the value for an existing key', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/character1');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ character1: { hp: 25 } });
    });

    it('should return the value for a complex key', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/combatSummary');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ combatSummary: { rounds: 5 } });
    });

    it('should delegate log key to next middleware', async () => {
        const app = express();
        app.use(express.json());
        let logHandlerCalled = false;
        app.use('/api/campaigns/:campaign/log', (req, res) => {
            logHandlerCalled = true;
            res.json({ fromLogHandler: true });
        });
        app.use(campaignsChangedata);

        const res = await request(app).get('/api/campaigns/test-campaign/log');
        expect(logHandlerCalled).toBe(true);
        expect(res.body).toEqual({ fromLogHandler: true });
    });
});

describe('campaignsChangedata - POST /api/campaigns/:campaign/:key', () => {
    afterEach(clearChangeData);

    it('should save a value to the in-memory store', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: { hp: 20 } });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data saved successfully');
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 20 });
    });

    it('should save value from req.body.value when present', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/hp').send({ value: 15 });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').hp).toBe(15);
    });

    it('should save entire req.body when value is not present', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ hp: 30, maxHp: 30 });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 30, maxHp: 30 });
    });

    it('should create the campaign entry if it does not exist', async () => {
        const app = createTestApp();
        expect(characterChangeData.has('test-campaign')).toBe(false);
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: { hp: 10 } });
        expect(res.status).toBe(200);
        expect(characterChangeData.has('test-campaign')).toBe(true);
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 10 });
    });

    it('should overwrite an existing key value', async () => {
        characterChangeData.set('test-campaign', { character1: { hp: 10 } });
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: { hp: 25 } });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 25 });
    });

    it('should delegate log key to next middleware', async () => {
        const app = express();
        app.use(express.json());
        let logHandlerCalled = false;
        app.use('/api/campaigns/:campaign/log', (req, res) => {
            logHandlerCalled = true;
            res.json({ fromLogHandler: true });
        });
        app.use(campaignsChangedata);

        const res = await request(app).post('/api/campaigns/test-campaign/log').send({ entry: 'test' });
        expect(logHandlerCalled).toBe(true);
        expect(res.body).toEqual({ fromLogHandler: true });
    });
});

describe('campaignsChangedata - DELETE /api/campaigns/:campaign/:key', () => {
    afterEach(clearChangeData);

    it('should remove a key from the change data store', async () => {
        characterChangeData.set('test-campaign', { character1: { hp: 25 }, character2: { hp: 10 } });
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/character1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data deleted successfully');
        expect(characterChangeData.get('test-campaign')).toEqual({ character2: { hp: 10 } });
    });

    it('should do nothing if campaign does not exist in store', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/nonexistent-campaign/somekey');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data deleted successfully');
    });

    it('should delegate log key to next middleware', async () => {
        const app = express();
        app.use(express.json());
        let logHandlerCalled = false;
        app.use('/api/campaigns/:campaign/log', (req, res) => {
            logHandlerCalled = true;
            res.json({ fromLogHandler: true });
        });
        app.use(campaignsChangedata);

        const res = await request(app).delete('/api/campaigns/test-campaign/log');
        expect(logHandlerCalled).toBe(true);
        expect(res.body).toEqual({ fromLogHandler: true });
    });

    it('should preserve other keys when deleting one', async () => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
            character2: { hp: 10 },
            combatSummary: { rounds: 5 },
        });
        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/character1');
        const data = characterChangeData.get('test-campaign');
        expect(data).not.toHaveProperty('character1');
        expect(data.character2).toEqual({ hp: 10 });
        expect(data.combatSummary).toEqual({ rounds: 5 });
    });
});
