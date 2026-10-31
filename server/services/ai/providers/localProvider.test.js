// L5 Phase 3 — local provider tests (fetch stubbed; D3 privacy contract live here).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { chat, probe, isLocalEndpoint, resolveApiKey, inferProvider, resetJsonSchemaProbe } from './localProvider.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    resetJsonSchemaProbe(); // capability probe cache is module state — isolate legs
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

    it('openai provider uses /v1/chat/completions — deliberately WITHOUT response_format (some servers, observed oMLX, answer with chunk arrays when it is forced)', async () => {
        const fetchFn = stubFetch({ json: { choices: [{ message: { content: 'hi' } }] } });
        expect(await chat({ ...cfg, provider: 'openai', messages: msgs })).toBe('hi');
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('http://localhost:11434/v1/chat/completions');
        expect(JSON.parse(init.body).response_format).toBeUndefined();
        expect(JSON.parse(init.body).temperature).toBeDefined();
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
        expect(await probe({ endpoint: 'http://localhost:11434' })).toEqual({ reachable: true, models: ['llama3.1:8b', 'qwen3:4b'], dialect: 'ollama' });
    });
    it('down endpoint ⇒ reachable:false, never throws', async () => {
        stubFetch({ throws: 'ECONNREFUSED' });
        expect(await probe({ endpoint: 'http://localhost:11434' })).toMatchObject({ reachable: false });
        expect(await probe({ endpoint: 'https://evil.example' })).toMatchObject({ reachable: false, reason: /not a local URL/ });
    });
});

describe('openai-compatible endpoints + optional bearer key', () => {
    it('/v1 endpoint + openai provider posts to /v1/chat/completions WITHOUT doubling /v1', async () => {
        const stub = stubFetch({ json: { choices: [{ message: { content: 'ok' } }] } });
        const content = await chat({ endpoint: 'http://localhost:8000/v1', provider: 'openai', model: 'local', messages: msgs });
        expect(content).toBe('ok');
        const url = stub.mock.calls[0][0];
        expect(url).toBe('http://localhost:8000/v1/chat/completions');
    });

    it('probe against /v1 lists OpenAI-shaped models', async () => {
        const stub = stubFetch({ json: { data: [{ id: 'qwen3:4b' }, { id: 'llama3' }] } });
        const r = await probe({ endpoint: 'http://localhost:8000/v1/', provider: 'openai' });
        expect(r).toEqual({ reachable: true, models: ['qwen3:4b', 'llama3'], dialect: 'openai' });
        expect(stub.mock.calls[0][0]).toBe('http://localhost:8000/v1/models');
    });

    it('resolveApiKey: env wins; absent ⇒ null (keyless stays working)', () => {
        delete process.env.AI_API_KEY;
        expect(resolveApiKey()).toBeNull();
        process.env.AI_API_KEY = 'sk-test-123';
        expect(resolveApiKey()).toBe('sk-test-123');
        delete process.env.AI_API_KEY;
    });

    it('key present ⇒ Authorization header on chat + probe; keyless ⇒ none', async () => {
        process.env.AI_API_KEY = 'sk-test-123';
        const stub = stubFetch({ json: { choices: [{ message: { content: 'ok' } }] } });
        await chat({ endpoint: 'http://localhost:8000/v1', provider: 'openai', model: 'local', messages: msgs });
        expect(stub.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test-123');
        delete process.env.AI_API_KEY;
        const stub2 = stubFetch({ json: { choices: [{ message: { content: 'ok' } }] } });
        await chat({ endpoint: 'http://localhost:8000/v1', provider: 'openai', model: 'local', messages: msgs });
        expect(stub2.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
});

describe('provider sniffing', () => {
    it('ollama native keeps format:json for structured tasks', async () => {
        const stub = stubFetch({ json: { message: { content: '{"ok":true}' } } });
        await chat({ endpoint: 'http://localhost:11434', model: 'm', messages: [{ role: 'user', content: 'go' }] });
        expect(JSON.parse(stub.mock.calls[0][1].body).format).toBe('json');
    });
});

describe('inferProvider — different people, different local servers', () => {
    it('any /v1 endpoint is the OpenAI-compatible family (oMLX, LM Studio, vLLM, llama.cpp)', () => {
        expect(inferProvider('http://localhost:8000/v1')).toBe('openai');   // oMLX
        expect(inferProvider('http://localhost:1234/v1')).toBe('openai');    // LM Studio
        expect(inferProvider('http://localhost:8000/v1/')).toBe('openai');   // trailing slash
        expect(inferProvider('http://localhost:8080/v1')).toBe('openai');    // vLLM / llama.cpp
    });
    it('bare port (plain Ollama default) stays native', () => {
        expect(inferProvider('http://localhost:11434')).toBe('ollama');
    });
    it('explicit aiConfig.provider always wins over the sniff', () => {
        expect(inferProvider('http://localhost:8000/v1', 'ollama')).toBe('ollama');
        expect(inferProvider('http://localhost:11434', 'openai')).toBe('openai');
        expect(inferProvider('http://localhost:8000/v1', 'bogus')).toBe('openai');
    });
});

// Campaign-authoring residual item 3 — response_format json_schema
// pass-through, PROBED per endpoint+model, silent fallback to the jsonMode/
// prompt lane on backends that refuse or misbehave.
describe('constrained decoding (response_format json_schema)', () => {
    const openai = { endpoint: 'http://localhost:8000/v1', provider: 'openai', model: 'qwen' };
    const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
    const good = { choices: [{ message: { content: '{"name":"x"}' } }] };

    function stubSchemaSensitive({ refuseWith, junkAnswer = false } = {}) {
        const bodies = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const body = JSON.parse(init.body);
            bodies.push(body);
            if (body.response_format) {
                if (refuseWith) return { ok: false, status: refuseWith, json: async () => ({}) };
                if (junkAnswer) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ['chunk', 'array'] } }] }) };
                return { ok: true, status: 200, json: async () => good };
            }
            return { ok: true, status: 200, json: async () => good };
        }));
        return bodies;
    }

    it('aiConfig.jsonSchema=true forces the header with the fed schema verbatim', async () => {
        const bodies = stubSchemaSensitive();
        const out = await chat({ ...openai, messages: msgs, responseSchema: schema, schemaName: 'npc', jsonSchema: true });
        expect(out).toContain('name');
        expect(bodies[0].response_format).toEqual({ type: 'json_schema', json_schema: { name: 'npc', schema } });
    });

    it('aiConfig.jsonSchema=false never sends it, even with a schema available', async () => {
        const bodies = stubSchemaSensitive();
        await chat({ ...openai, messages: msgs, responseSchema: schema, jsonSchema: false });
        expect(bodies).toHaveLength(1);
        expect(bodies[0].response_format).toBeUndefined();
    });

    it('unknown backends probe once: a 400 refusal retries plain and is cached (later calls skip the probe)', async () => {
        const bodies = stubSchemaSensitive({ refuseWith: 400 });
        expect(await chat({ ...openai, messages: msgs, responseSchema: schema })).toContain('name');
        expect(bodies).toHaveLength(2);
        expect(bodies[0].response_format).toBeDefined();
        expect(bodies[1].response_format).toBeUndefined(); // silent jsonMode fallback

        await chat({ ...openai, messages: msgs, responseSchema: schema });
        expect(bodies).toHaveLength(3);
        expect(bodies[2].response_format).toBeUndefined(); // probed, not assumed
    });

    it('the oMLX chunk-array answer counts as a refusal, not an outage', async () => {
        const bodies = stubSchemaSensitive({ junkAnswer: true });
        expect(await chat({ ...openai, messages: msgs, responseSchema: schema })).toContain('name');
        expect(bodies).toHaveLength(2);
        expect(bodies[1].response_format).toBeUndefined();
    });

    it('a capable backend caches the hit and keeps using constrained decoding', async () => {
        const bodies = stubSchemaSensitive();
        await chat({ ...openai, messages: msgs, responseSchema: schema });
        await chat({ ...openai, messages: msgs, responseSchema: schema });
        expect(bodies).toHaveLength(2);
        expect(bodies.every(b => b.response_format)).toBe(true);
    });

    it('the ollama dialect never receives response_format', async () => {
        const stub = stubFetch({ json: { message: { content: 'ok' } } });
        await chat({ endpoint: 'http://localhost:11434', model: 'llama', messages: msgs, responseSchema: schema });
        expect(JSON.parse(stub.mock.calls[0][1].body).response_format).toBeUndefined();
    });

    it('endpoint errors still surface honestly (only refusal shapes fall back)', async () => {
        stubFetch({ ok: false, status: 500 });
        await expect(chat({ ...openai, messages: msgs, responseSchema: schema }))
            .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    });
});
