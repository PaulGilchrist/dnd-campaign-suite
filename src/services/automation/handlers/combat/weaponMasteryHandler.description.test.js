// @maintained-by-ai
// Lane: description composition — own-contract of buildMasteryDescription (pure fn).
// Sibling lanes own the handler paths that consume it (push/nick/postDamage/main).
// Redundant, brittle, and low-value tests removed:
// - Consolidated null/undefined/empty targetName fallback into single test
// - Consolidated unknown mastery default case into single test
// - Removed loop tests asserting trivial properties (truthy, string type, length > 0)
// - Removed loop test asserting mastery name appears in every description (obvious from switch)
// - Removed loop test asserting target name presence in specific descriptions (overly implementation-specific)
// - Removed negative assertion tests for Topple/Cleave/Graze/Nick (already proven by exact string assertions)
// - Consolidated per-case exact-string pins into one strict table (same assertions, one test)

import { describe, it, expect } from 'vitest';

import { buildMasteryDescription } from './weaponMasteryHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('buildMasteryDescription', () => {
    it('returns the exact description for every known mastery', () => {
        expect({
            Push: buildMasteryDescription('Push', 'Goblin'),
            Topple: buildMasteryDescription('Topple', 'Ogre'),
            Sap: buildMasteryDescription('Sap', 'Hobgoblin'),
            Slow: buildMasteryDescription('Slow', 'Bugbear'),
            Vex: buildMasteryDescription('Vex', 'Goblin'),
            Cleave: buildMasteryDescription('Cleave', 'Ogre'),
            Graze: buildMasteryDescription('Graze', 'Hobgoblin'),
            Nick: buildMasteryDescription('Nick', 'Goblin'),
        }).toEqual({
            Push: 'Push applied to Goblin — pushed up to 10 feet straight away from you.',
            Topple: 'Topple: ready to force a CON save vs Prone.',
            Sap: 'Sap applied to Hobgoblin — Disadvantage on next attack roll.',
            Slow: 'Slow applied to Bugbear — Speed reduced by 10 ft.',
            Vex: 'Vex applied to Goblin — you have Advantage on next attack.',
            Cleave: 'Cleave — make an extra attack against a second creature within 5 ft.',
            Graze: 'Graze — deal damage equal to ability modifier on a miss.',
            Nick: 'Nick — make Light weapon extra attack as part of Attack action.',
        });
    });

    it('should use lowercase "target" when targetName is falsy', () => {
        expect(buildMasteryDescription('Push', null)).toBe('Push applied to target — pushed up to 10 feet straight away from you.');
        expect(buildMasteryDescription('Sap', undefined)).toBe('Sap applied to target — Disadvantage on next attack roll.');
        expect(buildMasteryDescription('Slow', '')).toBe('Slow applied to target — Speed reduced by 10 ft.');
    });

    it('should use default description for unknown mastery names', () => {
        expect(buildMasteryDescription('UnknownEffect', 'Goblin')).toBe('UnknownEffect applied to Goblin.');
        expect(buildMasteryDescription('UnknownEffect', null)).toBe('UnknownEffect applied to target.');
    });
});
