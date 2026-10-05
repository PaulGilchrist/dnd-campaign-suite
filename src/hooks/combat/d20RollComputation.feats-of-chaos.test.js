// CLA-134 — Feats of Chaos (Wild Magic Sorcery): the armed latch
// featsOfChaosActive must fold into forcedMode:'advantage' at the
// computeD20Roll roll seam and be CONSUMED there (single owner).
import { describe, it, expect, vi, beforeEach } from 'vitest';

let d20Queue = [];
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: () => d20Queue.shift(),
    rollExpression: () => null,
}));

const store = {};
const key = (name, prop) => `${name}.${prop}`;
vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, prop) => store[key(name, prop)] ?? null,
    setRuntimeValue: vi.fn((name, prop, value) => {
        store[key(name, prop)] = value;
        return Promise.resolve();
    }),
}));

vi.mock('./starryDragon.js', () => ({
    hasStarryDragonActive: () => false,
    starryDragonAppliesToRoll: () => false,
}));

vi.mock('../../services/encounters/monsterBurstOfIngenuity.js', () => ({
    consumeBurstOfIngenuityBuff: () => ({ bonus: 0 }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { computeD20Roll } from './d20RollComputation.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const CASTER = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';

function arm() {
    store[key(CASTER, 'featsOfChaosActive')] = true;
}

function rollCallsForFlagClears() {
    return setRuntimeValue.mock.calls.filter(
        ([name, prop]) => name === CASTER && prop === 'featsOfChaosActive'
    );
}

describe('computeD20Roll — Feats of Chaos advantage fold + consume (CLA-134)', () => {
    beforeEach(() => {
        d20Queue = [];
        setRuntimeValue.mockClear();
        addEntry.mockClear();
        for (const k of Object.keys(store)) delete store[k];
    });

    it('armed weapon attack folds to advantage, takes high-of-two, consumes once', () => {
        arm();
        d20Queue = [4, 16];
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('advantage');
        expect(r.effectiveD20Roll).toBe(16);
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(false);
        expect(rollCallsForFlagClears()).toHaveLength(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            type: 'ability_use',
            characterName: CASTER,
            abilityName: 'Feats of Chaos',
        });
    });

    it('spell attack (Fire Bolt via spell-cast lane) folds and consumes too', () => {
        arm();
        d20Queue = [5, 17];
        const ctx = { spellName: 'Fire Bolt', attackerName: CASTER, targetName: 'Goblin' };
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Fire Bolt', rollType: 'attack', context: ctx, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('advantage');
        expect(r.effectiveD20Roll).toBe(17);
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(false);
    });

    it('save roll folds and consumes (any d20 test at this seam)', () => {
        arm();
        d20Queue = [3, 19];
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Dexterity', rollType: 'save', context: {}, bonus: 7, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('advantage');
        expect(r.effectiveD20Roll).toBe(19);
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(false);
    });

    it('not armed — normal mode, no flag write, no consumption log', () => {
        d20Queue = [4, 16];
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('normal');
        expect(r.effectiveD20Roll).toBe(4);
        expect(rollCallsForFlagClears()).toHaveLength(0);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('after consumed, the next test rolls normal (consume once)', () => {
        arm();
        d20Queue = [4, 16, 15, 7];
        const first = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        expect(first.forcedMode).toBe('advantage');
        const second = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        expect(second.forcedMode).toBe('normal');
        expect(second.effectiveD20Roll).toBe(15);
        expect(rollCallsForFlagClears()).toHaveLength(1);
    });

    it('existing disadvantage beats the fold — latch stays armed', () => {
        arm();
        d20Queue = [15, 7];
        const ctx = { forcedMode: 'disadvantage' };
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: ctx, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('disadvantage');
        expect(r.effectiveD20Roll).toBe(7);
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(true);
        expect(rollCallsForFlagClears()).toHaveLength(0);
    });

    it('Restore Balance-cancelled roll blocks the fold — latch stays armed', () => {
        arm();
        d20Queue = [8, 12];
        const ctx = { _restoreBalanceCancelled: true };
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: ctx, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('normal');
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(true);
        expect(rollCallsForFlagClears()).toHaveLength(0);
    });

    it('owner-gated — another character armed does not advantage the roller', () => {
        store[key('OtherCaster', 'featsOfChaosActive')] = true;
        d20Queue = [4, 16];
        const r = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('normal');
        expect(getRuntimeValue('OtherCaster', 'featsOfChaosActive', CAMPAIGN)).toBe(true);
    });
});
