// L5 Phase 3 — AI referee route tests (403 parity gates, referee authority, honest fallback).
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
}));
vi.mock('./log.js', () => ({
    addEntry: vi.fn(() => ({})),
}));

import { characterChangeData } from '../utils/changeData.js';
import { addEntry } from './log.js';
import campaignsAi from './campaigns-ai.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsAi);
    return app;
}

const CFG = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };
const VALID = JSON.stringify({ type: 'dice', expression: '1d20+5', explanation: 'swing' });

function setStore(aiConfig) {
    characterChangeData.set('test-campaign', { aiConfig });
}

function stubModel(content) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content } }) })));
}

beforeEach(() => {
    vi.clearAllMocks();
    characterChangeData.set('test-campaign', {});
});

afterEach(() => vi.unstubAllGlobals());

describe('GET /ai/status', () => {
    it('unconfigured ⇒ configured:false, zero provider traffic (L1–4 parity)', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/ai/status');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ configured: false, mode: 'off' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('configured ⇒ probes the local endpoint (bounded)', async () => {
        setStore(CFG);
        stubModel('unused');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/ai/status');
        expect(res.body.configured).toBe(true);
        expect(res.body.model).toBe('llama3.1:8b');
    });
});

describe('POST /ai/referee', () => {
    it('AI off/unset ⇒ 403 (the AI surface is invisible without aiConfig)', async () => {
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .send({ action: 'I cast fire bolt' });
        expect(res.status).toBe(403);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('requires an action', async () => {
        setStore(CFG);
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .send({});
        expect(res.status).toBe(400);
    });

    it('suggest mode returns a validated proposal + logs ai_ruling, applies nothing', async () => {
        setStore(CFG);
        stubModel('```json\n' + VALID + '\n```');
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .send({ action: 'I attack the goblin with my longsword', characterName: 'Hero' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, mode: 'suggest' });
        expect(res.body.ruling).toMatchObject({ type: 'dice', expression: '1d20+5' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_ruling' }));
    });

    it('model down ⇒ needs_human logged, still 200 (table never stalls on the model)', async () => {
        setStore(CFG);
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
        const res = await request(createTestApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .send({ action: 'do something' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(false);
        expect(res.body.ruling.type).toBe('needs_human');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_ruling' }));
    });
});

describe('referee authority (§12)', () => {
    // trust-proxy makes req.hostname follow the Host header so the
    // hostname-based LAN guard is exercisable from supertest loopback.
    function proxyApp() {
        const app = createTestApp();
        app.set('trust proxy', true);
        return app;
    }

    it('non-localhost anonymous ⇒ 403 on the AI surface', async () => {
        setStore(CFG);
        stubModel(VALID);
        const res = await request(proxyApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .set('Host', '203.0.113.7')
            .send({ action: 'take over the campaign' });
        expect(res.status).toBe(403);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('non-localhost WITH the referee clientId ⇒ allowed', async () => {
        setStore(CFG);
        characterChangeData.get('test-campaign').referee = { name: 'Ref', clientId: 'referee-abc' };
        stubModel(VALID);
        const res = await request(proxyApp())
            .post('/api/campaigns/test-campaign/ai/referee')
            .set('Host', '203.0.113.7')
            .set('X-Client-Id', 'referee-abc')
            .send({ action: 'I cast shield' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
