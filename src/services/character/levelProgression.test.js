// @maintained-by-ai 2026-11-26
// Roadmap Item 8 — pin for the ONE canonical XP → implied-level ladder used by
// the LEVEL UP celebration. This file is the strongest home for the shared
// ladder canon: LevelUpCelebration exercises it through the component but
// never re-pins thresholds, and neither ruleset's classes.json carries an XP
// column, so the calculator is ruleset-agnostic BY DESIGN — impliedLevelFromXp
// takes no ruleset argument and the 5e/2024 printings publish identical
// cumulative thresholds.
//
// Owns:
//  - the verbatim PHB ladder, one threshold per level, tied to MAX_CHARACTER_LEVEL;
//  - exact-boundary behaviour (a threshold reads as the NEW level);
//  - multi-level jumps (the banner copy must be honest);
//  - the past-max honesty edge: XP beyond 355,000 never implies level 21;
//  - input coercion: numeric strings from the runtime store count, junk falls
//    back to level 1.
import { describe, it, expect } from 'vitest';
import {
    MAX_CHARACTER_LEVEL,
    XP_LEVEL_THRESHOLDS,
    impliedLevelFromXp,
} from './levelProgression.js';

describe('XP_LEVEL_THRESHOLDS ladder', () => {
    it('publishes the cumulative PHB ladder verbatim, one threshold per level (shared by 5e and 2024)', () => {
        expect([...XP_LEVEL_THRESHOLDS]).toEqual([
            0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
            85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
        ]);
        expect(XP_LEVEL_THRESHOLDS).toHaveLength(MAX_CHARACTER_LEVEL);
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

    it('multi-level jump lands on the true implied level (honest "Level 1 → 4" span)', () => {
        expect(impliedLevelFromXp(3000)).toBe(4);
        expect(impliedLevelFromXp(13999)).toBe(5);
        expect(impliedLevelFromXp(14000)).toBe(6);
        expect(impliedLevelFromXp(64001)).toBe(10);
    });

    it('never invents a level 21: max-level XP implies 20 and past-max XP stays capped', () => {
        expect(impliedLevelFromXp(305000)).toBe(19);
        expect(impliedLevelFromXp(355000)).toBe(20);
        expect(impliedLevelFromXp(355001)).toBe(20);
        expect(impliedLevelFromXp(10_000_000)).toBe(20);
    });

    it('coerces runtime-store input: numeric strings count, junk and negative fall back to level 1', () => {
        expect(impliedLevelFromXp('6500')).toBe(5);
        expect(impliedLevelFromXp(null)).toBe(1);
        expect(impliedLevelFromXp(undefined)).toBe(1);
        expect(impliedLevelFromXp(NaN)).toBe(1);
        expect(impliedLevelFromXp('abc')).toBe(1);
        expect(impliedLevelFromXp(-500)).toBe(1);
        expect(impliedLevelFromXp(0)).toBe(1);
    });
});
