/**
 * Resolves a spell's damage string at the given character level.
 * Handles both damage_at_slot_level and damage_at_character_level formats.
 * For cantrips (level 0), selects the highest applicable tier.
 * For leveled spells, selects the base tier.
 * @param {Object} spell - The spell object with damage property
 * @param {number} playerLevel - The character's level
 * @returns {string} The resolved damage string (e.g. "1d10" or "8d6")
 */
export function resolveSpellDamageAtLevel(spell, playerLevel) {
    if (!spell || !spell.damage) return '';
    const slotDmg = spell.damage.damage_at_slot_level;
    const charDmg = spell.damage.damage_at_character_level;
    const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
    if (!dmgObj) return '';
    if (spell.level === 0) {
        const lvls = Object.keys(dmgObj).map(Number).filter(l => l <= playerLevel);
        const bestLevel = lvls.length > 0 ? Math.max(...lvls) : Object.keys(dmgObj)[0];
        return dmgObj[bestLevel];
    }
    return dmgObj[Object.keys(dmgObj)[0]];
}

/**
 * Determines if a spell auto-hits (no attack roll needed).
 * Healing spells and Magic Missile always hit.
 * @param {Object} spell - The spell object
 * @returns {boolean} True if the spell auto-hits
 */
export function isAutoHitSpell(spell) {
    if (!spell) return false;
    if (spell.heal_at_slot_level) return true;
    if (spell.name && spell.name.toLowerCase() === 'magic missile') return true;
    return false;
}

/**
 * Resolves spell damage from monster-style fields (damage_dice_primary, damage_dice_secondary)
 * with per-level scaling for secondary damage.
 * Returns { formula, primaryDice, primaryType, secondaryDice, secondaryType }
 * @param {Object} spell - The spell object with damage property
 * @param {number} spellLevel - The spell slot level being cast
 * @returns {Object|null} Resolved damage info or null if no damage
 */
function resolvePrimarySecondary(damage, spellLevel) {
    const slotDmg = damage.damage_at_slot_level;
    const charDmg = damage.damage_at_character_level;
    const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;

    let effectiveLevel = spellLevel;
    if (dmgObj) {
        const levels = Object.keys(dmgObj).map(Number).filter(l => l <= spellLevel);
        if (levels.length > 0) {
            effectiveLevel = Math.max(...levels);
        }
    }

    const levelKey = String(effectiveLevel);
    const slotFormula = dmgObj ? (dmgObj[levelKey] || dmgObj[Object.keys(dmgObj)[0]]) : null;

    // Extract secondary dice from the per-level formula
    let secondaryDice = damage.damage_dice_secondary;
    let primaryDice = damage.damage_dice_primary;
    if (slotFormula) {
        const m = slotFormula.match(/([0-9]d[0-9]+)\s*plus\s*([0-9]d[0-9]+)/i);
        if (m) {
            primaryDice = m[1];
            secondaryDice = m[2];
        } else {
            // Single dice (cantrip scaling) — use the formula directly
            primaryDice = slotFormula;
        }
    }

    const formula = [primaryDice, secondaryDice].filter(Boolean).join(' plus ');

    return {
        formula,
        primaryDice,
        primaryType: damage.damage_type_primary,
        secondaryDice,
        secondaryType: damage.damage_type_secondary,
    };
}

function resolveLegacyFormula(spell, spellLevel) {
    const slotDmg = spell.damage.damage_at_slot_level;
    const charDmg = spell.damage.damage_at_character_level;
    const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
    let formula = '';
    if (dmgObj) {
        if (spell.level === 0) {
            // Cantrip: scale by character level
            const lvls = Object.keys(dmgObj).map(Number).filter(l => l <= spellLevel);
            const bestLevel = lvls.length > 0 ? Math.max(...lvls) : Object.keys(dmgObj)[0];
            formula = dmgObj[bestLevel];
        } else {
            // Leveled spell: use the given slot level
            const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
            const applicable = levels.filter(l => l <= spellLevel);
            const key = applicable.length > 0 ? String(Math.max(...applicable)) : String(levels[0]);
            formula = dmgObj[key] || dmgObj[Object.keys(dmgObj)[0]];
        }
    }
    if (!formula) return null;
    return {
        formula,
        primaryDice: formula,
        primaryType: spell.damage.damage_type || '',
        secondaryDice: null,
        secondaryType: null,
    };
}

export function resolveSpellDamageWithTypes(spell, spellLevel) {
    if (!spell || !spell.damage) return null;

    // Use monster-style fields if present
    if (spell.damage.damage_dice_primary) {
        return resolvePrimarySecondary(spell.damage, spellLevel);
    }

    // Fallback to legacy string format
    return resolveLegacyFormula(spell, spellLevel);
}

/**
 * Resolves a healing spell's heal_at_slot_level expression for display.
 * For cantrips (level 0), selects the highest tier up to player level.
 * For leveled spells, uses the base tier.
 * Replaces 'MOD' with the spellcasting ability modifier.
 * @param {Object} spell - The spell object with heal_at_slot_level property
 * @param {number} playerLevel - The character's level
 * @param {number} spellCastingMod - The spellcasting ability modifier
 * @returns {string} The resolved healing expression (e.g. "1d4+1")
 */
export function resolveHealExpression(spell, playerLevel, spellCastingMod) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel || typeof healAtSlotLevel !== 'object') return '';

    let expression;
    if (spell.level === 0) {
        // Cantrip: use highest tier up to player level
        const levels = Object.keys(healAtSlotLevel).map(Number).filter(l => l <= playerLevel);
        const bestLevel = levels.length > 0 ? Math.max(...levels) : Object.keys(healAtSlotLevel)[0];
        expression = healAtSlotLevel[bestLevel];
    } else {
        // Leveled spell: use the first (base) key
        const levelKeys = Object.keys(healAtSlotLevel);
        expression = healAtSlotLevel[levelKeys[0]];
    }
    if (!expression) return '';

    if (spellCastingMod !== null && spellCastingMod !== undefined) {
        expression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    }
    return expression.replace(/\s*([+-])\s*/g, '$1');
}
