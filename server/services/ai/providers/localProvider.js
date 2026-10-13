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

const DEFAULT_TIMEOUT_MS = 60_000;

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

function requestShape(provider, { model, messages, temperature, jsonMode }) {
    if (provider === 'openai') {
        return {
            path: '/v1/chat/completions',
            body: {
                model,
                messages,
                temperature,
                ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            },
            extract: (data) => data?.choices?.[0]?.message?.content,
        };
    }
    // Ollama native (default): /api/chat with format:'json' for structured tasks.
    return {
        path: '/api/chat',
        body: {
            model,
            messages,
            stream: false,
            ...(jsonMode ? { format: 'json' } : {}),
            options: { temperature },
        },
        extract: (data) => data?.message?.content,
    };
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

    const shape = requestShape(cfg.provider === 'openai' ? 'openai' : 'ollama', {
        model: model || '',
        messages,
        temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.7,
        jsonMode: cfg.jsonMode !== false, // structured by default (Principle 3)
    });
    const timeoutMs = Number.isFinite(cfg.timeoutMs) && cfg.timeoutMs > 0 ? Math.min(cfg.timeoutMs, 300_000) : DEFAULT_TIMEOUT_MS;

    let res;
    try {
        res = await fetch(`${endpoint.replace(/\/+$/, '')}${shape.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shape.body),
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
    const path = provider === 'openai' ? '/v1/models' : '/api/tags';
    try {
        const res = await fetch(`${endpoint.replace(/\/+$/, '')}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return { reachable: false, reason: `HTTP ${res.status}` };
        const data = await res.json().catch(() => ({}));
        const models = Array.isArray(data?.models) ? data.models.map((m) => m?.name).filter(Boolean)
            : Array.isArray(data?.data) ? data.data.map((m) => m?.id).filter(Boolean) : [];
        return { reachable: true, models };
    } catch (e) {
        return { reachable: false, reason: String(e?.message || e).slice(0, 160) };
    }
}
