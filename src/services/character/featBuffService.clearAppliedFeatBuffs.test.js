// featBuffService.clearAppliedFeatBuffs.test.js — LANE #2/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject: src/services/character/featBuffService.js (662 l).
// Canonical seam map lives in the lane #1 header (featBuffService.applyFeatBuffsToFormData.test.js) — READ FIRST.
//
// THIS LANE CONTRACT (#2017, pinned below):
//   - Form-data RESET: clearAppliedFeatBuffs → resetFeatIncreases sets featIncrease=0
//     on every ability in formData.abilities, mutating in place. The SOLE undo-seam for
//     lane #2016's additive writes (apply twice doubles featIncrease; this zeroes it).
//   - UNDO-SEAM DISCRIMINATION (pinned): clear touches ONLY abilities[].featIncrease.
//     formData.resistances survives untouched — apply merge-appends resistances via
//     mergeDeduplicated and clear never reverses that; sibling ability fields
//     (e.g. baseScore) are preserved through the in-place mutation.
//   - Tolerance (kept exact): missing/empty abilities array does not throw
//     (resetFeatIncreases early-returns on !abilities, featBuffService.js:654).
//
// LIVENESS FLAG (shared with #2016; re-verified by repo-wide grep, 2026-10-16):
// clearAppliedFeatBuffs has ZERO production callers — occurrences are the export itself
// (featBuffService.js:660), this test file, and comments in the apply-lane header. The
// live wizard reset lane is useWizardFeatAbilityChoices.js:113's own inline
// `abilities.forEach(a => { a.featIncrease = 0; })`. This lane is CONTRACT-PRESERVATION-
// MINIMAL: tests stay minimal-sized but exact so a revived caller inherits pinned
// semantics. Deletion of the export is a production decision — flagged to parent, FINAL REPORT.
//
// Anti-pattern hygiene: exact assertions only (no toBeDefined), no fabricated shapes
// (ability keys mirror the apply lane's makeFormData), no timers, no vacuous loops.

import { describe, it, expect } from 'vitest';

import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  it('resets featIncrease to 0 on every ability', () => {
    const formData = {
      abilities: [
        { name: 'Strength', featIncrease: 5 },
        { name: 'Dexterity', featIncrease: -2 },
        { name: 'Constitution', featIncrease: 3 },
      ],
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.abilities.every(a => a.featIncrease === 0)).toBe(true);
  });

  it('does not throw when abilities is missing or empty', () => {
    expect(() => clearAppliedFeatBuffs({})).not.toThrow();
    expect(() => clearAppliedFeatBuffs({ abilities: [] })).not.toThrow();
  });

  it('resets only featIncrease — leaves resistances and sibling ability fields untouched', () => {
    // Undo-seam discrimination vs lane #2016: apply merge-appends resistances onto
    // formData; clear never reverses that — it zeroes featIncrease and nothing else.
    const formData = {
      abilities: [
        { name: 'Strength', baseScore: 16, featIncrease: 2 },
        { name: 'Dexterity', baseScore: 14, featIncrease: 1 },
      ],
      resistances: ['cold', 'fire'],
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.abilities[0]).toEqual({ name: 'Strength', baseScore: 16, featIncrease: 0 });
    expect(formData.abilities[1]).toEqual({ name: 'Dexterity', baseScore: 14, featIncrease: 0 });
    expect(formData.resistances).toEqual(['cold', 'fire']);
  });
});
