/**
 * Level 5 (L5-001) — per-key validators for the generic change-data write
 * chokepoint (POST /api/campaigns/:campaign/:key).
 *
 * Today this route accepts ANY key/value blindly. L5 flips decision D2: keys
 * that carry enforcement state are validated server-side so the shared truth
 * cannot be silently forged by a buggy (or casual) client, and the Phase 3 AI
 * audit log becomes trustworthy.
 *
 * Contract: no validator registered ⇒ the write passes through EXACTLY as today
 * (the L1–4 guarantee — every existing suite exercises those keys).
 */

const MODES = new Set(['off', 'on']);
const AI_MODES = ['off', 'suggest', 'autopilot']; // mirrors server/services/ai aiConfig modes

// D3 privacy contract — single implementation lives with the provider that
// would obey it; the validator enforces the same rule, not a copy of it.
import { isLocalEndpoint } from '../services/ai/providers/localProvider.js';

// Mirrors client ENFORCEMENT_DEFAULTS (src/services/combat/canTakeAction.js).
// Keeping the list explicit here is the point: the server defines the contract.
const ENFORCEMENT_FLAGS = new Set([
    'mode', 'turnLock', 'actionEconomy', 'movementBudget',
    'lineOfSight', 'zones', 'opportunityAttacks', 'serverDice',
    // L5-003 §8.1: teleport automations write real token positions.
    'tokenMoving',
]);

// Client turnState economy charges one slot per use; the generous caps here are
// sanity bounds (multi-attack/surge/multi-activity futures), not the rules —
// budget arithmetic stays client-side (turnState.js), fabrication stops here.
const SANITY_CAPS = {
    actionsUsed: 2,        // 1 + Action Surge-style double action
    bonusActionsUsed: 2,   // rare multi-bonus builds/monsters
    reactionsUsed: 2,      // 1 + generous margin for granted reactions
};

function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}

function nonNegNumber(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validateEnforcement(value) {
    if (!isPlainObject(value)) return { ok: false, reason: 'enforcement must be an object' };
    if (!MODES.has(value.mode)) return { ok: false, reason: `enforcement.mode must be 'off' or 'on'` };
    for (const [flag, flagValue] of Object.entries(value)) {
        if (!ENFORCEMENT_FLAGS.has(flag)) return { ok: false, reason: `unknown enforcement flag: ${flag}` };
        if (flag !== 'mode' && typeof flagValue !== 'boolean') return { ok: false, reason: `enforcement.${flag} must be boolean` };
    }
    return { ok: true };
}

function validateReferee(value) {
    if (value === null) return { ok: true }; // null ⇒ unassigned (defaults to localhost authority)
    if (!isPlainObject(value)) return { ok: false, reason: 'referee must be null or { name, clientId }' };
    if (typeof value.name !== 'string' || value.name.trim() === '') return { ok: false, reason: 'referee.name must be a non-empty string' };
    if (typeof value.clientId !== 'string' || value.clientId.trim() === '') return { ok: false, reason: 'referee.clientId must be a non-empty string' };
    return { ok: true };
}

function validateTurnState(value) {
    if (!isPlainObject(value)) return { ok: false, reason: 'turnState must be an object keyed by creature name' };
    for (const [creatureName, entry] of Object.entries(value)) {
        if (!isPlainObject(entry)) return { ok: false, reason: `turnState.${creatureName} must be an object` };
        for (const field of ['actionsUsed', 'bonusActionsUsed', 'reactionsUsed', 'movementUsedFeet']) {
            if (!nonNegNumber(entry[field])) {
                return { ok: false, reason: `turnState.${creatureName}.${field} must be a non-negative number` };
            }
            const cap = SANITY_CAPS[field];
            if (cap !== undefined && entry[field] > cap) {
                return { ok: false, reason: `turnState.${creatureName}.${field} exceeds sanity cap ${cap}` };
            }
        }
        if (entry.movementUsedFeet > 1000) {
            return { ok: false, reason: `turnState.${creatureName}.movementUsedFeet exceeds sanity cap 1000` };
        }
        if (typeof entry.hasMoved !== 'boolean' || typeof entry.turnActive !== 'boolean') {
            return { ok: false, reason: `turnState.${creatureName}.hasMoved/turnActive must be boolean` };
        }
    }
    return { ok: true };
}

/**
 * L5 §7.5 validateTurnTimer REMOVED (no-timers plan T1): the turnTimer key
 * no longer exists — real-time countdowns are banned (AGENTS.md "No Game
 * Timers"); initiative advances only on player/GM action.
 */

/**
 * Authority check for enforcement/referee writes (D2/D4): while enforcement is
 * engaged these may only come from the referee client (X-Client-Id header) or
 * localhost. With enforcement off the surface stays exactly as open as today.
 * `engaged` may be overridden by the caller (e.g. aiConfig engages on its own
 * mode, not the enforcement master).
 */
function validateAuthority(key, ctx, engaged) {
    const { req, current } = ctx;
    const enforcement = (current || {}).enforcement;
    const referee = (current || {}).referee;
    const live = engaged !== undefined ? engaged
        : isPlainObject(enforcement) && enforcement.mode === 'on';
    if (!live) return { ok: true };
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
    if (isLocalhost) return { ok: true };
    const clientId = req.header('x-client-id');
    if (isPlainObject(referee) && clientId && clientId === referee.clientId) return { ok: true };
    return {
        ok: false,
        reason: `only the referee (or localhost) may change ${key} while it is engaged`,
    };
}

/**
 * L5 Phase 3 (plan §5.3/§9.1, D3): aiConfig governs the local model. The
 * LOCALHOST-ENDPOINT guard is the privacy contract — campaign/world context
 * must never be POSTed to a remote URL by configuration drift. mode
 * non-'off' engages referee authority for changes (§12).
 */
function validateAiConfig(value) {
    if (value === null) return { ok: true }; // unset ⇒ AI off (today's behavior)
    if (!isPlainObject(value)) return { ok: false, reason: 'aiConfig must be null or an object' };
    if (!AI_MODES.includes(value.mode)) return { ok: false, reason: "aiConfig.mode must be 'off'|'suggest'|'autopilot'" };
    if (value.mode !== 'off') {
        // Single source of truth for the local-endpoint contract (D3).
        if (!isLocalEndpoint(value.endpoint)) return { ok: false, reason: 'aiConfig.endpoint must be a LOCAL http(s) URL (D3: local model only — campaign data never leaves the machine)' };
        if (typeof value.model !== 'string' || value.model.trim() === '') return { ok: false, reason: 'aiConfig.model is required when AI is on' };
    }
    if (value.temperature !== undefined && !isTemperature(value.temperature)) return { ok: false, reason: 'aiConfig.temperature must be a number 0..2' };
    if (value.provider !== undefined && !['ollama', 'openai'].includes(value.provider)) return { ok: false, reason: "aiConfig.provider must be 'ollama'|'openai'" };
    return { ok: true };
}

function isTemperature(t) {
    return typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= 2;
}

function chain(...validators) {
    return (value, ctx) => {
        for (const validator of validators) {
            const result = validator(value, ctx);
            if (!result.ok) return result;
        }
        return { ok: true };
    };
}

export const keyValidators = {
    enforcement: chain(validateEnforcement, (v, ctx) => validateAuthority('enforcement', ctx)),
    referee: chain(validateReferee, (v, ctx) => validateAuthority('referee', ctx)),
    turnState: validateTurnState,
    // AI config engages referee authority on its OWN mode (§12), not the
    // enforcement master — and engaging counts: a WRITE that turns the AI on
    // is itself an act of authority, so an AI-off campaign cannot be
    // silently autopiloted by a random client.
    aiConfig: chain(validateAiConfig, (v, ctx) => validateAuthority('aiConfig', ctx,
        (isPlainObject(v) && v.mode && v.mode !== 'off')
        || (isPlainObject(ctx.current?.aiConfig) && ctx.current.aiConfig.mode !== 'off'))),
};

/**
 * Run the validator (if any) for a change-data key write.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateRuntimeWrite(key, value, ctx) {
    const validator = keyValidators[key];
    if (!validator) return { ok: true }; // unregistered key ⇒ today's pass-through
    try {
        return validator(value, ctx);
    } catch (e) {
        // A defect in a validator must never brick the shared store — fail OPEN
        // with a loud error (writes keep working, humans get the alarm).
        console.error('[keyValidators] validator threw, failing open:', key, e);
        return { ok: true };
    }
}
