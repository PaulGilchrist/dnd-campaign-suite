// @maintained-by-ai
// CLA-216 base lane — computeD20Roll GENERIC roll mechanics at the compute
// seam: d20 selection (normal keeps r1, advantage high-of-two, disadvantage
// low-of-two), crit/nat boundaries, the context.d20Floor10 consumer, totals
// assembly (hand-derived literals, never recomputed from the formula), and
// the Halfling Lucky auto-reroll: reroll nat 1, use the new roll even when
// it is another nat 1 (consume-once), after forcedMode resolution.
//
// Family ownership map — ticket lanes CLOSED here, cut any overlap:
// - .feats-of-chaos.test.js #936 owns the CLA-134 latch fold + consume
//   bytes at the consume seam (source :254-262).
// - .subtract-die.test.js #937 owns bane/giggling rider fold bytes
//   (incl. bane-positive row 6 and the '(+7 to hit)' / '(+5)' control bytes).
// - .weakening-breath.test.js owns the STR-te disadvantage producer path.
// - cosmicOmenHandler.pending-store.test.js owns the cosmic-omen consume fold.
// - useLoggedDiceRollAttack.misc-effects.test.js owns bless/Sundering/
//   Sacred-Weapon/target-Lucky bytes at the createLogAndShow caller seam.
// - LogRoll #886 owns RENDER bytes.
// Ticket seams (globalFeats, monsterBurstOfIngenuity) are mocked-to-zero
// below to prove non-interference with the generic mechanics (#937).
//
// Old→new map (was 10 flat Lucky tests): nat-1 check/save/attack rerolls →
// Lucky rows 1–3; reroll-is-also-1 consume-once → row 4; advantage
// resolves-1 ordering → row 5; non-nat-1 / advantage-keeps-1 / no-flag /
// favored_enemy / convert_miss_to_hit gates → rows 6–10 (each now also
// pins exact die consumption). NEW: d20-selection matrix (selection core +
// crit boundaries + d20Floor10 consumer) and the zero-mutation totals
// control, both previously unmapped base-owned census.
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

// Ticket seams mocked to zero — prove non-interference (#936/#937 lanes own them).
vi.mock('./globalFeats.js', () => ({
    consumeFeatsOfChaos: () => null,
}));
vi.mock('../../services/encounters/monsterBurstOfIngenuity.js', () => ({
    consumeBurstOfIngenuityBuff: () => ({ bonus: 0 }),
}));

import { computeD20Roll } from './d20RollComputation.js';

const CAMPAIGN = 'test-campaign';

function roll({ queue, rollType = 'attack', name = 'Shortsword', bonus = 5, context = {} }) {
    d20Queue = [...queue]; // copy so row literals stay intact for byte assertions
    return computeD20Roll({
        characterName: 'LightfootHalfling',
        campaignName: CAMPAIGN,
        name,
        rollType,
        context,
        bonus,
        isResilientSphereActive: () => false,
    });
}

describe('computeD20Roll — d20 selection core + crit boundaries + floor', () => {
    beforeEach(() => { d20Queue = []; });

    it.each([
        { title: 'normal keeps r1; exact totals bytes (+5 to hit)', context: {}, queue: [12, 5], mode: 'normal', effective: 12, detail: '(+5 to hit)' },
        { title: 'advantage takes the high die', context: { forcedMode: 'advantage' }, queue: [3, 17], mode: 'advantage', effective: 17, detail: '(+5 to hit)' },
        { title: 'disadvantage takes the low die', context: { forcedMode: 'disadvantage' }, queue: [15, 7], mode: 'disadvantage', effective: 7, detail: '(+5 to hit)' },
        { title: 'crit boundary: advantage keeps nat 20 over low r1', context: { forcedMode: 'advantage' }, queue: [4, 20], mode: 'advantage', effective: 20, detail: '(+5 to hit)' },
        { title: 'crit boundary: disadvantage keeps nat 1 over high r1', context: { forcedMode: 'disadvantage' }, queue: [1, 20], mode: 'disadvantage', effective: 1, detail: '(+5 to hit)' },
        { title: 'advantage double nat 1 stays 1 without Lucky context (no reroll)', context: { forcedMode: 'advantage' }, queue: [1, 1], mode: 'advantage', effective: 1, detail: '(+5 to hit)' },
        { title: 'd20Floor10 floors nat 9 up to 10 (effectiveD20 and effectiveD20Roll)', context: { d20Floor10: true }, queue: [9, 13], mode: 'normal', effective: 10, floor: 10, detail: '(+5 to hit)' },
        { title: 'floor-off control: nat 9 kept raw', context: {}, queue: [9, 13], mode: 'normal', effective: 9, floor: 9, detail: '(+5 to hit)' },
    ])('$title', ({ context, queue, mode, effective, floor, detail }) => {
        const r = roll({ queue, context });

        expect(r.r1).toBe(queue[0]);
        expect(r.r2).toBe(queue[1]);
        expect(r.forcedMode).toBe(mode);
        expect(r.effectiveD20Roll).toBe(effective);
        expect(r.effectiveD20).toBe(floor ?? queue[0]);
        expect(r.finalBonusDetail).toBe(detail);
        expect(r.luckyRerolled).toBe(false);
        expect(r.luckyRerollValue).toBeNull();
        expect(d20Queue).toEqual([]); // exactly two dice consumed
    });
});

describe('computeD20Roll — totals assembly (zero-mutation control)', () => {
    it('plain roll: bonus passes through, every rider/flag field empty, no dice beyond r1/r2', () => {
        const r = roll({ queue: [12, 5], bonus: 7 });

        expect(r.effectiveBonus).toBe(7);
        expect(r.finalBonusDetail).toBe('(+7 to hit)');
        expect({
            cosmicOmenAppliedBonus: r.cosmicOmenAppliedBonus, cosmicOmenDetail: r.cosmicOmenDetail,
            pendingSkillCheckAppliedBonus: r.pendingSkillCheckAppliedBonus, pendingSkillCheckDetail: r.pendingSkillCheckDetail,
            rayStrDisadvantage: r.rayStrDisadvantage, sacredWeaponBonus: r.sacredWeaponBonus,
            baneAttackPenalty: r.baneAttackPenalty, baneAttackRoll: r.baneAttackRoll,
            subtractDiePenalty: r.subtractDiePenalty, subtractDieRoll: r.subtractDieRoll,
            subtractDieDisplayLabel: r.subtractDieDisplayLabel, subtractDie: r.subtractDie,
            blessAttackBonus: r.blessAttackBonus, blessAttackRoll: r.blessAttackRoll,
            sunderingBlowBonus: r.sunderingBlowBonus, burstOfIngenuityBonus: r.burstOfIngenuityBonus,
            starryDragonFloor: r.starryDragonFloor, isAutoMiss: r.isAutoMiss, coverAcBonus: r.coverAcBonus,
        }).toEqual({
            cosmicOmenAppliedBonus: 0, cosmicOmenDetail: null,
            pendingSkillCheckAppliedBonus: 0, pendingSkillCheckDetail: null,
            rayStrDisadvantage: false, sacredWeaponBonus: 0,
            baneAttackPenalty: 0, baneAttackRoll: null,
            subtractDiePenalty: 0, subtractDieRoll: null,
            subtractDieDisplayLabel: null, subtractDie: null,
            blessAttackBonus: 0, blessAttackRoll: null,
            sunderingBlowBonus: 0, burstOfIngenuityBonus: 0,
            starryDragonFloor: false, isAutoMiss: false, coverAcBonus: 0,
        });
        expect(d20Queue).toEqual([]);
    });
});

describe('computeD20Roll — Halfling Lucky auto reroll (CLA-216)', () => {
    beforeEach(() => { d20Queue = []; });

    const LUCKY = () => ({ autoReroll: true, autoRerollCondition: 'roll_equals_1' });

    it.each([
        { title: 'check nat 1 rerolls and uses the new value', rollType: 'check', name: 'Strength', context: LUCKY(), queue: [1, 7, 14], rerolled: true, rerollValue: 14, effective: 14 },
        { title: 'save nat 1 rerolls and uses the new value', rollType: 'save', name: 'Strength', context: LUCKY(), queue: [1, 4, 11], rerolled: true, rerollValue: 11, effective: 11 },
        { title: 'attack nat 1 rerolls and uses the new value', rollType: 'attack', name: 'Shortsword', context: LUCKY(), queue: [1, 7, 14], rerolled: true, rerollValue: 14, effective: 14 },
        { title: 'reroll that is ALSO nat 1 must be used — single consume, never a second die', rollType: 'check', name: 'Strength', context: LUCKY(), queue: [1, 7, 1], rerolled: true, rerollValue: 1, effective: 1 },
        { title: 'disadvantage resolving to nat 1 rerolls AFTER forcedMode is applied', rollType: 'check', name: 'Strength', context: { ...LUCKY(), forcedMode: 'disadvantage' }, queue: [5, 1, 17], rerolled: true, rerollValue: 17, effective: 17 },
        { title: 'non-nat-1 is not rerolled — exactly two dice consumed', rollType: 'check', name: 'Strength', context: LUCKY(), queue: [12, 3], rerolled: false, rerollValue: null, effective: 12 },
        { title: 'advantage keeping the die above 1 does not reroll', rollType: 'check', name: 'Strength', context: { ...LUCKY(), forcedMode: 'advantage' }, queue: [1, 15], rerolled: false, rerollValue: null, effective: 15 },
        { title: 'no autoReroll flag: nat 1 stands as rolled', rollType: 'check', name: 'Strength', context: {}, queue: [1, 9], rerolled: false, rerollValue: null, effective: 1 },
        { title: 'different condition favored_enemy (Indomitable lineage) does not trigger', rollType: 'save', name: 'Wisdom', context: { autoReroll: true, autoRerollCondition: 'favored_enemy' }, queue: [1, 9], rerolled: false, rerollValue: null, effective: 1 },
        { title: 'different condition convert_miss_to_hit on an attack does not trigger', rollType: 'attack', name: 'Shortsword', context: { autoReroll: true, autoRerollCondition: 'convert_miss_to_hit' }, queue: [1, 9], rerolled: false, rerollValue: null, effective: 1 },
    ])('$title', ({ rollType, name, context, queue, rerolled, rerollValue, effective }) => {
        const r = roll({ queue, rollType, name, bonus: 5, context });

        expect(r.luckyRerolled).toBe(rerolled);
        expect(r.luckyRerollValue).toBe(rerollValue);
        expect(r.effectiveD20Roll).toBe(effective);
        expect(d20Queue).toEqual([]); // exact die consumption: no phantom reroll dice
    });
});
