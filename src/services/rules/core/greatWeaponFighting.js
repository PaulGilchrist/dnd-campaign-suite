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

/**
 * Check if Great Weapon Fighting applies to a given weapon and character.
 *
 * @param {Object} weapon - Weapon object with properties array
 * @param {Object} playerStats - PlayerStats object with automation data
 * @returns {boolean} True if GWF applies
 */
export function greatWeaponFightingApplies(weapon, playerStats) {
    if (!weapon) return false;

    const hasGWF = (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'great_weapon_fighting'
    );
    if (!hasGWF) return false;

    const properties = weapon.properties || [];
    const hasTwoHandedOrVersatile = properties.some(
        prop => prop === 'Two-Handed' || prop === 'Versatile'
    );

    return hasTwoHandedOrVersatile;
}
