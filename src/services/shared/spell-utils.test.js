import { describe, it, expect } from 'vitest';
import { getSpellMaxLevel } from './spell-utils.js';

describe('getSpellMaxLevel', () => {
    it('should return null when spellAbilities is null', () => {
        expect(getSpellMaxLevel(null)).toBeNull();
    });

    it('should return null when spellAbilities is undefined', () => {
        expect(getSpellMaxLevel(undefined)).toBeNull();
    });

    it('should return null when all slots are 0', () => {
        const spellAbilities = {
            spell_slots_level_1: 0,
            spell_slots_level_2: 0,
            spell_slots_level_3: 0,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBeNull();
    });

    it('should return 1 when only level 1 slots exist', () => {
        const spellAbilities = {
            spell_slots_level_1: 4,
            spell_slots_level_2: 0,
            spell_slots_level_3: 0,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(1);
    });

    it('should return 9 when all levels have slots', () => {
        const spellAbilities = {
            spell_slots_level_1: 4,
            spell_slots_level_2: 3,
            spell_slots_level_3: 3,
            spell_slots_level_4: 3,
            spell_slots_level_5: 2,
            spell_slots_level_6: 1,
            spell_slots_level_7: 1,
            spell_slots_level_8: 1,
            spell_slots_level_9: 1,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(9);
    });

    it('should return correct max level when only mid-level slots exist', () => {
        const spellAbilities = {
            spell_slots_level_1: 0,
            spell_slots_level_2: 0,
            spell_slots_level_3: 3,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(3);
    });

    it('should return null when spellAbilities has no slot properties', () => {
        const spellAbilities = {
            cantrips_known: 3,
            spells_known: 4,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBeNull();
    });

    it('should handle mixed levels (1, 3, 5 have slots → returns 5)', () => {
        const spellAbilities = {
            spell_slots_level_1: 4,
            spell_slots_level_2: 0,
            spell_slots_level_3: 3,
            spell_slots_level_4: 0,
            spell_slots_level_5: 2,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(5);
    });

    it('should return null when spellAbilities is an empty object', () => {
        expect(getSpellMaxLevel({})).toBeNull();
    });

    it('should handle a single high-level slot', () => {
        const spellAbilities = {
            spell_slots_level_1: 0,
            spell_slots_level_2: 0,
            spell_slots_level_3: 0,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 1,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(9);
    });

    it('should handle sparse slot properties (only some levels defined)', () => {
        const spellAbilities = {
            spell_slots_level_3: 2,
        };
        expect(getSpellMaxLevel(spellAbilities)).toBe(3);
    });
});
