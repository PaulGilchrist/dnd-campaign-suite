// @maintained-by-ai
// Campaign-authoring Phase 4 — the designer routes are GM-only and dead while
// aiConfig is off (zero new traffic for non-AI campaigns, mirroring the
// referee/director/world-keeper authority model).
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';

vi.mock('../services/ai/index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
const designChat = vi.fn(async () => ({ ok: true, reply: 'hi' }));
const proposePlan = vi.fn(async () => ({ ok: true, scope: { scope: 'arc' } }));
const generateBlueprint = vi.fn(async () => ({ ok: true, created: {} }));
const refineEntity = vi.fn(async () => ({ ok: true, replacement: { name: 'X' } }));
const dressMapProposal = vi.fn(async () => ({ ok: true, map: 'battle-arena', ops: [], preview: [], updated: {} }));
vi.mock('../services/ai/authoring/designer.js', () => ({
    designChat: (...a) => designChat(...a),
    proposePlan: (...a) => proposePlan(...a),
    generateBlueprint: (...a) => generateBlueprint(...a),
}));
vi.mock('../services/ai/authoring/refine.js', () => ({
    refineEntity: (...a) => refineEntity(...a),
}));
vi.mock('../services/ai/authoring/dressMap.js', () => ({
    dressMapProposal: (...a) => dressMapProposal(...a),
}));
const savePendingPlan = vi.fn((c, scope) => ({ pendingPlan: scope ? { ...scope, savedAt: 1 } : null }));
const setDesignerError = vi.fn((c, stage, error) => ({ lastError: error ? { stage, error } : null }));
vi.mock('../services/ai/authoring/designNotes.js', () => ({
    loadNotes: () => ({ messages: [], plans: [], pendingPlan: null, lastError: null }),
    savePendingPlan: (...a) => savePendingPlan(...a),
    setDesignerError: (...a) => setDesignerError(...a),
}));

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

    it('dress routes the map name + instruction to the service, GM + aiConfig gated', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'suggest', endpoint: 'http://localhost:1234/v1' } });
        const res = await request(app).post('/api/campaigns/test-campaign/ai/dress/battle-arena')
            .set('Host', 'localhost').send({ instruction: 'add a trapped chest in the throne room' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, map: 'battle-arena' });
        expect(dressMapProposal).toHaveBeenCalledWith(expect.objectContaining({
            campaign: 'test-campaign', mapName: 'battle-arena', instruction: 'add a trapped chest in the throne room',
        }));

        const lan = await request(app).post('/api/campaigns/test-campaign/ai/dress/battle-arena')
            .set('Host', '10.0.0.5').send({ instruction: 'x' });
        expect(lan.status).toBe(403);

        store.set('test-campaign', { aiConfig: { mode: 'off' } });
        const off = await request(app).post('/api/campaigns/test-campaign/ai/dress/battle-arena')
            .set('Host', 'localhost').send({ instruction: 'x' });
        expect(off.status).toBe(403);
    });

    it('generate requires a scope body', async () => {
        store.set('test-campaign', { aiConfig: { mode: 'autopilot' } });
        const res = await request(app).post('/api/campaigns/test-campaign/ai/designer/generate').set('Host', 'localhost').send({});
        expect(res.status).toBe(400);
        expect(generateBlueprint).not.toHaveBeenCalled();
    });

    // --- designer-plan-state-volatile: persistence lanes ---------------------

    it('pending-plan endpoint persists/clears the GM plan — GM-only, shape-checked', async () => {
        savePendingPlan.mockClear();
        const url = '/api/campaigns/test-campaign/ai/designer/pending-plan';
        const lan = await request(app).post(url).set('Host', '10.0.0.5').send({ scope: { scope: 'arc' } });
        expect(lan.status).toBe(403);
        expect(savePendingPlan).not.toHaveBeenCalled();

        const junk = await request(app).post(url).set('Host', 'localhost').send({ scope: [1] });
        expect(junk.status).toBe(400);

        const ok = await request(app).post(url).set('Host', 'localhost').send({ scope: { scope: 'arc', entityPlan: [] } });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ ok: true, pending: true });
        expect(savePendingPlan).toHaveBeenLastCalledWith('test-campaign', { scope: 'arc', entityPlan: [] });

        const clear = await request(app).post(url).set('Host', 'localhost').send({ scope: null });
        expect(clear.body).toEqual({ ok: true, pending: false });
        expect(savePendingPlan).toHaveBeenLastCalledWith('test-campaign', null);
    });

    it('plan/generate/chat outcomes ride into design-notes: plan stored, errors recorded, plan consumed on success', async () => {
        savePendingPlan.mockClear();
        setDesignerError.mockClear();
        store.set('test-campaign', { aiConfig: { mode: 'suggest', endpoint: 'http://localhost:1234/v1' } });

        // proposed plan becomes the stored pending plan immediately
        await request(app).post('/api/campaigns/test-campaign/ai/designer/plan').set('Host', 'localhost').send({});
        expect(savePendingPlan).toHaveBeenLastCalledWith('test-campaign', { scope: 'arc' });

        // failed chat is recorded with its message
        designChat.mockResolvedValueOnce({ ok: false, code: 'AI_UNREACHABLE', error: 'local model endpoint unreachable' });
        await request(app).post(CHAT).set('Host', 'localhost').send({ message: 'x' });
        expect(setDesignerError).toHaveBeenLastCalledWith('test-campaign', 'chat', 'local model endpoint unreachable');

        // failed generate persists its whole error list
        generateBlueprint.mockResolvedValueOnce({ ok: false, code: 'AI_NEEDS_HUMAN', errors: ['bad ref', 'placeholder name'] });
        await request(app).post('/api/campaigns/test-campaign/ai/designer/generate').set('Host', 'localhost').send({ scope: { scope: 'arc' } });
        expect(setDesignerError).toHaveBeenLastCalledWith('test-campaign', 'generate', 'bad ref\nplaceholder name');

        // successful generate consumes the pending plan and clears the error
        await request(app).post('/api/campaigns/test-campaign/ai/designer/generate').set('Host', 'localhost').send({ scope: { scope: 'arc' } });
        expect(savePendingPlan).toHaveBeenLastCalledWith('test-campaign', null);
        expect(setDesignerError).toHaveBeenLastCalledWith('test-campaign', 'generate', null);
    });
});
