const DIVINE_SMITE_NAME = 'divine smite';

export function isDivineSmite(spell) {
    return (spell.name || '').toLowerCase() === DIVINE_SMITE_NAME.toLowerCase();
}

export function usesSpellSlot(spell, metaCtx) {
    return metaCtx?.slotLevel > 0 || spell.level > 0;
}
