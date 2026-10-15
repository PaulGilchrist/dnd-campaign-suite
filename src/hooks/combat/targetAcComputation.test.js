// @maintained-by-ai: 2026-10-14
// Seam: computeTargetAc — the single AC math consumed by hitResolution.js and
// useLoggedDiceRollAttack.js at the attack-roll seam: player/NPC base-AC
// resolution, the SP-013 Barkskin min-17 FLOOR (2024; floor semantics, NOT an
// additive buff), and the L5-003 half-cover −2 stamp stacking ON TOP of the
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
        it('returns undefined for non-attack rolls and missing targets', () => {
            barkskin('DruidTarget');
            const target = { name: 'DruidTarget', type: 'player' };
            const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
            expect(computeTargetAc({ rollType: 'save' }, target, characters, CAMPAIGN)).toBeUndefined();
            expect(computeTargetAc(ATTACK, null, characters, CAMPAIGN)).toBeUndefined();
        });

        it('reads a player target from computedStats, falling back to flat armorClass', () => {
            const characters = [
                { name: 'Computed', computedStats: { armorClass: 16 } },
                { name: 'Flat', armorClass: 13 },
            ];
            expect(computeTargetAc(ATTACK, { name: 'Computed', type: 'player' }, characters, CAMPAIGN)).toBe(16);
            expect(computeTargetAc(ATTACK, { name: 'Flat', type: 'player' }, characters, CAMPAIGN)).toBe(13);
        });

        it('reads target.ac for non-player (EB-joined) combatants', () => {
            expect(computeTargetAc(ATTACK, { name: 'Goblin 1', type: 'npc', ac: 15 }, [], CAMPAIGN)).toBe(15);
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

        it('is inert without the buff and for legacy callers (no campaignName)', () => {
            barkskin('DruidTarget');
            const target = { name: 'DruidTarget', type: 'player' };
            const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
            // Legacy lane: campaignName not threaded ⇒ runtime store never consulted for buffs.
            expect(computeTargetAc(ATTACK, target, characters)).toBe(9);
            characters[0].name = 'PlainTarget';
            expect(computeTargetAc(ATTACK, { name: 'PlainTarget', type: 'player' }, characters, CAMPAIGN)).toBe(9);
        });
    });

    describe('L5-003 §8.3 half cover', () => {
        it('stacks the stamped −2 on top of the Barkskin floor', () => {
            barkskin('DruidTarget');
            store['campaign._cover_shot'] = { attackerName: 'Hero', targetName: 'DruidTarget', ac: -2, round: 1 };
            const ctx = { ...ATTACK, attackerName: 'Hero' };
            const target = { name: 'DruidTarget', type: 'player' };
            const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
            // floor 17 is a base-AC rule; the −2 circumstance penalty rides on top.
            expect(computeTargetAc(ctx, target, characters, CAMPAIGN)).toBe(15);
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
