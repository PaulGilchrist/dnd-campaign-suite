import express from 'express';
import { subscribers, characterChangeData, spellOverlayData } from '../utils/changeData.js';
import sseRoutes from './sse.js';
import request from 'supertest';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(sseRoutes);
    return app;
}

// Clean up subscribers and stores between tests
function clearSubscribers() {
    subscribers.length = 0;
}

function clearStores() {
    characterChangeData.clear();
    spellOverlayData.clear();
}

// Helper: create a mock response that captures writes
function createMockRes() {
    const writes = [];
    const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        write: vi.fn((chunk) => {
            writes.push(chunk);
            return true;
        }),
        emit: vi.fn(),
        _writes: writes,
    };
    return mockRes;
}

// Helper: create a mock request with query params
function createMockReq(query = {}) {
    let closeCallback = null;
    return {
        query,
        on: vi.fn((event, callback) => {
            if (event === 'close') {
                closeCallback = callback;
            }
        }),
        _triggerClose: () => {
            if (closeCallback) closeCallback();
        },
    };
}

// Helper: get the subscribe handler from the router
function getSubscribeHandler() {
    // Find the subscribe route handler from the router stack
    for (const layer of sseRoutes.stack) {
        if (layer.route && layer.route.path === '/subscribe') {
            return layer.route.stack[0].handle;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// GET /subscribe - SSE endpoint
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    describe('response headers', () => {
        it('should set Content-Type to text/event-stream', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
            expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
            expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
            expect(mockRes.writeHead).toHaveBeenCalledWith(200);
        });
    });

    describe('client registration', () => {
        it('should add the client to the subscribers list', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            expect(subscribers).toHaveLength(1);
            expect(subscribers[0].campaignName).toBe('test-campaign');
            expect(subscribers[0].res).toBe(mockRes);
            expect(subscribers[0].id).toBeDefined();
        });

        it('should generate a unique client id', () => {
            const mockReq1 = createMockReq({ campaign: 'test-campaign' });
            const mockRes1 = createMockRes();
            subscribeHandler(mockReq1, mockRes1);

            const mockReq2 = createMockReq({ campaign: 'test-campaign' });
            const mockRes2 = createMockRes();
            subscribeHandler(mockReq2, mockRes2);

            expect(subscribers).toHaveLength(2);
            expect(subscribers[0].id).not.toBe(subscribers[1].id);
        });

        it('should default campaignName to empty string when query param is missing', () => {
            const mockReq = createMockReq({});
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            expect(subscribers).toHaveLength(1);
            expect(subscribers[0].campaignName).toBe('');
        });
    });

    describe('character change data snapshot', () => {
        it('should not write change data when campaign has no change data', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            // No writes should have been made for change data
            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites).toHaveLength(0);
        });

        it('should not write change data when campaign name does not match any stored data', () => {
            characterChangeData.set('other-campaign', { character1: { hp: 25 } });

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites).toHaveLength(0);
        });

        it('should write change data snapshot for matching campaign', () => {
            characterChangeData.set('my-campaign', {
                character1: { hp: 25 },
                character2: { hp: 10 },
            });

            const mockReq = createMockReq({ campaign: 'my-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites).toHaveLength(2);
        });

        it('should write change data with key prefixed by change-{campaignName}-', () => {
            characterChangeData.set('test-campaign', {
                character1: { hp: 25 },
            });

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites.length).toBeGreaterThan(0);
            // Verify the key format in the JSON data
            const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
            expect(parsed.key).toBe('change-test-campaign-character1');
        });

        it('should unwrap value when data has {value: ...} shape with single key', () => {
            characterChangeData.set('test-campaign', {
                character1: { value: { hp: 25 } },
            });

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites.length).toBeGreaterThan(0);
            const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
            // The unwrapped value should be { hp: 25 }, not { value: { hp: 25 } }
            expect(parsed.data).toEqual({ hp: 25 });
        });

        it('should send raw value when data does not have {value: ...} shape', () => {
            characterChangeData.set('test-campaign', {
                character1: { hp: 25, maxHp: 30 },
            });

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites.length).toBeGreaterThan(0);
            const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
            expect(parsed.data).toEqual({ hp: 25, maxHp: 30 });
        });

        it('should handle empty campaign store gracefully', () => {
            characterChangeData.set('empty-campaign', {});

            const mockReq = createMockReq({ campaign: 'empty-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            // No change data writes since the store is empty
            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            expect(changeWrites).toHaveLength(0);
        });

        it('should handle write errors gracefully during change data snapshot', () => {
            characterChangeData.set('test-campaign', {
                character1: { hp: 25 },
                character2: { hp: 10 },
            });

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();
            // Make write throw on second call
            let writeCount = 0;
            mockRes.write = vi.fn(() => {
                writeCount++;
                if (writeCount === 2) throw new Error('write failed');
                return true;
            });

            // Should not throw - the handler catches errors
            expect(() => subscribeHandler(mockReq, mockRes)).not.toThrow();
        });
    });

    describe('spell overlay snapshot', () => {
        it('should not write spell overlays when campaign has no overlays', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );
            expect(overlayWrites).toHaveLength(0);
        });

        it('should not write spell overlays when campaign name does not match', () => {
            spellOverlayData.set('other-campaign', [
                { id: 'overlay-1', name: 'Fireball' },
            ]);

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );
            expect(overlayWrites).toHaveLength(0);
        });

        it('should write spell overlays for matching campaign with overlays', () => {
            spellOverlayData.set('my-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
                { id: 'overlay-2', name: 'Shield', level: 1 },
            ]);

            const mockReq = createMockReq({ campaign: 'my-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );
            expect(overlayWrites).toHaveLength(1);
            const parsed = JSON.parse(overlayWrites[0].replace('data: ', ''));
            expect(parsed.key).toBe('spell-overlay-my-campaign');
            expect(parsed.data.action).toBe('add');
            expect(parsed.data.overlays).toHaveLength(2);
        });

        it('should not write spell overlays when overlays array is empty', () => {
            spellOverlayData.set('empty-campaign', []);

            const mockReq = createMockReq({ campaign: 'empty-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );
            expect(overlayWrites).toHaveLength(0);
        });

        it('should write spell overlays with correct action and data', () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball', level: 3 },
            ]);

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );
            const parsed = JSON.parse(overlayWrites[0].replace('data: ', ''));
            expect(parsed.data.action).toBe('add');
            expect(parsed.data.overlays[0].id).toBe('overlay-1');
            expect(parsed.data.overlays[0].name).toBe('Fireball');
        });

        it('should handle write errors gracefully during overlay snapshot', () => {
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball' },
            ]);

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();
            // Make write throw
            mockRes.write = vi.fn(() => { throw new Error('write failed'); });

            // Should not throw - the handler catches errors
            expect(() => subscribeHandler(mockReq, mockRes)).not.toThrow();
        });
    });

    describe('client removal on close', () => {
        it('should remove the client from subscribers when connection closes', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            expect(subscribers).toHaveLength(1);

            // Trigger the close event via the mock request
            mockReq._triggerClose();

            expect(subscribers).toHaveLength(0);
        });

        it('should handle close when client was already removed', () => {
            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);
            expect(subscribers).toHaveLength(1);

            // Remove manually first
            subscribers.splice(0, 1);
            expect(subscribers).toHaveLength(0);

            // Trigger close via mock request - should not throw
            expect(() => mockReq._triggerClose()).not.toThrow();
            expect(subscribers).toHaveLength(0);
        });

        it('should find and remove the correct client by id when multiple subscribers exist', () => {
            const mockReq1 = createMockReq({ campaign: 'test-campaign' });
            const mockRes1 = createMockRes();
            subscribeHandler(mockReq1, mockRes1);

            const mockReq2 = createMockReq({ campaign: 'test-campaign' });
            const mockRes2 = createMockRes();
            subscribeHandler(mockReq2, mockRes2);

            expect(subscribers).toHaveLength(2);
            const firstClientId = subscribers[0].id;

            // Close the second client
            mockReq2._triggerClose();

            expect(subscribers).toHaveLength(1);
            expect(subscribers[0].id).toBe(firstClientId);
        });
    });

    describe('multiple subscribers', () => {
        it('should support multiple subscribers for the same campaign', () => {
            for (let i = 0; i < 3; i++) {
                const mockReq = createMockReq({ campaign: 'test-campaign' });
                const mockRes = createMockRes();
                subscribeHandler(mockReq, mockRes);
            }

            expect(subscribers).toHaveLength(3);
            expect(subscribers.every(s => s.campaignName === 'test-campaign')).toBe(true);
        });

        it('should support multiple subscribers for different campaigns', () => {
            const campaigns = ['campaign-a', 'campaign-b', 'campaign-c'];
            for (const campaign of campaigns) {
                const mockReq = createMockReq({ campaign });
                const mockRes = createMockRes();
                subscribeHandler(mockReq, mockRes);
            }

            expect(subscribers).toHaveLength(3);
            const campaignNames = subscribers.map(s => s.campaignName);
            expect(campaignNames).toContain('campaign-a');
            expect(campaignNames).toContain('campaign-b');
            expect(campaignNames).toContain('campaign-c');
        });
    });

    describe('write ordering', () => {
        it('should write change data before spell overlays', () => {
            characterChangeData.set('test-campaign', { character1: { hp: 25 } });
            spellOverlayData.set('test-campaign', [
                { id: 'overlay-1', name: 'Fireball' },
            ]);

            const mockReq = createMockReq({ campaign: 'test-campaign' });
            const mockRes = createMockRes();

            subscribeHandler(mockReq, mockRes);

            const changeWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('change-')
            );
            const overlayWrites = mockRes._writes.filter(w =>
                typeof w === 'string' && w.includes('spell-overlay-')
            );

            // All change writes should come before overlay writes
            if (changeWrites.length > 0 && overlayWrites.length > 0) {
                const lastChangeIndex = mockRes._writes.indexOf(changeWrites[changeWrites.length - 1]);
                const firstOverlayIndex = mockRes._writes.indexOf(overlayWrites[0]);
                expect(lastChangeIndex).toBeLessThan(firstOverlayIndex);
            }
        });
    });
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
describe('sse - GET /health', () => {
    it('should return 200 with healthy status', async () => {
        const app = createTestApp();
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'Healthy' });
    });

    it('should return JSON content type', async () => {
        const app = createTestApp();
        const res = await request(app).get('/health');

        expect(res.headers['content-type']).toContain('application/json');
    });
});

// ---------------------------------------------------------------------------
// GET catch-all - React Router fallback
// ---------------------------------------------------------------------------
describe('sse - GET catch-all for React Router', () => {
    it('should serve dist/index.html for non-API paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/some-react-route');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for nested paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/campaigns/my-campaign/character/1');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths with query strings', async () => {
        const app = createTestApp();
        const res = await request(app).get('/map?camera=topdown');

        expect(res.status).toBe(200);
    });

    it('should NOT serve dist/index.html for /api paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        // This should be handled by another route (campaignsBasic), not the catch-all
        // Since we're only mounting sseRoutes, it should return 404
        expect(res.status).toBe(404);
    });

    it('should NOT serve dist/index.html for /spell-overlay paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spell-overlay?campaign=test');

        // This should be handled by spellOverlayRoutes, not the catch-all
        expect(res.status).toBe(404);
    });

    it('should serve dist/index.html for paths starting with /maps', async () => {
        const app = createTestApp();
        const res = await request(app).get('/maps');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths starting with /encounters', async () => {
        const app = createTestApp();
        const res = await request(app).get('/encounters');

        expect(res.status).toBe(200);
    });
});
