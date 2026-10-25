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
 * (the L1–4 guarantee — every existing suite exercises those keys). A validator
 * may additionally return a canonicalized `value` on success; the route persists
 * that instead of the raw payload (enforcement never stores key-subset shapes).
 */

const MODES = new Set(['off', 'on']);
const AI_MODES = ['off', 'suggest', 'autopilot']; // mirrors server/services/ai aiConfig modes

// D3 privacy contract — single implementation lives with the provider that
// would obey it; the validator enforces the same rule, not a copy of it.
import { isLocalEndpoint, PROVIDERS } from '../services/ai/providers/localProvider.js';

// Mirrors client ENFORCEMENT_DEFAULTS (src/services/combat/canTakeAction.js).
// Keeping the list explicit here is the point: the server defines the contract.
const ENFORCEMENT_FLAGS = new Set([
    'mode', 'turnLock', 'actionEconomy', 'movementBudget',
    'lineOfSight', 'zones', 'opportunityAttacks', 'serverDice',
    // L5-003 §8.1: teleport automations write real token positions.
    'tokenMoving',
    // L5 Phase 4 §10.2: accepted travel combat events auto-start initiative.
    'autoEncounters',
    // L5 Phase 4 §10.3: combat close auto-awards loot + XP.
    'autoRewards',
]);

// Client turnState economy charges one slot per use; the generous caps here are
// sanity bounds (multi-attack/surge/multi-activity futures), not the rules —
// budget arithmetic stays client-side (turnState.js), fabrication stops here.
const SANITY_CAPS = {
    actionsUsed: 2,        // 1 + Action Surge-style double action
    bonusActionsUsed: 2,   // rare multi-bonus builds/monsters
    // §18 D1: features may RAISE a creature's reactionCap (client floors it
    // to 1..3) — reactionsUsed is legitimate up to that bound, not just 1.
    reactionsUsed: 3,
};

function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}

function nonNegNumber(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

// Canonical state = the full ENFORCEMENT_FLAGS set with absent keys defaulted
// (mode 'off', sub-flags false). This is the ONE canonicalizer: the authority
// comparison below reads state through it, and validateEnforcement returns its
// output so the route persists the full canonical blob — a valid key-subset
// write can never clobber the stored shape (backlog 2026-10-25 subset-clobber).
function canonicalizeEnforcement(blob) {
    return Object.fromEntries([...ENFORCEMENT_FLAGS].map(flag => [
        flag,
        flag === 'mode'
            ? (isPlainObject(blob) && blob.mode === 'on' ? 'on' : 'off')
            : !!(isPlainObject(blob) && blob[flag]),
    ]));
}

function validateEnforcement(value) {
    if (!isPlainObject(value)) return { ok: false, reason: 'enforcement must be an object' };
    if (!MODES.has(value.mode)) return { ok: false, reason: `enforcement.mode must be 'off' or 'on'` };
    for (const [flag, flagValue] of Object.entries(value)) {
        if (!ENFORCEMENT_FLAGS.has(flag)) return { ok: false, reason: `unknown enforcement flag: ${flag}` };
        if (flag !== 'mode' && typeof flagValue !== 'boolean') return { ok: false, reason: `enforcement.${flag} must be boolean` };
    }
    return { ok: true, value: canonicalizeEnforcement(value) };
}

const TURN_STATE_NUMBER_FIELDS = ['actionsUsed', 'bonusActionsUsed', 'reactionsUsed', 'movementUsedFeet'];

function validateTurnStateEntry(creatureName, entry) {
    for (const field of TURN_STATE_NUMBER_FIELDS) {
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
    return validateTurnStateOptionalProps(creatureName, entry);
}

// Optional §18 props — absent is fine, present must be well-formed.
function validateTurnStateOptionalProps(creatureName, entry) {
    // §18 D1: feature-granted reaction caps — 1..3 integers only.
    if (entry.reactionCap !== undefined && (!Number.isInteger(entry.reactionCap) || entry.reactionCap < 1 || entry.reactionCap > 3)) {
        return { ok: false, reason: `turnState.${creatureName}.reactionCap must be an integer 1..3` };
    }
    // §18 D2: companion ownership links — a non-empty string naming the owner.
    if (entry.companionOf !== undefined && entry.companionOf !== null && (typeof entry.companionOf !== 'string' || entry.companionOf.trim() === '')) {
        return { ok: false, reason: `turnState.${creatureName}.companionOf must be null or a non-empty string` };
    }
    return { ok: true };
}

function validateTurnState(value) {
    if (!isPlainObject(value)) return { ok: false, reason: 'turnState must be an object keyed by creature name' };
    for (const [creatureName, entry] of Object.entries(value)) {
        if (!isPlainObject(entry)) return { ok: false, reason: `turnState.${creatureName} must be an object` };
        const result = validateTurnStateEntry(creatureName, entry);
        if (!result.ok) return result;
    }
    return { ok: true };
}

/**
 * L5 §7.5 validateTurnTimer REMOVED (no-timers plan T1): the turnTimer key
 * no longer exists — real-time countdowns are banned (AGENTS.md "No Game
 * Timers"); initiative advances only on player/GM action.
 */

/**
 * Authority check for enforcement-scoped writes (D2): while enforcement is
 * engaged these may only come from localhost — the GM machine. There is no
 * assignable referee (removed 2026-10-13: the app runs on the GM's computer,
 * so localhost IS the referee; delegation via client ids was never wired to
 * a pairing mechanism). `engaged` may be overridden by the caller (e.g.
 * aiConfig engages on its own mode; the enforcement lane is always engaged —
 * see the keyValidators entry below).
 */
function validateAuthority(key, ctx, engaged) {
    const { req, current } = ctx;
    const enforcement = (current || {}).enforcement;
    const live = engaged !== undefined ? engaged
        : isPlainObject(enforcement) && enforcement.mode === 'on';
    if (!live) return { ok: true };
    if (isLocalhostReq(req)) return { ok: true };
    // The enforcement lane is GM-owned in EVERY mode (caller passes blob-changed
    // ⇒ engaged), so the literal engaged-mode suffix would be a lie on a
    // mode:'off'/'absent' enforcement refusal. Other always-engaged keys
    // (activeCreatureName, __map__) keep their byte-identical legacy copy.
    const enforcementEngaged = isPlainObject(enforcement) && enforcement.mode === 'on';
    const suffix = (key === 'enforcement' && !enforcementEngaged)
        ? ' — enforcement is GM-owned in every mode'
        : ' while it is engaged';
    return {
        ok: false,
        reason: `only localhost (the GM) may change ${key}${suffix}`,
    };
}

function isLocalhostReq(req) {
    return req.hostname === 'localhost' || req.hostname === '127.0.0.1';
}

// Canonical state = the full ENFORCEMENT_FLAGS set (absent keys read as their
// defaults: mode 'off', sub-flags false), so the comparison reports *state*
// changes, not key ordering or partial-shape noise: a byte-identical re-post
// is a no-op and stays open to every origin; ANY real change — master engage
// or a single sub-flag while mode stays 'off' — is an act of authority.
function enforcementBlobChanged(value, current) {
    return JSON.stringify(canonicalizeEnforcement(value)) !== JSON.stringify(canonicalizeEnforcement(current));
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
        if (!isLocalEndpoint(value.endpoint)) return { ok: false, reason: 'aiConfig.endpoint must be a LOCAL http(s) URL — campaign data never leaves this machine' };
        if (typeof value.model !== 'string' || value.model.trim() === '') return { ok: false, reason: 'aiConfig.model is required when AI is on' };
    }
    if (value.temperature !== undefined && !isTemperature(value.temperature)) return { ok: false, reason: 'aiConfig.temperature must be a number 0..2' };
    if (value.provider !== undefined && !PROVIDERS[value.provider]) return { ok: false, reason: `aiConfig.provider must be one of: ${Object.keys(PROVIDERS).join(', ')}` };
    return { ok: true };
}

function isTemperature(t) {
    return typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= 2;
}

function validateLegendaryUsesProp(uses) {
    if (uses === undefined || uses === null) return { ok: true };
    if (!isPlainObject(uses)) return { ok: false, reason: 'monsterLegendaryUses must be {max, used} or null' };
    if (!Number.isInteger(uses.max) || uses.max < 1) return { ok: false, reason: 'monsterLegendaryUses.max must be a positive integer' };
    if (!Number.isInteger(uses.used) || uses.used < 0) return { ok: false, reason: 'monsterLegendaryUses.used must be a non-negative integer' };
    if (uses.used > uses.max) return { ok: false, reason: `monsterLegendaryUses.used ${uses.used} exceeds max ${uses.max}` };
    return { ok: true };
}

function validateLegendaryLatchProp(latch) {
    if (latch === undefined || latch === null) return { ok: true };
    if (!isPlainObject(latch)) return { ok: false, reason: '_legendaryUses_usedRound must be {round, activeCreature} or null' };
    if (!nonNegNumber(latch.round)) return { ok: false, reason: '_legendaryUses_usedRound.round must be a non-negative number' };
    return { ok: true };
}

function validateLegendaryCooldownsProp(cooldowns) {
    if (cooldowns === undefined || cooldowns === null) return { ok: true };
    if (!isPlainObject(cooldowns)) return { ok: false, reason: 'monsterLegendaryActionCooldowns must be an object keyed by action slug or null' };
    for (const [slug, entry] of Object.entries(cooldowns)) {
        if (!isPlainObject(entry) || !nonNegNumber(entry.round)) {
            return { ok: false, reason: `monsterLegendaryActionCooldowns.${slug} must be {round, usedBefore}` };
        }
    }
    return { ok: true };
}

function validateRechargeMapProp(recharge) {
    if (recharge === undefined || recharge === null) return { ok: true };
    if (!isPlainObject(recharge)) return { ok: false, reason: 'monsterRecharge must be an object keyed by action or null' };
    for (const [actionKey, entry] of Object.entries(recharge)) {
        if (!isPlainObject(entry)) return { ok: false, reason: `monsterRecharge.${actionKey} must be {recharged, threshold}` };
        if (typeof entry.recharged !== 'boolean') return { ok: false, reason: `monsterRecharge.${actionKey}.recharged must be boolean` };
        const t = entry.threshold;
        if (!(Number.isInteger(t) && t >= 1 && t <= 6)) {
            return { ok: false, reason: `monsterRecharge.${actionKey}.threshold must be an integer 1..6 (d6), got ${JSON.stringify(t)}` };
        }
    }
    return { ok: true };
}

function validateSessionState(value) {
    if (value === null) return { ok: true }; // unset ⇒ exploration default (today's behavior)
    if (!isPlainObject(value)) return { ok: false, reason: 'sessionState must be null or { phase, changedBy, changedAt }' };
    const phases = ['exploration', 'encounter', 'travel', 'roleplay'];
    if (!phases.includes(value.phase)) return { ok: false, reason: `sessionState.phase must be one of: ${phases.join(', ')}` };
    if (value.changedBy !== undefined && typeof value.changedBy !== 'string') return { ok: false, reason: 'sessionState.changedBy must be a string' };
    if (value.changedAt !== undefined && !Number.isFinite(Number(value.changedAt))) return { ok: false, reason: 'sessionState.changedAt must be a number' };
    return { ok: true };
}

// '__map__' is the active-map pointer every range gate consults. The server owns
// it (the activate route stamps it, campaigns routes clear it with the map); the
// client-side stamp in MapContextSync is a GM-tab heal-after-admin-wipe — every
// read-only tab force-posting it is the auto-write lane family of
// bug-player-clients-clobber-fog-reset. Always engaged: there is no state of the
// campaign in which a non-GM client legitimately moves the pointer.
function validateMapContext(value) {
    if (value === null) return { ok: true }; // honest clear (no active map)
    if (!isPlainObject(value)) return { ok: false, reason: '__map__ must be null or { activeMapName }' };
    if (value.activeMapName !== undefined && value.activeMapName !== null && typeof value.activeMapName !== 'string') {
        return { ok: false, reason: '__map__.activeMapName must be a string or null' };
    }
    return { ok: true };
}

/**
 * H1 hardening (§17): monster-side economy shape validation inside creature
 * store writes (POST /:campaign/:storeName posts the full store). The MA
 * engines (monsterLegendaryUses/monsterRecharge) enforce the rules client-side
 * since forever — this cannot forge what the shape cannot express: a client
 * cannot self-heal exhausted legendary uses past max, invent fractional
 * spends, or smuggle a recharge entry that never d6s. Well-formed writes
 * (every honest client today) pass byte-identical; malformed shapes are
 * refused loudly at the chokepoint and the mirrored store keeps prior truth.
 */
function validateMonsterEconomyProps(value) {
    if (!isPlainObject(value)) return { ok: true }; // scalar store ⇒ nothing to scan
    for (const check of [
        [validateLegendaryUsesProp, value.monsterLegendaryUses],
        [validateLegendaryLatchProp, value._legendaryUses_usedRound],
        [validateLegendaryCooldownsProp, value.monsterLegendaryActionCooldowns],
        [validateRechargeMapProp, value.monsterRecharge],
    ]) {
        const result = check[0](check[1]);
        if (!result.ok) return result;
    }
    return { ok: true };
}

// Serial validators may refine the payload: a step returning { ok, value }
// hands its canonicalized value to the next step and up to the route (the
// enforcement lane persists the full canonical blob, never the raw subset).
function chain(...validators) {
    return (value, ctx) => {
        let current = value;
        for (const validator of validators) {
            const result = validator(current, ctx);
            if (!result.ok) return result;
            if ('value' in result) current = result.value;
        }
        return { ok: true, value: current };
    };
}

export const keyValidators = {
    // Enforcement engages GM authority on its OWN master mode (§12), mirroring
    // the aiConfig engage-guard below — and engaging counts: a WRITE that turns
    // enforcement on is itself an act of authority. Without this, a disengaged
    // campaign could be silently turn-locked table-wide by any LAN client with a
    // curl (the grief window: the engaged guard then 400s the same client trying
    // to stop it, so only the GM tab can un-ring what a player client rang).
    // 2026-10-25 (owner-approved): the residual LAN lane CLOSED — sub-flag
    // staging that never engages is authority too (see the guard comment below).
    // enforcement's mode enum stays 'off'|'on' (see MODES above).
    enforcement: chain(validateEnforcement, (v, ctx) => validateAuthority('enforcement', ctx,
        // GM-owned in EVERY mode (backlog 2026-10-25): a write that ENGAGES is
        // itself an act of authority (0b6492583), and since that fix the residual
        // was sub-flag staging with mode:'off' — accepted 200 from any origin, so
        // a LAN client could pre-seed flags that the GM's next engage rides into
        // (the panel posts its live draft blob, 161ee52c1 zeroes only on a GM
        // master-off click). Engaged is therefore TRUE whenever the write would
        // ALTER enforcement state; the only open LAN lane is the no-op re-post of
        // byte-identical state (0 change, 200 — guard shape preserved).
        enforcementBlobChanged(v, ctx.current?.enforcement))),
    turnState: validateTurnState,
    // L5 Phase 4 (§10.1): session orchestration truth — shape only, phase
    // enum pinned; unset ⇒ 'exploration' (today's implicit default).
    sessionState: validateSessionState,
    // AI config engages GM authority on its OWN mode (§12), not the
    // enforcement master — and engaging counts: a WRITE that turns the AI on
    // is itself an act of authority, so an AI-off campaign cannot be
    // silently autopiloted by a random client.
    aiConfig: chain(validateAiConfig, (v, ctx) => validateAuthority('aiConfig', ctx,
        (isPlainObject(v) && v.mode && v.mode !== 'off')
        || (isPlainObject(ctx.current?.aiConfig) && ctx.current.aiConfig.mode !== 'off'))),
    // '__map__' is GM-owned (engaged always true): read-only clients must not
    // move the active-map pointer (auto-write lane of bug-player-clients-clobber-fog-reset).
    '__map__': chain(validateMapContext, (v, ctx) => validateAuthority('__map__', ctx, true)),
    // Turn-admin truth is GM-owned (engaged always true): the initiative pointer
    // and its turn-start stamp advance ONLY through the GM's Prev/Next/Clear/
    // End-Turn lane — no honest player tab ever posts these keys (the card lanes
    // ride combatSummary target writes instead). Server backstop of
    // bug-player-clients-can-hijack-initiative: a LAN client forging a turn
    // turnover is refused with the standard 400 + enforcement_denied audit log.
    'activeCreatureName': (v, ctx) => validateAuthority('activeCreatureName', ctx, true),
    'lastAppliedTurnStartCreature': (v, ctx) => validateAuthority('lastAppliedTurnStartCreature', ctx, true),
};

/**
 * Run the validator (if any) for a change-data key write.
 * @returns {{ ok: boolean, reason?: string, value?: any }} — `value` is the
 * canonicalized payload to persist when a validator normalizes (enforcement);
 * absent ⇒ the route stores the raw value exactly as before.
 */
export function validateRuntimeWrite(key, value, ctx) {
    const validator = keyValidators[key];
    if (!validator) {
        // Unregistered key ⇒ today's pass-through — plus the H1 monster-economy
        // property scan (§17): creature stores ride the same chokepoint, and the
        // scan only bites on shapes no honest client ever posts.
        return validateMonsterEconomyProps(value);
    }
    try {
        return validator(value, ctx);
    } catch (e) {
        // A defect in a validator must never brick the shared store — fail OPEN
        // with a loud error (writes keep working, humans get the alarm).
        console.error('[keyValidators] validator threw, failing open:', key, e);
        return { ok: true };
    }
}
