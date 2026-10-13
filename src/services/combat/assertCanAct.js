/**
 * Level 5 — impure wrapper around the pure canTakeAction gate (L5-001).
 *
 * Reads the enforcement flags / turn economy / active creature / blocker
 * targetEffects from the shared runtime store, runs the pure decision, and on
 * denial surfaces the reason (popup) + logs to the campaign log (AGENTS.md:
 * every automation logs when triggered).
 *
 * Fast path: enforcement.mode !== 'on' short-circuits on a single in-memory
 * Map read — zero behavior change and zero network traffic for Levels 1–4.
 *
 * Wiring: call sites swap `if (cannotAct) return;` (or add to unguarded
 * executors):
 *   if (!assertCanAct({ campaignName, creatureName, bucket, cannotAct, setPopupHtml, source }).allowed) return;
 */
import { getRuntimeValue, getStore } from '../../hooks/runtime/useRuntimeState.js';
import { canTakeAction } from './canTakeAction.js';
import { hasBudget } from './turnState.js';
import { addEntry } from '../ui/logService.js';
import { classifyBucket, isChargeableBucket } from './automation/classifyBucket.js';
import { chargeSlot } from './chargeEconomy.js';

const ACTION_BUCKETS = new Set(['action', 'bonusAction']);

/**
 * Infer the economy bucket from an action/attack row's metadata — delegates
 * to classifyBucket, the single taxonomy shared with the automation router
 * consumers (plan §7.2). Never returns undefined.
 */
export function bucketForAction(action) {
    return classifyBucket(action);
}

/** Blocker targetEffects search — SP-111 Stinking Cloud / no_reactions shapes. */
function resolveBlockers(creatureName, bucket) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    return targetEffects.find(te => te && te.target === creatureName && (
        (ACTION_BUCKETS.has(bucket) && te.effect === 'no_action_and_bonus_action') ||
        (bucket === 'reaction' && te.effect === 'no_reactions')
    )) || null;
}

/** Enforcement flag read (shared truth; fast-path gate lives here). */
function readEnforcement() {
    const enforcement = getRuntimeValue('campaign', 'enforcement');
    return { enforcement, enforcementOn: !!(enforcement && enforcement.mode === 'on') };
}

/** Blocker targetEffects → lane flags (action/bonus vs reaction). */
function resolveBlockerFlags(ctx) {
    const te = resolveBlockers(ctx.creatureName, ctx.bucket);
    if (!te) return {};
    const fallback = ctx.bucket === 'reaction' ? 'A zone effect blocks reactions.' : "Can't take an Action or Bonus Action";
    if (ACTION_BUCKETS.has(ctx.bucket)) return { cannotActActions: true, cannotActReason: te.reason || fallback };
    return { cannotAct: true, cannotActReason: te.reason || fallback };
}

/** Active creature resolution:
 *  - Combat is live (enforcement ON) ⇒ combatSummary is authoritative: it is
 *    an OBJECT, so every transition updates it via SSE (initiative writes
 *    both the object and a boundary stamp; scalar change events are ignored
 *    by the client's change-key handler, so the campaign-key copy only
 *    refreshes on full loads and can go stale mid-session).
 *  - No combat ⇒ campaign key (seeded by the change-data load; CLA-044
 *    precedence preserved outside combat).
 *  Reads the mirror via getStore — getRuntimeValue guards campaign-key/char-key pairs. */
function readActiveCreatureName(enforcementOn) {
    const summaryActive = enforcementOn
        ? getStore('combatSummary')?.get?.('activeCreatureName')
        : null;
    return summaryActive
        || getRuntimeValue('campaign', 'activeCreatureName')
        || null;
}

/** Popup + audit log on denial (audit requires campaignName; popup sink optional per call site). */
function reportDenial(ctx, reason) {
    const { campaignName, creatureName, bucket, source, setPopupHtml } = ctx;
    if (typeof setPopupHtml === 'function') setPopupHtml(reason);
    if (campaignName) {
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: creatureName,
            bucket,
            source,
            reason,
        }).catch((e) => { console.error('[assertCanAct] denial log failed:', e); });
    }
}

/**
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string} ctx.creatureName            acting creature/character name
 * @param {string} [ctx.bucket]                'action' | 'bonusAction' | 'reaction' | 'free' | …
 * @param {boolean} [ctx.cannotAct]            existing condition-gate result (fed in unchanged)
 * @param {boolean} [ctx.cannotActActions]     optional precomputed action/bonus block
 * @param {string|null} [ctx.cannotActReason]  optional precomputed reason
 * @param {Function} [ctx.setPopupHtml]        deny-reason UI sink (call-site popup)
 * @param {string} [ctx.source]                call-site label for the audit log
 * @param {boolean} [ctx.charge]               L5-002: when true AND the gate
 *                                             allows, charge the bucket now
 *                                             (actionEconomy off ⇒ no-op). Use
 *                                             only at sites that EXECUTE on
 *                                             allow — modal-opening sites must
 *                                             charge at their confirm seam.
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function assertCanAct(input) {
    const ctx = { bucket: 'action', cannotAct: false, source: 'action', ...input };
    const { enforcement, enforcementOn } = readEnforcement();

    // Legacy silent condition gate — cannotAct denies regardless of enforcement.
    // Off-table UX stays silent (visual disabled state); enforcement-on adds the
    // reason popup + audit log.
    if (ctx.cannotAct) {
        const reason = ctx.cannotActReason || 'You cannot take actions right now.';
        if (enforcementOn) reportDenial(ctx, reason);
        return { allowed: false, reason };
    }

    // Fast path — enforcement off (the default) is today's behavior, untouched.
    if (!enforcementOn) return { allowed: true, reason: null };

    const blockers = resolveBlockerFlags(ctx);
    const result = canTakeAction({
        enforcement,
        creatureName: ctx.creatureName,
        bucket: ctx.bucket,
        activeCreatureName: readActiveCreatureName(),
        turnState: getRuntimeValue('campaign', 'turnState'),
        cannotAct: !!blockers.cannotAct,
        cannotActActions: !!ctx.cannotActActions || !!blockers.cannotActActions,
        cannotActReason: ctx.cannotActReason || blockers.cannotActReason || null,
        hasBudget,
    });

    if (!result.allowed) {
        reportDenial(ctx, result.reason);
        return result;
    }

    // L5-002: charge-on-execute (plan §7.2). Sites that open a modal first
    // pass charge:false (default) and charge at their confirm seam — matching
    // the existing charge-on-resolve latch semantics. A failed charge here
    // means a double-click race consumed the slot between decision and
    // charge: deny rather than overspend.
    if (ctx.charge && enforcement.actionEconomy && isChargeableBucket(ctx.bucket)) {
        const charged = chargeSlot({ creatureName: ctx.creatureName, bucket: ctx.bucket, campaignName: ctx.campaignName });
        if (!charged) {
            const spent = { allowed: false, reason: 'No actions left this turn.' };
            reportDenial(ctx, spent.reason);
            return spent;
        }
    }

    return result;
}
