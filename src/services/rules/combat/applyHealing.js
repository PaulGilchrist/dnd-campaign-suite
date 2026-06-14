
import { setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { modifyHitPoints } from '../../shared/hpModifier.js';

export function applyHealingToTarget(combatSummary, targetName, healAmount, campaignName) {
    const result = modifyHitPoints(combatSummary, targetName, healAmount, campaignName);
    if (!result) return null;

    const { isPlayer, oldHp, newHp, delta, creature } = result;

    if (isPlayer && oldHp <= 0 && newHp > 0) {
        setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
        setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
    }

    if (!isPlayer && delta !== 0) {
        storage.set('combatSummary', combatSummary, campaignName);
    }

    return { actualHeal: delta, oldHp, newHp };
}
