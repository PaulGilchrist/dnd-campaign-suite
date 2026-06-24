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
    describe('null/undefined/empty input', () => {
        it('returns null for null, undefined, and empty objects', () => {
            expect(getSpellMaxLevel(null)).toBeNull();
            expect(getSpellMaxLevel(undefined)).toBeNull();
            expect(getSpellMaxLevel({})).toBeNull();
        });
    });

    describe('slot level detection', () => {
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
    });

    describe('edge cases for slot values', () => {
        it('ignores null slot values', () => {
            expect(getSpellMaxLevel({ spell_slots_level_3: null })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_3: null, spell_slots_level_5: 2 })).toBe(5);
        });

        it('ignores undefined slot values', () => {
            expect(getSpellMaxLevel({ spell_slots_level_3: undefined })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_3: undefined, spell_slots_level_7: 1 })).toBe(7);
        });

        it('ignores zero slot values', () => {
            expect(getSpellMaxLevel({ spell_slots_level_1: 0 })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_1: 0, spell_slots_level_4: 3 })).toBe(4);
        });

        it('ignores negative slot values', () => {
            expect(getSpellMaxLevel({ spell_slots_level_2: -1 })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_2: -1, spell_slots_level_6: 1 })).toBe(6);
        });

        it('ignores non-numeric slot values', () => {
            expect(getSpellMaxLevel({ spell_slots_level_1: '' })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_1: 'three' })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_1: NaN })).toBeNull();
            expect(getSpellMaxLevel({ spell_slots_level_1: '1', spell_slots_level_3: 2 })).toBe(3);
        });

        it('counts fractional slot values above zero', () => {
            expect(getSpellMaxLevel({ spell_slots_level_1: 0.5 })).toBe(1);
            expect(getSpellMaxLevel({ spell_slots_level_1: 0.5, spell_slots_level_5: 0.1 })).toBe(5);
        });
    });

    describe('sparse objects', () => {
        it('handles objects with only a single high-level slot defined', () => {
            expect(getSpellMaxLevel({ spell_slots_level_7: 1 })).toBe(7);
        });

        it('handles objects with a single low-level slot defined', () => {
            expect(getSpellMaxLevel({ spell_slots_level_3: 2 })).toBe(3);
        });
    });
});
