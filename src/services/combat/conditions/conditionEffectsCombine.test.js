// @maintained-by-ai
// Owner lane: attacksOtherDisadvantageSource gating in combineAttackModes
// (the compelled_duel / taunting_step field, conditionEffects.js :378/:381
// consumed at :864). Split vs #998 base canon (conditionEffects.test.js
// :230-249): its 13-row net-mode matrix carries NO attacksOther rows —
// its header :13/:46 explicitly forwards this gating HERE. Producer-side
// te→field folds are owned by conditionEffectsCompute.test.js :96-103 and
// are NOT re-pinned here; this file pins only the consumer gate at :864 and
// its net-mode interaction faces.
//
// Row falsifiers (each row kills a distinct deletion mutant):
//   fires vs non-source → deletion of :864 dis++ flips row 1 to 'normal'
//   attacks source → deleting `targetName !== source` conjunct flips row 2
//   unknown target → deleting `targetName &&` conjunct flips row 3
//   additive not override → deleting :864 flips row 4 to 'advantage'
//     (the old 'combines with other disadvantage sources' test was NOT
//     falsifiable: bucket dis=1 already returned 'disadvantage' without the
//     gate; replaced with this advantage-offset face — honest per #910)
//   gate dis survives noAdvantageAgainst → row 5 pins :868 zeroes only adv;
//     #998 :244 pins the adv side alone, the dis-survival leg lives here
//
// old → new map: old tests 1-3 → rows 1-3 (exact same assertions, folded);
// old test 4 → row 4 (strengthened, see falsifier note). restoreBalance×gate
// omitted: mutant-equivalent to restoreBalance.test.js :204 (RB decrements
// the same combined dis), per #936 fold + one-home-per-matrix (#710).
import { describe, it, expect } from 'vitest';
import { combineAttackModes } from './conditionEffects.js';

describe('combineAttackModes — attacksOtherDisadvantageSource gating (:864)', () => {
  const ATT = (o = {}) => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false, ...o });
  const TGT = (o = {}) => ({ targetAdvantageCount: 0, targetDisadvantageCount: 0, ...o });

  it.each([
    ['fires vs non-source target → disadvantage', ATT({ attacksOtherDisadvantageSource: 'Paladin' }), TGT(), 5, 'Goblin', 'disadvantage'],
    ['attacking the source itself → normal', ATT({ attacksOtherDisadvantageSource: 'Paladin' }), TGT(), 5, 'Paladin', 'normal'],
    ['unknown target (null targetName) → normal', ATT({ attacksOtherDisadvantageSource: 'Paladin' }), TGT(), 5, null, 'normal'],
    ['stacked advantage 1 nets vs gate (additive, not override)', ATT({ attackAdvantageCount: 1, attacksOtherDisadvantageSource: 'Paladin' }), TGT(), 5, 'Goblin', 'normal'],
    ['noAdvantageAgainst zeroes adv but gate disadvantage survives', ATT({ attackAdvantageCount: 2, attacksOtherDisadvantageSource: 'Paladin' }), TGT({ noAdvantageAgainst: true }), 10, 'Goblin', 'disadvantage'],
  ])('%s', (_name, attacker, target, range, targetName, expected) => {
    expect(combineAttackModes(attacker, target, range, targetName)).toBe(expected);
  });
});
