export function getSpellMaxLevel(spellAbilities) {
    let spellMaxLevel = null;
    if (spellAbilities) {
        if (spellAbilities.spell_slots_level_1 != null && spellAbilities.spell_slots_level_1 > 0) spellMaxLevel = 1;
        if (spellAbilities.spell_slots_level_2 != null && spellAbilities.spell_slots_level_2 > 0) spellMaxLevel = 2;
        if (spellAbilities.spell_slots_level_3 != null && spellAbilities.spell_slots_level_3 > 0) spellMaxLevel = 3;
        if (spellAbilities.spell_slots_level_4 != null && spellAbilities.spell_slots_level_4 > 0) spellMaxLevel = 4;
        if (spellAbilities.spell_slots_level_5 != null && spellAbilities.spell_slots_level_5 > 0) spellMaxLevel = 5;
        if (spellAbilities.spell_slots_level_6 != null && spellAbilities.spell_slots_level_6 > 0) spellMaxLevel = 6;
        if (spellAbilities.spell_slots_level_7 != null && spellAbilities.spell_slots_level_7 > 0) spellMaxLevel = 7;
        if (spellAbilities.spell_slots_level_8 != null && spellAbilities.spell_slots_level_8 > 0) spellMaxLevel = 8;
        if (spellAbilities.spell_slots_level_9 != null && spellAbilities.spell_slots_level_9 > 0) spellMaxLevel = 9;
    }
    return spellMaxLevel;
}
