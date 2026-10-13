/**
 * Level 5 (L5-001) — durable client identity.
 *
 * There is no auth in this app (CORS *, anonymous writes). L5's referee model
 * (plan D4/§6.8) needs a *stable* client handle so enforcement-scoped writes
 * can be attributed. This is a first-claim UUID in localStorage sent as an
 * X-Client-Id header on runtime-store writes.
 *
 * Honest limitation (documented in plan §12): a client CAN spoof a UUID. This
 * stops accidental/casual bypass, not a determined attacker; the audit log +
 * server validator (server/validation/keyValidators.js) record anomalies.
 *
 * Identity is NOT game state — localStorage is legitimate here (server-first
 * rules target game data; see eslint-plugin-custom scope).
 */

const CLIENT_ID_KEY = 'clientId';

function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for environments without randomUUID (jsdom/older browsers).
    return 'cid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Stable per-browser client id (created on first read). */
export function getClientId() {
    let id = null;
    try {
        id = localStorage.getItem(CLIENT_ID_KEY);
    } catch {
        // Private-mode storage failures fall through to an ephemeral id.
    }
    if (!id) {
        id = generateId();
        try {
            localStorage.setItem(CLIENT_ID_KEY, id);
        } catch {
            // Ephemeral for this tab only; identity will re-claim next load.
        }
    }
    return id;
}

/** Merge X-Client-Id into a fetch headers object. */
export function withClientId(headers = {}) {
    return { ...headers, 'X-Client-Id': getClientId() };
}
