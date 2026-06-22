import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';

/**
 * Get the last attack from combatSummary.lastAttack.
 * Single source of truth — contains attacker, target, d20, hit, damage, save info, spell/weapon info, etc.
 *
 * @param {string} [campaignName] - Campaign name for fetching combat context
 * @returns {{ attackEvent: Object|null, attackerName: string|null, targetName: string|null, primaryDamage: number, secondaryDamage: number, totalDamage: number, damageTypes: string[] }}
 */
export async function findLastAttack(campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.lastAttack) {
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
 * @param {string} targetName - Name of the target to find attacks against
 * @param {string} [campaignName] - Campaign name for fetching combat context
 * @returns {{ attackEvent: Object|null, attackerName: string|null }}
 */
export async function findAttackRollAgainstTarget(targetName, campaignName) {
    const result = await findLastAttack(campaignName);
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
    const result = await findLastAttack(campaignName);
    if (!result.attackEvent) return 0;

    const a = result.attackEvent;
    if (a.attackerName !== attackerName || a.targetName !== targetName) return 0;
    if (!result.totalDamage || result.totalDamage <= 0) return 0;

    const cs = await getCombatContext(campaignName);
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

/**
 * Find the most recent roll (attack, ability check, or save) for each creature.
 * Reads from combatSummary.lastAttack — the single source of truth for the most recent roll.
 * Since reactions can only target the most recent roll, this returns the same lastAttack
 * data for all creatures. Handlers should check attackerName/targetName to determine relevance.
 *
 * @returns {Promise<Object|null>} Map of { creatureName: { attackEvent, abilityEvent, saveEvent, rollType } } or null
 */
export async function findRollsByCreature(campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return null;

    const lastAttack = cs.lastAttack;
    const result = {};
    for (const creature of cs.creatures) {
        const name = creature.name;
        result[name] = {
            attackEvent: lastAttack?.rollType === 'attack' ? lastAttack : null,
            abilityEvent: lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill' ? lastAttack : null,
            saveEvent: lastAttack?.rollType === 'save' ? lastAttack : null,
            rollType: lastAttack?.rollType || null,
        };
    }
    return result;
}

/**
 * Find the most recent roll across all creatures (used by Portent).
 * Returns the single most recent event regardless of creature type.
 *
 * @returns {Promise<{ creatureName: string, eventType: string, eventData: Object, isStale: boolean }|null>}
 */
export async function findMostRecentRollAcrossCreatures(campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.lastAttack) return null;

    const lastAttack = cs.lastAttack;
    let eventType = 'attack';
    if (lastAttack.rollType === 'check' || lastAttack.rollType === 'skill') {
        eventType = 'ability';
    } else if (lastAttack.rollType === 'save') {
        eventType = 'save';
    }

    return {
        creatureName: lastAttack.attackerName || lastAttack.targetName || null,
        eventType,
        eventData: lastAttack,
        isStale: false,
    };
}
