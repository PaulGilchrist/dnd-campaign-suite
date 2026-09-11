/**
 * Shared pure helpers for the dual-ruleset attack builders
 * (attackCalc.js / attackCalc2024.js).
 */

/**
 * Strip magic item prefix (+1, +2, +3) from an item name.
 * @param {string} itemName
 * @returns {{ baseName: string, magicBonus: number }}
 */
export function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        const magicBonus = Number(itemName.charAt(1));
        return {
            baseName: itemName.substring(3),
            magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
        };
    }
    return { baseName: itemName, magicBonus: 0 };
}

/**
 * Parse damage dice string to average value (e.g., "1d8" → 4.5, "2d6" → 7).
 * @param {string} diceStr
 * @returns {number}
 */
export function parseDamageDice(diceStr) {
    const match = String(diceStr).match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const [, count, sides] = match;
    return parseInt(count, 10) * (parseInt(sides, 10) + 1) / 2;
}

/**
 * Resolve an equipped item name to its catalog weapon.
 * @param {Array} allEquipment
 * @param {string} itemName
 * @returns {{ baseName: string, magicBonus: number, weapon: Object|undefined }}
 */
export function resolveWeapon(allEquipment, itemName) {
    const { baseName, magicBonus } = parseMagicItemName(itemName);
    return { baseName, magicBonus, weapon: allEquipment.find(item => item.name === baseName) };
}

/**
 * True if the given weapon has the Light property.
 * @param {Object} weapon
 * @returns {boolean}
 */
export function weaponHasLight(weapon) {
    return Boolean(weapon && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'light'));
}

/**
 * Pick the highest average-damage weapon from a list of equipped names.
 * @param {Array} allEquipment
 * @param {string[]} names
 * @returns {{ name: string, weapon: Object, baseName: string }|null}
 */
export function pickHighestDamageWeapon(allEquipment, names) {
    let best = null;
    let bestAvgDamage = -1;
    for (const name of names) {
        const { baseName, weapon } = resolveWeapon(allEquipment, name);
        if (weapon) {
            const avg = parseDamageDice(weapon.damage.damage_dice);
            if (avg > bestAvgDamage) {
                bestAvgDamage = avg;
                best = { name, weapon, baseName };
            }
        }
    }
    return best;
}

/**
 * Push Action attacks for each found weapon name in the list.
 * @param {Object[]} attacks
 * @param {Array} allEquipment
 * @param {string[]} names
 * @param {Function} builder - (weapon, name) => attack
 */
export function pushWeaponAttacks(attacks, allEquipment, names, builder) {
    for (const name of names) {
        const { weapon } = resolveWeapon(allEquipment, name);
        if (weapon) {
            attacks.push(builder(weapon, name));
        }
    }
}

/**
 * Build fallback unarmed strike attacks when no weapons produce attacks.
 * Identical for both rulesets.
 * @param {number} strMod
 * @param {number} proficiency
 * @param {boolean} twoWeaponFighting - add a Bonus Action unarmed strike
 * @param {boolean} blessedWarrior
 * @returns {Object[]}
 */
export function buildFallbackUnarmedAttacks(strMod, proficiency, twoWeaponFighting, blessedWarrior) {
    const blessedWarriorHit = blessedWarrior ? 2 : 0;
    const base = {
        name: 'Unarmed Strike',
        damage: `1d4${strMod >= 0 ? '+' : ''}${strMod}`,
        damageType: 'Bludgeoning',
        damageFormula: `Damage Formula = Unarmed Strike (1d4) + Strength Bonus (${strMod})`,
        hitBonus: strMod + proficiency + blessedWarriorHit,
        hitBonusFormula: `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${proficiency})${blessedWarriorHit ? ' + Blessed Warrior (2)' : ''}`,
        range: 5,
        weaponType: 'unarmed',
    };
    const attacks = [{ ...base, type: 'Action' }];
    if (twoWeaponFighting) {
        attacks.push({ ...base, type: 'Bonus Action' });
    }
    return attacks;
}
