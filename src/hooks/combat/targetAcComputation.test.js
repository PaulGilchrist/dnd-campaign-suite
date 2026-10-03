// SP-013: Barkskin floor must reach hit resolution — computeTargetAc folds a
// min-17 FLOOR (not an additive buff) when the target carries a barkskin
// activeBuff; targets without the buff and non-attack rolls stay byte-identical.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { computeTargetAc, isBarkskinAcFloorActive } from './targetAcComputation.js';

const store = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => (store[`${name}.${key}`] ?? null)),
    setRuntimeValue: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

describe('SP-013 computeTargetAc — barkskin AC floor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
    });

    it('floors a barkskinned player target at AC 17', () => {
        store['DruidTarget.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        const target = { name: 'DruidTarget', type: 'player' };
        const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
        expect(computeTargetAc({ rollType: 'attack' }, target, characters, CAMPAIGN)).toBe(17);
    });

    it('leaves barkskinned targets above 17 untouched (floor, not buff)', () => {
        store['PaladinTarget.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        const target = { name: 'PaladinTarget', type: 'player' };
        const characters = [{ name: 'PaladinTarget', computedStats: { armorClass: 20 } }];
        expect(computeTargetAc({ rollType: 'attack' }, target, characters, CAMPAIGN)).toBe(20);
    });

    it('floors an EB-joined (non-player) barkskinned combatant too', () => {
        store['Goblin 1.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        const target = { name: 'Goblin 1', type: 'npc', ac: 15 };
        expect(computeTargetAc({ rollType: 'attack' }, target, [], CAMPAIGN)).toBe(17);
    });

    it('returns base AC when no barkskin buff is present', () => {
        const target = { name: 'PlainTarget', type: 'player' };
        const characters = [{ name: 'PlainTarget', computedStats: { armorClass: 9 } }];
        expect(computeTargetAc({ rollType: 'attack' }, target, characters, CAMPAIGN)).toBe(9);
    });

    it('returns base AC for non-attack rolls even with barkskin', () => {
        store['DruidTarget.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        const target = { name: 'DruidTarget', type: 'player' };
        const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
        expect(computeTargetAc({ rollType: 'save' }, target, characters, CAMPAIGN)).toBeUndefined();
    });

    it('is inert when campaignName is not threaded (legacy callers)', () => {
        store['DruidTarget.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        const target = { name: 'DruidTarget', type: 'player' };
        const characters = [{ name: 'DruidTarget', computedStats: { armorClass: 9 } }];
        expect(computeTargetAc({ rollType: 'attack' }, target, characters)).toBe(9);
    });

    it('isBarkskinAcFloorActive only matches the barkskin effect key', () => {
        store['A.activeBuffs'] = [{ name: 'Barkskin', effect: 'mage_armor' }];
        expect(isBarkskinAcFloorActive('A', CAMPAIGN)).toBe(false);
        store['B.activeBuffs'] = [{ name: 'Barkskin', effect: 'barkskin' }];
        expect(isBarkskinAcFloorActive('B', CAMPAIGN)).toBe(true);
        store['C.activeBuffs'] = 'not-an-array';
        expect(isBarkskinAcFloorActive('C', CAMPAIGN)).toBe(false);
        expect(isBarkskinAcFloorActive(null, CAMPAIGN)).toBe(false);
    });
});
