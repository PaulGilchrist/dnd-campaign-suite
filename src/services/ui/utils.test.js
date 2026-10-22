// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import utils, { DEBUG_FORCE_CRIT } from './utils.js';

// Mock-completeness census: exact-of-0. utils.js is pure — no fetch, no
// localStorage, no timers, no Date. guid() uses Math.random (randomness, not
// a clock) and is pinned structurally + by uniqueness, never by byte snapshot.
// Caller boundary: getName is delegated to from storage.js:68,:90 — its
// 'Unknown' byte feeds GET /api/campaigns/<campaign>/Unknown URLs
// (pinned downstream at storage.test.js:195). This file is the contract HOME.
// rules-core.js:34 / rules.js:372 re-export getAbilityLongName; identity is
// pinned at rules-core.test.js:69 — byte law lives here only.
// Arity vs REAL module (no default params): census below.

describe('utils', () => {
    describe('getAbilityLongName', () => {
        // disk-derived inputs: STR/DEX/CON/INT/WIS/CHA appear verbatim in
        // public/data/classes.json saving_throws/ability arrays; long-name
        // outputs are the 5e canonical spellings, never retyped from memory.
        const abilityMap = [
            ['STR', 'Strength'],
            ['DEX', 'Dexterity'],
            ['CON', 'Constitution'],
            ['INT', 'Intelligence'],
            ['WIS', 'Wisdom'],
            ['CHA', 'Charisma'],
        ];

        it.each(abilityMap)('maps disk abbreviation %s to "%s"', (short, long) => {
            expect(utils.getAbilityLongName(short)).toBe(long);
        });

        it('returns undefined outside the abbreviation domain (silent-undefined arm is load-bearing)', () => {
            // Consumers rely on undefined to mean "already long / unknown,
            // keep original" (classRules2024.js:107; race-rules 5e.js:37).
            expect(utils.getAbilityLongName('UNKNOWN')).toBeUndefined();
            expect(utils.getAbilityLongName('Strength')).toBeUndefined(); // not idempotent: abbreviation-domain only
            expect(utils.getAbilityLongName('str')).toBeUndefined(); // case-sensitive: lowercase abbreviation does not map
            expect(utils.getAbilityLongName('')).toBeUndefined();
            expect(utils.getAbilityLongName(null)).toBeUndefined();
            expect(utils.getAbilityLongName(undefined)).toBeUndefined();
            expect(utils.getAbilityLongName(0)).toBeUndefined();
            expect(utils.getAbilityLongName(false)).toBeUndefined();
            expect(utils.getAbilityLongName(NaN)).toBeUndefined();
            expect(utils.getAbilityLongName(123)).toBeUndefined();
            expect(utils.getAbilityLongName({})).toBeUndefined();
            expect(utils.getAbilityLongName([])).toBeUndefined();
        });
    });

    describe('getName', () => {
        // storage-delegated contract (#1547 home span): passthrough bytes and
        // the exact 'Unknown' fallback byte must not drift — storage.js builds
        // URLs from the return value (storage.test.js:195 pins 'Unknown' wire byte).
        it('returns the input string byte-identical for valid names', () => {
            expect(utils.getName('John Doe')).toBe('John Doe');
            expect(utils.getName('John')).toBe('John');
            expect(utils.getName('John Michael Doe')).toBe('John Michael Doe');
            expect(utils.getName("O'Brien")).toBe("O'Brien");
            expect(utils.getName('Ária 20%')).toBe('Ária 20%'); // unicode + punctuation bytes preserved
        });

        it('collapses falsy and non-string inputs to "Unknown"; truthy-string lookalikes pass through', () => {
            expect(utils.getName(null)).toBe('Unknown');
            expect(utils.getName(undefined)).toBe('Unknown');
            expect(utils.getName('')).toBe('Unknown');
            expect(utils.getName(0)).toBe('Unknown');
            expect(utils.getName(false)).toBe('Unknown');
            expect(utils.getName(NaN)).toBe('Unknown');
            expect(utils.getName(123)).toBe('Unknown');
            expect(utils.getName({})).toBe('Unknown');
            expect(utils.getName([])).toBe('Unknown');
            // observably-distinct arms: truthy strings are NOT collapsed, no trim
            expect(utils.getName('false')).toBe('false');
            expect(utils.getName('0')).toBe('0');
            expect(utils.getName(' ')).toBe(' ');
        });
    });

    describe('guid', () => {
        // Math.random-based v4-shaped id: pinned by structural law over a
        // sample (deterministic assertions, random bytes), never byte-stable.
        it('produces lowercase v4-shaped ids honoring the version/variant nibble law, unique per call', () => {
            const seen = new Set();
            for (let i = 0; i < 20; i++) {
                const id = utils.guid();
                expect(typeof id).toBe('string');
                // case-SENSITIVE: the template only ever emits lowercase hex
                expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
                seen.add(id);
            }
            expect(seen.size).toBe(20); // fresh value per call (kills constant-stub mutants)
        });
    });

    describe('module surface', () => {
        it('pins arity vs the real module and the live DEBUG_FORCE_CRIT byte', () => {
            expect(utils.getAbilityLongName.length).toBe(1);
            expect(utils.getName.length).toBe(1);
            expect(utils.guid.length).toBe(0);
            // live export consumed by 3 handlers (bonusAttacksHandler:519,
            // concentrationBonusAttackHandler:153, warMagicSpellHandler:155):
            // flipping true would force every d20 into a critical.
            expect(DEBUG_FORCE_CRIT).toBe(false);
        });
    });
});
