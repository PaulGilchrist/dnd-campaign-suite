
import { setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { modifyHitPoints } from '../../shared/hpModifier.js';
import { isHealingBlocked, blockedHealResult } from './healingBlock.js';
import { removeInfernalWoundOnHeal } from '../features/infernalWoundService.js';

export function applyHealingToTarget(combatSummary, targetName, healAmount, campaignName) {
    if (isHealingBlocked(targetName, campaignName, healAmount)) {
        return blockedHealResult(combatSummary, targetName, campaignName);
    }
    // CLA-092 write-batching: opt into modifyHitPoints' defer seam (the ONLY
    // production caller) so the player-HP commit happens HERE, folded with the
    // revive's death-state reset into a single POST (one SSE echo instead of
    // four). Every non-deferred lane (monsters, direct callers) is unchanged.
    const result = modifyHitPoints(combatSummary, targetName, healAmount, campaignName, { deferPlayerHpWrite: true });
    if (!result) return null;

    const { isPlayer, oldHp, newHp, delta, creature, deferredHpWrite } = result;

    // Commit the deferred player write (CLA-092 resurrection truth, mirroring
    // handOfUltimateMercyHandler/revivificationHandler/CharHitPoints): a revive
    // (oldHp<=0 -> newHp>0) lands currentHitPoints + deathSaves + deathFailures
    // + isDead in ONE setRuntimeBatch; every other player heal keeps the exact
    // historical single setRuntimeValue('currentHitPoints') POST.
    if (deferredHpWrite != null) {
        if (isPlayer && oldHp <= 0 && newHp > 0) {
            setRuntimeBatch(creature.name, {
                currentHitPoints: newHp,
                deathSaves: [false, false, false],
                deathFailures: [false, false, false],
                isDead: 0,
            }, campaignName);
        } else {
            setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
        }
        // modifyHitPoints suppressed its dispatch for the deferred lane — fire
        // it now that the write has landed (same non-zero-delta gate).
        if (delta !== 0) {
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    }

    // MA-0367: ANY Hit Points restored to the target closes its Infernal
    // Wound + cancels the 1-minute clock (MA-0016 heal choke point). Fire-and-
    // await on the actual-healed amount; no-op when the target is unwounded.
    if (delta > 0) {
        removeInfernalWoundOnHeal(targetName, campaignName).catch((e) => { console.error('[applyHealing:infernal-wound-close]', e); });
    }

    if (!isPlayer && delta !== 0) {
        storage.set('combatSummary', combatSummary, campaignName);
    }

    return { actualHeal: delta, oldHp, newHp, maxHp: result.maxHp };
}
