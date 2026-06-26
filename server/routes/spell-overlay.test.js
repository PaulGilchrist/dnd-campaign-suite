import request from 'supertest';
import express from 'express';
import { spellOverlayData } from '../utils/changeData.js';

// Import the route module after the store is available
import spellOverlay from './spell-overlay.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(spellOverlay);
    return app;
}

// Clean up the in-memory store between tests
function clearOverlayStore() {
    spellOverlayData.clear();
}

describe('spell-overlay - GET /spell-overlay', () => {
    afterEach(() => {
        clearOverlayStore();
    });

    it('should return 400 when campaign query param is missing', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spell-overlay');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('campaign query param required');
    });

    it('should return empty overlays array when campaign has no overlays', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spell-overlay?campaign=test-campaign');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('overlays');
        expect(Array.isArray(res.body.overlays)).toBe(true);
        expect(res.body.overlays).toEqual([]);
    });

    it('should return stored overlays for a campaign', async () => {
        spellOverlayData.set('test-campaign', [
            { id: 'overlay-1', name: 'Fireball', level: 3 },
            { id: 'overlay-2', name: 'Shield', level: 1 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/spell-overlay?campaign=test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.overlays).toHaveLength(2);
        expect(res.body.overlays[0].id).toBe('overlay-1');
        expect(res.body.overlays[1].id).toBe('overlay-2');
    });

    it('should return empty array for campaign that was never set', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spell-overlay?campaign=unknown-campaign');

        expect(res.status).toBe(200);
        expect(res.body.overlays).toEqual([]);
    });

    it('should handle overlays with complex data', async () => {
        const complexOverlay = {
            id: 'overlay-complex',
            name: 'Concentration Spell',
            level: 4,
            source: 'Class Feature',
            duration: 'Concentration, up to 1 minute',
            affectedCreatures: ['creature-1', 'creature-2'],
            modifiers: { acBonus: 2, saveDC: 15 },
        };
        spellOverlayData.set('complex-campaign', [complexOverlay]);

        const app = createTestApp();
        const res = await request(app).get('/spell-overlay?campaign=complex-campaign');

        expect(res.status).toBe(200);
        expect(res.body.overlays).toHaveLength(1);
        expect(res.body.overlays[0]).toEqual(complexOverlay);
    });
});

describe('spell-overlay - POST /spell-overlay', () => {
    afterEach(() => {
        clearOverlayStore();
    });

    it('should return 400 when campaign query param is missing', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/spell-overlay')
            .send({ action: 'add' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('campaign query param required');
    });

    it('should return 400 when campaign query param is empty', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/spell-overlay?campaign=')
            .send({ action: 'add' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('campaign query param required');
    });

    it('should return success for unknown action', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/spell-overlay?campaign=test-campaign')
            .send({ action: 'unknown-action' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });

    describe('add action', () => {
        it('should add a single overlay to an empty campaign', async () => {
            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [{ id: 'overlay-1', name: 'Fireball', level: 3 }],
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('ok', true);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('overlay-1');
            expect(stored[0].name).toBe('Fireball');
        });

        it('should add multiple overlays at once', async () => {
            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball', level: 3 },
                        { id: 'overlay-2', name: 'Shield', level: 1 },
                        { id: 'overlay-3', name: 'Mage Armor', level: 1 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(3);
        });

        it('should add overlays to an existing campaign that already has overlays', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [
                        { id: 'overlay-2', name: 'Shield', level: 1 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored.map(o => o.id)).toEqual(['overlay-1', 'overlay-2']);
        });

        it('should skip adding overlays with duplicate ids', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball Updated', level: 4 },
                        { id: 'overlay-2', name: 'Shield', level: 1 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored.map(o => o.id)).toEqual(['overlay-1', 'overlay-2']);
            // Original overlay data should be preserved (not replaced)
            expect(stored[0].name).toBe('Fireball');
            expect(stored[0].level).toBe(3);
        });

        it('should skip adding all overlays when all are duplicates', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball Updated', level: 4 },
                        { id: 'overlay-2', name: 'Shield Updated', level: 2 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('Fireball');
            expect(stored[1].name).toBe('Shield');
        });

        it('should do nothing when overlays array is empty', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: [],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('overlay-1');
        });

        it('should do nothing when overlays is undefined', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
        });

        it('should do nothing when overlays is null', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'add',
                    overlays: null,
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
        });

        it('should create the campaign entry if it does not exist yet', async () => {
            expect(spellOverlayData.has('new-campaign')).toBe(false);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=new-campaign')
                .send({
                    action: 'add',
                    overlays: [{ id: 'overlay-1', name: 'First Overlay' }],
                });

            expect(res.status).toBe(200);
            expect(spellOverlayData.has('new-campaign')).toBe(true);
            expect(spellOverlayData.get('new-campaign')).toHaveLength(1);
        });
    });

    describe('update action', () => {
        it('should update existing overlays by id', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball Updated', level: 4 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('Fireball Updated');
            expect(stored[0].level).toBe(4);
            // Unupdated overlay should remain unchanged
            expect(stored[1].name).toBe('Shield');
            expect(stored[1].level).toBe(1);
        });

        it('should replace all overlays when all ids match', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball V2', level: 5 },
                        { id: 'overlay-2', name: 'Shield V2', level: 2 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('Fireball V2');
            expect(stored[1].name).toBe('Shield V2');
        });

        it('should update existing overlays while keeping overlays not in the payload', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball Updated', level: 4 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored[0].name).toBe('Fireball Updated');
            expect(stored[0].level).toBe(4);
            // overlay-2 was not in the payload but should be kept
            expect(stored[1].name).toBe('Shield');
            expect(stored[1].level).toBe(1);
        });

        it('should not add new overlays that are not in existing list', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [
                        { id: 'overlay-1', name: 'Fireball Updated', level: 4 },
                        { id: 'overlay-3', name: 'New Overlay', level: 5 },
                    ],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            // overlay-3 is new, not in existing, so it should NOT be added
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe('overlay-1');
            expect(stored[0].name).toBe('Fireball Updated');
        });

        it('should do nothing when overlays array is empty', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [],
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
        });

        it('should do nothing when overlays is undefined', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
        });
    });

    describe('remove action', () => {
        it('should remove a single overlay by id', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
                { id: 'overlay-3', name: 'Mage Armor', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'overlay-2',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
            expect(stored.map(o => o.id)).toEqual(['overlay-1', 'overlay-3']);
        });

        it('should do nothing when overlayId does not match any overlay', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'nonexistent',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(2);
        });

        it('should do nothing when overlayId is missing', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(1);
        });

        it('should handle removing the last overlay', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'overlay-1',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toHaveLength(0);
            expect(stored).toEqual([]);
        });

        it('should handle removing from an empty overlay list', async () => {
            spellOverlayData.set('test-campaign', []);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'overlay-1',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toEqual([]);
        });

        it('should handle removing when campaign has no overlays', async () => {
            expect(spellOverlayData.has('test-campaign')).toBe(false);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'overlay-1',
                });

            expect(res.status).toBe(200);

            // Should create an empty array for the campaign
            expect(spellOverlayData.has('test-campaign')).toBe(true);
            expect(spellOverlayData.get('test-campaign')).toEqual([]);
        });
    });

    describe('clear action', () => {
        it('should clear all overlays for a campaign', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
                { id: 'overlay-3', name: 'Mage Armor', level: 1 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'clear',
                });

            expect(res.status).toBe(200);

            const stored = spellOverlayData.get('test-campaign');
            expect(stored).toEqual([]);
        });

        it('should clear even if campaign has no overlays yet', async () => {
            expect(spellOverlayData.has('test-campaign')).toBe(false);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'clear',
                });

            expect(res.status).toBe(200);

            expect(spellOverlayData.has('test-campaign')).toBe(true);
            expect(spellOverlayData.get('test-campaign')).toEqual([]);
        });

        it('should clear all overlays leaving the campaign key in the store', async () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const app = createTestApp();
            const res = await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'clear',
                });

            expect(res.status).toBe(200);

            // The campaign key should still exist in the Map (with empty array)
            expect(spellOverlayData.has('test-campaign')).toBe(true);
            expect(spellOverlayData.get('test-campaign')).toEqual([]);
        });
    });

    describe('publish (SSE) on post', () => {
        it('should call publish with the correct event key and data for add action', async () => {
            const changeDataModule = await import('../utils/changeData.js');
            const publishSpy = vi.spyOn(changeDataModule, 'publish');

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=my-campaign')
                .send({
                    action: 'add',
                    overlays: [{ id: 'overlay-1', name: 'Fireball' }],
                });

            expect(publishSpy).toHaveBeenCalledWith(
                'spell-overlay-my-campaign',
                { action: 'add', overlays: [{ id: 'overlay-1', name: 'Fireball' }], overlayId: undefined }
            );

            publishSpy.mockRestore();
        });

        it('should publish remove action with overlayId', async () => {
            const changeDataModule = await import('../utils/changeData.js');
            const publishSpy = vi.spyOn(changeDataModule, 'publish');

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'remove',
                    overlayId: 'overlay-42',
                });

            expect(publishSpy).toHaveBeenCalledWith(
                'spell-overlay-test-campaign',
                { action: 'remove', overlays: undefined, overlayId: 'overlay-42' }
            );

            publishSpy.mockRestore();
        });

        it('should publish clear action without overlays or overlayId', async () => {
            const changeDataModule = await import('../utils/changeData.js');
            const publishSpy = vi.spyOn(changeDataModule, 'publish');

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'clear',
                });

            expect(publishSpy).toHaveBeenCalledWith(
                'spell-overlay-test-campaign',
                { action: 'clear', overlays: undefined, overlayId: undefined }
            );

            publishSpy.mockRestore();
        });

        it('should publish update action with overlays', async () => {
            const changeDataModule = await import('../utils/changeData.js');
            const publishSpy = vi.spyOn(changeDataModule, 'publish');

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=test-campaign')
                .send({
                    action: 'update',
                    overlays: [{ id: 'overlay-1', name: 'Updated' }],
                });

            expect(publishSpy).toHaveBeenCalledWith(
                'spell-overlay-test-campaign',
                { action: 'update', overlays: [{ id: 'overlay-1', name: 'Updated' }], overlayId: undefined }
            );

            publishSpy.mockRestore();
        });
    });

    describe('campaign isolation', () => {
        afterEach(() => {
            clearOverlayStore();
        });

        it('should keep overlays separate between campaigns', async () => {
            spellOverlayData.set('campaign-a', [
                { id: 'a-1', name: 'Fireball', level: 3 },
            ]);
            spellOverlayData.set('campaign-b', [
                { id: 'b-1', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();

            const resA = await request(app).get('/spell-overlay?campaign=campaign-a');
            expect(resA.body.overlays).toHaveLength(1);
            expect(resA.body.overlays[0].name).toBe('Fireball');

            const resB = await request(app).get('/spell-overlay?campaign=campaign-b');
            expect(resB.body.overlays).toHaveLength(1);
            expect(resB.body.overlays[0].name).toBe('Shield');
        });

        it('should not affect other campaigns when adding to one', async () => {
            spellOverlayData.set('campaign-a', [
                { id: 'a-1', name: 'Fireball', level: 3 },
            ]);
            spellOverlayData.set('campaign-b', [
                { id: 'b-1', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=campaign-a')
                .send({
                    action: 'add',
                    overlays: [{ id: 'a-2', name: 'Mage Armor' }],
                });

            const storedA = spellOverlayData.get('campaign-a');
            expect(storedA).toHaveLength(2);

            const storedB = spellOverlayData.get('campaign-b');
            expect(storedB).toHaveLength(1);
            expect(storedB[0].id).toBe('b-1');
        });

        it('should not affect other campaigns when removing from one', async () => {
            spellOverlayData.set('campaign-a', [
                { id: 'a-1', name: 'Fireball', level: 3 },
                { id: 'a-2', name: 'Shield', level: 1 },
            ]);
            spellOverlayData.set('campaign-b', [
                { id: 'b-1', name: 'Mage Armor', level: 1 },
            ]);

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=campaign-a')
                .send({
                    action: 'remove',
                    overlayId: 'a-1',
                });

            const storedA = spellOverlayData.get('campaign-a');
            expect(storedA).toHaveLength(1);
            expect(storedA[0].id).toBe('a-2');

            const storedB = spellOverlayData.get('campaign-b');
            expect(storedB).toHaveLength(1);
            expect(storedB[0].id).toBe('b-1');
        });

        it('should not affect other campaigns when clearing one', async () => {
            spellOverlayData.set('campaign-a', [
                { id: 'a-1', name: 'Fireball', level: 3 },
            ]);
            spellOverlayData.set('campaign-b', [
                { id: 'b-1', name: 'Shield', level: 1 },
            ]);

            const app = createTestApp();
            await request(app)
                .post('/spell-overlay?campaign=campaign-a')
                .send({
                    action: 'clear',
                });

            const storedA = spellOverlayData.get('campaign-a');
            expect(storedA).toEqual([]);

            const storedB = spellOverlayData.get('campaign-b');
            expect(storedB).toHaveLength(1);
            expect(storedB[0].name).toBe('Shield');
        });
    });
});
