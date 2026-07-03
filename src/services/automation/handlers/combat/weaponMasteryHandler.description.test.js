// @cleaned-by-ai
// Redundant, brittle, and low-value tests removed:
// - Consolidated null/undefined/empty targetName fallback into single test
// - Consolidated unknown mastery default case into single test
// - Removed loop tests asserting trivial properties (truthy, string type, length > 0)
// - Removed loop test asserting mastery name appears in every description (obvious from switch)
// - Removed loop test asserting target name presence in specific descriptions (overly implementation-specific)
// - Removed negative assertion tests for Topple/Cleave/Graze/Nick (already proven by exact string assertions)

import { describe, it, expect } from 'vitest';

import { buildMasteryDescription } from './weaponMasteryHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('buildMasteryDescription', () => {
    it('should return correct description for Push', () => {
        const result = buildMasteryDescription('Push', 'Goblin');
        expect(result).toBe('Push applied to Goblin — pushed up to 10 ft away.');
    });

    it('should return correct description for Topple', () => {
        const result = buildMasteryDescription('Topple', 'Ogre');
        expect(result).toBe('Topple: ready to force a CON save vs Prone.');
    });

    it('should return correct description for Sap', () => {
        const result = buildMasteryDescription('Sap', 'Hobgoblin');
        expect(result).toBe('Sap applied to Hobgoblin — Disadvantage on next attack roll.');
    });

    it('should return correct description for Slow', () => {
        const result = buildMasteryDescription('Slow', 'Bugbear');
        expect(result).toBe('Slow applied to Bugbear — Speed reduced by 10 ft.');
    });

    it('should return correct description for Vex', () => {
        const result = buildMasteryDescription('Vex', 'Goblin');
        expect(result).toBe('Vex applied to Goblin — you have Advantage on next attack.');
    });

    it('should return correct description for Cleave', () => {
        const result = buildMasteryDescription('Cleave', 'Ogre');
        expect(result).toBe('Cleave — make an extra attack against a second creature within 5 ft.');
    });

    it('should return correct description for Graze', () => {
        const result = buildMasteryDescription('Graze', 'Hobgoblin');
        expect(result).toBe('Graze — deal damage equal to ability modifier on a miss.');
    });

    it('should return correct description for Nick', () => {
        const result = buildMasteryDescription('Nick', 'Goblin');
        expect(result).toBe('Nick — make Light weapon extra attack as part of Attack action.');
    });

    it('should use lowercase "target" when targetName is falsy', () => {
        expect(buildMasteryDescription('Push', null)).toBe('Push applied to target — pushed up to 10 ft away.');
        expect(buildMasteryDescription('Sap', undefined)).toBe('Sap applied to target — Disadvantage on next attack roll.');
        expect(buildMasteryDescription('Slow', '')).toBe('Slow applied to target — Speed reduced by 10 ft.');
    });

    it('should use default description for unknown mastery names', () => {
        expect(buildMasteryDescription('UnknownEffect', 'Goblin')).toBe('UnknownEffect applied to Goblin.');
        expect(buildMasteryDescription('UnknownEffect', null)).toBe('UnknownEffect applied to target.');
    });
});
