// @improved-by-ai
import { describe, it, expect } from 'vitest';
import utils from './utils.js';

describe('utils', () => {
    describe('getAbilityLongName', () => {
        const abilityMap = [
            ['STR', 'Strength'],
            ['DEX', 'Dexterity'],
            ['CON', 'Constitution'],
            ['INT', 'Intelligence'],
            ['WIS', 'Wisdom'],
            ['CHA', 'Charisma'],
        ];

        it.each(abilityMap)('returns "%s" for %s', (short, long) => {
            expect(utils.getAbilityLongName(short)).toBe(long);
        });

        it('returns undefined for unknown codes', () => {
            expect(utils.getAbilityLongName('UNKNOWN')).toBeUndefined();
            expect(utils.getAbilityLongName('')).toBeUndefined();
            expect(utils.getAbilityLongName(null)).toBeUndefined();
            expect(utils.getAbilityLongName(undefined)).toBeUndefined();
        });

        it('returns undefined for lowercase ability codes', () => {
            expect(utils.getAbilityLongName('str')).toBeUndefined();
            expect(utils.getAbilityLongName('dex')).toBeUndefined();
        });
    });

    describe('getName', () => {
        it('returns the input string for valid names', () => {
            expect(utils.getName('John Doe')).toBe('John Doe');
            expect(utils.getName('John')).toBe('John');
            expect(utils.getName('John Michael Doe')).toBe('John Michael Doe');
            expect(utils.getName('O\'Brien')).toBe("O'Brien");
        });

        it('returns "Unknown" for falsy and non-string values', () => {
            expect(utils.getName(null)).toBe('Unknown');
            expect(utils.getName(undefined)).toBe('Unknown');
            expect(utils.getName('')).toBe('Unknown');
            expect(utils.getName(123)).toBe('Unknown');
            expect(utils.getName({})).toBe('Unknown');
            expect(utils.getName([])).toBe('Unknown');
        });

    });

    describe('getFirstName', () => {
        it('returns the input string for valid names', () => {
            expect(utils.getFirstName('John Doe')).toBe('John Doe');
            expect(utils.getFirstName('John')).toBe('John');
            expect(utils.getFirstName('John Michael Doe')).toBe('John Michael Doe');
        });

        it('returns "Unknown" for falsy and non-string values', () => {
            expect(utils.getFirstName(null)).toBe('Unknown');
            expect(utils.getFirstName(undefined)).toBe('Unknown');
            expect(utils.getFirstName('')).toBe('Unknown');
            expect(utils.getFirstName(123)).toBe('Unknown');
            expect(utils.getFirstName({})).toBe('Unknown');
            expect(utils.getFirstName([])).toBe('Unknown');
        });

    });

    describe('guid', () => {
        it('returns a string matching the GUID format', () => {
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(utils.guid()).toMatch(guidRegex);
        });

        it('generates unique GUIDs', () => {
            const guids = new Set();
            for (let i = 0; i < 100; i++) {
                guids.add(utils.guid());
            }
            expect(guids.size).toBe(100);
        });


    });
});
