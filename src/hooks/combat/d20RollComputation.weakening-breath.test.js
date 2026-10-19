// @maintained-by-ai
// MA-0102 lane — STR-te disadvantage PRODUCER at the computeD20Roll seam:
// any te on the roller carrying the generic strCheckDisadvantage flag
// (weakening_breath from Adult Gold Dragon Weakening Breath; the generalized
// consumer of ray_of_enfeeble_debuff) forces forcedMode:'disadvantage' on
// that creature's STR ability/skill checks. Rule mapped from source
// hasStrTestDisadvantage (:56-66): rollType gate check|skill only, STR
// keying (abbr 'STR*' | 'Strength' | 'Athletics'), flag-vs-effect-name
// keying, target match. Exact output bytes: forcedMode + the branch's
// dedicated rayStrDisadvantage result byte, forced exactly once per roll,
// never consumed (duration/flag consumer, NOT a oneShot latch — #932
// consume semantics do NOT apply here). No store writes and no log bytes
// are authored in this branch, so no skipSync (#936) or log assertions.
//
// Family map (cut overlaps): d20RollComputation.test.js base #938 owns the
// selection core (incl. 'disadvantage takes the low die' [15,7]→7), Lucky
// and totals; .feats-of-chaos.test.js #936 owns the CLA-134 latch fold +
// consume bytes; .subtract-die.test.js #937 owns bane/giggling rider fold
// bytes (the damageSubtractDie decoration on the weakening te is INERT at
// this seam — computeSubtractDiePenalty keys te.subtractDie/bane_penalty,
// owned there); LogRoll #886 owns RENDER bytes.
// Rec #938 applied: old test 1's queue [15,6]→effectiveD20Roll 6 assertion
// re-proved low-of-two selection at this seam — TRIMMED to the lane's true
// distinct face (context-free producer bytes).
//
// Old→new map (was 4 flat tests): old 1 armed STR check → row 1; old 2
// skill keying → rows 2+4; old 3 'ray legacy te (no flag)' was MISCaptioned
// (the spread carried strCheckDisadvantage:true) and merely re-ran row 1 —
// replaced by the honest keying census rows 3 (ray WITH flag = parity) and
// 8 (ray WITHOUT flag inert: consumer keys on the flag, not the effect
// name); old 4 'without the flag' changed the TARGET, not the flag — split
// into honest rows 6 (wrong target) and 7 (flag absent). NEW: row 5 save
// gate + row 5b attack gate (rollType census — save gate was header-claimed
// but untested), zero-mutation context controls (#934 survives-proof), and
// the persist/no-consume test.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rollD20 = vi.fn(() => 12);
const rollExpression = vi.fn(() => ({ total: 3, rolls: [3], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: (...args) => rollD20(...args),
    rollExpression: (...args) => rollExpression(...args),
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

// Zero out unrelated ticket seams so this lane tests ONLY the STR-dis
// producer (#937 mock-to-zero precedent).
vi.mock('../../services/encounters/monsterBurstOfIngenuity.js', () => ({
    consumeBurstOfIngenuityBuff: () => ({ bonus: 0 }),
}));
vi.mock('./globalFeats.js', () => ({
    consumeFeatsOfChaos: () => null,
}));

import { computeD20Roll } from './d20RollComputation.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';

const TARGET = 'EvasiveFighter';
const weakeningTe = [{
    target: TARGET,
    effect: 'weakening_breath',
    source: 'Adult Gold Dragon 1',
    duration: '1_minute',
    dc: 21,
    saveType: 'Strength',
    strCheckDisadvantage: true,
    damageSubtractDie: '1d6',
}];
const rayTe = [{ ...weakeningTe[0], effect: 'ray_of_enfeeble_debuff' }];

function roll({ rollType, name }) {
    const context = {};
    const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name, rollType, context, bonus: 5, isResilientSphereActive: () => false });
    return { r, context };
}

beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(12);
    rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
    tes = [];
});

describe('MA-0102 STR-te disadvantage producer (via computeD20Roll)', () => {
    it.each([
        { title: 'weakening te on roller: STR ability check → producer forces dis', tes: weakeningTe, rollType: 'check', name: 'Strength', dis: true },
        { title: 'weakening te on roller: Athletics skill → producer forces dis', tes: weakeningTe, rollType: 'skill', name: 'Athletics', dis: true },
        { title: 'ray_of_enfeeble te carrying the flag: parity dis', tes: rayTe, rollType: 'check', name: 'Strength', dis: true },
        { title: 'armed but non-STR skill: untouched', tes: weakeningTe, rollType: 'skill', name: 'Arcana', dis: false },
        { title: 'armed but STR save: untouched (save seam owned by saveProcessing)', tes: weakeningTe, rollType: 'save', name: 'Strength', dis: false },
        { title: 'armed but attack roll: untouched', tes: weakeningTe, rollType: 'attack', name: 'Longsword', dis: false },
        { title: 'flagged te on another creature: inert', tes: [{ ...weakeningTe[0], target: 'SomeoneElse' }], rollType: 'check', name: 'Strength', dis: false },
        { title: 'weakening te without the flag: inert', tes: [{ ...weakeningTe[0], strCheckDisadvantage: false }], rollType: 'check', name: 'Strength', dis: false },
        { title: 'ray te without the flag: inert — keyed on the flag, not the effect name', tes: [{ ...rayTe[0], strCheckDisadvantage: false }], rollType: 'check', name: 'Strength', dis: false },
    ])('$title', ({ tes: rowTes, rollType, name, dis }) => {
        tes = rowTes;
        const { r, context } = roll({ rollType, name });
        expect(r.rayStrDisadvantage).toBe(dis);
        expect(r.forcedMode).toBe(dis ? 'disadvantage' : 'normal');
        expect(context).toEqual({});
    });

    it('disadvantage is NOT consumed: two armed STR checks both forced dis, zero store writes', () => {
        tes = weakeningTe;
        const first = roll({ rollType: 'skill', name: 'Athletics' });
        const second = roll({ rollType: 'skill', name: 'Athletics' });
        expect(first.r.forcedMode).toBe('disadvantage');
        expect(second.r.forcedMode).toBe('disadvantage');
        expect(second.r.rayStrDisadvantage).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
