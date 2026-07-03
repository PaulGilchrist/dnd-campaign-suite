// @cleaned-by-ai
// All behavioral coverage for getSpellMaxLevel is provided by
// src/services/rules/core/rules-core.test.js which tests the same
// function through the rules module (the production call path).
// The dedicated unit tests below were redundant and have been removed.
//
// Tests removed:
//   - "null/undefined/empty input" — covered by rules-core.test.js
//   - "slot level detection" (it.each + 3 additional tests) — covered by rules-core.test.js
//   - "edge cases for slot values" (null, undefined, zero, negative, non-numeric, fractional) —
//     tests JS type coercion of "!= null && > 0", not business behavior; covered by rules-core.test.js
//   - "sparse objects" — covered by rules-core.test.js it.each cases
//
// @cleaned-by-ai

import { describe, it, expect } from 'vitest';
import { getSpellMaxLevel } from './spell-utils.js';

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
            [{ spell_slots_level_1: 4 }, 1],
            [{ spell_slots_level_1: 1, spell_slots_level_2: 1 }, 2],
            [{ spell_slots_level_1: 1, spell_slots_level_3: 1, spell_slots_level_5: 1 }, 5],
            [{ spell_slots_level_3: 3 }, 3],
            [{ spell_slots_level_9: 1 }, 9],
            [{ spell_slots_level_1: 1, spell_slots_level_4: 1, spell_slots_level_7: 1, spell_slots_level_9: 1 }, 9],
            [{ spell_slots_level_5: 10 }, 5],
        ])('returns the highest level with slots > 0', (spellAbilities, expected) => {
            expect(getSpellMaxLevel(spellAbilities)).toBe(expected);
        });
    });
});
