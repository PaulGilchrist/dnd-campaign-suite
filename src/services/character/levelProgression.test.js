// Roadmap Item 8 — pin for the ONE canonical XP → implied-level ladder used by
// the LEVEL UP celebration.
//
// Owns:
//  - table shape: 20 cumulative thresholds, ascending, starting at 0;
//  - exact-boundary behaviour (a threshold reads as the NEW level);
//  - single-level and multi-level jumps (the banner copy must be honest);
//  - the 20→21 honesty edge: past-max XP never implies level 21;
//  - junk input (null/NaN/string/negative) falls back to level 1;
//  - both rulesets: the calculator is ruleset-agnostic BY DESIGN (verified:
//    neither classes.json carries an XP column and the 5e/2024 printings
//    publish identical cumulative thresholds) — pinned here by driving the
//    same ladder for a '5e' and a '2024' crossing sequence.
import { describe, it, expect } from 'vitest';
import {
    MAX_CHARACTER_LEVEL,
    XP_LEVEL_THRESHOLDS,
    impliedLevelFromXp,
} from './levelProgression.js';

describe('XP_LEVEL_THRESHOLDS table shape', () => {
    it('carries 20 cumulative thresholds starting at 0 and strictly ascending', () => {
        expect(XP_LEVEL_THRESHOLDS).toHaveLength(MAX_CHARACTER_LEVEL);
        expect(XP_LEVEL_THRESHOLDS[0]).toBe(0);
        for (let i = 1; i < XP_LEVEL_THRESHOLDS.length; i++) {
            expect(XP_LEVEL_THRESHOLDS[i]).toBeGreaterThan(XP_LEVEL_THRESHOLDS[i - 1]);
        }
    });

    it('pins the published PHB cumulative ladder verbatim (shared by 5e and 2024)', () => {
        expect([...XP_LEVEL_THRESHOLDS]).toEqual([
            0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
            85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
        ]);
    });
});

describe('impliedLevelFromXp', () => {
    it('reads the exact threshold byte as the NEW level, one below as the old', () => {
        expect(impliedLevelFromXp(299)).toBe(1);
        expect(impliedLevelFromXp(300)).toBe(2);
        expect(impliedLevelFromXp(899)).toBe(2);
        expect(impliedLevelFromXp(900)).toBe(3);
        expect(impliedLevelFromXp(6500)).toBe(5);
    });

    it('single-level award crosses exactly one rung', () => {
        expect(impliedLevelFromXp(250)).toBe(1);
        expect(impliedLevelFromXp(350)).toBe(2);
    });

    it('multi-level jump lands on the true implied level (honest "Level 1 → 4" span)', () => {
        expect(impliedLevelFromXp(3000)).toBe(4);
        expect(impliedLevelFromXp(13999)).toBe(5);
        expect(impliedLevelFromXp(14000)).toBe(6);
        expect(impliedLevelFromXp(64001)).toBe(10);
    });

    it('20 → 21 honesty: max-level XP implies 20 and PAST-max XP never implies 21', () => {
        expect(impliedLevelFromXp(305000)).toBe(19);
        expect(impliedLevelFromXp(355000)).toBe(20);
        expect(impliedLevelFromXp(355001)).toBe(20);
        expect(impliedLevelFromXp(10_000_000)).toBe(20);
    });

    it('falls back to level 1 for junk input', () => {
        expect(impliedLevelFromXp(null)).toBe(1);
        expect(impliedLevelFromXp(undefined)).toBe(1);
        expect(impliedLevelFromXp(NaN)).toBe(1);
        expect(impliedLevelFromXp('abc')).toBe(1);
        expect(impliedLevelFromXp(-500)).toBe(1);
        expect(impliedLevelFromXp(0)).toBe(1);
    });

    it('coerces numeric strings written through the runtime store', () => {
        expect(impliedLevelFromXp('6500')).toBe(5);
    });

    // Both rulesets share this ladder (ruleset-agnostic by design); the
    // celebration drives the SAME sequence for a '5e' and a '2024' character.
    it.each(['5e', '2024'])('drives identical crossings for ruleset %s', (ruleset) => {
        const award = (from, to) => impliedLevelFromXp(from, ruleset) < impliedLevelFromXp(to, ruleset);
        expect(award(250, 350)).toBe(true);    // 1 → 2
        expect(award(250, 3000)).toBe(true);   // 1 → 4 (multi-level)
        expect(award(400, 500)).toBe(false);    // still level 2
        expect(award(355000, 400000)).toBe(false); // capped at 20
    });
});
