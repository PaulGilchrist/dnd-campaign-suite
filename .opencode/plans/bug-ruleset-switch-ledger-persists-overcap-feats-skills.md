# Ruleset-switch ledger keeps rows the target ruleset cannot allow, and the Save gate never checks caps

## Summary
Switching a character's ruleset through the creation-wizard's RulesetSwitchConfirmModal keeps selections that are legal row NAMES in the target ruleset but impossible in the target build (feats/skills over the level/ruleset cap), writes them to the character file, and the wizard's Save gate stays enabled while the steps themselves print "selected 1 of 0 allowed feat(s)" / "3 of 2 allowed skill proficiency/ies". The wizard will happily re-save the invalid state indefinitely.

## Steps to reproduce
Starting state: in `test-campaign`, any simple 5e character you own (or create one: sidebar `Add Character` → Quick build + 5e → any name, Human, Fighter, Champion, default skills → `Create Character`).

1. Open the character's sheet and click `Edit`.
2. Step 1 (Ruleset): click the `✨ 2024 Rules (Essentials)` card. NOTE face A: no confirmation modal appears at all for this direction (the wizard just advances — the switch commits silently and a new required `5 Background` step appears; until a background is chosen every later step and the sidebar Save are disabled with no explanation on the disabled buttons).
3. On the new `Step 5: Background` select a background (`Soldier`). Notice the feat pre-selected is the 2024 origin feat `Savage Attacker`, and the Soldier skill grant gets folded into `skillProficiencies` (now Athletics, Acrobatics, Intimidation).
4. Step 1: click the `📜 5th Edition (5e)` card. The in-app `Switch to 5th Edition (5e)?` ledger modal appears: `Feats — 1 kept, 0 removed Savage Attacker / Background — 0 kept, 1 removed Soldier`. Press `Yes, switch ruleset`.
5. The wizard restarts at Basic Information. Open `Step 7: Feats`: it reads `You have selected 1 of 0 allowed feat(s).` with Savage Attacker still selected. Open `Step 9: Skill Proficiencies`: `You have selected 3 of 2 allowed skill proficiency/ies.`
6. Click sidebar `✓ Save` — it is ENABLED; press it.
7. Inspect the saved file (`GET /api/campaigns/test-campaign/<Name>.json` or disk): `rules:"5e"`, `feats:["Savage Attacker"]`, `skillProficiencies` has 3 entries — a 5e level-1 character with a feat the 5e rules cap at 0, and more skills than allowed.
8. Reopen `Edit`: the over-cap counts render again, no banner/refusal, and Save is STILL enabled.

## Expected behavior
- The switch ledger must classify a kept row as REMOVED when the target ruleset grants ZERO slots for that category at this level (a 5e lv-1 build cannot hold any feat), or at minimum the Save gate must block while any step reports `selected > allowed` (the skill checkbox lane already enforces the cap interactively with a refusal toast — the gate is inconsistent between live selection and loaded state).
- Direction 5e→2024 silently committing (step 2 note) with the named-rows ledger only offered in the lossful direction may be intentional (nothing removed), but the follow-through face — a brand-new empty required step locking ten steps behind unlabeled disabled buttons — is at least inconsistent feedback.

## Actual behavior
As steps 5–8: over-cap rows are named "kept", persisted with 200 PUTs, and no gate or warning ever fires. Witnessed live 2026-11-24 (run RH) on throwaway character `QA Wizard Kid` (created and deleted in the same session; fixtures byte-untouched, 15-char aggregate restored to `9c851a53c10927d7346d27e8d30cb138`).

## Likely location
- `src/hooks/wizard/` ruleset-switch preview (`buildRulesetSwitchPreview` / `applyRulesetSwitchToFormData`, wired at `src/components/character-creation/CharacterCreationWizard.jsx:427-440, 685-695`): the keep/remove ledger checks row EXISTENCE in the target ruleset data, not the target grant/cap. Confident.
- The Save gate: `isSaveEnabled` in `src/hooks/wizard/useWizardNavigation.js:109` is a pure valid-PREFIX ladder over per-step validity, and the feats/skills steps evidently report valid while over-cap (feats step `0 allowed` with 1 selected still lets the prefix through). The interactive cap refusal lives in `WizardStepSkills.jsx getProficiencyCapBlockReason` (FT-002) — no loaded-state twin for feats, and no whole-form cap audit. Guessing at exact file split, confident on the shape.

## Suggested fix
First read `buildRulesetSwitchPreview` / `applyRulesetSwitchToFormData` (grep under `src/hooks/wizard/` and `src/services/character/`): the keep test should be `granted > 0 in target ruleset at this level` — for feats compare against the target `allowed feat(s)` count used by `WizardStepFeats` (the same source that prints "1 of 0"), for skills against `skillLimits.allowed`. Anything beyond the cap must land in the ledger's REMOVED list (named, e.g. `Feats — 0 kept, 1 removed Savage Attacker (5e grants no feats at level 1)`). Belt: make step validity false while `selected > allowed` on feats/skills so the existing monotonic ladder disables Save.

## Severity
Data integrity risk — invalid character state is persisted silently to the campaign file and re-servable to the rules engine; the app's own cap doctrine (interactive refusals, FT-002) says over-cap selections are illegal, yet the switch lane and Save gate write them freely.
