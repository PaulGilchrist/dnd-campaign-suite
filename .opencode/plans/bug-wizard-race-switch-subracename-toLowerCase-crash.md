# Bug: switching race mid-wizard (Human → Dwarf) throws `subraceName.toLowerCase is not a function` in the 5e limits collector

## Summary

Discovered incidentally during the 2026-11-24 improve run `wizard-tools-empty-choose-sentence`
(while re-walking the create wizard on `test-campaign`). Switching the race from Human to
Dwarf mid-wizard on a 5e build throws TWO console errors:

    TypeError: subraceName.toLowerCase is not a function

thrown at `src/services/character/resistancesValidation.js:37`
(`extract5eRaceResistances` ← `collectLimits5e` ← `useWizardConfig`). The crash is a latent
pre-existing defect in the race-switch lane, unrelated to the tools-step render guard that was
landed in the same session. No fix was attempted by the improve run; file is opened per the
ownership law (every confirmed defect carries an open tracker).

## Steps to reproduce

1. On `test-campaign` (localhost, :5173), open the create wizard (sidebar `Add Character`).
2. Pick 5e + Quick build, set a name, advance to the Race step, select Human, continue.
3. Jump/edit back to the Race step and switch the race Human → Dwarf (a race with subraces).
4. Watch the console: 2× `TypeError: subraceName.toLowerCase is not a function` at
   `resistancesValidation.js:37`.

## Expected behavior

The 5e race-switch re-derivation (resistances, limits collection) completes without console
errors for any race in `races.json`, including subrace-bearing races.

## Observed behavior

`extract5eRaceResistances` calls `.toLowerCase()` on a `subraceName` value that is not a
string at this seam (likely `undefined`/object when the switch sets the race before the
subrace selection settles). Errors repeat per limits recomputation.

## Notes for the fixer

- The improve-run observation is console-level; whether the face visibly mis-renders after
  the throw (or React swallows it) was NOT probed — verify both.
- Check the sibling 2024 lane for the same `.toLowerCase` un-guarded read.

## Status

OPEN — filed 2026-11-24 by the e2e-improve run (observer report from implementer session
`ses_defffb685ffeGd7JTQbEkh921b`).
