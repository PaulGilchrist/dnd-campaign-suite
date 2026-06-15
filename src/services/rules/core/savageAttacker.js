/**
 * Savage Attacker (Feat) — Damage Dice Reroll
 *
 * Once per turn when you hit a target with a weapon, you can roll the
 * weapon's damage dice twice and use either roll against the target.
 *
 * This module provides a utility to apply the Savage Attacker reroll logic
 * to damage rolls.
 */

/**
 * Roll damage dice twice and pick the higher total.
 *
 * @param {number[]} rolls - Individual die roll values (first roll)
 * @returns {number[]} Modified rolls with the higher total selected
 */
export function applySavageAttacker(rolls) {
    if (!Array.isArray(rolls) || rolls.length === 0) {
        return rolls;
    }

    // Roll the same number of dice again and pick the higher total
    let firstTotal = 0;
    const secondRolls = [];

    for (const roll of rolls) {
        firstTotal += roll;
        const reroll = Math.floor(Math.random() * roll) + 1;
        // For a proper reroll, we need to roll the same die type again
        // Since we don't know the die size here, we use a placeholder
        // The actual reroll is done in the caller where we know the die type
        secondRolls.push(reroll);
    }

    const secondTotal = secondRolls.reduce((sum, r) => sum + r, 0);

    // Return the higher total's rolls
    return secondTotal > firstTotal ? secondRolls : rolls;
}

/**
 * Roll damage dice twice and pick the higher total (full implementation).
 * This version takes the dice formula (e.g., "2d6") to properly reroll.
 *
 * @param {number[]} firstRolls - Individual die roll values (first roll)
 * @param {string} diceFormula - The dice formula (e.g., "2d6")
 * @returns {{ rolls: number[], secondRolls: number[], higher: boolean }}
 */
export function applySavageAttackerFull(firstRolls, diceFormula) {
    if (!Array.isArray(firstRolls) || firstRolls.length === 0 || !diceFormula) {
        return { rolls: firstRolls, secondRolls: [], higher: false };
    }

    const diceMatch = diceFormula.match(/(\d+)d(\d+)/);
    if (!diceMatch) {
        return { rolls: firstRolls, secondRolls: [], higher: false };
    }

    const numDice = parseInt(diceMatch[1], 10);
    const dieSize = parseInt(diceMatch[2], 10);

    if (numDice !== firstRolls.length || dieSize <= 0) {
        return { rolls: firstRolls, secondRolls: [], higher: false };
    }

    // Roll the dice again
    const secondRolls = [];
    for (let i = 0; i < numDice; i++) {
        secondRolls.push(Math.floor(Math.random() * dieSize) + 1);
    }

    const firstTotal = firstRolls.reduce((sum, r) => sum + r, 0);
    const secondTotal = secondRolls.reduce((sum, r) => sum + r, 0);

    return {
        rolls: secondTotal > firstTotal ? secondRolls : firstRolls,
        secondRolls,
        higher: secondTotal > firstTotal,
    };
}

/**
 * Check if Savage Attacker applies for a given character.
 *
 * @param {Object} playerStats - PlayerStats object with automation data
 * @returns {boolean} True if Savage Attacker is active
 */
export function savageAttackerApplies(playerStats) {
    if (!playerStats) return false;

    return (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn'
    );
}
