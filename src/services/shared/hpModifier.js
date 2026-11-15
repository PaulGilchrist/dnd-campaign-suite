import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Canonical dead detection: PC truth is the runtime store (combatSummary player
// entries are 1/1 placeholders — pitfall 37); monsters carry real HP on the
// combatSummary entry (CLA-303).
export function isCreatureDead(combatSummary, creatureName) {
  const creature = combatSummary?.creatures?.find(c => c.name === creatureName);
  if (!creature) return false;
  if (creature.type === 'player') {
    // HP-consistent corpse (HoUoM collectCorpseTargets precedent): the bucket's
    // currentHitPoints is canonical and DECIDES — a stale isDead latch left by a
    // desynced writer must not invert a positive-HP bucket into a corpse
    // (bug-revivify-stale-isdead-negative-heal: Revivify's `1 - oldHp` delta went
    // negative and a revive drained a living ally). The isDead flag only
    // corroborates when the bucket carries no HP to check against.
    const isDead = getRuntimeValue(creature.name, 'isDead');
    const currentHp = getRuntimeValue(creature.name, 'currentHitPoints');
    if (currentHp != null) return Number(currentHp) <= 0;
    return !!isDead;
  }
  return creature.currentHp != null && Number(creature.currentHp) <= 0;
}

// Shared HP ladder for both lanes (the fix#352(a) twin-byte idiom now literally
// shares one implementation): floor at 0, upper clamp only on a KNOWN max
// (Math.min(undefined, n) === NaN once poisoned the summary), then the
// heal-never-drains floor (bug-hoh-negative-heal-stale-snapshot-clamp): a
// POSITIVE delta must never write a lower HP — an upper clamp below the current
// value (a stale row max, e.g. a 1/1 Initiative fan-out placeholder under a
// healed-up bucket, or a GM maxHp edit below current) would otherwise turn a
// heal into a drain and log it as isHealing:true. maxHp 0 is exempt: the
// ??-fallback STRUCT pin (hpModifier.test.js) preserves that impossible-RAW
// lane's bytes.
function clampHpLadder(oldHp, delta, maxHp) {
  let newHp = Math.max(0, oldHp + delta);
  if (maxHp != null) {
    newHp = Math.min(maxHp, newHp);
  }
  if (delta > 0 && maxHp > 0 && newHp < oldHp) {
    newHp = oldHp;
  }
  return newHp;
}

// Player leg of the ladder (extracted to keep modifyHitPoints within the
// complexity budget): resolves oldHp/newHp from runtime truth and either
// DEFERS the write (opt-in CLA-092 seam — value returned as deferredHpWrite
// for the commit owner) or performs the historical setRuntimeValue in place.
function resolvePlayerHp(creature, delta, maxHp, campaignName, deferWrite) {
  const oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
  const newHp = clampHpLadder(oldHp, delta, maxHp);
  if (deferWrite) {
    return { oldHp, newHp, deferredHpWrite: newHp };
  }
  setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
  return { oldHp, newHp, deferredHpWrite: null };
}

// options (all opt-in — every existing caller/shape stays byte-identical):
//   deferPlayerHpWrite: the player leg SKIPS its setRuntimeValue('currentHitPoints')
//     and instead carries the resolved value on the result as `deferredHpWrite`
//     (also suppressing the 'combat-summary-updated' dispatch — the commit owner
//     dispatches AFTER writing, preserving write-before-event order). Used ONLY by
//     applyHealingToTarget's choke so a revive (oldHp<=0 -> newHp>0) can fold the
//     HP + death-state reset into ONE setRuntimeBatch POST (CLA-092 write-batching,
//     handOfUltimateMercy/CharHitPoints one-POST idiom) instead of HP-POST + three
//     sequential reset-POSTs (4 SSE echoes -> 1).
export function modifyHitPoints(combatSummary, targetName, delta, campaignName, options = {}) {
  if (!combatSummary || !combatSummary.creatures) {
    return null;
  }

  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) {
    return null;
  }

  const isPlayer = creature.type === 'player';
  const maxHp = isPlayer
    ? (getRuntimeValue(creature.name, 'hitPoints') ?? creature.maxHp)
    : creature.maxHp;

  let oldHp, newHp;
  let deferredHpWrite = null;
  if (isPlayer) {
    ({ oldHp, newHp, deferredHpWrite } =
      resolvePlayerHp(creature, delta, maxHp, campaignName, options.deferPlayerHpWrite));
  } else {
    // fix#352(a): twin-byte parity with the player leg — '?? 0' (absent HP is a
    // zero: this file's zero-is-data stance, the pin at hpModifier.test.js
    // 'currentHitPoints null defaults oldHp to 0') and the shared clampHpLadder
    // (upper clamp only on a known max, heal-never-drains floor).
    // Non-finite HP (NaN delta, non-numeric currentHp on the entry) is
    // LOUD-refused with ZERO write and ZERO dispatch — NaN never lands on
    // combatSummary.currentHp and never rides the event (fix#337S stamp).
    oldHp = creature.currentHp ?? 0;
    newHp = clampHpLadder(oldHp, delta, maxHp);
    if (!Number.isFinite(oldHp) || !Number.isFinite(newHp)) {
      console.error(`modifyHitPoints: non-finite HP for ${creature.name} (currentHp=${String(creature.currentHp)}, delta=${String(delta)}, maxHp=${String(maxHp)}) — refused, no write, no dispatch`);
      return null;
    }
    creature.currentHp = newHp;
  }

  const actualDelta = newHp - oldHp;

  // Deferred lane: the commit owner (applyHealingToTarget) dispatches once the
  // write has landed, so listeners never read a stale currentHitPoints.
  if (actualDelta !== 0 && deferredHpWrite === null) {
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
  }

  const result = { oldHp, newHp, delta: actualDelta, isPlayer, creature, maxHp };
  // Only present on the opt-in defer lane (hpModifier.test.js toStrictEqual
  // pins keep the default result shape byte-identical for every other caller).
  if (deferredHpWrite !== null) {
    result.deferredHpWrite = deferredHpWrite;
  }
  return result;
}
