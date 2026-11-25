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

## Live re-verification (explore run AZ, 2026-11-24, HEAD 2ebac3989) — CONFIRMED, visible-face question ANSWERED

- Reproduced exactly per the steps above on :5173 (dev pair, `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`):
  create-wizard → 5e quick → name → Race = Human → Next → nav back to Race → switch to Dwarf →
  **2×** `TypeError: subraceName.toLowerCase is not a function` at `resistancesValidation.js:37`
  (`extract5eRaceResistances` ← `collectLimits5e` ← `getResistanceLimits` ← `getPreSelectedResistances`
  ← `useWizardConfig.js:31/:62`), logged as `Pre-select error:` + `Wizard config validation error:`.
- **The burst is one-per-switch, not per-recompute**: the count stayed at exactly 2 across the entire
  remaining walk (Subrace=Hill Dwarf → Class=Fighter → Subclass=Champion → skills → Save).
- **Visible face renders honestly after the throw**: the crash lands in the async PRE-SELECT lane, but the
  Step-12 Resistances face still showed `Poison (Granted)` CHECKED for the Dwarf (a different grant lane
  survives the throw), no error boundary, no mis-render, and the completed save round-tripped correct
  disk bytes (`race: {name:'Dwarf', subrace:{name:'Hill Dwarf'}}`, class Fighter/Champion).
  So severity is console-noise + silent loss of the 5e limits collector for that recompute
  (`getResistanceLimits`/`collectLimits5e` never returns — caps for that draft may fall back to defaults),
  not visible corruption.
- Trigger shape for the fixer: at the throw moment `formData.race.subrace` carried the previous selection
  in a non-string form (Human has no subraces); `subraceName && raceData.subraces` passes the truthiness
  guard, then `sr.index === subraceName.toLowerCase()` throws inside `Array.find`. A `typeof subraceName === 'string'`
  guard at the `:47` entry (or normalizing the value where the race switch resets subrace) closes it.

## Status

OPEN — filed 2026-11-24 by the e2e-improve run (observer report from implementer session
`ses_defffb685ffeGd7JTQbEkh921b`).
