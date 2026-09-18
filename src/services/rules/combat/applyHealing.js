
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { modifyHitPoints } from '../../shared/hpModifier.js';
import { isHealingBlocked, blockedHealResult } from './healingBlock.js';
import { removeInfernalWoundOnHeal } from '../features/infernalWoundService.js';

export function applyHealingToTarget(combatSummary, targetName, healAmount, campaignName) {
    if (isHealingBlocked(targetName, campaignName, healAmount)) {
        return blockedHealResult(combatSummary, targetName, campaignName);
    }
    const result = modifyHitPoints(combatSummary, targetName, healAmount, campaignName);
    if (!result) return null;

    const { isPlayer, oldHp, newHp, delta, creature } = result;

    // MA-0367: ANY Hit Points restored to the target closes its Infernal
    // Wound + cancels the 1-minute clock (MA-0016 heal choke point). Fire-and-
    // await on the actual-healed amount; no-op when the target is unwounded.
    if (delta > 0) {
        removeInfernalWoundOnHeal(targetName, campaignName).catch((e) => { console.error('[applyHealing:infernal-wound-close]', e); });
    }

    if (isPlayer && oldHp <= 0 && newHp > 0) {
        setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
        setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
        setRuntimeValue(creature.name, 'isDead', 0, campaignName);
    }

    if (!isPlayer && delta !== 0) {
        storage.set('combatSummary', combatSummary, campaignName);
    }

    return { actualHeal: delta, oldHp, newHp, maxHp: result.maxHp };
}
