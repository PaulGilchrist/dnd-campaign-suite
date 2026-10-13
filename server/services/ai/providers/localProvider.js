/**
 * Level 5 Phase 3 (L5-004, plan §9.1 / D3) — local model provider.
 *
 * Keyless, private, offline-capable: talks to an OpenAI-compatible LOCAL
 * endpoint (default Ollama). LOCALHOST-ONLY by contract — an aiConfig
 * endpoint pointing at the internet is rejected here AND by the server
 * validator, so campaign/world data never leaves the machine without the
 * owner deliberately changing this contract.
 *
 * Every call carries a bounded timeout (AbortSignal) — a hung model degrades
 * to AI_UNAVAILABLE (a failed request, never a game-state decision; a
 * player-facing prompt could never be auto-resolved by this clock,
 * AGENTS.md "No Game Timers" — the fallback here is 'needs_human').
 */

import fs from 'fs';

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Optional bearer key for the local endpoint. NEVER stored in aiConfig /
 * change-data (that mirrors to every client) — it lives in the environment
 * or a gitignored server-local file. Privacy holds even though the endpoint
 * is localhost-only: player browsers never see the key.
 */
export function resolveApiKey() {
    if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
    try {
        const file = new URL('../../../config/ai-local.json', import.meta.url);
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return typeof raw.apiKey === 'string' && raw.apiKey.trim() ? raw.apiKey.trim() : null;
    } catch {
        return null; // no key configured — keyless endpoints (plain Ollama) keep working
    }
}

function authHeaders(extra = {}) {
    const key = resolveApiKey();
    return key ? { ...extra, Authorization: `Bearer ${key}` } : extra;
}

/** Where the server-local key lives (gitignored; NEVER in aiConfig/change-data). */
function keyFile() {
    return new URL('../../../config/ai-local.json', import.meta.url);
}

/**
 * Persist the bearer key from the GM admin page (localhost-only route).
 * @param {string|null} key — null clears it
 * @returns {{ ok: boolean, set: boolean, reason?: string }}
 */
export function saveApiKey(key) {
    try {
        const file = keyFile();
        if (key === null || key === undefined || String(key).trim() === '') {
            if (fs.existsSync(file)) fs.rmSync(file);
            return { ok: true, set: false };
        }
        const cleaned = String(key).trim().slice(0, 200);
        fs.mkdirSync(new URL('../../../config/', import.meta.url), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ apiKey: cleaned }, null, 2) + '\n', { mode: 0o600 });
        return { ok: true, set: true };
    } catch (e) {
        console.error('[ai:key] save failed:', e);
        return { ok: false, set: false, reason: String(e?.message || e).slice(0, 160) };
    }
}

/** Masked status for the admin UI — the full key never leaves the server. */
export function apiKeyStatus() {
    const key = resolveApiKey();
    if (!key) return { set: false, source: null, hint: null };
    const fromEnv = !!process.env.AI_API_KEY;
    return { set: true, source: fromEnv ? 'env' : 'file', hint: `••••${key.slice(-4)}` };
}

/** Join endpoint + API path without doubling '/v1' ('http://h:8000/v1' accepted). */
function joinApi(endpoint, path) {
    let base = String(endpoint).replace(/\/+$/, '');
    if (/\/v1$/i.test(base)) base = base.replace(/\/v1$/i, '');
    return `${base}${path}`;
}

/** D3 privacy contract: http(s)://localhost|127.0.0.1|::1[:port] only. */
export function isLocalEndpoint(url) {
    if (typeof url !== 'string') return false;
    try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:')
            && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(u.hostname);
    } catch {
        return false;
    }
}

function endpointError(message) {
    const e = new Error(message);
    e.code = 'AI_BAD_ENDPOINT';
    return e;
}

function unavailableError(message, cause) {
    const e = new Error(message);
    e.code = 'AI_UNAVAILABLE';
    if (cause) e.cause = String(cause?.message || cause);
    return e;
}

/**
 * Provider registry — every supported LOCAL API dialect in one entry each.
 * Different people run different local servers (oMLX, LM Studio, vLLM,
 * llama.cpp, Ollama…), so nothing is privileged: the GM's aiConfig.provider
 * selects a dialect explicitly, or inferProvider() sniffs the endpoint.
 * Adding a new server = one entry here (the validator reads PROVIDERS too).
 */
export const PROVIDERS = {
    openai: {
        label: 'OpenAI-compatible (oMLX · LM Studio · vLLM…)',
        modelsPath: '/v1/models',
        chatPath: '/v1/chat/completions',
        // jsonMode deliberately IGNORED: forcing response_format on some
        // servers (observed: oMLX) makes them emit chunk arrays instead of
        // the contract object. The prompt pins the shape and the schema
        // validator fails closed — that pairing is the real guarantee.
        body: ({ model, messages, temperature }) => ({ model, messages, temperature }),
        extract: (data) => data?.choices?.[0]?.message?.content,
    },
    ollama: {
        label: 'Ollama (native API)',
        modelsPath: '/api/tags',
        chatPath: '/api/chat',
        body: ({ model, messages, temperature, jsonMode }) => ({
            model,
            messages,
            stream: false,
            ...(jsonMode ? { format: 'json' } : {}),
            options: { temperature },
        }),
        extract: (data) => data?.message?.content,
    },
};

/** Explicit aiConfig.provider wins; else sniff '/v1' → OpenAI-compatible. */
export function inferProvider(endpoint, provider) {
    if (PROVIDERS[provider]) return provider;
    return /\/v1\/?$/i.test(String(endpoint || '').replace(/\/+$/, '')) ? 'openai' : 'ollama';
}

function shapeFor(endpoint, provider) {
    return PROVIDERS[inferProvider(endpoint, provider)];
}

/**
 * chat({ endpoint, model, temperature, messages, provider, jsonMode, timeoutMs })
 *   → assistant content string
 * Throws { code: 'AI_BAD_ENDPOINT' | 'AI_UNAVAILABLE' } — callers fall back.
 */
export async function chat(cfg) {
    const { endpoint, model, messages } = cfg || {};
    if (!isLocalEndpoint(endpoint)) throw endpointError(`ai endpoint must be a local http(s) URL, got: ${JSON.stringify(endpoint)}`);
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('chat requires a non-empty messages array');

    const shape = shapeFor(endpoint, cfg.provider);
    const body = shape.body({
        model: model || '',
        messages,
        temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.7,
        jsonMode: cfg.jsonMode !== false, // structured by default (Principle 3)
    });
    const timeoutMs = Number.isFinite(cfg.timeoutMs) && cfg.timeoutMs > 0 ? Math.min(cfg.timeoutMs, 300_000) : DEFAULT_TIMEOUT_MS;

    let res;
    try {
        res = await fetch(joinApi(endpoint, shape.chatPath), {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (e) {
        throw unavailableError('local model endpoint unreachable', e);
    }
    if (!res.ok) throw unavailableError(`local model endpoint returned ${res.status}`);

    let data;
    try {
        data = await res.json();
    } catch (e) {
        throw unavailableError('local model endpoint returned non-JSON', e);
    }
    const content = shape.extract(data);
    if (typeof content !== 'string' || content.trim() === '') throw unavailableError('local model returned empty content');
    return content;
}

/** Health probe for the Referee console / status surfaces. */
export async function probe({ endpoint, provider, timeoutMs = 5000 } = {}) {
    if (!isLocalEndpoint(endpoint)) return { reachable: false, reason: 'endpoint is not a local URL' };
    const shape = shapeFor(endpoint, provider);
    try {
        const res = await fetch(joinApi(endpoint, shape.modelsPath), { headers: authHeaders(), signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return { reachable: false, reason: `HTTP ${res.status}` };
        const data = await res.json().catch(() => ({}));
        const models = Array.isArray(data?.data) ? data.data.map((m) => m?.id).filter(Boolean)
            : Array.isArray(data?.models) ? data.models.map((m) => m?.name).filter(Boolean) : [];
        return { reachable: true, models, dialect: inferProvider(endpoint, provider) };
    } catch (e) {
        return { reachable: false, reason: String(e?.message || e).slice(0, 160) };
    }
}
