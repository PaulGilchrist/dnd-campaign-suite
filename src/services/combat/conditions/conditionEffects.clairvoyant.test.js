// @maintained-by-ai
// CLA-053 lane: conditionEffects ENGINE consumer of the `clairvoyant_combatant`
// te key — LATE handler (conditionEffects.js:467, LATE_TARGET_EFFECT_HANDLERS
// opened :428) plus the combineAttackModes consumer (:854). This is NOT the
// automationModifiers.js SAVE-modifier builder (#964 census lane — different
// module face, automationModifiers.js:155, #941 module-split precedent).
// Producer: ClairvoyantCombatantModal.jsx:49-58 stamps the exact te bytes
// below onto the campaign targetEffects; te rides the BONDED creature's
// bucket (target = chosen creature). saveType/saveDc are consumed by the
// producer's save-prompt lane only — with no `te.condition` the generic
// applyTargetEffect:679 branch must leave the engine fold's save buckets null.
//
// Family map: exact fold-count canon for this te lives in
// conditionEffectsCompute.test.js:263 (counts 1/1/0); generic channel folds
// and combineAttackModes net-mode faces are owned by conditionEffects.test.js
// / conditionEffectsCombine.test.js (#964 net-mode canon — no generic faces
// here); registry golden-once is targetEffectDefinitions.test.js:199 (#820);
// bolster_advantage sibling is conditionEffects.bolster.test.js (#996).
// This file's distinct lane: the two ROLE-RESOLVED combine outcomes —
// which side of an attack matchup the advantage/disadvantage lands on.
//
// old → new map:
//   'holder attacks bonded → Advantage via targetAdvantageCount' (GTE + toContain)
//     → test 1 (exact reason bytes, combine 'advantage' as regression falsifier
//        for the old defender-bucket fold, save-bucket zero-leak)
//   'bonded attacks holder → Disadvantage...' → test 2 (kept, honest title)
//   'old defender-bucket fold is gone...' → REMOVED — targetDisadvantageCount
//     === 0 is already exact-pinned at conditionEffectsCompute.test.js:271 and
//     conditionEffects.test.js:337; its behavioral consequence is falsified
//     here by test 1 (a resurrected old fold would downgrade to 'normal').
import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

// Verbatim producer stamp (ClairvoyantCombatantModal.jsx:49-58).
const TE = {
    target: 'Bandit 1',
    source: 'Clairvoyant Combatant',
    effect: 'clairvoyant_combatant',
    duration: '1_minute',
    saveType: 'WIS',
    saveDc: 15,
    attackerAdvantage: true,
    defenderDisadvantage: true,
};

describe('CLA-053 clairvoyant_combatant — combine consumer roles', () => {
    const empty = computeConditionEffects({});

    it('holder attacks bonded: advantage with exact reason, save buckets untouched', () => {
        const bonded = computeConditionEffects({ targetEffects: [TE] });
        expect(bonded.targetAdvantageReasons).toEqual(['Clairvoyant Combatant']);
        // Regression falsifier for the pre-fix defender-bucket fold: had it
        // bumped targetDisadvantageCount here, the net mode would be 'normal'.
        expect(combineAttackModes(empty, bonded, null)).toBe('advantage');
        expect(bonded.saveType).toBeNull();
        expect(bonded.conditionToApply).toBeNull();
    });

    it('bonded attacks holder: bonded bucket feeds the attacker-side channel → disadvantage', () => {
        const bonded = computeConditionEffects({ targetEffects: [TE] });
        expect(combineAttackModes(bonded, empty, null)).toBe('disadvantage');
    });
});
