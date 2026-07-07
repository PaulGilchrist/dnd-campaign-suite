import request from 'supertest';
import express from 'express';
import { characterChangeData } from '../utils/changeData.js';

import pipelineEvents from './pipeline-events.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(pipelineEvents);
    return app;
}

function clearPipelineStore() {
    characterChangeData.forEach((data) => {
        const keysToRemove = [];
        for (const key of Object.keys(data)) {
            if (key.startsWith('pipeline-')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => delete data[k]);
    });
}

describe('pipeline-events - POST /api/campaigns/:campaign/pipeline-event', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should return 400 when key is missing', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('should record a pipeline event and return success message', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 15 } });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Pipeline event recorded');
    });

    it('should store the event in characterChangeData with correct key', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 15 } });

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('pipeline-test-campaign-damage:rolled');
        expect(data['pipeline-test-campaign-damage:rolled']).toEqual({ total: 15 });
    });

    it('should store event with empty data when data is missing', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'maneuvers:check' });

        expect(res.status).toBe(200);

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('pipeline-test-campaign-maneuvers:check');
        expect(data['pipeline-test-campaign-maneuvers:check']).toEqual({});
    });

    it('should store event with null data when data is null', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'pipeline:started', data: null });

        expect(res.status).toBe(200);

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('pipeline-test-campaign-pipeline:started');
        expect(data['pipeline-test-campaign-pipeline:started']).toEqual(null);
    });

    it('should broadcast via publish with correct key', async () => {
        const changeDataModule = await import('../utils/changeData.js');
        const publishSpy = vi.spyOn(changeDataModule, 'publish');

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/my-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 20 } });

        expect(publishSpy).toHaveBeenCalledWith(
            'pipeline-my-campaign-damage:rolled',
            { total: 20 }
        );

        publishSpy.mockRestore();
    });

    it('should handle invalid campaign names', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/undefined/pipeline-event')
            .send({ key: 'damage:rolled' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid campaign name');
    });

    it('should handle multiple events for the same campaign', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 10 } });

        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:applied', data: { total: 10 } });

        const data = characterChangeData.get('test-campaign');
        expect(data).toHaveProperty('pipeline-test-campaign-damage:rolled');
        expect(data).toHaveProperty('pipeline-test-campaign-damage:applied');
        expect(data['pipeline-test-campaign-damage:rolled']).toEqual({ total: 10 });
        expect(data['pipeline-test-campaign-damage:applied']).toEqual({ total: 10 });
    });

    it('should handle events from different campaigns independently', async () => {
        const app = createTestApp();

        await request(app)
            .post('/api/campaigns/campaign-a/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 5 } });

        await request(app)
            .post('/api/campaigns/campaign-b/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 15 } });

        const dataA = characterChangeData.get('campaign-a');
        const dataB = characterChangeData.get('campaign-b');

        expect(dataA['pipeline-campaign-a-damage:rolled']).toEqual({ total: 5 });
        expect(dataB['pipeline-campaign-b-damage:rolled']).toEqual({ total: 15 });
    });
});

describe('pipeline-events - GET /api/campaigns/:campaign/pipeline-events', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should return empty events array when campaign has no events', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('events');
        expect(res.body.events).toEqual([]);
    });

    it('should return empty events array for unknown campaign', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/unknown-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toEqual([]);
    });

    it('should return stored pipeline events for a campaign', async () => {
        characterChangeData.set('test-campaign', {
            'pipeline-test-campaign-damage:rolled': { total: 15 },
            'pipeline-test-campaign-damage:applied': { total: 15 },
            'otherKey': 'should be excluded',
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(2);

        const keys = res.body.events.map(e => e.key);
        expect(keys).toContain('pipeline-test-campaign-damage:rolled');
        expect(keys).toContain('pipeline-test-campaign-damage:applied');
        expect(keys).not.toContain('otherKey');
    });

    it('should return events with their values', async () => {
        characterChangeData.set('test-campaign', {
            'pipeline-test-campaign-damage:rolled': { total: 15, dice: '2d6' },
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0].key).toBe('pipeline-test-campaign-damage:rolled');
        expect(res.body.events[0].value).toEqual({ total: 15, dice: '2d6' });
    });

    it('should filter events by campaign prefix', async () => {
        characterChangeData.set('campaign-a', {
            'pipeline-campaign-a-damage:rolled': { total: 10 },
            'pipeline-campaign-b-damage:rolled': { total: 20 },
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/campaign-a/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0].key).toBe('pipeline-campaign-a-damage:rolled');
        expect(res.body.events[0].value.total).toBe(10);
    });
});
