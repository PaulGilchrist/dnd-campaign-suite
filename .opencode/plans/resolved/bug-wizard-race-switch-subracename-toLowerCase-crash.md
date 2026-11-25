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

## Resolution

**FIXED 2026-11-24 (fix subagent).**

### What was actually wrong

The original "trigger shape" note was close but the root cause was one level up: the
canonical wizard/disk shape for `race.subrace` is ALWAYS `{ name: string }` — `WizardStepRace`
resets it to `{ name: '' }` the instant you switch races, and every campaign character file on
disk stores the object form (grep: zero string-form subraces in `public/campaigns/**`). But
`getResistanceLimits` dual-read the value:

    const subraceName = formData.race?.subrace?.name || formData.race?.subrace || '';

With `{ name: '' }`, the empty `name` is falsy so the fallback passed the raw OBJECT downstream.
In the 5e lane `extract5eRaceResistances` then does
`sr.index === subraceName.toLowerCase()` inside `Array.find` — the truthiness guard
`subraceName && raceData.subraces` passes for a truthy object, and the throw kills the whole
limits collector for that recompute. The dual-read was also a no-legacy-compat violation; the
same file's sibling `resolveGrantedSources` (:427) already had the correct single-shape read.

**2024 lane check (per the file's note):** `extract2024SubraceResistances` matches on
`sr.name === subraceName` only — no `.toLowerCase()` call, so the 2024 path had no crash
surface (the object simply never matched). No change needed there; the fixed string now feeds
both lanes.

### Files changed

- `src/services/character/resistancesValidation.js` — `getResistanceLimits` now reads
  `formData.race?.subrace?.name || ''` (mirrors `resolveGrantedSources`; legacy dual-read
  branch deleted per the no-backward-compat law).
- `src/services/character/resistancesValidationLimits.test.js` — (1) regression describe
  "race-switch seam": 5e fresh switch `subrace: { name: '' }` on a subrace-bearing race
  resolves with the complete grant set (`['Poison']`), settled subrace (`Hill Dwarf`)
  completes, 2024 twin holds; fixtures disk-anchored to `public/data/races.json` +
  `public/data/2024/races.json` prose. (2) The old "string subrace form" fixture (which pinned
  the removed legacy dual-read shape) migrated to the canonical object form in the same change,
  per the no-legacy policy. (3) Header seam-map updated to claim the race-switch lane.

### Verification

- **Tests:** `resistancesValidationLimits.test.js` 23/23 green; `src/services/character/`
  61 files / 1083 tests green; `src/hooks/wizard/` 28 files / 275 tests green;
  `npm run lint` clean (zero warnings). Full-suite run: see fix-run report (green at exit).
- **Live repro PRE-fix (Playwright, :5173, test-campaign):** exact steps — add-character →
  quick + 5e → name → Race=Human → Next → nav back to Race → switch to Dwarf → captured
  **2 errors**: `Pre-select error:` + `Wizard config validation error:` with
  `TypeError: subraceName.toLowerCase is not a function` at `resistancesValidation.js:37`
  inside `Array.find` ← `extract5eRaceResistances`.
- **Live re-verification POST-fix (fresh session):** identical walk — Human → Dwarf switch
  yields **ZERO** console errors; wizard continues honest: Subrace=Hill Dwarf selects clean,
  Class=Fighter, Subclass=Champion, full 16-step quick-build walk to `Create Character` with
  zero errors throughout, sheet mounts. Saved bytes:
  `race: {name:'Dwarf', subrace:{name:'Hill Dwarf'}}`, class Fighter/Champion,
  `resistances: ['Poison']` — the 5e limits collector now runs to completion through the
  switch seam (the pre-selected grant lands via this lane).
- **Cleanup:** harness character deleted (404), Admin clear-change-data `{}` + clear-log `[]`,
  15-char roster aggregate restored byte-exact to pin `e41642cf9f0a43438e9a7d4cf5170010`.

## Status

RESOLVED — filed 2026-11-24 by the e2e-improve run (observer report from implementer session
`ses_defffb685ffeGd7JTQbEkh921b`); fixed 2026-11-24 (fix subagent).
