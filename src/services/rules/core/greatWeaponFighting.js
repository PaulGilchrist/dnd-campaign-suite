/**
 * Great Weapon Fighting (2024 Feat) — Damage Die Reroll
 *
 * When you roll damage for an attack you make with a Melee weapon that you
 * are holding with two hands, you can treat any 1 or 2 on a damage die as a 3.
 * The weapon must have the Two-Handed or Versatile property to gain this benefit.
 *
 * This module provides a utility to apply the GWF reroll logic to damage rolls.
 */

/**
 * Apply Great Weapon Fighting reroll to damage rolls.
 * Treats any 1 or 2 on a damage die as a 3.
 *
 * @param {number[]} rolls - Individual die roll values
 * @returns {number[]} Modified rolls with 1s and 2s converted to 3s
 */
export function applyGreatWeaponFighting(rolls) {
    if (!Array.isArray(rolls) || rolls.length === 0) {
        return rolls;
    }

    return rolls.map(roll => (roll <= 2 ? 3 : roll));
}

// greatWeaponFightingApplies deleted (#1246 dead-export lane): zero production
// importers tree-wide (fresh census, src/server/public). The LIVE path for this
// exact check is automationPassives.js hasGreatWeaponFighting (:398) driving
// applyGreatWeaponFightingToDamage (:430), re-exported via automationService.js
// and consumed by useLoggedDiceRollDamage.js / damageHandlerUtils.js. This export
// was its superseded shadow sibling; fix#204's tolerant-apex guard and posture
// JSDoc retire with it (guard-commits stay in git history — deletion is not revert).
