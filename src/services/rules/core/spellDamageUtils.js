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
