// @maintained-by-ai: 2026-10-18
// MA-0751: Fomorian Warping Hex — "The target gains 1 Exhaustion level."
// exhaustion is LEVEL-based (stackable to 6) and OUTSIDE the canonical
// CONDITIONS word list (MonsterCardHelpers.js:56), so extractConditionsFromSaveEffect
// can never grant it — zero grant on a failed save (§239 fingerprint).
// parseExhaustionLevelClause (MonsterCardHelpers.js:185) owns this lane; its
// distinct branches: non-string guard (:186), recurring burn-tick guard (:187),
// `gains N exhaustion level(s)` regex with >=1 clamp (:188-189). The Salamander
// Inferno Master twin ("...whenever it takes this burning damage" — §87 recurring
// tick on a picker-route row) is excluded explicitly so the one-shot save-fail
// grant never over-grants. The parsed level rides buildAbilitySaveRollContext
// (MonsterCardModal.jsx:1893, the ONLY production call site; MA-0711 slowedClauses
// inline seam shape) to saveProcessing's canonical exhaustionLevel grant — the
// grant itself is covered live in saveProcessing.exhaustion.test.js (consumer
// echo, cite-skip here). Fixtures are looked up BY NAME from disk; the former
// monsters.json field data-lock block was cut as half-vacuous transcription
// (#387/#499). Fiction prose below (#498): only the level-1 byte exists on
// disk — plural, lowercase, trailing-prose, zero-clamp and word-order-inverted
// probes are synthetic inputs pinning the regex branches.
import { describe, it, expect } from 'vitest';
import { parseExhaustionLevelClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const fomorianRow = monstersData.find(m => m.index === 'fomorian').actions.find(a => a.name === 'Warping Hex');
const salamanderRow = monstersData.find(m => m.index === 'salamander-inferno-master').actions.find(a => a.name === 'Inferno Blast');

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

describe('MA-0751 parseExhaustionLevelClause', () => {
  it('arms level 1 on the Fomorian byte while CONDITIONS extraction stays blind (§239 fingerprint)', () => {
    expect(extractConditionsFromSaveEffect(fomorianRow.save_effect)).toEqual([]);
    expect(parseExhaustionLevelClause(fomorianRow.save_effect)).toEqual({ effect: 'exhaustion', level: 1 });
  });

  it('truth table: plural/case/trailing-prose arm, N>=1 clamp, clauseless and inverted-order prose inert', () => {
    expect(parseExhaustionLevelClause('The target gains 2 exhaustion levels.')).toEqual({ effect: 'exhaustion', level: 2 });
    expect(parseExhaustionLevelClause('the target gains 1 Exhaustion level until the next dawn')).toEqual({ effect: 'exhaustion', level: 1 });
    expect(parseExhaustionLevelClause('The target gains 0 exhaustion levels.')).toEqual({ effect: 'exhaustion', level: 1 });
    expect(parseExhaustionLevelClause('The target is Poisoned.')).toBeNull();
    expect(parseExhaustionLevelClause('gains 1 level of exhaustion immunity')).toBeNull();
    expect(parseExhaustionLevelClause(null)).toBeNull();
    expect(parseExhaustionLevelClause(42)).toBeNull();
  });

  it('Salamander Inferno Master recurring burn-tick twin stays inert (guard fires, not missing clause)', () => {
    expect(salamanderRow.save_effect).toMatch(/gains 1 Exhaustion level whenever it takes this burning damage/i);
    expect(parseExhaustionLevelClause(salamanderRow.save_effect)).toBeNull();
  });
});

describe('MA-0751 buildAbilitySaveRollContext threading', () => {
  it('rides exhaustionLevel {level:1} onto the Fomorian inline save context (single call site)', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Fomorian 1',
      target: { name: 'Bandit 1', type: 'npc' },
      spellName: null,
      action: fomorianRow,
      saveType: 'Wisdom',
      dcSuccess: 'half',
      saveDamageFormula: fomorianRow.damage_dice_primary,
      saveConditions: extractConditionsFromSaveEffect(fomorianRow.save_effect),
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.exhaustionLevel).toEqual({ effect: 'exhaustion', level: 1 });
  });
});
