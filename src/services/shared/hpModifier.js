import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

export function modifyHitPoints(combatSummary, targetName, delta, campaignName) {
  if (!combatSummary || !combatSummary.creatures) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;

  const isPlayer = creature.type === 'player';
  const maxHp = isPlayer
    ? (getRuntimeValue(creature.name, 'hitPoints') ?? creature.maxHp)
    : creature.maxHp;

  let oldHp, newHp;
  if (isPlayer) {
    oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
    newHp = Math.min(maxHp, Math.max(0, oldHp + delta));
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
