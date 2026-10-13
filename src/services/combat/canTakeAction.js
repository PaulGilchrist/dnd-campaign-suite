/**
 * Level 5 — the single enforcement decision (L5-001).
 *
 * Pure + synchronous: takes state, returns { allowed, reason }. No runtime-store
 * reads, no popup/log side effects — those belong to assertCanAct (the impure
 * wrapper) so the whole decision matrix is unit-testable in isolation.
 *
 * Short-circuit order (locked in the L5 plan §6.2):
 *   1. enforcement.mode === 'off' (or missing) → allowed  ← today's behavior
 *   2. condition gate (existing cannotAct / cannotActActions primitives)
 *   3. turn-lock (whose turn) — reactions/free stay allowed off-turn
 *   4. action economy (per-creature budget in `bucket`)
 *   5. spatial gates are additive later (Phase 2 wires range/LoS in)
 */

const ACTION_BUCKETS = new Set(['action', 'bonusAction']);

export const ENFORCEMENT_DEFAULTS = Object.freeze({
    mode: 'off',
    turnLock: false,
    actionEconomy: false,
    movementBudget: false,
    lineOfSight: false,
    zones: false,
    opportunityAttacks: false,
    serverDice: false,
    // L5-003 §8.1: teleport automations write real token gridX/gridY (via
    // the map save path) instead of only advisory prose. Off ⇒ byte-identical.
    tokenMoving: false,
    // L5 Phase 4 §10.2: accepting a travel combat event auto-starts the
    // initiative tracker (engine rolls). Off ⇒ Accept keeps today's map-only
    // behavior — the GM starts initiative manually.
    autoEncounters: false,
});

/** Merge campaign `enforcement` runtime value over defaults; never trusts shape. */
export function resolveEnforcement(enforcement) {
    if (!enforcement || typeof enforcement !== 'object') return { ...ENFORCEMENT_DEFAULTS };
    return { ...ENFORCEMENT_DEFAULTS, ...enforcement };
}

/** Step 2 — condition gate (existing primitives, unchanged semantics). */
function conditionDenial({ bucket, cannotAct, cannotActActions, cannotActReason }) {
    if (cannotAct) {
        return { allowed: false, reason: cannotActReason || 'You cannot take actions while incapacitated.' };
    }
    if (ACTION_BUCKETS.has(bucket) && cannotActActions) {
        return { allowed: false, reason: cannotActReason || 'Your condition blocks this action.' };
    }
    return null;
}

/** Step 3 — turn-lock: actions/bonus only on own turn; reactions/free off-turn are rules-correct. */
function turnLockDenial({ flags, bucket, creatureName, activeCreatureName }) {
    if (flags.turnLock && ACTION_BUCKETS.has(bucket) && creatureName !== activeCreatureName) {
        return {
            allowed: false,
            reason: `It is ${activeCreatureName || 'another creature'}'s turn — ${creatureName} cannot act now.`,
        };
    }
    return null;
}

/** Step 4 — economy budget pre-check for the economy buckets.
 * hasBudget is injected by assertCanAct; without an injected checker we do not
 * invent enforcement (graceful degradation keeps L1–4 untouched). */
function economyDenial({ flags, bucket, turnState, creatureName, hasBudget }) {
    if (!flags.actionEconomy || typeof hasBudget !== 'function') return null;
    if (hasBudget(turnState, creatureName, bucket)) return null;
    const label = bucket === 'action' ? 'No action' : bucket === 'bonusAction' ? 'No bonus action' : 'No reaction';
    return { allowed: false, reason: `${label} left this turn.` };
}

/**
 * @param {object} ctx
 * @param {object|null} ctx.enforcement       campaign 'enforcement' runtime value (or null)
 * @param {string} ctx.creatureName           who is attempting the action
 * @param {string} [ctx.bucket]               'action' | 'bonusAction' | 'reaction' | 'free' | …
 * @param {string|null} [ctx.activeCreatureName] combatSummary.activeCreatureName
 * @param {object|null} [ctx.turnState]       campaign 'turnState' runtime value (or null)
 * @param {boolean} [ctx.cannotAct]           existing condition-gate result
 * @param {boolean} [ctx.cannotActActions]   existing condition-gate action/bonus-only block
 * @param {string|null} [ctx.cannotActReason] existing condition-gate reason text
 * @param {Function} [ctx.hasBudget]          injectable budget check (turnState.hasBudget)
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canTakeAction(ctx = {}) {
    const {
        enforcement,
        creatureName,
        bucket = 'action',
        activeCreatureName = null,
        turnState = null,
        cannotAct = false,
        cannotActActions = false,
        cannotActReason = null,
        hasBudget,
    } = ctx;

    const flags = resolveEnforcement(enforcement);

    // 1. Master switch — off means byte-identical behavior to Levels 1–4.
    if (flags.mode !== 'on') return { allowed: true, reason: null };

    const gateState = { flags, bucket, creatureName, activeCreatureName, turnState, cannotAct, cannotActActions, cannotActReason, hasBudget };
    return conditionDenial(gateState)
        || turnLockDenial(gateState)
        || economyDenial(gateState)
        || { allowed: true, reason: null };
}
