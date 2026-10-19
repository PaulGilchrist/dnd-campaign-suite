// @maintained-by-ai
// MA-0093 lane — generalized subtract-die roll-time COMPUTATION at the
// computeD20Roll seam: any te on the roller carrying subtractDie
// (giggling_magic_debuff 1d6) rolls its own die and folds the negative
// total into effectiveBonus on attack rolls AND ability/skill checks only;
// bane_penalty stays attack-only 1d4 (MA-0070 legacy). Zero/negative
// outcomes and the exact finalBonusDetail bytes are pinned as hand-derived
// literals — never recomputed here from the formula.
//
// Family map: d20RollComputation.test.js (base) owns generic computation +
// Halfling Lucky; .feats-of-chaos.test.js #936 owns the CLA-134 advantage
// fold; .weakening-breath.test.js owns STR-disadvantage; LogRoll #886 owns
// the RENDER byte '-1d6 [Subtract Rider]: -2' — display lives there.
// This lane owns ONLY the subtract-rider/bane fold bytes on the COMPUTE
// result object.
//
// Old→new map (was 5 flat tests): giggling attack → row 1 (negatives
// folded in); giggling check → row 2 (no ' to hit' byte, MN-004); giggling
// save → row 3; te-on-other-target inert → row 5; bane-on-check → row 7.
// Added: row 4 zero-rider falsifier (#882 short-circuit class — die rolled
// but absent bracket proves detail derives from penalty<0, not te presence);
// row 6 bane POSITIVE on attack (completes the attack-only claim — was
// half-tested); row 8 two riders stack with per-te die expressions.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let d20Queue = [];
let riderQueue = [];
const rolled = [];
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: () => d20Queue.shift(),
    rollExpression: (expr) => {
        rolled.push(expr);
        return { total: riderQueue.shift(), rolls: [], modifier: 0 };
    },
}));

let tes = [];
vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => (key === 'targetEffects' ? tes : undefined),
    setRuntimeValue: vi.fn(),
}));

vi.mock('./starryDragon.js', () => ({
    hasStarryDragonActive: () => false,
    starryDragonAppliesToRoll: () => false,
}));

// Zero out unrelated seams so this lane tests ONLY the subtract fold.
vi.mock('../../services/encounters/monsterBurstOfIngenuity.js', () => ({
    consumeBurstOfIngenuityBuff: () => ({ bonus: 0 }),
}));
vi.mock('./globalFeats.js', () => ({
    consumeFeatsOfChaos: () => null,
}));

import { computeD20Roll } from './d20RollComputation.js';

const TARGET = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';
const gigglingTe = [{
    target: TARGET,
    effect: 'giggling_magic_debuff',
    source: 'Adult Copper Dragon 1',
    duration: 'until_end_of_next_turn',
    subtractDie: '1d6',
    displayLabel: 'Giggling Magic',
}];
const baneTe = [{ target: TARGET, effect: 'bane_penalty' }];

describe('MA-0093 computeD20Roll — subtract-die rider fold (bless/bane legacy included)', () => {
    beforeEach(() => {
        d20Queue = [12, 12]; // two normal-mode d20s; d20 mechanics owned by base lane
        riderQueue = [];
        rolled.length = 0;
        tes = [];
    });

    it.each([
        {
            title: 'giggling 1d6 on attack rolls its own die, exact negative-total bytes, carries all rider fields',
            tes: gigglingTe, rollType: 'attack', name: 'Fire Bolt', bonus: 1, riders: [6],
            rolled: ['1d6'], eff: -5, detail: '(+1 to hit, -6 [Giggling Magic])',
            banePenalty: 0, baneRoll: null, subPenalty: -6, subRoll: 6, subDie: '1d6', subLabel: 'Giggling Magic',
        },
        {
            title: 'giggling rider applies to ability checks — folded total, no " to hit" byte on checks (MN-004)',
            tes: gigglingTe, rollType: 'check', name: 'Arcana', bonus: 9, riders: [3],
            rolled: ['1d6'], eff: 6, detail: '(+9, -3 [Giggling Magic])',
            banePenalty: 0, baneRoll: null, subPenalty: -3, subRoll: 3, subDie: '1d6', subLabel: 'Giggling Magic',
        },
        {
            title: 'save roll: rider NOT applied — no die rolled, fields stay empty, negative bonus passes through',
            tes: gigglingTe, rollType: 'save', name: 'Death', bonus: -1, riders: [],
            rolled: [], eff: -1, detail: null,
            banePenalty: 0, baneRoll: null, subPenalty: 0, subRoll: null, subDie: null, subLabel: null,
        },
        {
            title: 'zero-rider falsifier: die rolled 0 folds nothing — bracket byte absent despite live te',
            tes: gigglingTe, rollType: 'attack', name: 'Fire Bolt', bonus: 7, riders: [0],
            rolled: ['1d6'], eff: 7, detail: '(+7 to hit)',
            banePenalty: 0, baneRoll: null, subPenalty: 0, subRoll: 0, subDie: '1d6', subLabel: 'Giggling Magic',
        },
        {
            title: 'te aimed at another creature is inert — no rider die consumed, bonus untouched',
            tes: [{ ...gigglingTe[0], target: 'SomeoneElse' }], rollType: 'attack', name: 'Fire Bolt', bonus: 7, riders: [],
            rolled: [], eff: 7, detail: '(+7 to hit)',
            banePenalty: 0, baneRoll: null, subPenalty: 0, subRoll: null, subDie: null, subLabel: null,
        },
        {
            title: 'bane legacy POSITIVE: attack rolls 1d4 (not the 1d6 lane), -2 [Bane] byte, effBonus folded',
            tes: baneTe, rollType: 'attack', name: 'Fire Bolt', bonus: 7, riders: [2],
            rolled: ['1d4'], eff: 5, detail: '(+7 to hit, -2 [Bane])',
            banePenalty: -2, baneRoll: 2, subPenalty: 0, subRoll: null, subDie: null, subLabel: null,
        },
        {
            title: 'bane_penalty stays attack-only on checks (locked MA-0070 legacy)',
            tes: baneTe, rollType: 'check', name: 'Athletics', bonus: 5, riders: [],
            rolled: [], eff: 5, detail: '(+5)',
            banePenalty: 0, baneRoll: null, subPenalty: 0, subRoll: null, subDie: null, subLabel: null,
        },
        {
            title: 'bane + giggling stack: each te rolls its OWN die, both bracket bytes, both folded',
            tes: [...baneTe, ...gigglingTe], rollType: 'attack', name: 'Fire Bolt', bonus: 7, riders: [2, 3],
            rolled: ['1d4', '1d6'], eff: 2, detail: '(+7 to hit, -2 [Bane], -3 [Giggling Magic])',
            banePenalty: -2, baneRoll: 2, subPenalty: -3, subRoll: 3, subDie: '1d6', subLabel: 'Giggling Magic',
        },
    ])('$title', ({ tes: te, rollType, name, bonus, riders, rolled: expectedRolled, eff, detail, banePenalty, baneRoll, subPenalty, subRoll, subDie, subLabel }) => {
        tes = te;
        riderQueue = riders;

        const r = computeD20Roll({ characterName: TARGET, campaignName: CAMPAIGN, name, rollType, context: {}, bonus, isResilientSphereActive: () => false });

        expect(rolled).toEqual(expectedRolled);
        expect(r.effectiveBonus).toBe(eff);
        expect(r.finalBonusDetail ?? null).toBe(detail);
        expect(r.baneAttackPenalty).toBe(banePenalty);
        expect(r.baneAttackRoll).toBe(baneRoll);
        expect(r.subtractDiePenalty).toBe(subPenalty);
        expect(r.subtractDieRoll).toBe(subRoll);
        expect(r.subtractDie).toBe(subDie);
        expect(r.subtractDieDisplayLabel).toBe(subLabel);
    });
});
