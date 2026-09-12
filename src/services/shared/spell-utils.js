const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function getSpellMaxLevel(spellAbilities) {
    let spellMaxLevel = null;
    if (spellAbilities) {
        for (const level of SPELL_SLOT_LEVELS) {
            const slots = spellAbilities[`spell_slots_level_${level}`];
            if (slots != null && slots > 0) spellMaxLevel = level;
        }
    }
    return spellMaxLevel;
}
