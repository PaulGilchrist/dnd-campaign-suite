// §9.3 — AI director route gates + honest refusals.
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

const CFG = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };

function store(extra = {}) {
    characterChangeData.set('test-campaign', {
        aiConfig: CFG,
        combatSummary: {
            round: 1,
            activeCreatureName: 'Goblin 1',
            creatures: [
                { name: 'Goblin 1', type: 'npc', currentHp: 7 },
                { name: 'Rakan', type: 'player', currentHp: 20, ac: 16 },
            ],
        },
        turnState: { 'Goblin 1': { actionsUsed: 0 } },
        enforcement: { mode: 'off' },
        ...extra,
    });
}

afterEach(() => vi.unstubAllGlobals());

describe('POST /ai/director', () => {
    it('AI off ⇒ 403, zero model traffic (L1–4 parity)', async () => {
        characterChangeData.set('test-campaign', {});
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Goblin 1' });
        expect(res.status).toBe(403);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('unknown creature ⇒ 404; player creature ⇒ 400 (players direct themselves)', async () => {
        store();
        const miss = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Nobody' });
        expect(miss.status).toBe(404);
        const player = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Rakan' });
        expect(player.status).toBe(400);
        const blank = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({});
        expect(blank.status).toBe(400);
    });

    it('turn-lock ON, not its turn ⇒ 409 NOT_THEIR_TURN', async () => {
        store({ enforcement: { mode: 'on', turnLock: true }, combatSummary: { round: 1, activeCreatureName: 'Rakan', creatures: [{ name: 'Goblin 1', type: 'npc', currentHp: 7 }, { name: 'Rakan', type: 'player', currentHp: 20 }] } });
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Goblin 1' });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('NOT_THEIR_TURN');
    });

    it('happy path: 200 with validated intent + audit log', async () => {
        store();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"intent":"attack","actionName":"Scimitar","targetName":"Rakan","explanation":"melee","confidence":0.9}' } }) })));
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Goblin 1' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, mode: 'suggest' });
        expect(res.body.intent).toMatchObject({ intent: 'attack', actionName: 'Scimitar', targetName: 'Rakan', creatureName: 'Goblin 1' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_director' }));
    });

    it('model down ⇒ 200 needs_human intent (the table never stalls)', async () => {
        store();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/ai/director').send({ creatureName: 'Goblin 1' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: false, code: 'AI_NEEDS_HUMAN' });
        expect(res.body.intent.intent).toBe('needs_human');
    });
});
