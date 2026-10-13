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

const ACTION_BUCKETS = new Set(['action', 'bonusAction']);

/**
 * Infer the economy bucket from an action/attack row's metadata
 * (single source of the bonus-vs-action decision until Phase 1's
 * classifyBucket formalizes the full taxonomy — plan §7.2).
 */
export function bucketForAction(action) {
    const auto = action?.automation
    const castingTime = String(auto?.casting_time || action?.casting_time || auto?.castTime || '')
    if (auto?.action === 'bonus_action' || /bonus\s*action/i.test(castingTime) || action?.type === 'Bonus Action') return 'bonusAction'
    return 'action'
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

/** Active creature: live campaign key first, combatSummary mirror as fallback
 *  (initiative writes the boundary via storage.set; the store copy can lag SSE).
 *  Reads the mirror via getStore — getRuntimeValue guards campaign-key/char-key pairs. */
function readActiveCreatureName() {
    return getRuntimeValue('campaign', 'activeCreatureName')
        || getStore('combatSummary')?.get?.('activeCreatureName')
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

    if (!result.allowed) reportDenial(ctx, result.reason);
    return result;
}
