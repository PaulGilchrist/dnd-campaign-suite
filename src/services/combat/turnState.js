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

export function emptyTurnEntry() {
    return {
        actionsUsed: 0,
        bonusActionsUsed: 0,
        reactionsUsed: 0,
        movementUsedFeet: 0,
        hasMoved: false,
        turnActive: false,
    };
}

/**
 * Read a creature's economy entry, defaulting to a fresh empty state when absent.
 * Never returns undefined — callers can destructure unconditionally.
 */
export function getTurnState(turnState, creatureName) {
    const entry = turnState && turnState[creatureName];
    if (!entry || typeof entry !== 'object') return emptyTurnEntry();
    return {
        actionsUsed: Number(entry.actionsUsed) || 0,
        bonusActionsUsed: Number(entry.bonusActionsUsed) || 0,
        reactionsUsed: Number(entry.reactionsUsed) || 0,
        movementUsedFeet: Number(entry.movementUsedFeet) || 0,
        hasMoved: !!entry.hasMoved,
        turnActive: !!entry.turnActive,
    };
}

/** True when the creature still has budget in `bucket` (free buckets always pass). */
export function hasBudget(turnState, creatureName, bucket) {
    if (FREE_BUCKETS.has(bucket)) return true;
    const cap = BUCKET_CAPS[bucket];
    if (cap === undefined) return true; // unknown bucket → do not invent enforcement
    return getTurnState(turnState, creatureName)[`${bucket}sUsed`] < cap;
}

/**
 * Charge one economy slot. Returns the new full turnState object (caller persists).
 * Idempotent refusal: when the bucket is exhausted the state is returned unchanged
 * and ok:false — the caller (assertCanAct) must surface the reason BEFORE calling.
 */
export function spend(turnState, creatureName, bucket) {
    const cap = BUCKET_CAPS[bucket];
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
 */
export function rearmReactions(turnState) {
    const next = { ...(turnState || {}) };
    for (const name of Object.keys(next)) {
        next[name] = { ...getTurnState(next, name), reactionsUsed: 0 };
    }
    return next;
}
