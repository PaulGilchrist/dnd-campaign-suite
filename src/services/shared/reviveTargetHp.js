// Revive-family pre-payment invariant (improve 2026-11-15, zero-behaviour dedupe
// of the bd00b4d93 guards): a revive lane may only PAY (consume a diamond, spend
// Focus, burn Rage) while the resolved target HP is <= 0. Every lane pays via a
// delta of `healAmount - targetHp` (or Revivify's `1 - oldHp`), so a POSITIVE
// resolved HP silently inverts the resurrection into damage — clampHpLadder's
// heal-never-drains floor (hpModifier.js) only guards delta > 0, and the
// negative-delta face lived in bug-revivify-stale-isdead-negative-heal. The
// check ran inline in three lanes (revivifyService.validateBeforeConsume,
// handOfUltimateMercyHandler.commitResurrection, revivificationHandler.handle —
// the same HP-truth pair as isCreatureDead, hpModifier.js:9-21); it lives here
// once now. Refusal COPY, payload shape, console.error text and the surrounding
// read ORDER stay with each lane — this module owns only the HP read and the
// predicate.
//
// Absent-HP-key law per lane (all three pinned byte-identical pre-extraction):
// an absent bucket/row HP key DEFAULTS TO ZERO (treated as a corpse), it never
// falls back to the combatSummary row — unlike the DISPLAY twin
// resolveLiveTargetHp (healing/liveTargetHp.js) whose bucket-less players fall
// back to the row. Players are bucket-canonical (pitfall 37), monsters
// summary-canonical (CLA-303).
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Pre-payment HP truth of a combatSummary creature row: player -> runtime
// bucket `currentHitPoints ?? 0`; monster -> row `currentHp ?? 0`. Read once —
// callers reuse the value for the commit delta, so a mid-flight echo can never
// split one commit across two different HP truths.
export function resolveReviveTargetHp(creature) {
    if (creature.type === 'player') {
        return getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
    }
    return creature.currentHp ?? 0;
}

// The invariant verdict: any resolved HP above 0 means there is no resurrection
// to perform — the lane must refuse BEFORE it pays or consumes.
export function reviveTargetIsLiving(targetHp) {
    return targetHp > 0;
}
