// Shared helpers for the damage handlers in this directory.
import { applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';
import { hasGreatWeaponFighting, applyGreatWeaponFightingToDamage } from '../../../services/combat/automation/automationService.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';

export function findTargetByContext(combatSummary, context) {
    return combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
}

export function resolveTargetMaxHp(target) {
    return target?.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : target?.maxHp ?? 0;
}

export function resolveAppliedDamage(applyResult, isIntercepted) {
    if (isIntercepted) return applyResult.damageDealt ?? 0;
    return applyResult?.finalDamage ?? 0;
}

export function getHpThreshold({ oldHp, newHp, maxHp, deadHp = newHp }) {
    const wasAlive = oldHp > 0;
    const isDead = deadHp <= 0;
    const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
    const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
    if (!wasAlive && isDead) return 'dead';
    if (!wasBloodied && isBloodied) return 'bloodied';
    if (wasBloodied && !isBloodied && newHp > 0) return 'recovering';
    return undefined;
}

export function assignSecondaryFields(dest, secondaryResult, suffixes) {
    if (!secondaryResult) return;
    for (const suffix of suffixes) {
        dest['secondary' + suffix] = secondaryResult[suffix[0].toLowerCase() + suffix.slice(1)];
    }
}

// Great Weapon Fighting: re-roll 1s/2s on secondary damage dice and re-apply
// the damage minimum. Returns the adjusted secondary total.
export function computeGwfAdjustedSecondaryTotal(secondaryRollResult, playerStats, secondaryDamageType) {
    const secondaryTotal = applyMinDamageAdjustment(secondaryRollResult.total, secondaryRollResult.rolls, playerStats, secondaryDamageType);
    if (!hasGreatWeaponFighting(playerStats)) return secondaryTotal;
    const gwfSecondaryRolls = applyGreatWeaponFightingToDamage(secondaryRollResult.rolls, playerStats);
    const hasSecondaryChanges = gwfSecondaryRolls.some((r, i) => r !== secondaryRollResult.rolls[i]);
    if (!hasSecondaryChanges) return secondaryTotal;
    const gwfSecondaryTotal = gwfSecondaryRolls.reduce((sum, r) => sum + r, 0) + secondaryRollResult.modifier;
    return applyMinDamageAdjustment(gwfSecondaryTotal, gwfSecondaryRolls, playerStats, secondaryDamageType);
}

export function buildDamageBreakdownEntry(applyResult, damageType, amount) {
    return {
        damageType,
        amount,
        resisted: applyResult?.resistanceDetails?.some(rd => rd.status === 'resistant') ?? false,
        status: applyResult?.resistanceDetails?.[0]?.status || null,
    };
}
