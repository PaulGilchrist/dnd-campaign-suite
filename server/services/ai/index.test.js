// L5 Phase 3 — AI service orchestration tests: retry once, fail closed, audit log, never applies.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { askReferee, aiConfigLive } from './index.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

const CFG = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };
const VALID = JSON.stringify({ type: 'dice', expression: '1d20+5', targetName: 'Goblin', explanation: 'swing', confidence: 0.8 });

function fetchSequence(...responses) {
    let i = 0;
    const fn = vi.fn(async () => {
        const r = responses[Math.min(i++, responses.length - 1)];
        if (r === 'DOWN') throw new Error('ECONNREFUSED');
        return { ok: true, status: 200, json: async () => ({ message: { content: r } }) };
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

describe('aiConfigLive', () => {
    it('off/unset/remote ⇒ not live', () => {
        expect(aiConfigLive(null)).toBe(false);
        expect(aiConfigLive({ ...CFG, mode: 'off' })).toBe(false);
        expect(aiConfigLive({ ...CFG, endpoint: 'https://api.openai.com' })).toBe(false);
        expect(aiConfigLive(CFG)).toBe(true);
    });
});

describe('askReferee', () => {
    it('AI off ⇒ zero provider traffic', async () => {
        const fetchFn = fetchSequence(VALID);
        const res = await askReferee({ campaign: 'test-campaign', action: 'attack', aiConfig: { ...CFG, mode: 'off' }, log: vi.fn() });
        expect(res).toMatchObject({ ok: false, code: 'AI_OFF' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('valid proposal ⇒ ok, ruling returned (NOT applied), ai_ruling audit logged', async () => {
        fetchSequence(VALID);
        const log = vi.fn(async () => {});
        const res = await askReferee({ campaign: 'test-campaign', action: 'I swing at the goblin', characterName: 'Hero', aiConfig: CFG, state: {}, log });
        expect(res.ok).toBe(true);
        expect(res.ruling).toMatchObject({ type: 'dice', expression: '1d20+5' });
        expect(res.mode).toBe('suggest');
        expect(log).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ai_ruling',
            characterName: 'Hero',
            description: expect.stringContaining('dice'),
        }));
    });

    it('invalid twice ⇒ needs_human fallback logged (never a guessed ruling)', async () => {
        const fn = fetchSequence('the goblin just dies lol', 'also not json');
        const log = vi.fn(async () => {});
        const res = await askReferee({ campaign: 'test-campaign', action: 'x', aiConfig: CFG, state: {}, log });
        expect(res.ok).toBe(false);
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        expect(res.ruling.type).toBe('needs_human');
        expect(fn).toHaveBeenCalledTimes(2); // exactly ONE retry (§9.1)
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][1].ruling.type).toBe('needs_human');
    });

    it('invalid then valid ⇒ second attempt succeeds', async () => {
        fetchSequence('garbage', '```json\n' + VALID + '\n```');
        const res = await askReferee({ campaign: 'test-campaign', action: 'x', aiConfig: CFG, state: {}, log: vi.fn(async () => {}) });
        expect(res.ok).toBe(true);
        expect(res.ruling.expression).toBe('1d20+5');
    });

    it('endpoint down twice ⇒ needs_human (no model = human, never a silent ruling)', async () => {
        fetchSequence('DOWN');
        const log = vi.fn(async () => {});
        const res = await askReferee({ campaign: 'test-campaign', action: 'x', aiConfig: CFG, state: {}, log });
        expect(res.ok).toBe(false);
        expect(res.ruling.type).toBe('needs_human');
        expect(res.ruling.text).toContain('AI_UNAVAILABLE');
    });

    it('log failures never break the ruling response', async () => {
        fetchSequence(VALID);
        const res = await askReferee({ campaign: 'test-campaign', action: 'x', aiConfig: CFG, state: {}, log: () => { throw new Error('log down'); } });
        expect(res.ok).toBe(true);
    });
});
