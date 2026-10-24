/**
 * Level 5 — generic per-creature turn economy (L5-001).
 *
 * Pure functions over the campaign-level `turnState` runtime key:
 *   turnState = { [creatureName]: { actionsUsed, bonusActionsUsed, reactionsUsed,
 *                                    movementUsedFeet, hasMoved, turnActive } }
 *
 * Orthogonal to the existing per-feature round latches (PLAYER_ROUND_LATCH_KEYS) —
 * those stay as-is. Charges economy SLOTS, never class resources (ki, Focus Points,
 * Superiority Dice keep their own latches), so this module is ruleset-agnostic.
 *
 * Persistence lives with the caller (storage.set('turnState', …, campaignName) next
 * to the existing combatSummary stamps in initiative navigationHandlers).
 */

// Economy bucket caps. Reactions re-arm at round wrap; the rest at turn start.
export const BUCKET_CAPS = Object.freeze({
    action: 1,
    bonusAction: 1,
    reaction: 1,
});

/** Buckets that never charge an economy slot (free interactions, legendary/special). */
const FREE_BUCKETS = new Set(['free', 'special', 'legendary', 'passive', 'none']);

/** §18 D1/D2 sane bounds — the server validator enforces these; the client
 * floors junk so a corrupted store can never grant unlimited reactions or
 * orphan a companion link. */
export const REACTION_CAP_MAX = 3;

export function emptyTurnEntry() {
    return {
        actionsUsed: 0,
        bonusActionsUsed: 0,
        reactionsUsed: 0,
        movementUsedFeet: 0,
        hasMoved: false,
        turnActive: false,
        // §18 D1: per-creature reaction cap (default 1; features may raise it
        // — Sentinel-style grants, monster multi-reactions).
        reactionCap: 1,
        // §18 D2: commanded creatures (companion/steed/familiar/undead) act
        // on their OWNER's turn; the owner's own economy is untouched.
        companionOf: null,
    };
}

/**
 * Read a creature's economy entry, defaulting to a fresh empty state when absent.
 * Never returns undefined — callers can destructure unconditionally.
 */
export function getTurnState(turnState, creatureName) {
    const entry = turnState && turnState[creatureName];
    if (!entry || typeof entry !== 'object') return emptyTurnEntry();
    const cap = Math.floor(Number(entry.reactionCap));
    const companion = typeof entry.companionOf === 'string' && entry.companionOf.trim() !== '' ? entry.companionOf : null;
    return {
        // #1070 fix#363 defense-in-depth clamp: forged negative counters would
        // over-grant budget at hasBudget (: -5 < cap === true). Identity on every
        // legitimate non-negative counter write; negatives floor to 0.
        actionsUsed: Math.max(0, Number(entry.actionsUsed) || 0),
        bonusActionsUsed: Math.max(0, Number(entry.bonusActionsUsed) || 0),
        reactionsUsed: Math.max(0, Number(entry.reactionsUsed) || 0),
        movementUsedFeet: Math.max(0, Number(entry.movementUsedFeet) || 0),
        hasMoved: !!entry.hasMoved,
        turnActive: !!entry.turnActive,
        reactionCap: Number.isFinite(cap) && cap >= 1 && cap <= REACTION_CAP_MAX ? cap : 1,
        companionOf: companion,
    };
}

/** Budget cap for a bucket on a given creature (§18 D1: features raise reaction). */
export function budgetCap(turnState, creatureName, bucket) {
    if (bucket === 'reaction') return getTurnState(turnState, creatureName).reactionCap;
    return BUCKET_CAPS[bucket];
}

/** True when the creature still has budget in `bucket` (free buckets always pass). */
export function hasBudget(turnState, creatureName, bucket) {
    if (FREE_BUCKETS.has(bucket)) return true;
    const cap = budgetCap(turnState, creatureName, bucket);
    if (cap === undefined) return true; // unknown bucket → do not invent enforcement
    return getTurnState(turnState, creatureName)[`${bucket}sUsed`] < cap;
}

/**
 * Charge one economy slot. Returns the new full turnState object (caller persists).
 * Idempotent refusal: when the bucket is exhausted the state is returned unchanged
 * and ok:false — the caller (assertCanAct) must surface the reason BEFORE calling.
 */
export function spend(turnState, creatureName, bucket) {
    const cap = budgetCap(turnState, creatureName, bucket);
    if (cap === undefined || FREE_BUCKETS.has(bucket)) {
        return { ok: true, turnState: turnState || {} };
    }
    if (!hasBudget(turnState, creatureName, bucket)) {
        return { ok: false, turnState: turnState || {} };
    }
    const next = { ...(turnState || {}) };
    const entry = getTurnState(turnState, creatureName);
    const field = `${bucket}sUsed`;
    next[creatureName] = { ...entry, [field]: entry[field] + 1 };
    return { ok: true, turnState: next };
}

/** Movement cap fallback when a creature has no known speed (30 ft is the common baseline). */
export const DEFAULT_SPEED_FEET = 30;

/**
 * Un-charge one economy slot (modal-cancel / referee correction seam, L5-002).
 * Mirrors spend(); floors at 0. Returns the new turnState (caller persists).
 */
export function refund(turnState, creatureName, bucket) {
    const cap = BUCKET_CAPS[bucket];
    if (cap === undefined || FREE_BUCKETS.has(bucket)) {
        return { ok: true, turnState: turnState || {} };
    }
    const entry = getTurnState(turnState, creatureName);
    const field = `${bucket}sUsed`;
    if (entry[field] === 0) return { ok: false, turnState: turnState || {} };
    const next = { ...(turnState || {}) };
    next[creatureName] = { ...entry, [field]: entry[field] - 1 };
    return { ok: true, turnState: next };
}


/** Remaining movement for a creature with `speedFeet` this turn (≥0). */
export function remainingMovement(turnState, creatureName, speedFeet) {
    const speed = Number.isFinite(speedFeet) && speedFeet >= 0 ? speedFeet : DEFAULT_SPEED_FEET;
    const used = getTurnState(turnState, creatureName).movementUsedFeet;
    return Math.max(0, speed - used);
}

/**
 * Charge movement feet (clamped ≥0). Returns { ok, feetCharged, turnState } where
 * feetCharged may be less than requested when the budget runs out (caller snaps the
 * token to the clamped distance). ok:false only when nothing at all could be charged.
 */
export function spendMovement(turnState, creatureName, feet) {
    const amount = Number.isFinite(feet) ? Math.max(0, Math.floor(feet)) : 0;
    const entry = getTurnState(turnState, creatureName);
    if (amount === 0) {
        return { ok: true, feetCharged: 0, turnState: turnState || {} };
    }
    const next = { ...(turnState || {}) };
    next[creatureName] = { ...entry, movementUsedFeet: entry.movementUsedFeet + amount, hasMoved: true };
    return { ok: true, feetCharged: amount, turnState: next };
}

/** Reset one creature's per-turn economy (called from turn-transition seams). */
export function resetForTurn(turnState, creatureName) {
    const next = { ...(turnState || {}) };
    const entry = getTurnState(turnState, creatureName);
    next[creatureName] = {
        ...entry,
        actionsUsed: 0,
        bonusActionsUsed: 0,
        movementUsedFeet: 0,
        hasMoved: false,
        turnActive: true,
    };
    return next;
}

/** Mark a creature's turn as closed (outgoing creature on turn transition). */
export function closeTurn(turnState, creatureName) {
    const next = { ...(turnState || {}) };
    const entry = getTurnState(turnState, creatureName);
    next[creatureName] = { ...entry, turnActive: false };
    return next;
}

/**
 * Re-open a creature's turnActive flag WITHOUT refunding spent budgets —
 * used by initiative rewind, which (like the CLA-307 turn-end passes) is
 * not a real turn boundary. Budget restoration belongs to snapshot undo.
 */
export function openTurn(turnState, creatureName) {
    const next = { ...(turnState || {}) };
    const entry = getTurnState(turnState, creatureName);
    next[creatureName] = { ...entry, turnActive: true };
    return next;
}

/**
 * Re-arm the once-per-round reaction budget for every creature (round-wrap seam).
 * Movement/actions reset per-turn in resetForTurn, so they are untouched here.
 * §18 D1: feature-granted reactionCap PERSISTS across the wrap (it is a
 * standing grant, not a per-round charge); only reactionsUsed re-arms.
 */
export function rearmReactions(turnState) {
    const next = { ...(turnState || {}) };
    for (const name of Object.keys(next)) {
        next[name] = { ...getTurnState(next, name), reactionsUsed: 0 };
    }
    return next;
}

/**
 * §18 D2 — register a commanded creature: its own turnState entry, linked to
 * its owner. Economy charges land on the companion's own entry; the command
 * itself is charged to the OWNER on the owner's own lane (as authored).
 * Returns the new turnState (caller persists). Re-registration only re-links
 * (never refunds spent budget).
 */
export function registerCompanion(turnState, companionName, ownerName) {
    if (!companionName || !ownerName || companionName === ownerName) return turnState || {};
    const next = { ...(turnState || {}) };
    const entry = getTurnState(next, companionName);
    next[companionName] = { ...entry, companionOf: ownerName };
    return next;
}
