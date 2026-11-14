import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Canonical dead detection: PC truth is the runtime store (combatSummary player
// entries are 1/1 placeholders — pitfall 37); monsters carry real HP on the
// combatSummary entry (CLA-303).
export function isCreatureDead(combatSummary, creatureName) {
  const creature = combatSummary?.creatures?.find(c => c.name === creatureName);
  if (!creature) return false;
  if (creature.type === 'player') {
    const isDead = getRuntimeValue(creature.name, 'isDead');
    const currentHp = getRuntimeValue(creature.name, 'currentHitPoints');
    return !!isDead || (currentHp != null && Number(currentHp) <= 0);
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

export function modifyHitPoints(combatSummary, targetName, delta, campaignName) {
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
  if (isPlayer) {
    oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
    newHp = clampHpLadder(oldHp, delta, maxHp);
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
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

  if (actualDelta !== 0) {
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
  }

  return { oldHp, newHp, delta: actualDelta, isPlayer, creature, maxHp };
}
