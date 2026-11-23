// Extra Attack — single runtime source for the class feature the sheet
// summary displays ("Extra Attacks: N"). The press lane (Attack action
// weapon rows) consumes this to stage 1 + N sequential weapon attacks.
//
// Canonical tables: public/data/classes.json (5e — `extra_attacks` nests
// under `class_specific`, Fighter rows only) and
// public/data/2024/classes.json (2024 — `extra_attacks` is a top-level
// column on the level rows). Both tables scale Fighter the same way:
// 1 extra at lv5, 2 extra at lv11, 3 extra at lv20 (the app's canonical
// data puts the fourth attack at lv20 in BOTH rulesets — not lv17).
// For 5e classes the tables carry no column for (Barbarian/Monk/
// Paladin/Ranger) the rule is one flat Extra Attack from lv5 — the same
// threshold the display lanes use (classRules.js paladin/ranger,
// CharClassFeatures.jsx barbarianRageScalingLegacy/monkExtraAttacks).
const FLAT_EXTRA_ATTACK_CLASSES = ['Barbarian', 'Monk', 'Paladin', 'Ranger'];

/**
 * Extra weapon attacks the character's Extra Attack adds to the Attack
 * action (0 when the class has none). Reads the merged class_levels row
 * for the character's level — table value wins, flat rule is the fallback.
 */
export function getExtraAttacks(playerStats) {
    const classLevel = (playerStats?.class?.class_levels || [])
        .find(cl => cl && cl.level === playerStats?.level);
    const fromTable = classLevel?.extra_attacks ?? classLevel?.class_specific?.extra_attacks;
    if (typeof fromTable === 'number') return fromTable;
    if (FLAT_EXTRA_ATTACK_CLASSES.includes(playerStats?.class?.name) && playerStats?.level >= 5) return 1;
    return 0;
}

// attackCalc.js/attackCalc2024.js weapon rows carry weaponType
// 'melee' | 'ranged' | 'unarmed'; spell/feature rows do not.
const EXTRA_ATTACK_WEAPON_TYPES = ['melee', 'ranged', 'unarmed'];

/**
 * True for weapon rows that take the Attack action and roll an attack, so
 * Extra Attack may add swings. Excludes Bonus Action rows (Flurry of Blows,
 * off-hand — they ride their own `bonus_attacks` automation and must not
 * double-fire), save-based rows (no attack roll to repeat), Psychic Blade
 * rows (CLA-274's own action economy) and spell rows (no weaponType).
 */
export function isExtraAttackEligibleRow(attack) {
    if (!attack || attack.type !== 'Action') return false;
    if (attack.saveDc || attack.isPsychicBlade) return false;
    return EXTRA_ATTACK_WEAPON_TYPES.includes(attack.weaponType);
}
