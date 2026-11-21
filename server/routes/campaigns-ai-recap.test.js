// Roadmap Step 8 — POST /ai/recap: GM gates, honest refusals, and the posted
// session_recap row. Conventions mirror campaigns-ai.test.js (the ./log.js
// mock carries every named export — addEntry for the route, loadLog +
// activeSessionName for the storyMemory import inside services/ai/index.js).
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    publish: vi.fn(),
}));
vi.mock('./log.js', () => ({
    addEntry: vi.fn((campaign, entry) => ({ ...entry, id: 'gen-1', timestamp: 1, session: 'Session 2' })),
    loadLog: vi.fn(() => []),
    activeSessionName: vi.fn(() => null),
}));

import { characterChangeData } from '../utils/changeData.js';
import { addEntry, loadLog } from './log.js';
import campaignsAi from './campaigns-ai.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsAi);
    return app;
}

const CFG = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };
const PATH = '/api/campaigns/test-campaign/ai/recap';

function setStore() {
    characterChangeData.set('test-campaign', { aiConfig: CFG });
}

function seedSessionRows() {
    loadLog.mockReturnValue([
        { id: '1', type: 'narrative', description: 'The cave mouth yawned.', characterName: 'GM', session: 'Session 1' },
        { id: '2', type: 'roll', message: 'Goblin hits Rakan', rollType: 'attack', characterName: 'Goblin', targetName: 'Rakan', hit: true, session: 'Session 1' },
        { id: '3', type: 'narrative', description: 'Other session.', characterName: 'GM', session: 'Session 2' },
    ]);
}

function stubRecap(content) {
    const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content } }) }));
    vi.stubGlobal('fetch', fn);
    return fn;
}

beforeEach(() => {
    vi.clearAllMocks();
    characterChangeData.set('test-campaign', {});
    loadLog.mockReturnValue([]);
});

afterEach(() => vi.unstubAllGlobals());

describe('POST /ai/recap — gates', () => {
    it('AI off/unset ⇒ 403 with plain-English copy, zero model traffic', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const res = await request(createTestApp()).post(PATH).send({ session: 'Session 1' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/not enabled/i);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('visitor origin ⇒ 403 (GM-only surface), zero traffic, no row', async () => {
        setStore();
        seedSessionRows();
        const app = createTestApp();
        app.set('trust proxy', true);
        const res = await request(app).post(PATH).set('Host', '203.0.113.7').send({ session: 'Session 1' });
        expect(res.status).toBe(403);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('missing/blank session ⇒ 400', async () => {
        setStore();
        const res = await request(createTestApp()).post(PATH).send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/session .* required/i);
    });

    it('session with no stamped rows ⇒ 400 RECAP_NO_ROWS naming the session, zero model calls', async () => {
        setStore();
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const res = await request(createTestApp()).post(PATH).send({ session: 'Session 9' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ ok: false, code: 'RECAP_NO_ROWS' });
        expect(res.body.error).toContain('Session 9');
        expect(fetchFn).not.toHaveBeenCalled();
    });
});

describe('POST /ai/recap — the write path', () => {
    it('success posts a GM-authored session_recap row shaped for the stamping law', async () => {
        setStore();
        seedSessionRows();
        stubRecap('{"text":"Beneath a eyeless moon the party delved…"}');
        const res = await request(createTestApp()).post(PATH).send({ session: 'Session 1' });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, entry: { id: 'gen-1' } });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'session_recap',
            name: 'Session Recap',
            characterName: 'GM',
            description: 'Beneath a eyeless moon the party delved…',
            recapSession: 'Session 1',
        }));
        // Server-side addEntry (mocked here, pinned for real stamping in
        // log.test.js): the route itself never sends a `session` field.
        expect(addEntry.mock.calls[0][1]).not.toHaveProperty('session');
    });

    it('the model sees ONLY the session\'s rows (other sessions stay out of the prompt)', async () => {
        setStore();
        seedSessionRows();
        const fetchFn = stubRecap('{"text":"ok"}');
        await request(createTestApp()).post(PATH).send({ session: 'Session 1' });

        const sent = JSON.stringify(fetchFn.mock.calls.map(c => c[1]));
        expect(sent).toContain('The cave mouth yawned.');
        expect(sent).toContain('Goblin hits Rakan');
        expect(sent).not.toContain('Other session.');
    });

    it('model down twice ⇒ 502 needs_human copy and NO junk row', async () => {
        setStore();
        seedSessionRows();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
        const res = await request(createTestApp()).post(PATH).send({ session: 'Session 1' });
        expect(res.status).toBe(502);
        expect(res.body).toMatchObject({ ok: false, code: 'AI_NEEDS_HUMAN' });
        expect(res.body.error).toMatch(/nothing was posted/i);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('twice-invalid answers ⇒ 502, never a partial or invented row', async () => {
        setStore();
        seedSessionRows();
        stubRecap('Once upon a time, prose instead of JSON.');
        const res = await request(createTestApp()).post(PATH).send({ session: 'Session 1' });
        expect(res.status).toBe(502);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
