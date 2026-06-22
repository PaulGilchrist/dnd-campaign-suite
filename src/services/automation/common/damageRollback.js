import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

/**
 * Get the last attack from combatSummary.lastAttack.
 * Single source of truth — contains attacker, target, d20, hit, damage, save info, spell/weapon info, etc.
 *
 * @returns {{ attackEvent: Object|null, attackerName: string|null, targetName: string|null, primaryDamage: number, secondaryDamage: number, totalDamage: number, damageTypes: string[] }}
 */
export async function findLastAttack() {
    const cs = await getCombatContext();
    if (!cs?.lastAttack || isStale(cs.lastAttack)) {
        return { attackEvent: null, attackerName: null, targetName: null, primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] };
    }
    const a = cs.lastAttack;
    const primary = a.primaryDamage || a.rawDamage || 0;
    const secondary = a.secondaryDamage || 0;
    return {
        attackEvent: a,
        attackerName: a.attackerName,
        targetName: a.targetName,
        primaryDamage: primary,
        secondaryDamage: secondary,
        totalDamage: primary + secondary,
        damageTypes: a.damageTypes || [],
    };
}

/**
 * Find the last attack roll targeting a specific player.
 * Uses combatSummary.lastAttack which is the single source of truth.
 *
 * @returns {{ attackEvent: Object|null, attackerName: string|null }}
 */
export async function findAttackRollAgainstTarget(targetName) {
    const result = await findLastAttack();
    if (!result.attackEvent) return { attackEvent: null, attackerName: null };
    if (result.targetName === targetName) {
        return { attackEvent: result.attackEvent, attackerName: result.attackerName };
    }
    return { attackEvent: null, attackerName: null };
}

/**
 * Rollback damage by healing the target for the last attack's total damage (primary + secondary).
 * Logs the rollback to the campaign log.
 *
 * @returns {number} The amount that was actually healed (may be 0 if target is at max HP)
 */
export async function rollbackDamage(attackerName, targetName, campaignName, featureName) {
    const result = await findLastAttack();
    if (!result.attackEvent) return 0;

    const a = result.attackEvent;
    if (a.attackerName !== attackerName || a.targetName !== targetName) return 0;
    if (!result.totalDamage || result.totalDamage <= 0) return 0;

    const cs = await getCombatContext();
    if (!cs) return 0;

    const healResult = applyHealingToTarget(cs, targetName, result.totalDamage, campaignName);
    if (healResult?.newHp != null) {
        const { addEntry } = await import('../../ui/logService.js');
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: targetName,
            abilityName: featureName,
            description: `${targetName} used ${featureName} — ${attackerName}'s attack misses due to illusory duplicate. The attack is retroactively negated and ${targetName} is healed for ${result.totalDamage} HP.`,
            targetName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`[${featureName}] Error:`, e); throw e; });
        return result.totalDamage;
    }

    return 0;
}
