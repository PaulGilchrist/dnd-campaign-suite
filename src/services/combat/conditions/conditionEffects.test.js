// @maintained-by-ai
// Base-canon lane for the conditionEffects engine (conditionEffects.js).
// Owned HERE: CONDITIONS_THAT_* data sets, the per-condition handler census
// (CONDITION_EFFECT_HANDLERS), the EARLY/LATE + generic-channel dispatch of
// applyTargetEffect over the registry (imported, never hand-typed — #820),
// the generic combineAttackModes net-mode matrix (#964 net-mode consumer
// :854-856, incl. the CLA-053 attacker-side channel :856), and the
// hasSaveModifier / hasSaveAdvantage / hasBeaconOfHope readers.
//
// Family map (who owns what elsewhere — faces verified absent here):
//   per-te / per-modifier fold canon  → conditionEffectsCompute.test.js
//   restoreBalance net-mode (getNet + combine) → restoreBalance.test.js
//   attacksOtherDisadvantageSource gating → conditionEffectsCombine.test.js
//   foresight/bolster family: #996 LATE fold — the assign-vs-addUnique
//     reason-clobber asymmetry (foresight :483 vs bolster :501) is FIXED
//     (foresight now addUniqueReason) and pinned HERE (this lane); per-effect
//     folds live in compute + bolster file.
//   clairvoyant_combatant → conditionEffects.clairvoyant.test.js (roles) +
//     compute :263 (counts) — #997 rec: its leg in the old crusher/clairvoyant
//     bundle exactly duplicated compute, so the clairvoyant leg is CUT here;
//     the crusher leg stays.
//   animal-spirit #995 · bolster #996 · clairvoyant #997 → dedicated files
//   internal saveModifierApplies gate/predicate matrix → conditionEffectsInternal.test.js
//   registerTargetEffect write bytes (:1497) → targetEffectDefinitions.test.js
//   (not present in this module — nothing pinned here).
//
// old → new map (old :46-433 compute block):
//   5 incapacitating + 6 mobility/disadvantage + invisible + slow one-offs
//     → condition census it.each (exact changed-fields diff vs defaults =
//        zero-leak falsifier; SP-111 "generic Poisoned never blocks" is the
//        poisoned row's exact empty-of-cannotAct diff, cited inline)
//   'combines effects from multiple conditions' → census multi-condition row
//   'default values when called with no arguments' → census row 1
//   saveModifiers block (adv/dis counts, ability tracking, attack_roll,
//     fiend_undead, replacement, specialEffects ×15, reroll, lucky_point,
//     wis_replacement, modify_d20_roll, pass_without_trace)
//     → folded to a 3-row census of faces NOT pinned in compute (fix#363 #1000:
//       plain-count rows + dup fiend_undead fixture + dodge fold cut with cites);
//       every other row duplicated conditionEffectsCompute.test.js :39-659 or
//       conditionEffectsInternal.test.js (dropped, not weakened)
//   targetEffects blocks → registry dispatch census (#820) + 2 dispatch-order
//     tests (early-before-generic crusher row with both generic channels
//     :675/:679; late-over-generic topple row) + foresight/bolster ledger
//     pin (#996); per-effect byte folds live in compute (dropped here)
//   getNetAttackMode 4 tests → 1 it.each (restoreBalance legs dropped:
//     owned by restoreBalance.test.js :155)
//   combineAttackModes 7 tests → 1 it.each (restoreBalance legs dropped:
//     restoreBalance.test.js; attacksOther legs dropped: combine file)
//   hasSaveModifier 3 → 1 it.each; hasSaveAdvantage 5 → 2; hasBeaconOfHope
//     6 → 2 (nullish guard asserts store untouched; faithful-store call
//     bytes pinned per row — #934).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
  hasSaveModifier,
  hasSaveAdvantage,
  hasBeaconOfHope,
} from './conditionEffects.js';
import { TARGET_EFFECT_DEFINITIONS } from './targetEffectDefinitions.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

// Engine default byte-shape — the census baseline. Any field a fixture moves
// beyond these defaults shows up in folded(); expecting {} proves inertness.
const DEFAULTS = computeConditionEffects();
const folded = (options) => {
  const result = computeConditionEffects(options);
  return Object.fromEntries(
    Object.entries(result).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])),
  );
};

describe('conditionEffects', () => {
  describe('CONDITIONS_THAT_CANNOT_ACT', () => {
    it('contains exactly the expected incapacitating conditions', () => {
      const expected = new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']);
      expect(CONDITIONS_THAT_CANNOT_ACT).toEqual(expected);
    });
  });

  describe('CONDITIONS_THAT_SPEED_ZERO', () => {
    it('contains exactly the expected speed-zero conditions', () => {
      const expected = new Set(['grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero', 'forcecaged', 'mazed']);
      expect(CONDITIONS_THAT_SPEED_ZERO).toEqual(expected);
    });
  });

  describe('computeConditionEffects — condition handler census (exact diff vs defaults)', () => {
    it.each([
      ['no arguments at all', undefined, {}],
      ['blinded', { conditions: ['blinded'] }, { attackDisadvantageCount: 1, targetAdvantageCount: 1, targetAdvantageReasons: ['Blinded'] }],
      ['charmed', { conditions: ['charmed'] }, { attackDisadvantageCount: 1, saveDisadvantage: ['dex'] }],
      ['frightened', { conditions: ['frightened'] }, { attackDisadvantageCount: 1, abilityCheckDisadvantage: true }],
      ['grappled', { conditions: ['grappled'] }, { speedZero: true, attackDisadvantageCount: 1 }],
      ['incapacitated', { conditions: ['incapacitated'] }, { cannotAct: true, concentrationBroken: true }],
      // SP-111: generic Poisoned must NOT set cannotAct (per-source block is
      // sheet-level) — the exact diff below pins cannotAct untouched.
      ['poisoned', { conditions: ['poisoned'] }, { attackDisadvantageCount: 1, abilityCheckDisadvantage: true }],
      ['prone', { conditions: ['prone'] }, { attackDisadvantageCount: 1, targetAdvantageIfWithin5ft: true, targetDisadvantageIfBeyond5ft: true }],
      ['speed_zero', { conditions: ['speed_zero'] }, { speedZero: true }],
      ['restrained', { conditions: ['restrained'] }, { speedZero: true, attackDisadvantageCount: 1, targetAdvantageCount: 1, targetAdvantageReasons: ['Restrained'], saveDisadvantage: ['dex'] }],
      ['paralyzed', { conditions: ['paralyzed'] }, { cannotAct: true, speedZero: true, autoFailSaves: ['str', 'dex'], targetAdvantageCount: 1, targetAdvantageReasons: ['Paralyzed'], autoCritWithin5ft: true }],
      ['petrified', { conditions: ['petrified'] }, { cannotAct: true, speedZero: true, autoFailSaves: ['str', 'dex'], targetAdvantageCount: 1, targetAdvantageReasons: ['Petrified'], resistantToAll: true, poisonImmune: true }],
      ['stunned', { conditions: ['stunned'] }, { cannotAct: true, speedZero: true, autoFailSaves: ['str', 'dex'], targetAdvantageCount: 1, targetAdvantageReasons: ['Stunned'] }],
      ['unconscious', { conditions: ['unconscious'] }, { cannotAct: true, speedZero: true, autoFailSaves: ['str', 'dex'], targetAdvantageCount: 1, targetAdvantageReasons: ['Unconscious'], autoCritWithin5ft: true }],
      ['dazed', { conditions: ['dazed'] }, { dazed: true, targetAdvantageCount: 1, targetAdvantageReasons: ['Dazed'] }],
      ['slow', { conditions: ['slow'] }, { speedHalved: true, acPenalty: 2, slowNoReactions: true, slowActionLimit: true, slowSingleAttackLimit: true, slowSomaticFailure: true, saveDisadvantage: ['dex'] }],
      ['forcecaged', { conditions: ['forcecaged'] }, { speedZero: true, cannotAct: true, concentrationBroken: true }],
      ['mazed', { conditions: ['mazed'] }, { speedZero: true, cannotAct: true, concentrationBroken: true }],
      // invisible folds advantage only while nothing reveals the holder
      ['invisible', { conditions: ['invisible'] }, { attackAdvantageCount: 1, attackAdvantageReasons: ['Invisible'], targetDisadvantageCount: 1 }],
      ['invisible + seeInvisibility (suppressed)', { conditions: ['invisible'], seeInvisibilityActive: true }, {}],
      // multi-condition accumulation folds additively in one pass
      ['blinded + paralyzed', { conditions: ['blinded', 'paralyzed'] }, { attackDisadvantageCount: 1, cannotAct: true, speedZero: true, autoFailSaves: ['str', 'dex'], targetAdvantageCount: 2, targetAdvantageReasons: ['Blinded', 'Paralyzed'], autoCritWithin5ft: true }],
      ['unknown condition is inert', { conditions: ['not_a_condition'] }, {}],
    ])('%s', (_name, options, expected) => {
      expect(folded(options)).toEqual(expected);
    });
  });

  describe('computeConditionEffects — saveModifiers channels not pinned in compute', () => {
    // fix#363 #1000 trims: 'plain save advantage/disadvantage bumps count' rows cut
    // byte-identical to compute census :69/:70 (same folded() idiom, same expectations);
    // second byte-identical fiend_undead fixture cut (same input bytes, same expected).
    it.each([
      ['ability-tagged advantage without abilityName tracks abilities, not count', [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR', 'DEX'] }], { saveAdvantageAbilities: ['STR', 'DEX'] }],
      ['attack_roll (singular gate target) folds attack advantage', [{ target: 'attack_roll', effect: 'advantage' }], { attackAdvantageCount: 1 }],
      // 'fiend_undead' is not in SAVE_CONDITION_LABELS — ungated by construction:
      // the plain advantage fold lands regardless of the condition being active.
      ['unmapped condition fiend_undead never gates — plain advantage folds', [{ target: 'saving_throw', effect: 'advantage', condition: 'fiend_undead' }], { saveAdvantageCount: 1 }],
    ])('%s', (_name, saveModifiers, expected) => {
      expect(folded({ saveModifiers })).toEqual(expected);
    });
  });

  describe('applyTargetEffect dispatch', () => {
    // #820: iterate the REAL registry — every GM-addable te key must pass
    // through early → generic → late dispatch and return the engine shape.
    it.each(TARGET_EFFECT_DEFINITIONS.map(d => d.effect))('registry te %s dispatches without throwing', (effect) => {
      const result = computeConditionEffects({ targetEffects: [{ effect }] });
      expect(typeof result.attackAdvantageCount).toBe('number');
      expect(typeof result.saveAdvantageCount).toBe('number');
    });

    it('unregistered unknown te keys stay inert (no byte moves)', () => {
      expect(folded({ targetEffects: [{ effect: 'unknown_effect' }] })).toEqual({});
      expect(folded({ targetEffects: [{ effect: 'speed_zero' }] })).toEqual({});
    });

    it('EARLY handler + both generic channels fold in one te (crusher leg stays, :675/:679)', () => {
      // Crusher kept per #997 rec; its former clairvoyant bundle-mate is
      // owned by compute :263 + .clairvoyant.test.js (exact duplicate cut).
      expect(folded({ targetEffects: [{
        effect: 'crusher_enhanced_critical',
        source: 'Crusher 1',
        noOpportunityAttacks: true,
        saveType: 'DEX',
        condition: 'stunned',
        saveDc: 15,
      }] })).toEqual({
        targetAdvantageCount: 1,
        targetAdvantageReasons: ['Crusher 1'],
        riderCannotOpportunityAttack: true,
        saveType: 'DEX',
        saveDc: 15,
        conditionToApply: 'stunned',
        conditionDuration: 'until_start_of_next_turn',
      });
    });

    it('LATE handler overwrites the generic save branch (topple beats its own condition)', () => {
      // te.saveType+te.condition trips generic :679 first; LATE topple then
      // rewrites saveAbility and wins the conditionToApply byte.
      expect(folded({ targetEffects: [{
        effect: 'topple', saveType: 'STR', saveDc: 13, condition: 'restrained',
      }] })).toEqual({
        toppleEffect: true,
        saveType: 'STR',
        saveDc: 13,
        saveAbility: 'CON',
        conditionToApply: 'prone',
        conditionDuration: 'until_start_of_next_turn',
      });
    });

    // fix#363 #1000: dodge fold test cut — exact bytes (targetDisadvantageCount:1 +
    // saveAdvantage:['dex'], same bare-{effect} input) pinned by the compute registry
    // census OVERRIDE dodge row :136. Consumer net-mode row stays at :259 below.

    it('#996 foresight APPENDS abilityCheckAdvantageReasons via addUniqueReason — co-existing bolster reason survives', () => {
      // FIXED (was a wholesale assign clobbering the ledger): foresight :483 now
      // mirrors bolster :501 — addUniqueReason append-if-absent on all three
      // reason legs. The reasons list is the canonical display/journal of WHY
      // advantage applies (ConditionEffectBadges.jsx :99-103 joins all entries).
      const bolster = { effect: 'bolster_advantage', source: 'Empyrean 1' };
      const foresight = { effect: 'foresight' };
      expect(folded({ targetEffects: [bolster, foresight] })).toEqual({
        attackAdvantageCount: 2,
        attackAdvantageReasons: ['Empyrean 1', 'Foresight'],
        saveAdvantageCount: 2,
        saveAdvantageReasons: ['Empyrean 1', 'Foresight'],
        abilityCheckAdvantage: true,
        abilityCheckAdvantageReasons: ['Empyrean 1', 'Foresight'], // BOTH survive
        targetDisadvantageCount: 1,
      });
      // Reverse order: foresight appends first, bolster's addUnique appends after.
      expect(folded({ targetEffects: [foresight, bolster] }).abilityCheckAdvantageReasons).toEqual(['Foresight', 'Empyrean 1']);
      // #1348 arms: empty-base foresight lands its reason exactly once...
      expect(folded({ targetEffects: [foresight] }).abilityCheckAdvantageReasons).toEqual(['Foresight']);
      // ...dup foresight te lands no duplicate reason but still bumps counts.
      expect(folded({ targetEffects: [foresight, foresight] })).toMatchObject({
        attackAdvantageCount: 2,
        attackAdvantageReasons: ['Foresight'],
        saveAdvantageCount: 2,
        saveAdvantageReasons: ['Foresight'],
        abilityCheckAdvantageReasons: ['Foresight'],
      });
    });
  });

  describe('getNetAttackMode — base net math (restoreBalance owned by restoreBalance.test.js)', () => {
    it.each([
      [3, 1, 'advantage'],
      [1, 3, 'disadvantage'],
      [2, 2, 'normal'],
      [0, 0, 'normal'],
      [1, 0, 'advantage'],
      [0, 1, 'disadvantage'],
    ])('%i adv vs %i dis → %s', (adv, dis, expected) => {
      expect(getNetAttackMode(adv, dis, false)).toBe(expected);
    });
  });

  describe('combineAttackModes — net-mode consumer matrix (#964 :854-856; RB and attacksOther legs owned by their files)', () => {
    const ATT = (o = {}) => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0, ...o });
    const TGT = (o = {}) => ({ targetAdvantageCount: 0, targetDisadvantageCount: 0, ...o });
    it.each([
      ['attacker + target advantage stacks', ATT({ attackAdvantageCount: 2 }), TGT({ targetAdvantageCount: 1 }), 10, null, 'advantage'],
      ['attacker + target disadvantage stacks', ATT({ attackDisadvantageCount: 2 }), TGT({ targetDisadvantageCount: 1 }), 10, null, 'disadvantage'],
      ['one advantage cancels one disadvantage', ATT({ attackAdvantageCount: 1 }), TGT({ targetDisadvantageCount: 1 }), 10, null, 'normal'],
      ['vex target named → advantage', ATT({ vexAdvantageTargets: ['Goblin'] }), TGT(), 5, 'Goblin', 'advantage'],
      ['vex target not named → normal', ATT({ vexAdvantageTargets: ['Goblin'] }), TGT(), 5, 'Orc', 'normal'],
      ['vex targets null → normal', ATT({ vexAdvantageTargets: null }), TGT(), 5, 'Goblin', 'normal'],
      ['prone within 5ft → advantage', ATT(), TGT({ targetAdvantageIfWithin5ft: true }), 5, null, 'advantage'],
      ['prone flag idle beyond 5ft → normal', ATT(), TGT({ targetAdvantageIfWithin5ft: true }), 10, null, 'normal'],
      ['prone beyond 5ft → disadvantage', ATT(), TGT({ targetDisadvantageIfBeyond5ft: true }), 10, null, 'disadvantage'],
      ['prone flag idle within 5ft → normal', ATT(), TGT({ targetDisadvantageIfBeyond5ft: true }), 5, null, 'normal'],
      ['noAdvantageAgainst zeroes stacked attacker advantage', ATT({ attackAdvantageCount: 3 }), TGT({ noAdvantageAgainst: true }), 10, null, 'normal'],
      ['attacker-side targetAttackDisadvantageCount channel (CLA-053/slasher :856)', ATT({ targetAttackDisadvantageCount: 1 }), TGT(), 10, null, 'disadvantage'],
      ['dodge target disadvantage', ATT(), TGT({ targetDisadvantageCount: 1 }), 10, null, 'disadvantage'],
    ])('%s', (_name, attacker, target, range, targetName, expected) => {
      expect(combineAttackModes(attacker, target, range, targetName)).toBe(expected);
    });
  });

  describe('hasSaveModifier', () => {
    it.each([
      ['empty modifiers', [], 'saving_throw', 'STR', false],
      ['null modifiers', null, 'saving_throw', 'STR', false],
      ['target mismatch', [{ target: 'attack_roll', effect: 'advantage' }], 'saving_throw', 'STR', false],
      ['disadvantage never matches', [{ target: 'saving_throw', effect: 'disadvantage' }], 'saving_throw', 'STR', false],
      ['plain advantage matches any ability', [{ target: 'saving_throw', effect: 'advantage' }], 'saving_throw', 'STR', true],
      ['ability-tagged match', [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }], 'saving_throw', 'STR', true],
      ['ability-tagged miss', [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }], 'saving_throw', 'DEX', false],
      ['ability-tagged, no ability asked', [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }], 'saving_throw', null, false],
    ])('%s', (_name, modifiers, target, ability, expected) => {
      expect(hasSaveModifier(modifiers, target, ability)).toBe(expected);
    });
  });

  describe('hasSaveAdvantage', () => {
    const PLAIN_ADV = computeConditionEffects({ saveModifiers: [{ target: 'saving_throw', effect: 'advantage' }] });
    const DOUBLE_ADV = computeConditionEffects({ saveModifiers: [
      { target: 'saving_throw', effect: 'advantage' },
      { target: 'saving_throw', effect: 'advantage' },
    ] });
    const CIRCLE = computeConditionEffects({ targetEffects: [{ effect: 'circle_of_power' }] });

    it('returns false for null/undefined effects or a default (advantage-free) fold', () => {
      expect(hasSaveAdvantage(null, 'STR', false)).toBe(false);
      expect(hasSaveAdvantage(undefined, 'STR', false)).toBe(false);
      expect(hasSaveAdvantage(computeConditionEffects(), 'STR', false)).toBe(false);
    });

    it.each([
      ['plain advantage count', PLAIN_ADV, 'STR', false, true],
      ['named save in saveAdvantage', { saveAdvantage: ['dex'], saveAdvantageCount: 0 }, 'dex', false, true],
      ['other save not in saveAdvantage', { saveAdvantage: ['dex'], saveAdvantageCount: 0 }, 'str', false, false],
      ['ability-list hit', { saveAdvantage: [], saveAdvantageCount: 0, saveAdvantageAbilities: ['STR'] }, 'STR', false, true],
      ['ability-list miss', { saveAdvantage: [], saveAdvantageCount: 0, saveAdvantageAbilities: ['STR'] }, 'DEX', false, false],
      ['against_spell (circle_of_power producer) matches con', CIRCLE, 'con', false, true],
      ['against_spell matches dex too', CIRCLE, 'dex', false, true],
      ['against_spell yields to restoreBalance', CIRCLE, 'con', true, false],
      ['single advantage neutralized by restoreBalance', PLAIN_ADV, 'STR', true, false],
      ['double advantage survives restoreBalance', DOUBLE_ADV, 'STR', true, true],
    ])('%s → %s', (_name, effects, saveType, restoreBalance, expected) => {
      expect(hasSaveAdvantage(effects, saveType, restoreBalance)).toBe(expected);
    });
  });

  describe('hasBeaconOfHope', () => {
    beforeEach(() => vi.mocked(getRuntimeValue).mockReset());

    it('returns false for nullish target without touching the store', () => {
      expect(hasBeaconOfHope(null, 'test-campaign')).toBe(false);
      expect(hasBeaconOfHope(undefined, 'test-campaign')).toBe(false);
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
      ['empty store', [], false],
      ['null store', null, false],
      ['beacon on another target', [{ effect: 'beacon_of_hope', target: 'OtherPlayer' }], false],
      ['beacon on Player among unrelated te', [
        { effect: 'beacon_of_hope', target: 'Player' },
        { effect: 'advantage_attacks', target: 'Enemy' },
      ], true],
    ])('reads campaign targetEffects — %s', (_name, store, expected) => {
      vi.mocked(getRuntimeValue).mockReturnValue(store);
      expect(hasBeaconOfHope('Player', 'test-campaign')).toBe(expected);
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', 'test-campaign');
    });
  });
});
