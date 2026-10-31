// @maintained-by-ai
// Campaign-authoring Phase 4 — the designer routes are GM-only and dead while
// aiConfig is off (zero new traffic for non-AI campaigns, mirroring the
// referee/director/world-keeper authority model).
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';

vi.mock('../services/ai/index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
const designChat = vi.fn(async () => ({ ok: true, reply: 'hi' }));
const generateBlueprint = vi.fn(async () => ({ ok: true, created: {} }));
const refineEntity = vi.fn(async () => ({ ok: true, replacement: { name: 'X' } }));
vi.mock('../services/ai/authoring/designer.js', () => ({
    designChat: (...a) => designChat(...a),
    proposePlan: vi.fn(async () => ({ ok: true, scope: {} })),
    generateBlueprint: (...a) => generateBlueprint(...a),
}));
vi.mock('../services/ai/authoring/refine.js', () => ({
    refineEntity: (...a) => refineEntity(...a),
}));
vi.mock('../services/ai/authoring/designNotes.js', () => ({ loadNotes: () => ({ messages: [], plans: [] }) }));

const store = new Map();
vi.mock('../utils/changeData.js', () => ({
    characterChangeData: { get: (c) => store.get(c) },
}));
vi.mock('../log.js', () => ({ addEntry: vi.fn() }));

import aiDesigner from './ai-designer.js';

const app = express();
app.use(express.json());
app.use(aiDesigner);

const CHAT = '/api/campaigns/test-campaign/ai/designer/chat';
beforeEach(() => store.clear());

describe('ai-designer route authority', () => {
    it('403 to a LAN client regardless of config', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'autopilot' } });
        const res = await request(app).post(CHAT).set('Host', '10.0.0.5').send({ message: 'hello' });
        expect(res.status).toBe(403);
        expect(designChat).not.toHaveBeenCalled();
    });

    it('403 on localhost while AI is off', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'off' } });
        const res = await request(app).post(CHAT).set('Host', 'localhost').send({ message: 'hello' });
        expect(res.status).toBe(403);
    });

    it('serves the GM when configured, and requires a message', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'suggest', endpoint: 'http://localhost:1234/v1' } });
        const ok = await request(app).post(CHAT).set('Host', 'localhost').send({ message: 'hello' });
        expect(ok.status).toBe(200);
        expect(designChat).toHaveBeenCalledWith(expect.objectContaining({ campaign: 'test-campaign' }));

        const empty = await request(app).post(CHAT).set('Host', 'localhost').send({});
        expect(empty.status).toBe(400);
    });

    it('refine routes kind + entity + instruction to the service, GM-only', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'suggest', endpoint: 'http://localhost:1234/v1' } });
        const res = await request(app).post('/api/campaigns/test-campaign/ai/refine/npc')
            .set('Host', 'localhost').send({ entity: { name: 'Oldhem' }, instruction: 'softer edges' });
        expect(res.status).toBe(200);
        expect(refineEntity).toHaveBeenCalledWith(expect.objectContaining({
            campaign: 'test-campaign', kind: 'npc', instruction: 'softer edges',
        }));
        const lan = await request(app).post('/api/campaigns/test-campaign/ai/refine/npc')
            .set('Host', '10.0.0.5').send({ entity: {}, instruction: 'x' });
        expect(lan.status).toBe(403);
    });

    it('generate requires a scope body', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'autopilot' } });
        const res = await request(app).post('/api/campaigns/test-campaign/ai/designer/generate').set('Host', 'localhost').send({});
        expect(res.status).toBe(400);
        expect(generateBlueprint).not.toHaveBeenCalled();
    });
});
