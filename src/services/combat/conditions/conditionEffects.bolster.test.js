// @maintained-by-ai
// MA-0694 lane: Empyrean Bolster te consumer fold — te `bolster_advantage`
// ("Advantage on D20 Tests") folded by the LATE handler in conditionEffects.js
// (:495): per-te bumpCount on attackAdvantageCount + saveAdvantageCount and
// abilityCheckAdvantage=true, reason bytes via addUniqueReason(te.source).
// Fixture is the exact producer shape: registerTargetEffect writes
// { target, effect, source, duration:'rounds', rounds, actionName } (monsterSelfBuff.js
// armBolsterLegs :214-223 → targetEffectDefinitions.js registerTargetEffect :1497).
// This lane is the PURE fold only — the compute is side-effect-free, so te-store
// writes and campaign log bytes are owned by the producer lane
// (monsterSelfBuff.bolster.test.js — exact teKeys + log types pinned there).
//
// Family map: generic vex/channel folds + combineAttackModes faces are owned by
// conditionEffects.test.js / conditionEffectsCompute.test.js / conditionEffectsCombine.test.js
// (#964 net-mode canon — no generic faces here); clairvoyant_combatant defender-leg
// sibling is conditionEffects.clairvoyant.test.js (distinct te key, no overlap — verified).
//
// old → new map:
//   'folds Advantage on attacks + saves...' (GTE/contains) → test 1 (exact counts + reason bytes)
//   'combineAttackModes returns advantage...' → test 2 (kept, honest title)
//   'does NOT grant creatures attacking the holder...' → test 3 (holder-bucket zeros folded into test 1)
//   'rows without the te stay inert' → test 4 (real decoy key + dispatch proof)
import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

// Exact shape registerTargetEffect stores for the Bolster ally/self stamp.
const BOLSTER_TE = {
  effect: 'bolster_advantage',
  target: 'Bandit 1',
  source: 'Empyrean 1',
  duration: 'rounds',
  rounds: 2,
  actionName: 'Bolster',
};

describe('MA-0694 bolster_advantage te consumer fold', () => {
  it('armed holder: folds exactly +1 advantage on attacks, saves and ability checks with the source as the only reason, and touches no other bucket', () => {
    const effects = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    expect(effects.attackAdvantageCount).toBe(1);
    expect(effects.attackAdvantageReasons).toEqual(['Empyrean 1']);
    expect(effects.saveAdvantageCount).toBe(1);
    expect(effects.saveAdvantageReasons).toEqual(['Empyrean 1']);
    expect(effects.abilityCheckAdvantage).toBe(true);
    expect(effects.abilityCheckAdvantageReasons).toEqual(['Empyrean 1']);
    // No leaks into opposing/other channels (incl. the foresight defender leg).
    expect(effects.targetDisadvantageCount).toBe(0);
    expect(effects.targetAdvantageCount).toBe(0);
    expect(effects.attackDisadvantageCount).toBe(0);
    expect(effects.saveDisadvantageCount).toBe(0);
    expect(effects.abilityCheckDisadvantage).toBe(false);
  });

  it('holder attacking with the te folded resolves combineAttackModes to advantage', () => {
    const holderEffects = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    const cleanDefender = computeConditionEffects({});
    expect(combineAttackModes(holderEffects, cleanDefender, 5, 'AasimarTest')).toBe('advantage');
  });

  // Distinct from foresight: the bolster te carries NO defender-disadvantage leg,
  // so attackers striking the holder roll normal (foresight would force disadvantage).
  it('attackers striking the bolstered holder gain nothing — combine stays normal', () => {
    const holderAsDefender = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    const cleanAttacker = computeConditionEffects({});
    expect(combineAttackModes(cleanAttacker, holderAsDefender, 5, 'Bandit 1')).toBe('normal');
  });

  it('decoy te dispatches its own handler but leaves every bolster channel at base', () => {
    const effects = computeConditionEffects({
      targetEffects: [{ effect: 'speed_reduction', target: 'Bandit 1', source: 'Empyrean 1', value: 10 }],
    });
    // Dispatch proof: the decoy row is live, not an inert/unknown key.
    expect(effects.speedReduction).toBe(10);
    expect(effects.attackAdvantageCount).toBe(0);
    expect(effects.attackAdvantageReasons).toEqual([]);
    expect(effects.saveAdvantageCount).toBe(0);
    expect(effects.saveAdvantageReasons).toEqual([]);
    expect(effects.abilityCheckAdvantage).toBe(false);
    expect(effects.abilityCheckAdvantageReasons).toEqual([]);
  });
});
