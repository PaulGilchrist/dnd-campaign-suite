// L5 Phase 3 — local provider tests (fetch stubbed; D3 privacy contract live here).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { chat, probe, isLocalEndpoint } from './localProvider.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

const cfg = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', temperature: 0.7 };
const msgs = [{ role: 'user', content: 'hi' }];

function stubFetch({ ok = true, status = 200, json, throws } = {}) {
    const fn = vi.fn(async () => {
        if (throws) throw new Error(throws);
        return { ok, status, json: async () => (typeof json === 'function' ? json() : json) };
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

describe('isLocalEndpoint (D3 privacy contract)', () => {
    it('accepts localhost http(s) URLs with any port', () => {
        expect(isLocalEndpoint('http://localhost:11434')).toBe(true);
        expect(isLocalEndpoint('http://127.0.0.1:1234')).toBe(true);
        expect(isLocalEndpoint('https://localhost')).toBe(true);
    });
    it('rejects remote, non-http, and junk endpoints', () => {
        expect(isLocalEndpoint('https://api.openai.com')).toBe(false);
        expect(isLocalEndpoint('http://example.com:11434')).toBe(false);
        expect(isLocalEndpoint('ftp://localhost')).toBe(false);
        expect(isLocalEndpoint('not a url')).toBe(false);
        expect(isLocalEndpoint(undefined)).toBe(false);
    });
});

describe('chat', () => {
    it('refuses a remote endpoint BEFORE any fetch (world data never leaves the machine)', async () => {
        const fetchFn = stubFetch({ json: {} });
        await expect(chat({ ...cfg, endpoint: 'https://api.openai.com', messages: msgs }))
            .rejects.toMatchObject({ code: 'AI_BAD_ENDPOINT' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('posts Ollama-native /api/chat with json format and extracts content', async () => {
        const fetchFn = stubFetch({ json: { message: { content: '{"type":"narrative","text":"ok"}' } } });
        const out = await chat({ ...cfg, messages: msgs });
        expect(out).toContain('narrative');
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('http://localhost:11434/api/chat');
        const body = JSON.parse(init.body);
        expect(body.model).toBe('llama3.1:8b');
        expect(body.format).toBe('json');
        expect(body.stream).toBe(false);
        expect(body.options.temperature).toBe(0.7);
        expect(init.signal).toBeDefined(); // bounded — never a forever-wait
    });

    it('openai provider uses /v1/chat/completions with response_format', async () => {
        const fetchFn = stubFetch({ json: { choices: [{ message: { content: 'hi' } }] } });
        expect(await chat({ ...cfg, provider: 'openai', messages: msgs })).toBe('hi');
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('http://localhost:11434/v1/chat/completions');
        expect(JSON.parse(init.body).response_format).toEqual({ type: 'json_object' });
    });

    it('network refusal / non-200 / non-JSON / empty content ⇒ AI_UNAVAILABLE', async () => {
        stubFetch({ throws: 'ECONNREFUSED' });
        await expect(chat({ ...cfg, messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });

        stubFetch({ ok: false, status: 500 });
        await expect(chat({ ...cfg, messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });

        stubFetch({ json: () => { throw new Error('not json'); } });
        await expect(chat({ ...cfg, messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });

        stubFetch({ json: {} });
        await expect(chat({ ...cfg, messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    });

    it('requires messages', () => expect(chat(cfg)).rejects.toThrow(/messages/));
});

describe('probe', () => {
    it('reports reachable + model list (ollama tags shape)', async () => {
        stubFetch({ json: { models: [{ name: 'llama3.1:8b' }, { name: 'qwen3:4b' }] } });
        expect(await probe({ endpoint: 'http://localhost:11434' })).toEqual({ reachable: true, models: ['llama3.1:8b', 'qwen3:4b'] });
    });
    it('down endpoint ⇒ reachable:false, never throws', async () => {
        stubFetch({ throws: 'ECONNREFUSED' });
        expect(await probe({ endpoint: 'http://localhost:11434' })).toMatchObject({ reachable: false });
        expect(await probe({ endpoint: 'https://evil.example' })).toMatchObject({ reachable: false, reason: /not a local URL/ });
    });
});
