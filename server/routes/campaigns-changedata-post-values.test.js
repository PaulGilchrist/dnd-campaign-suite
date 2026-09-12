import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

function clearChangeData() {
    characterChangeData.clear();
}

describe('campaignsChangedata - POST value extraction edge cases', () => {
    beforeEach(() => {
        vi.mocked(markDirty).mockClear();
        vi.mocked(publish).mockClear();
    });
    afterEach(clearChangeData);

    it('should save entire req.body as property value when no "value" key and key not in body', async () => {
        const app = createTestApp();
        const body = { hp: 30, maxHp: 30, ac: 18 };
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send(body);
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').character1).toEqual(body);
    });

    it('should extract value[key] when body contains both the key and a nested value', async () => {
        characterChangeData.set('test-campaign', { character1: { hp: 10 } });
        const app = createTestApp();
        const body = { character1: { hp: 25, maxHp: 25 } };
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send(body);
        expect(res.status).toBe(200);
        // When body has { character1: {...} }, the handler extracts value[key] = value['character1']
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 25, maxHp: 25 });
    });

    it('should extract value[key] when body has { value: fullStoreObject } and key exists in the object', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();
        const fullStoreObject = { character1: { hp: 30 }, otherKey: 'ignored' };
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: fullStoreObject });
        expect(res.status).toBe(200);
        // First condition: key is in value → extract value[key]
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 30 });
    });

    it('should unwrap { value: fullStoreObject } when body has only "value" key and key is NOT in the object', async () => {
        const app = createTestApp();
        // 'someOtherKey' is not in the object, so first condition fails
        const fullStoreObject = { hp: 20, maxHp: 20 };
        const res = await request(app).post('/api/campaigns/test-campaign/someOtherKey').send({ value: fullStoreObject });
        expect(res.status).toBe(200);
        // Second condition: { value: object } with only "value" key → unwrap directly
        expect(characterChangeData.get('test-campaign').someOtherKey).toEqual(fullStoreObject);
    });

    it('should extract value[key] before unwrapping { value: fullStoreObject }', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();
        const fullStoreObject = { character1: { hp: 30 }, otherKey: 'ignored' };
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: fullStoreObject });
        expect(res.status).toBe(200);
        // First condition: key is in value → extract value[key]
        expect(characterChangeData.get('test-campaign').character1).toEqual({ hp: 30 });
    });



    it('should save a string value from { value: string }', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/status').send({ value: 'healthy' });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').status).toBe('healthy');
    });

    it('should save a boolean value from { value: boolean }', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/isActive').send({ value: true });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').isActive).toBe(true);
    });

    it('should save an array value when sent as req.body directly', async () => {
        const app = createTestApp();
        const arr = ['spell1', 'spell2', 'spell3'];
        const res = await request(app).post('/api/campaigns/test-campaign/spellList').send(arr);
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').spellList).toEqual(arr);
    });

    it('should save a numeric value from { value: number }', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/hp').send({ value: 25 });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').hp).toBe(25);
    });

    it('should save an object from { value: object } when key is not in the object', async () => {
        const app = createTestApp();
        const obj = { hp: 20, maxHp: 20 };
        // 'character1' is not a key in obj, so the first condition fails
        // Then it checks if { value: obj } has only "value" key with object value → yes
        const res = await request(app).post('/api/campaigns/test-campaign/character1').send({ value: obj });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').character1).toEqual(obj);
    });
});
