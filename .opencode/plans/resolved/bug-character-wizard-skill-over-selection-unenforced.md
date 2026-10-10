# Character wizard allows exceeding allowed skill proficiency choices (counter shows "3 of 2", Save not blocked)

### Summary
On the Skill Proficiencies step of the character creation wizard, the "allowed" cap is display-only. A 5e Human Wizard lvl1 with 2 allowed skill proficiencies accepted 3 checked skills ("You have selected **3** of **2** allowed"), Next stayed enabled, and the save persisted all three on the character.

### Steps to reproduce
1. On localhost, in test-campaign, click "Add Character".
2. Skip ruleset (Next), enter a unique name (or note the separate duplicate-name bug), set Class Wizard, Subclass Evocation, leave feats empty, spend or leave point buy, and continue to the Skill Proficiencies step.
3. Check three skill checkboxes, e.g. Arcana, History, Religion.
4. Observe: counter reads "You have selected 3 of 2 allowed skill proficiency/ies." — no error, checkboxes stay checked, Next is enabled.
5. Click Next through remaining steps and Create Character (or inspect the saved JSON).

### Expected behavior
The third checkbox should refuse to check (or auto-uncheck with a message) once the allowed count is reached, and Next/Save should be disabled while over the cap — same enforcement pattern as "0 of 0 allowed feat(s)" gating.

### Actual behavior
All three boxes stay checked, the counter turns into an honest complaint ("3 of 2") that nothing acts on, and the wizard proceeds. The over-cap selection persisted to the character file (verified by reading the overwritten JSON during the session before restoring it).

### Likely location
Guessing at exact file, confident about the layer: the wizard skill-selection component (under `src/components/wizard/` / skill proficiencies step) renders the selected/allowed counter but its checkbox onChange has no `selected.length < allowed` guard. Fix is a client guard in the checkbox handler plus a gate on the step's Next validation.

### Severity
Broken feature — rules validation advertised by the UI is not enforced, letting invalid characters be saved.

## Summary
Skill proficiency cap on wizard step 10 is now enforced at two layers: the checkbox handler refuses over-cap additions with a visible message, and a blocking `validateStep(10)` gate disables Next/Save while the selection exceeds `getSkillLimits().allowed`. Both rulesets share the path. Regression tests and live browser re-verification pass; lint clean.

## Resolution
(2026-10-10, fixed)

**Root cause** — two gaps, matching the original guess about the layer:
1. `WizardStepSkills.jsx` `handleProficiencyToggle` called `onSkillToggle` unconditionally — no `selected.length < allowed` guard (the component's own expertise refusals DO use a `blockReason` + `.expertise-feedback` pattern; proficiency toggling just never adopted it).
2. `src/config/utils.js` `stepValidators` had no entry for the Skill Proficiencies step (step 10 per `steps-config.js`; content heading number "Step 6" is the known cosmetic numbering mismatch). `useWizardNavigation` gates Next/Save solely via `validateStep(currentStep, …)`, so nothing was ever blocked. `validateSkills()` in the skillValidation service only produces non-blocking warnings.

**Correction to the bug file's cited sibling**: the "0 of 0 allowed feat(s)" gating is itself display-only — verified live, selecting a feat at level 1 (allowed 0) succeeded ("1 of 0 allowed feat", Next enabled). The actually-enforced sibling is the FT-001 ability-total cap gate (`validateAbilitiesStep` registered as `stepValidators[9]`); that step-validator pattern was mirrored.

**Rule-data ground truth**: `public/data/classes.json` Wizard 5e `proficiency_choices.choose: 2`; `public/data/2024/classes.json` Wizard "Choose 2" — allowed=2 confirmed against canonical data.

**Files changed**:
- `src/config/utils.js` — added `validateSkillsStep` (blocking error `skillProficiencies` when `selected.length > getSkillLimits(...).allowed`) registered as `stepValidators[10]`; `validateStep` now forwards `allFeats` through to validators (previously dropped despite callers passing it). 2024 wizard shares this component + validator, so the single fix covers both rulesets.
- `src/components/character-creation/WizardStepSkills.jsx` — `getProficiencyCapBlockReason` + guard in `handleProficiencyToggle`: over-cap toggle-on is refused with the existing `.expertise-feedback` message flow (pre-selected skills and null `skillLimits` while loading are not gated; toggle-off always allowed).
- `src/config/utils.skill-cap.test.js` — NEW regression tests (step-10 gate blocks 3-of-2, passes exactly-at-cap/empty/wide-cap, forwards allFeats, works for 2024).
- `src/components/character-creation/WizardStepSkills.skill-cap.test.jsx` — NEW regression tests (third checkbox refused with feedback, below-cap and toggle-off allowed, null-limit and pre-selected not gated).

**Verification**:
- Live (test-campaign, localhost): fresh wizard Wizard/Evocation/Human lvl1 → checked Arcana, History → "2 of 2", Next enabled; clicked Religion → **refused, stays unchecked**, feedback "You can only select 2 allowed skill proficiency/ies. Deselect one first.", counter holds at "2 of 2". Pre-fix state "3 of 2" left over from the repro (before the fix was loaded) also correctly showed **Next disabled**. Next then passed cleanly through Tools → Languages with exactly 2. Wizard cancelled; `BugTestWizard` never persisted (absent from sidebar).
- Tests: `npx vitest run` on both new files (11 pass), then full `src/config/` + `src/components/character-creation/` (40 files, 622 pass), plus `useWizardNavigation`/`useWizardSkills` (57 pass).
- `npm run lint`: zero warnings/errors.
- Cleanup: no test character was ever saved (wizard cancelled); Admin "Clear Change Data" + "Clear Campaign Log" executed for test-campaign — API confirms both empty.

