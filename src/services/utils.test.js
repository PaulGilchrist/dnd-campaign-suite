import { describe, it, expect } from 'vitest';
import utils from './utils';

describe('utils', () => {
    describe('getAbilityLongName', () => {
        it('should return the long name for STR', () => {
            expect(utils.getAbilityLongName('STR')).toBe('Strength');
        });

        it('should return the long name for DEX', () => {
            expect(utils.getAbilityLongName('DEX')).toBe('Dexterity');
        });

        it('should return the long name for CON', () => {
            expect(utils.getAbilityLongName('CON')).toBe('Constitution');
        });

        it('should return the long name for INT', () => {
            expect(utils.getAbilityLongName('INT')).toBe('Intelligence');
        });

        it('should return the long name for WIS', () => {
            expect(utils.getAbilityLongName('WIS')).toBe('Wisdom');
        });

        it('should return the long name for CHA', () => {
            expect(utils.getAbilityLongName('CHA')).toBe('Charisma');
        });

        it('should return undefined for unknown ability codes', () => {
            expect(utils.getAbilityLongName('UNKNOWN')).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            expect(utils.getAbilityLongName('')).toBeUndefined();
        });

        it('should return undefined for null', () => {
            expect(utils.getAbilityLongName(null)).toBeUndefined();
        });
    });

    describe('getFirstName', () => {
        it('should return the first name from a full name', () => {
            expect(utils.getFirstName('John Doe')).toBe('John');
        });

        it('should return the name when only one name is provided', () => {
            expect(utils.getFirstName('John')).toBe('John');
        });

        it('should return Unknown for null', () => {
            expect(utils.getFirstName(null)).toBe('Unknown');
        });

        it('should return Unknown for undefined', () => {
            expect(utils.getFirstName(undefined)).toBe('Unknown');
        });

        it('should return Unknown for empty string', () => {
            expect(utils.getFirstName('')).toBe('Unknown');
        });

        it('should return Unknown for non-string types', () => {
            expect(utils.getFirstName(123)).toBe('Unknown');
            expect(utils.getFirstName({})).toBe('Unknown');
            expect(utils.getFirstName([])).toBe('Unknown');
        });

        it('should handle names with multiple spaces', () => {
            expect(utils.getFirstName('John Michael Doe')).toBe('John');
        });
    });

    describe('guid', () => {
        it('should return a string', () => {
            const guid = utils.guid();
            expect(typeof guid).toBe('string');
        });

        it('should return a string matching the GUID format', () => {
            const guid = utils.guid();
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(guid).toMatch(guidRegex);
        });

        it('should generate unique GUIDs', () => {
            const guid1 = utils.guid();
            const guid2 = utils.guid();
            expect(guid1).not.toBe(guid2);
        });

        it('should generate many unique GUIDs', () => {
            const guids = new Set();
            for (let i = 0; i < 100; i++) {
                guids.add(utils.guid());
            }
            expect(guids.size).toBe(100);
        });
    });
});