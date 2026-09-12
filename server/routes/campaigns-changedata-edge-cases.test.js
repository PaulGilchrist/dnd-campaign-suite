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

describe('campaignsChangedata - Campaign name equals key edge cases', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
        clearChangeData();
    });

    it('should log error when GET key === campaign name', async () => {
        characterChangeData.set('my-campaign', { 'my-campaign': { data: 'value' } });
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/my-campaign/my-campaign');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ 'my-campaign': { data: 'value' } });
    });

    it('should log error when POST key === campaign name', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/my-campaign/my-campaign').send({ value: { data: 'new' } });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data saved successfully');
        expect(characterChangeData.get('my-campaign')['my-campaign']).toEqual({ data: 'new' });
    });

    it('should save data when key === campaign name (POST creates nested key)', async () => {
        characterChangeData.set('my-campaign', {});
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/my-campaign/my-campaign').send({ nested: true });
        expect(res.status).toBe(200);
        // body has no 'value' key, so value = req.body = { nested: true }
        // key 'my-campaign' is NOT in value, so first condition fails
        // Then { value: { nested: true } } check: 'value' in req.body is false, so falls to propertyValue = value = { nested: true }
        expect(characterChangeData.get('my-campaign')['my-campaign']).toEqual({ nested: true });
    });

    it('should extract value[key] when body is { key: value } and key === nestedKey', async () => {
        characterChangeData.set('my-campaign', {});
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/my-campaign/my-campaign').send({ 'my-campaign': { nested: true } });
        expect(res.status).toBe(200);
        // key 'my-campaign' IS in value, so propertyValue = value['my-campaign'] = { nested: true }
        expect(characterChangeData.get('my-campaign')['my-campaign']).toEqual({ nested: true });
    });
});

describe('campaignsChangedata - "campaign" key deprecation warnings', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(markDirty).mockClear();
        vi.mocked(publish).mockClear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        clearChangeData();
    });

    it('should return 400 with deprecation warning when GET key === "campaign"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/campaign');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Use /api/campaigns/:campaign/:key for campaign-level data');
    });

    it('should return 400 with deprecation warning when POST key === "campaign"', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/campaign').send({ value: { name: 'test' } });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Use /api/campaigns/:campaign/:key for campaign-level data');
    });

    it('should NOT save data when key === "campaign" (deprecated)', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();
        await request(app).post('/api/campaigns/test-campaign/campaign').send({ value: { name: 'test' } });
        expect(characterChangeData.get('test-campaign')).not.toHaveProperty('campaign');
    });

    it('should NOT call markDirty when key === "campaign" (deprecated)', async () => {
        const app = createTestApp();
        await request(app).post('/api/campaigns/test-campaign/campaign').send({ value: { name: 'test' } });
        expect(markDirty).not.toHaveBeenCalled();
    });

    it('should NOT call publish when key === "campaign" (deprecated)', async () => {
        const app = createTestApp();
        await request(app).post('/api/campaigns/test-campaign/campaign').send({ value: { name: 'test' } });
        expect(publish).not.toHaveBeenCalled();
    });
});
