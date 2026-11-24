# Cast-time condition-AoE applies Poisoned to a poison-IMMUNE creature (zone turn-start lane correctly skips the same creature)

## Summary
Stinking Cloud cast from the sheet on FixtureLandDruid (2024 Circle of the Land Druid — the engine's own 2024 classes data carries "Immune to Poisoned condition" for this circle) prompts a CON save and, on a failed save, applies the Poisoned condition plus the stinking_cloud/no_action_and_bonus_action targetEffect rows. The zone turn-start recurring-save lane in the SAME engine skips that exact creature via `playerIsImmuneToCondition` (verified live as the differential in the same session) — the cast-time lane has no immunity gate at all.

## Steps to reproduce
1. In `test-campaign`, Initiative mounted; overlay armed as DivinationWizard's target (same rig as `bug-aoe-evasion-success-pays-half-damage`, though any Stinking Cloud cast works).
2. Open the DivinationWizard sheet, press `Stinking Cloud` → `Cast Spell`; in the picker deselect the auto-preselected FeyRanger and select `FixtureLandDruid` only; confirm `Cast Stinking Cloud (1)`.
3. A "Saving Throw Required — FixtureLandDruid must make a CON saving throw (DC 19)" prompt arms (expected: an immune creature is never put through the save). Roll Save — rolls 3 + 2 = 5 vs DC 19 → SAVE FAILURE. Done.
4. Read change-data: `FixtureLandDruid.activeConditions` and `targetEffects`; then press `Next →` until FixtureLandDruid's turn starts.

## Expected behavior
Poisoned cannot be applied to a creature with the Poisoned immunity (`playerIsImmuneToCondition`, `src/services/combat/automation/automationImmunities.js` — the same check chain `stinkingCloudHandler.js:90` runs at turn start with the real threaded PlayerStats from `8c314c468`). Either the picker/prompt should skip immune creatures the way the zone sweep does, or a failed save must land an honest immunity annotation with NO condition/te application.

## Actual behavior
- Save prompt mounted normally; on fail, log rows: `save_result :: FixtureLandDruid failed CON save (DC 19, rolled 3 +2 = 5)` and `save_result :: FixtureLandDruid failed CON save against Stinking Cloud and is Poisoned.`
- Disk/store truth right after: `FixtureLandDruid` bucket `activeConditions: ["poisoned"]` and targetEffects gained `FixtureLandDruid:stinking_cloud` + `FixtureLandDruid:no_action_and_bonus_action` — a rule-contradicting poisoned state on an immune creature.
- Differential control in the same session at the SAME DC/zone: FeyRanger (not immune) DID get the recurring turn-start `savePrompt-FeyRanger-<uuid>`; when FixtureLandDruid's turn started with his live stinking_cloud te row and the caster's `_stinkingCloud_DivinationWizard` tracking alive, NO prompt armed — the turn-start immunity gate (the `8c314c468` fix lane) fired correctly. So the two sibling lanes disagree about the same immunity, and the cast lane writes the illegal state.
- The turn-0 save also prompted at all — no honest "immune — no save" skip face.

## Likely location
Confident about the absence, guessing about the intended fix site:
- `grep playerIsImmuneToCondition` returns ZERO hits in `src/services/rules/spells/spellCastService/execution/savePath.js` and `src/components/char-sheet/modals/AOEConditionModal.jsx` — the cast-time condition-AoE application lane never consults the immunity registry the zone handlers (`src/services/automation/handlers/spells/stinkingCloudHandler.js:76-90` etc.), `conditionSaveService.js`, `saveProcessing.js`, `handleNpcSaveDamage.js`, `SetConditionModal.jsx` all use.
- The fail-apply step (write `activeConditions` + `stinking_cloud` te + `no_action_and_bonus_action` rider) is inside the AOEConditionModal/savePath fail branch.

## Suggested fix
Thread the same `resolveTargetStats`-style real PlayerStats into the cast-time condition application and gate on `playerIsImmuneToCondition({ conditionKey: 'poisoned', ... })` before arming prompts / applying conditions for condition-AoE casts (mirror `stinkingCloudHandler.js:90` semantics: honest skip, ledger/log annotation, no te rows). Decide with the owner whether immune creatures should be omitted from the picker entirely or prompted-then-refused with an "immune" copy. Add the CLA-119-style live e2e (immune fixture in-zone) pin so a mock-fed roster cannot mask the gate again.

## Severity
Data integrity risk — the engine stores a condition the ruleset says the creature can never have, and downstream riders (action/bonus-action block) enforce that illegal state for real turns.
