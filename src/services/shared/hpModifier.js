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
    newHp = Math.max(0, oldHp + delta);
    if (maxHp != null) {
      newHp = Math.min(maxHp, newHp);
    }
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
  } else {
    // fix#352(a): mirror the player-leg guard idiom EXACTLY — twin byte :34
    // '?? 0' (absent HP is a zero: this file's zero-is-data stance, the
    // pin at hpModifier.test.js 'currentHitPoints null defaults oldHp to 0')
    // and twin bytes :36-38 'if (maxHp != null)' (upper clamp only on a
    // known max; Math.min(undefined, n) === NaN poisoned the summary).
    // Non-finite HP (NaN delta, non-numeric currentHp on the entry) is
    // LOUD-refused with ZERO write and ZERO dispatch — NaN never lands on
    // combatSummary.currentHp and never rides the event (fix#337S stamp).
    oldHp = creature.currentHp ?? 0;
    newHp = Math.max(0, oldHp + delta);
    if (maxHp != null) {
      newHp = Math.min(maxHp, newHp);
    }
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
