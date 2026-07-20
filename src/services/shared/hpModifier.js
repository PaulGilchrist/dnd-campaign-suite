import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

export function modifyHitPoints(combatSummary, targetName, delta, campaignName) {
  if (!combatSummary || !combatSummary.creatures) {
    const playerMaxHp = getRuntimeValue(targetName, 'hitPoints');
    if (playerMaxHp != null) {
      const oldHp = getRuntimeValue(targetName, 'currentHitPoints') ?? 0;
      const newHp = Math.min(playerMaxHp, Math.max(0, oldHp + delta));
      if (newHp !== oldHp) {
        setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
      }
      const actualDelta = newHp - oldHp;
      return { oldHp, newHp, delta: actualDelta, isPlayer: true, maxHp: playerMaxHp };
    }
    return null;
  }

  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) {
    const playerMaxHp = getRuntimeValue(targetName, 'hitPoints');
    if (playerMaxHp != null) {
      const oldHp = getRuntimeValue(targetName, 'currentHitPoints') ?? 0;
      const newHp = Math.min(playerMaxHp, Math.max(0, oldHp + delta));
      if (newHp !== oldHp) {
        setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
      }
      const actualDelta = newHp - oldHp;
      return { oldHp, newHp, delta: actualDelta, isPlayer: true, maxHp: playerMaxHp };
    }
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
    oldHp = creature.currentHp;
    newHp = Math.min(maxHp, Math.max(0, oldHp + delta));
    creature.currentHp = newHp;
  }

  const actualDelta = newHp - oldHp;

  if (actualDelta !== 0) {
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
  }

  return { oldHp, newHp, delta: actualDelta, isPlayer, creature, maxHp };
}
