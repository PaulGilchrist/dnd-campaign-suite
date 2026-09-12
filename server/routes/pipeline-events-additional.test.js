import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, markDirty } from '../utils/changeData.js';

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



describe('pipeline-events - POST invalid campaign names', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should reject POST for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/null/pipeline-event')
            .send({ key: 'damage:rolled' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid campaign name');
    });

    it('should reject POST for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/undefined/pipeline-event')
            .send({ key: 'damage:rolled' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid campaign name');
    });
});

describe('pipeline-events - POST overwrite and complex data', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should overwrite an existing event with the same key', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 10 } });

        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 20 } });

        const data = characterChangeData.get('test-campaign');
        expect(data['pipeline-test-campaign-damage:rolled']).toEqual({ total: 20 });
    });

    it('should store complex nested data objects', async () => {
        const app = createTestApp();
        const complexData = {
            total: 15,
            dice: '2d6',
            modifiers: { strength: 3, magic: 2 },
            targets: [
                { name: 'goblin', damage: 8 },
                { name: 'orc', damage: 7 },
            ],
        };

        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: complexData });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-damage:rolled']).toEqual(complexData);
    });

    it('should store array data', async () => {
        const app = createTestApp();
        const arrayData = ['action1', 'action2', 'action3'];

        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'turns:sequence', data: arrayData });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-turns:sequence']).toEqual(arrayData);
    });

    it('should store numeric data values', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'initiative:current', data: 7 });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-initiative:current']).toBe(7);
    });

    it('should store boolean data values', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'combat:started', data: true });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-combat:started']).toBe(true);
    });

    it('should store string data values', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'phase:current', data: 'combat' });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-phase:current']).toBe('combat');
    });
});

describe('pipeline-events - POST markDirty and initialization', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should auto-create the campaign entry in characterChangeData', async () => {
        const app = createTestApp();
        expect(characterChangeData.has('fresh-campaign')).toBe(false);

        await request(app)
            .post('/api/campaigns/fresh-campaign/pipeline-event')
            .send({ key: 'test:key', data: { value: 1 } });

        expect(characterChangeData.has('fresh-campaign')).toBe(true);
    });

    it('should call markDirty when storing an event', async () => {
        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled', data: { total: 10 } });

        expect(markDirty).toHaveBeenCalled();
    });
});

describe('pipeline-events - GET filtering edge cases', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should exclude non-pipeline keys from results', async () => {
        characterChangeData.set('test-campaign', {
            'pipeline-test-campaign-damage:rolled': { total: 15 },
            'combatSummary': { turn: 1 },
            'activeCreatureId': 'creature-1',
            'log': [],
            'otherRandomKey': 'value',
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0].key).toBe('pipeline-test-campaign-damage:rolled');
    });

    it('should return only events matching the campaign prefix in GET', async () => {
        characterChangeData.set('mixed-campaign', {
            'pipeline-mixed-campaign-attack:hit': { damage: 10 },
            'pipeline-mixed-campaign-attack:miss': {},
            'pipeline-other-campaign-attack:hit': { damage: 20 },
            'pipeline-mixed-campaign-other': { value: 42 },
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/mixed-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(3);

        const keys = res.body.events.map(e => e.key);
        expect(keys).toContain('pipeline-mixed-campaign-attack:hit');
        expect(keys).toContain('pipeline-mixed-campaign-attack:miss');
        expect(keys).toContain('pipeline-mixed-campaign-other');
        expect(keys).not.toContain('pipeline-other-campaign-attack:hit');
    });

    it('should return empty events when campaign exists but has no pipeline keys', async () => {
        characterChangeData.set('empty-campaign', {
            'combatSummary': { turn: 1 },
            'activeCreatureId': 'creature-1',
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/empty-campaign/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toEqual([]);
    });

    it('should handle campaign names with special characters in filtering', async () => {
        characterChangeData.set('campaign-123', {
            'pipeline-campaign-123-event:a': { value: 1 },
            'pipeline-campaign-123-event:b': { value: 2 },
            'pipeline-campaign-12-event:a': { value: 3 },
        });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/campaign-123/pipeline-events');

        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(2);

        const keys = res.body.events.map(e => e.key);
        expect(keys).toContain('pipeline-campaign-123-event:a');
        expect(keys).toContain('pipeline-campaign-123-event:b');
        expect(keys).not.toContain('pipeline-campaign-12-event:a');
    });
});

describe('pipeline-events - GET invalid campaign names', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should reject GET for campaign "undefined"', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/undefined/pipeline-events');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid campaign name');
    });

    it('should reject GET for campaign "null"', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/null/pipeline-events');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid campaign name');
    });
});

describe('pipeline-events - POST key validation edge cases', () => {
    afterEach(() => {
        clearPipelineStore();
    });

    it('should reject key with empty string', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: '', data: { value: 1 } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'key is required');
    });

    it('should accept key with special characters', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'damage:rolled:critical!', data: { total: 20 } });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        const expectedKey = 'pipeline-test-campaign-damage:rolled:critical!';
        expect(stored).toHaveProperty(expectedKey);
    });

    it('should accept key with colons', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'spell:slot:use:level:3', data: { remaining: 4 } });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored).toHaveProperty('pipeline-test-campaign-spell:slot:use:level:3');
    });

    it('should store event when data field is completely absent (not undefined)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/pipeline-event')
            .send({ key: 'flag:toggle' });

        expect(res.status).toBe(200);

        const stored = characterChangeData.get('test-campaign');
        expect(stored['pipeline-test-campaign-flag:toggle']).toEqual({});
    });
});
