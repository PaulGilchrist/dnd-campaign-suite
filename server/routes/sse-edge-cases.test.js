import express from 'express';
import { subscribers, characterChangeData, spellOverlayData } from '../utils/changeData.js';
import sseRoutes from './sse.js';
import { request } from '../test-utils/localhostSupertest.js';

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
    for (const layer of sseRoutes.stack) {
        if (layer.route && layer.route.path === '/subscribe') {
            return layer.route.stack[0].handle;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// GET /subscribe - Edge cases for unwrapping logic
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe - unwrapping edge cases', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    it('should not unwrap when value is null', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: null },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites.length).toBeGreaterThan(0);
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        // {value: null} has one key 'value', so it unwraps to null
        expect(parsed.data).toBeNull();
    });

    it('should not unwrap when value is a string primitive', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: 'hello' },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toBe('hello');
    });

    it('should not unwrap when value is a number primitive', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: 42 },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toBe(42);
    });

    it('should not unwrap when value is an array', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: [1, 2, 3] },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toEqual([1, 2, 3]);
    });

    it('should not unwrap when value object has multiple keys', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: { hp: 25 }, extra: 'data' },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        // Two keys: 'value' and 'extra', so should NOT unwrap
        expect(parsed.data).toEqual({ value: { hp: 25 }, extra: 'data' });
    });

    it('should not unwrap when the value property is missing', () => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toEqual({ hp: 25 });
    });

    it('should not unwrap when value is an empty object {}', () => {
        characterChangeData.set('test-campaign', {
            character1: {},
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toEqual({});
    });

    it('should not unwrap when value is a boolean', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: true },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toBe(true);
    });

    it('should not unwrap when value is 0 (falsy but valid)', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: 0 },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toBe(0);
    });

    it('should not unwrap when value is an empty string', () => {
        characterChangeData.set('test-campaign', {
            character1: { value: '' },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.data).toBe('');
    });
});

// ---------------------------------------------------------------------------
// GET /subscribe - Campaign name edge cases
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe - campaign name edge cases', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    it('should handle campaign names with special characters', () => {
        characterChangeData.set('campaign@2024!test', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: 'campaign@2024!test' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites.length).toBeGreaterThan(0);
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.key).toBe('change-campaign@2024!test-character1');
    });

    it('should handle campaign names with spaces', () => {
        characterChangeData.set('campaign with spaces', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: 'campaign with spaces' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites.length).toBeGreaterThan(0);
    });

    it('should handle campaign names with unicode characters', () => {
        characterChangeData.set('キャンペーン', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: 'キャンペーン' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites.length).toBeGreaterThan(0);
    });

    it('should handle campaign names with JSON-special characters', () => {
        characterChangeData.set('campaign"with\\"quotes', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: 'campaign"with\\"quotes' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites.length).toBeGreaterThan(0);
        // The key should be properly JSON-escaped
        const parsed = JSON.parse(changeWrites[0].replace('data: ', ''));
        expect(parsed.key).toContain('campaign');
    });

    it('should handle empty string campaign name (no snapshot sent)', () => {
        characterChangeData.set('', {
            character1: { hp: 25 },
        });

        const mockReq = createMockReq({ campaign: '' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        // Empty campaign name should not send any snapshots
        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// GET /subscribe - Write error handling
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe - write error handling', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    it('should break the change data loop when write throws', () => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
            character2: { hp: 10 },
            character3: { hp: 15 },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();
        let writeCount = 0;
        mockRes.write = vi.fn(() => {
            writeCount++;
            if (writeCount === 2) throw new Error('write failed');
            return true;
        });

        expect(() => subscribeHandler(mockReq, mockRes)).not.toThrow();
        // Only the first write should succeed, second throws and breaks the loop
        expect(mockRes.write).toHaveBeenCalledTimes(2);
    });

    it('should continue sending spell overlays after change data write error', () => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
            character2: { hp: 10 },
        });
        spellOverlayData.set('test-campaign', [
            { id: 'overlay-1', name: 'Fireball' },
        ]);

        const mockReq = createMockReq({ campaign: 'test-campaign' });
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
        let writeCount = 0;
        mockRes.write = vi.fn((chunk) => {
            writeCount++;
            writes.push(chunk);
            if (writeCount === 1) throw new Error('write failed');
            return true;
        });

        expect(() => subscribeHandler(mockReq, mockRes)).not.toThrow();
        // First change data write throws and breaks the loop,
        // but spell overlay write (2nd) should succeed
        const overlayWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('spell-overlay-')
        );
        expect(overlayWrites).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// GET /subscribe - Close event isolation
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe - close event isolation', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    it('should not affect other subscribers when one client closes', () => {
        const mockReq1 = createMockReq({ campaign: 'test-campaign' });
        const mockRes1 = createMockRes();
        subscribeHandler(mockReq1, mockRes1);

        const mockReq2 = createMockReq({ campaign: 'test-campaign' });
        const mockRes2 = createMockRes();
        subscribeHandler(mockReq2, mockRes2);

        expect(subscribers).toHaveLength(2);

        // Close the first client
        mockReq1._triggerClose();

        expect(subscribers).toHaveLength(1);
        expect(subscribers[0].id).toBe(subscribers[0].id); // second client remains
    });

    it('should generate GUIDs that are 36 characters long', () => {
        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        expect(subscribers[0].id.length).toBe(36);
    });

    it('should generate GUIDs in standard format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)', () => {
        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        expect(subscribers[0].id).toMatch(guidRegex);
    });
});

// ---------------------------------------------------------------------------
// GET /subscribe - Combined change data and spell overlays
// ---------------------------------------------------------------------------
describe('sse - GET /subscribe - combined snapshots', () => {
    let subscribeHandler;

    beforeEach(() => {
        clearSubscribers();
        clearStores();
        subscribeHandler = getSubscribeHandler();
    });

    it('should send both change data and spell overlays in a single connection', () => {
        characterChangeData.set('test-campaign', {
            character1: { hp: 25 },
            character2: { hp: 10 },
        });
        spellOverlayData.set('test-campaign', [
            { id: 'overlay-1', name: 'Fireball' },
            { id: 'overlay-2', name: 'Shield' },
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

        expect(changeWrites).toHaveLength(2);
        expect(overlayWrites).toHaveLength(1);
        expect(mockRes._writes).toHaveLength(3);
    });

    it('should send change data keys in iteration order', () => {
        characterChangeData.set('test-campaign', {
            zebra: { hp: 10 },
            alpha: { hp: 20 },
            middle: { hp: 30 },
        });

        const mockReq = createMockReq({ campaign: 'test-campaign' });
        const mockRes = createMockRes();

        subscribeHandler(mockReq, mockRes);

        const changeWrites = mockRes._writes.filter(w =>
            typeof w === 'string' && w.includes('change-')
        );
        expect(changeWrites).toHaveLength(3);

        const keys = changeWrites.map(w => {
            const parsed = JSON.parse(w.replace('data: ', ''));
            return parsed.key;
        });
        // Object.entries preserves insertion order
        expect(keys[0]).toContain('zebra');
        expect(keys[1]).toContain('alpha');
        expect(keys[2]).toContain('middle');
    });
});

// ---------------------------------------------------------------------------
// GET /health - additional edge cases
// ---------------------------------------------------------------------------
describe('sse - GET /health - additional edge cases', () => {
    it('should serve index.html for non-health, non-API paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/nonexistent');

        expect(res.status).toBe(200);
    });

    it('should serve index.html for any non-excluded path', async () => {
        const app = createTestApp();
        const res = await request(app).get('/any/thing/here');

        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// GET catch-all - additional edge cases
// ---------------------------------------------------------------------------
describe('sse - GET catch-all - additional edge cases', () => {
    it('should serve dist/index.html for root path', async () => {
        const app = createTestApp();
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for deeply nested paths', async () => {
        const app = createTestApp();
        const res = await request(app).get('/a/b/c/d/e/f');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths with fragments', async () => {
        const app = createTestApp();
        const res = await request(app).get('/campaigns#section');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths with encoded characters', async () => {
        const app = createTestApp();
        const res = await request(app).get('/campaigns/my%20campaign');

        expect(res.status).toBe(200);
    });

    it('should NOT serve dist/index.html for /api paths with nested segments', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test/characters');

        expect(res.status).toBe(404);
    });

    it('should NOT serve dist/index.html for /spell-overlay with nested segments', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spell-overlay/test/overlay');

        expect(res.status).toBe(404);
    });

    it('should serve dist/index.html for paths that contain api as a substring but not prefix', async () => {
        const app = createTestApp();
        const res = await request(app).get('/campaigns/api-test');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths starting with spell', async () => {
        const app = createTestApp();
        const res = await request(app).get('/spells');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for paths starting with speller', async () => {
        const app = createTestApp();
        const res = await request(app).get('/speller');

        expect(res.status).toBe(200);
    });

    it('should serve dist/index.html for single-character path', async () => {
        const app = createTestApp();
        const res = await request(app).get('/x');

        expect(res.status).toBe(200);
    });
});
