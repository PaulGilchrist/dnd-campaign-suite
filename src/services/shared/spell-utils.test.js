// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getSpellMaxLevel } from './spell-utils.js';

function slots(levelsWithSlots) {
    const result = {};
    for (let i = 1; i <= 9; i++) {
        result[`spell_slots_level_${i}`] = levelsWithSlots[i] ?? 0;
    }
    return result;
}

describe('getSpellMaxLevel', () => {
    it.each([
        [null, null],
        [undefined, null],
        [{} , null],
    ])('returns %p for spellAbilities', (spellAbilities, expected) => {
        expect(getSpellMaxLevel(spellAbilities)).toBe(expected);
    });

    it.each([
        [slots({ 1: 4 }), 1],
        [slots({ 1: 1, 2: 1 }), 2],
        [slots({ 1: 1, 3: 1, 5: 1 }), 5],
        [slots({ 3: 3 }), 3],
        [slots({ 9: 1 }), 9],
        [slots({ 1: 1, 4: 1, 7: 1, 9: 1 }), 9],
        [slots({ 5: 10 }), 5],
    ])('returns the highest level with slots > 0', (spellAbilities, expected) => {
        expect(getSpellMaxLevel(spellAbilities)).toBe(expected);
    });

    it('returns null when all slot values are 0', () => {
        expect(getSpellMaxLevel(slots({}))).toBeNull();
    });

    it('returns null when object has non-slot properties but no slots', () => {
        expect(getSpellMaxLevel({ cantrips_known: 3, spells_known: 4 })).toBeNull();
    });

    it('returns the highest level even when lower levels have more slots', () => {
        const spellAbilities = slots({ 1: 20, 5: 1 });
        expect(getSpellMaxLevel(spellAbilities)).toBe(5);
    });

    it('handles sparse objects with only some level keys defined', () => {
        expect(getSpellMaxLevel({ spell_slots_level_3: 2 })).toBe(3);
        expect(getSpellMaxLevel({ spell_slots_level_7: 1 })).toBe(7);
    });
});
