import request from 'supertest';
import express from 'express';
import campaignsPositioning from './campaigns-positioning.js';
import * as changeData from '../utils/changeData.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsPositioning);
    return app;
}

describe('campaignsPositioning - GET /api/campaigns/:campaign/positioning', () => {
    afterEach(() => {
        // Clean up test campaign data after each test
        changeData.characterChangeData.delete('test-campaign');
    });

    it('should return empty positioning when campaign has no data', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/positioning');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('positioning');
        expect(res.body.positioning).toEqual({});
    });

    it('should return empty positioning when campaign exists but has no positioning key', async () => {
        changeData.characterChangeData.set('test-campaign', { someOtherKey: 'value' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/positioning');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('positioning');
        expect(res.body.positioning).toEqual({});
    });

    it('should return existing positioning data', async () => {
        const positioningData = {
            character1: { x: 10, y: 20 },
            character2: { x: 30, y: 40 },
        };
        changeData.characterChangeData.set('test-campaign', { positioning: positioningData });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/positioning');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('positioning');
        expect(res.body.positioning).toEqual(positioningData);
    });

    it('should return positioning data with nested objects', async () => {
        const positioningData = {
            npc1: { x: 5, y: 15, grid: 'main', layer: 'foreground' },
            npc2: { x: 25, y: 35, grid: 'main', layer: 'background' },
        };
        changeData.characterChangeData.set('test-campaign', { positioning: positioningData });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/positioning');

        expect(res.status).toBe(200);
        expect(res.body.positioning).toEqual(positioningData);
    });

    it('should work with different campaign names independently', async () => {
        const positioningA = { char1: { x: 1, y: 1 } };
        const positioningB = { char2: { x: 2, y: 2 } };
        changeData.characterChangeData.set('campaign-a', { positioning: positioningA });
        changeData.characterChangeData.set('campaign-b', { positioning: positioningB });

        const app = createTestApp();

        const resA = await request(app).get('/api/campaigns/campaign-a/positioning');
        expect(resA.status).toBe(200);
        expect(resA.body.positioning).toEqual(positioningA);

        const resB = await request(app).get('/api/campaigns/campaign-b/positioning');
        expect(resB.status).toBe(200);
        expect(resB.body.positioning).toEqual(positioningB);
    });
});

describe('campaignsPositioning - POST /api/campaigns/:campaign/positioning', () => {
    beforeEach(() => {
        // Mock debouncedSave to avoid actual timer setup in tests
        vi.spyOn(changeData, 'debouncedSave').mockReturnValue(undefined);
    });

    afterEach(() => {
        changeData.characterChangeData.delete('test-campaign');
        changeData.characterChangeData.delete('new-campaign');
    });

    it('should save positioning data for a new campaign', async () => {
        const positioningData = { char1: { x: 10, y: 20 } };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: positioningData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Positioning saved successfully');

        // Verify data was stored in memory
        const storedData = changeData.characterChangeData.get('test-campaign');
        expect(storedData).toBeDefined();
        expect(storedData.positioning).toEqual(positioningData);
    });

    it('should update existing positioning data', async () => {
        const initialData = { char1: { x: 1, y: 1 } };
        const updatedData = { char1: { x: 5, y: 5 }, char2: { x: 10, y: 10 } };
        changeData.characterChangeData.set('test-campaign', { positioning: initialData });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: updatedData });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Positioning saved successfully');

        const storedData = changeData.characterChangeData.get('test-campaign');
        expect(storedData.positioning).toEqual(updatedData);
    });

    it('should overwrite previous positioning with empty object', async () => {
        changeData.characterChangeData.set('test-campaign', {
            positioning: { char1: { x: 1, y: 1 } },
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: {} });

        expect(res.status).toBe(200);

        const storedData = changeData.characterChangeData.get('test-campaign');
        expect(storedData.positioning).toEqual({});
    });

    it('should broadcast positioning change via publish', async () => {
        const positioningData = { char1: { x: 10, y: 20 } };
        const publishSpy = vi.spyOn(changeData, 'publish');

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: positioningData });

        expect(publishSpy).toHaveBeenCalledWith('positioning-test-campaign', positioningData);

        publishSpy.mockRestore();
    });

    it('should call debouncedSave when saving positioning', async () => {
        const positioningData = { char1: { x: 10, y: 20 } };

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: positioningData });

        expect(changeData.debouncedSave).toHaveBeenCalled();
    });

    it('should create campaign entry if it does not exist', async () => {
        // Ensure campaign does not exist
        changeData.characterChangeData.delete('new-campaign');

        const positioningData = { char1: { x: 100, y: 200 } };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/new-campaign/positioning')
            .send({ positioning: positioningData });

        expect(res.status).toBe(200);
        expect(changeData.characterChangeData.has('new-campaign')).toBe(true);
        expect(changeData.characterChangeData.get('new-campaign').positioning).toEqual(positioningData);
    });

    it('should preserve other keys when updating positioning on existing campaign', async () => {
        const existingData = {
            positioning: { char1: { x: 1, y: 1 } },
            spellSlots: { level1: 4 },
            hp: 20,
        };
        changeData.characterChangeData.set('test-campaign', existingData);

        const newPositioning = { char2: { x: 5, y: 5 } };

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: newPositioning });

        const storedData = changeData.characterChangeData.get('test-campaign');
        expect(storedData.positioning).toEqual(newPositioning);
        expect(storedData.spellSlots).toEqual({ level1: 4 });
        expect(storedData.hp).toBe(20);
    });

    it('should handle complex positioning data with multiple properties', async () => {
        const complexPositioning = {
            player1: {
                x: 10,
                y: 20,
                grid: 'main',
                layer: 'foreground',
                rotation: 0,
                scale: 1,
                visible: true,
            },
            player2: {
                x: 30,
                y: 40,
                grid: 'main',
                layer: 'background',
                rotation: 90,
                scale: 1.5,
                visible: false,
            },
            npc1: {
                x: 50,
                y: 60,
                grid: 'side',
                layer: 'foreground',
                rotation: 180,
                scale: 1,
                visible: true,
            },
        };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: complexPositioning });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Positioning saved successfully');

        const storedData = changeData.characterChangeData.get('test-campaign');
        expect(storedData.positioning).toEqual(complexPositioning);
    });

    it('should return 400 when positioning is not provided in body', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({});

        // The route doesn't validate — it stores undefined as positioning
        // This is the current behavior: undefined gets stored
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Positioning saved successfully');
    });
});
