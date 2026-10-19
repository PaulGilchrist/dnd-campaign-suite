// @maintained-by-ai
// ── restoreBalance.test.js — CLA-295 Restore Balance lane ──────────────────
// There is no restoreBalance.js module. The feature spans three sources and each
// lane pins only the faces this file owns:
//   1. Collector guard — automationModifiers.js:130-132 registers no
//      SAVE_MODIFIER_BUILDER for restore_balance: it is a Reaction, never a
//      passive modifier. It arms via row click and is consumed at the roll seam
//      by consumeArmedRestoreBalance (restoreBalanceState.js:32) — armed/consume
//      is owned by restoreBalanceState.test.js, never re-pinned here.
//   2. Never-passive fold — conditionEffectsInternal.js:7 SAVE_NEVER_APPLIES_EFFECTS
//      short-circuits saveModifierApplies (:215). conditionEffectsCompute.test.js
//      :112-113 dropped its restore_balance fold row citing THIS file as owner.
//   3. Net-mode interplay — conditionEffects.js:844-888: the restoreBalance legs of
//      getNetAttackMode / combineAttackModes / hasSaveAdvantage. Baseline (RB=false)
//      net math and the consumer matrix live in conditionEffects.test.js :217/:230/:267,
//      whose headers cite the restoreBalance legs as owned here.
//
// Applied recs (both sides read, verdict per rec):
//  #964 VERIFIED — collectSaveModifiers null/undefined legs removed: the unbuildable-
//       roster guard (null/undefined/[]/missing-automation/unknown-type) is owned by
//       automationModifiers.test.js:43-56. The three restore_balance legs stay, folded
//       into one exact-bytes it.each (#829); the mixed-roster row proves the collector
//       ran, so the empty-row pins are not vacuous filters (#842).
//  #998 VERIFIED — (1,0)/(0,1) RB=false contrast legs were byte-equivalent to
//       conditionEffects.test.js:222-223 → removed with cite. Old collector-bucket
//       block (:60-103) wholly redundant: automationCollector.types.test.js:116 routes
//       restore_balance "reactions only" across a full nine-bucket envelope, and the
//       collector null row is owned by automationService.collection.test.js:82-83 → removed.
//  #1000 VERIFIED — absent→false trio folded into one compute it.each with the
//       stray-modifier rows; the saveAdvantageCount/saveDisadvantageCount collateral
//       pins make every row fail if the fold ever misroutes a restore_balance row (#842).
//  #932 NOT APPLICABLE — restoreBalance does NOT route through
//       consumeGuardianProtectionAcBonus (attackPostProcessing.js:261 consumes
//       Guardian-of-Faith AC stamps) nor the guardian-protection oneShot seam. Its
//       consume seam is consumeArmedRestoreBalance (restoreBalanceState.js:32), born
//       with its own test file. MA-1463 belongs to the attackPostProcessing lane —
//       reported, not implemented here.
//
// Old → new map (31 loose its → 5 it.each tables, 22 falsifiable rows):
//   collectSaveModifiers 5 its → 3 rows (null/undefined cut #964; vacuous
//     "no-automation" leg replaced by the mixed-roster falsifier)
//   collectAutomationFromFeatures 4 its → 0 (owned elsewhere, cites above #998)
//   computeConditionEffects never-passive 5 its → 6 rows, one table (#1000; the old
//     :105/:119 stray targets d20/attack_roll kept verbatim, saving_throw target
//     added as the :215 guard face)
//   getNetAttackMode 5 its → 3 rows ((1,0)/(0,1) mode-flip falsifiers + (1,1) kills
//     the one-sided-decrement mutant; every other old row was mutant-equivalent to
//     the base-net census)
//   combineAttackModes 6 its → 6 rows (vacuous adv-vs-dis and noAdvantageAgainst
//     legs cut — same bytes as baseline census; excess rows rewritten to the
//     single-cancel discriminators; flag-OR and prone seams kept)
//   hasSaveAdvantage 6 its → 4 rows (count/against_spell/null owned by
//     conditionEffects.test.js:281-294; condition-named and ability-list RB seams
//     are this lane's per #998)
import { describe, it, expect } from 'vitest';
import { collectSaveModifiers } from '../automation/automationModifiers.js';
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  hasSaveAdvantage,
} from './conditionEffects.js';

describe('CLA-295 collectSaveModifiers never emits a restore_balance row', () => {
  // Exact bytes (#829) in authored row order. The mixed roster is the falsifier
  // that the same call DOES collect a registered builder type — proving the
  // restore_balance exclusions above are guards, not dead collectors.
  it.each([
    ['object automation', { type: 'restore_balance', target: 'd20', range: '60_ft' }, []],
    ['array automation', [{ type: 'restore_balance', target: 'd20' }, { type: 'some_other', target: 'attack_roll' }], []],
    ['mixed roster — conditional_advantage survives, restore_balance dropped', [
      { type: 'restore_balance', target: 'd20' },
      { type: 'conditional_advantage', target: 'saving_throw', condition: 'frightened', effect: 'advantage' },
    ], [{ source: 'Restore Balance', target: 'saving_throw', condition: 'frightened', effect: 'advantage', abilities: [], skills: [] }]],
  ])('collectSaveModifiers: %s', (_name, automation, expected) => {
    expect(collectSaveModifiers([{ name: 'Restore Balance', automation }])).toEqual(expected);
  });
});

describe('computeConditionEffects — restoreBalance is never set passively (CLA-295)', () => {
  // Owned here per conditionEffectsCompute.test.js:112-113. Stray restore_balance
  // rows must fold to nothing (guard: conditionEffectsInternal.js:7/:215); the
  // counter collateral pins make each row falsifiable — the fold must run and
  // must not leak the row into any count (#842).
  const stray = (target) => [{ source: 'Restore Balance', target, condition: '', effect: 'restore_balance' }];
  it.each([
    ['stray d20-target row folds to nothing', { saveModifiers: stray('d20') }, 0],
    ['stray attack_roll-target row folds to nothing', { saveModifiers: stray('attack_roll') }, 0],
    ['stray saving_throw-target row folds to nothing', { saveModifiers: stray('saving_throw') }, 0],
    ['absent: other advantage row still folds', { saveModifiers: [{ source: 'Other Feature', target: 'saving_throw', effect: 'advantage' }] }, 1],
    ['absent: empty options', {}, 0],
    ['absent: no argument', undefined, 0],
  ])('%s', (_name, options, expectedSaveAdvCount) => {
    const effects = computeConditionEffects(options);
    expect(effects.restoreBalance).toBe(false);
    expect(effects.saveAdvantageCount).toBe(expectedSaveAdvCount);
    expect(effects.saveDisadvantageCount).toBe(0);
  });
});

describe('getNetAttackMode — restoreBalance leg (base math owned by conditionEffects.test.js:217-228)', () => {
  // RB decrements each nonzero count once (:845-848), so the mode only flips for
  // single-sided counts — those are the falsifiable rows. (1,1) cannot flip the
  // mode but kills the one-sided-decrement mutant (would yield 'disadvantage').
  it.each([[1, 0], [0, 1], [1, 1]])('(%i adv, %i dis) with restoreBalance → normal', (adv, dis) => {
    expect(getNetAttackMode(adv, dis, true)).toBe('normal');
  });
});

describe('combineAttackModes — restoreBalance leg (baseline consumer matrix owned by conditionEffects.test.js:230-250)', () => {
  const ATT = (o = {}) => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0, ...o });
  const TGT = (o = {}) => ({ targetAdvantageCount: 0, targetDisadvantageCount: 0, ...o });
  it.each([
    ['attacker RB flag cancels attacker advantage', ATT({ attackAdvantageCount: 1, restoreBalance: true }), TGT(), 10, 'normal'],
    ['target RB flag cancels target advantage (flag OR :872)', ATT(), TGT({ targetAdvantageCount: 1, restoreBalance: true }), 10, 'normal'],
    ['RB cancels exactly one of two advantages', ATT({ attackAdvantageCount: 2, restoreBalance: true }), TGT(), 10, 'advantage'],
    ['RB cancels exactly one of two disadvantages', ATT({ attackDisadvantageCount: 2, restoreBalance: true }), TGT(), 10, 'disadvantage'],
    ['RB cancels prone within-5ft advantage', ATT({ restoreBalance: true }), TGT({ targetAdvantageIfWithin5ft: true }), 5, 'normal'],
    ['RB cancels prone beyond-5ft disadvantage', ATT({ restoreBalance: true }), TGT({ targetDisadvantageIfBeyond5ft: true }), 10, 'normal'],
  ])('%s', (_name, attacker, target, range, expected) => {
    expect(combineAttackModes(attacker, target, range)).toBe(expected);
  });
});

describe('hasSaveAdvantage — restoreBalance seams not in the engine matrix', () => {
  // Count/against_spell/null RB rows are owned by conditionEffects.test.js:281-294
  // (compute-folded fixtures, stronger than hand literals). Kept here: the
  // condition-named and ability-list save-advantage seams, where RB (:884)
  // short-circuits before the saveType/ability matchers (:886-887) — #998
  // module-specific semantics owned by this lane.
  it.each([
    ['condition-named advantage survives without RB', { saveAdvantage: ['charmed'], saveAdvantageCount: 0 }, 'charmed', false, true],
    ['condition-named advantage yields to RB', { saveAdvantage: ['charmed'], saveAdvantageCount: 0 }, 'charmed', true, false],
    ['ability-list advantage survives without RB (case-fold :877)', { saveAdvantageAbilities: ['CON'], saveAdvantageCount: 0 }, 'con', false, true],
    ['ability-list advantage yields to RB', { saveAdvantageAbilities: ['CON'], saveAdvantageCount: 0 }, 'con', true, false],
  ])('%s', (_name, effects, saveType, restoreBalance, expected) => {
    expect(hasSaveAdvantage(effects, saveType, restoreBalance)).toBe(expected);
  });
});
