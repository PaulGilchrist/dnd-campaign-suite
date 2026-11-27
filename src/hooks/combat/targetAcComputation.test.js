// @maintained-by-ai 2026-11-26
// Seam: computeTargetAc — the single AC math consumed by hitResolution.js and
// useLoggedDiceRollAttack.js at the attack-roll seam: player/NPC base-AC
// resolution, the SP-013 Barkskin min-17 FLOOR (2024; floor semantics, NOT an
// additive buff), and the L5-003 half-cover +2 stamp stacking ON TOP of the
// floor. Channel stamp read/write/matching lives in coverService.test.js;
// buff application in barkskinHandler.test.js; display pinning in
// CharSummary-BadgesAndAC.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { computeTargetAc, isBarkskinAcFloorActive } from './targetAcComputation.js';

const store = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => (store[`${name}.${key}`] ?? null)),
    setRuntimeValue: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';
const ATTACK = { rollType: 'attack' };

function barkskin(name) {
    store[`${name}.activeBuffs`] = [{ name: 'Barkskin', effect: 'barkskin' }];
}

describe('computeTargetAc', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
    });

    describe('base AC resolution', () => {
        it.each([
            ['non-attack roll', { rollType: 'save' }, { name: 'DruidTarget', type: 'player' }],
            ['missing target', ATTACK, null],
        ])('returns undefined for %s', (_label, context, target) => {
            expect(computeTargetAc(context, target, [], CAMPAIGN)).toBeUndefined();
        });

        it.each([
            ['player computedStats', { name: 'Computed', type: 'player' },
                [{ name: 'Computed', computedStats: { armorClass: 16 } }], 16],
            ['player flat armorClass fallback', { name: 'Flat', type: 'player' },
                [{ name: 'Flat', armorClass: 13 }], 13],
            ['non-player (EB-joined) target.ac', { name: 'Goblin 1', type: 'npc', ac: 15 }, [], 15],
        ])('resolves %s', (_label, target, characters, expected) => {
            expect(computeTargetAc(ATTACK, target, characters, CAMPAIGN)).toBe(expected);
        });

        it('throws when no AC is resolvable for an attack target', () => {
            expect(() => computeTargetAc(ATTACK, { name: 'Broken', type: 'npc' }, [], CAMPAIGN))
                .toThrow(/no AC defined/);
            expect(() => computeTargetAc(ATTACK, { name: 'Missing', type: 'player' }, [], CAMPAIGN))
                .toThrow(/no AC defined/);
        });
    });

    describe('SP-013 Barkskin floor', () => {
        it('floors barkskinned targets at 17, leaves targets at or above 17 untouched', () => {
            barkskin('DruidTarget');
            barkskin('PaladinTarget');
            barkskin('Goblin 1');
            const characters = [
                { name: 'DruidTarget', computedStats: { armorClass: 9 } },
                { name: 'PaladinTarget', computedStats: { armorClass: 20 } },
            ];
            expect(computeTargetAc(ATTACK, { name: 'DruidTarget', type: 'player' }, characters, CAMPAIGN)).toBe(17);
            expect(computeTargetAc(ATTACK, { name: 'PaladinTarget', type: 'player' }, characters, CAMPAIGN)).toBe(20);
            // EB-joined (non-player) combatants floor too
            expect(computeTargetAc(ATTACK, { name: 'Goblin 1', type: 'npc', ac: 15 }, [], CAMPAIGN)).toBe(17);
        });

        it('is name-keyed: an un-buffeted target is never floored', () => {
            barkskin('DruidTarget');
            const characters = [{ name: 'PlainTarget', computedStats: { armorClass: 9 } }];
            expect(computeTargetAc(ATTACK, { name: 'PlainTarget', type: 'player' }, characters, CAMPAIGN)).toBe(9);
        });
    });

    describe('L5-003 §8.3 half cover', () => {
        it('rides the context cover channel ON TOP of the Barkskin floor (targetAc stays the floored base)', () => {
            barkskin('DruidTarget');
            store['campaign._cover_shot'] = { attackerName: 'Hero', targetName: 'DruidTarget', ac: 2, blocker: 'Goblin', round: 1 };
            const ctx = { ...ATTACK, attackerName: 'Hero' };
            const target = { name: 'DruidTarget', type: 'player' };
            const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
            // Floor is a base-AC rule; the +2 circumstance bonus rides the
            // cover channel (computeEffectiveAc adds it) and never bumps
            // targetAc — the two are independent. The stamp × furniture
            // channel mechanics (tier, reason, no-stacking, AUTO-MISS) are
            // pinned in targetAcComputation.cover-no-stack.test.js.
            expect(computeTargetAc(ctx, target, characters, CAMPAIGN)).toBe(17);
            expect(ctx.coverAcBonus).toBe(2);
        });
    });
});

describe('isBarkskinAcFloorActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
    });

    it('only matches the barkskin effect key', () => {
        store['A.activeBuffs'] = [{ name: 'Barkskin', effect: 'mage_armor' }];
        expect(isBarkskinAcFloorActive('A', CAMPAIGN)).toBe(false);
        store['B.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        expect(isBarkskinAcFloorActive('B', CAMPAIGN)).toBe(true);
        store['C.activeBuffs'] = 'not-an-array';
        expect(isBarkskinAcFloorActive('C', CAMPAIGN)).toBe(false);
        expect(isBarkskinAcFloorActive(null, CAMPAIGN)).toBe(false);
    });
});
