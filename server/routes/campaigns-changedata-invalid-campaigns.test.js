import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData } from '../utils/changeData.js';
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

describe('campaignsChangedata - Invalid campaign rejection for positioning routes', () => {
    afterEach(clearChangeData);

    it('should reject GET positioning for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/undefined/positioning');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject GET positioning for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/null/positioning');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject POST positioning for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/undefined/positioning').send({ positioning: {} });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject POST positioning for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/null/positioning').send({ positioning: {} });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject DELETE for positioning with campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/undefined/positioning');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });

    it('should reject DELETE for positioning with campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/null/positioning');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid campaign name');
    });
});

describe('campaignsChangedata - Invalid campaign rejection for change-data route', () => {
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
});
