import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import createServerConfigRouter from './server-config.js';

function createTestApp(campaignLock) {
    const app = express();
    app.use(createServerConfigRouter(campaignLock));
    return app;
}

describe('server-config - GET /api/server-config', () => {
    it('reports the engaged lock with its campaign name', async () => {
        const res = await request(createTestApp('test-campaign')).get('/api/server-config');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ campaignLocked: true, lockedCampaign: 'test-campaign' });
    });

    it('reports no lock when CAMPAIGN_LOCK is unset (null)', async () => {
        const res = await request(createTestApp(null)).get('/api/server-config');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ campaignLocked: false });
    });
});
