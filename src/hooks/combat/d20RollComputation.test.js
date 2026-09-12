// CLA-216 — Lucky (Halfling, 2024 racial trait): auto-reroll on natural 1
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Queueable d20 roller so tests control every roll deterministically.
let d20Queue = [];
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: () => d20Queue.shift(),
    rollExpression: () => null,
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: () => null,
    setRuntimeValue: () => Promise.resolve(),
}));

vi.mock('./starryDragon.js', () => ({
    hasStarryDragonActive: () => false,
    starryDragonAppliesToRoll: () => false,
}));

import { computeD20Roll } from './d20RollComputation.js';

const LUCKY_CTX = () => ({ autoReroll: true, autoRerollCondition: 'roll_equals_1' });

describe('computeD20Roll — Halfling Lucky auto reroll (CLA-216)', () => {
    beforeEach(() => { d20Queue = []; });

    it('rerolls a natural 1 and uses the rerolled value', () => {
        d20Queue = [1, 7, 14]; // r1=1, r2=7, lucky reroll=14
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: LUCKY_CTX(), bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(true);
        expect(r.luckyRerollValue).toBe(14);
        expect(r.effectiveD20Roll).toBe(14);
    });

    it('still uses the reroll when the reroll itself is a 1 (single reroll, must use new roll)', () => {
        d20Queue = [1, 7, 1];
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: LUCKY_CTX(), bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(true);
        expect(r.luckyRerollValue).toBe(1);
        expect(r.effectiveD20Roll).toBe(1);
    });

    it('does NOT reroll a non-natural-1', () => {
        d20Queue = [12, 3]; // only r1 + r2 consumed
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: LUCKY_CTX(), bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(false);
        expect(r.luckyRerollValue).toBeNull();
        expect(r.effectiveD20Roll).toBe(12);
        expect(d20Queue).toEqual([]); // no third die rolled
    });

    it('does NOT reroll without lucky context flags', () => {
        d20Queue = [1, 9];
        const r = computeD20Roll({ characterName: 'HalflingTest', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: {}, bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(false);
        expect(r.effectiveD20Roll).toBe(1);
    });

    it('does NOT reroll for a different autoRerollCondition (e.g. Indomitable favored_enemy)', () => {
        d20Queue = [1, 9];
        const ctx = { autoReroll: true, autoRerollCondition: 'favored_enemy' };
        const r = computeD20Roll({ characterName: 'FighterTest', campaignName: 'test-campaign', name: 'Wisdom', rollType: 'save', context: ctx, bonus: 2, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(false);
        expect(r.effectiveD20Roll).toBe(1);
    });

    it('rerolls a natural 1 on a save roll (d20 Test covers saves)', () => {
        d20Queue = [1, 4, 11];
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'save', context: LUCKY_CTX(), bonus: 3, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(true);
        expect(r.effectiveD20Roll).toBe(11);
    });

    it('rerolls when disadvantage resolves to a natural 1, after forcedMode is applied', () => {
        d20Queue = [5, 1, 17]; // disadvantage → min(5,1)=1 → lucky reroll=17
        const ctx = { ...LUCKY_CTX(), forcedMode: 'disadvantage' };
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: ctx, bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(true);
        expect(r.effectiveD20Roll).toBe(17);
    });

    it('does NOT reroll when advantage keeps the die above 1', () => {
        d20Queue = [1, 15]; // advantage → max(1,15)=15
        const ctx = { ...LUCKY_CTX(), forcedMode: 'advantage' };
        const r = computeD20Roll({ characterName: 'LightfootHalfling', campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: ctx, bonus: 1, isResilientSphereActive: () => false });
        expect(r.luckyRerolled).toBe(false);
        expect(r.effectiveD20Roll).toBe(15);
    });
});
