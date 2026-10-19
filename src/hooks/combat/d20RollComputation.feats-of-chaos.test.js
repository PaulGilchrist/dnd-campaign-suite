// @maintained-by-ai
// CLA-134 — Feats of Chaos (Wild Magic Sorcery): the armed latch
// featsOfChaosActive must fold into forcedMode:'advantage' at the
// computeD20Roll roll seam and be CONSUMED there (single owner:
// globalFeats.consumeFeatsOfChaos — guards: existing forcedMode,
// Restore Balance-cancelled roll, and ownership all beat the fold and
// leave the latch armed).
//
// Sibling split: d20RollComputation.test.js (base) owns generic roll
// computation (Halfling Lucky reroll); d20RollComputation.subtract-die.test.js
// owns the subtract-die/bane rider fold; LogRoll #886 owns RENDER of
// bane/bless/GWF/subtract-rider bytes; wildMagicSurgeService.test.js owns
// surge triggering and re-arming. This lane owns ONLY the CLA-134
// fold + consume + guard contract at this seam.
//
// Old→new map (was 8 flat tests): weapon/spell/save fold tests → matrix
// rows 1–3; disadvantage/Restore-Balance/not-armed/owner-gated tests →
// rows 4–7; 'after consumed, next rolls normal' → standalone consume-once
// test below (needs two sequential calls, cannot be a matrix row).
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
// The exact consume write (skipSync=true per the SSE-echo convention).
const CONSUME_WRITE = [CASTER, 'featsOfChaosActive', false, CAMPAIGN, true];

describe('computeD20Roll — Feats of Chaos advantage fold + consume (CLA-134)', () => {
    beforeEach(() => {
        d20Queue = [];
        setRuntimeValue.mockClear();
        addEntry.mockClear();
        for (const k of Object.keys(store)) delete store[k];
    });

    it.each([
        {
            title: 'armed weapon attack folds to advantage, takes high-of-two, consumes + logs',
            arm: CASTER, queue: [4, 16], name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10,
            mode: 'advantage', effective: 16,
            clears: [CONSUME_WRITE], latch: false,
            log: 'AberrantSorcerer consumed Feats of Chaos: Advantage on Unarmed Strike attack.',
        },
        {
            title: 'armed spell-attack lane (Fire Bolt) folds to advantage, takes high-of-two, consumes + logs',
            arm: CASTER, queue: [5, 17], name: 'Fire Bolt', rollType: 'attack',
            context: { spellName: 'Fire Bolt', attackerName: CASTER, targetName: 'Goblin' }, bonus: 10,
            mode: 'advantage', effective: 17,
            clears: [CONSUME_WRITE], latch: false,
            log: 'AberrantSorcerer consumed Feats of Chaos: Advantage on Fire Bolt attack.',
        },
        {
            title: 'armed save roll folds to advantage, takes high-of-two, consumes + logs',
            arm: CASTER, queue: [3, 19], name: 'Dexterity', rollType: 'save', context: {}, bonus: 7,
            mode: 'advantage', effective: 19,
            clears: [CONSUME_WRITE], latch: false,
            log: 'AberrantSorcerer consumed Feats of Chaos: Advantage on Dexterity save.',
        },
        {
            title: 'existing disadvantage beats the fold — takes low, latch stays armed, no consume',
            arm: CASTER, queue: [15, 7], name: 'Unarmed Strike', rollType: 'attack',
            context: { forcedMode: 'disadvantage' }, bonus: 10,
            mode: 'disadvantage', effective: 7,
            clears: [], latch: true, log: null,
        },
        {
            title: 'existing advantage context beats the fold too — latch stays armed for the NEXT test',
            arm: CASTER, queue: [8, 12], name: 'Unarmed Strike', rollType: 'attack',
            context: { forcedMode: 'advantage' }, bonus: 10,
            mode: 'advantage', effective: 12,
            clears: [], latch: true, log: null,
        },
        {
            title: 'Restore Balance-cancelled roll blocks the fold — normal roll, latch stays armed',
            arm: CASTER, queue: [8, 12], name: 'Unarmed Strike', rollType: 'attack',
            context: { _restoreBalanceCancelled: true }, bonus: 10,
            mode: 'normal', effective: 8,
            clears: [], latch: true, log: null,
        },
        {
            title: 'owner-gated — another character armed does not advantage the roller, other stays armed',
            arm: 'OtherCaster', queue: [4, 16], name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10,
            mode: 'normal', effective: 4,
            clears: [], latch: true, log: null,
        },
        {
            title: 'not armed — control leg: normal mode, zero flag writes, zero logs',
            arm: null, queue: [4, 16], name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10,
            mode: 'normal', effective: 4,
            clears: [], latch: null, log: null,
        },
    ])('$title', ({ arm, queue, name, rollType, context, bonus, mode, effective, clears, latch, log }) => {
        if (arm) store[key(arm, 'featsOfChaosActive')] = true;
        d20Queue = queue;

        const r = computeD20Roll({
            characterName: CASTER, campaignName: CAMPAIGN, name, rollType, context, bonus,
            isResilientSphereActive: () => false,
        });

        expect(r.forcedMode).toBe(mode);
        expect(r.effectiveD20Roll).toBe(effective);
        expect(setRuntimeValue.mock.calls.filter(([, prop]) => prop === 'featsOfChaosActive')).toEqual(clears);
        expect(getRuntimeValue(arm || CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(latch);
        if (log) {
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][1]).toMatchObject({
                type: 'ability_use',
                characterName: CASTER,
                abilityName: 'Feats of Chaos',
                description: log,
            });
        } else {
            expect(addEntry).not.toHaveBeenCalled();
        }
    });

    it('consumes once — the armed roller\'s SECOND d20 test rolls normal', () => {
        store[key(CASTER, 'featsOfChaosActive')] = true;
        d20Queue = [4, 16, 15, 7];

        const first = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });
        const second = computeD20Roll({ characterName: CASTER, campaignName: CAMPAIGN, name: 'Unarmed Strike', rollType: 'attack', context: {}, bonus: 10, isResilientSphereActive: () => false });

        expect(first.forcedMode).toBe('advantage');
        expect(first.effectiveD20Roll).toBe(16);
        expect(second.forcedMode).toBe('normal');
        expect(second.effectiveD20Roll).toBe(15);
        expect(second.luckyRerolled).toBe(false);
        expect(getRuntimeValue(CASTER, 'featsOfChaosActive', CAMPAIGN)).toBe(false);
        expect(setRuntimeValue.mock.calls.filter(([, prop]) => prop === 'featsOfChaosActive')).toEqual([CONSUME_WRITE]);
        expect(addEntry).toHaveBeenCalledTimes(1);
    });
});
