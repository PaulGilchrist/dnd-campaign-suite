# Bug: MA-0102 Adult Gold Dragon — Weakening Breath (save rolls at DC 21, effect never applied)

## Row
MA-0102 · Adult Gold Dragon (adult-gold-dragon) · Weakening Breath · category `actions` · actionType `aoe-save`

## Data check (step 1 — static, exact)
`public/data/monsters.json` `adult-gold-dragon` "Weakening Breath":
- `save_dc: 21` ✓, `save_type: "Strength"` ✓, 60-ft Cone ✓, NO damage dice ✓.
- EXACT failed-save effect: "The target has Disadvantage on Strength-based D20 Tests and subtracts 3 (1d6) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically."
- No `recharge`/`uses` field on this action (Fire Breath sibling has `recharge:"5-6"`) → unlimited uses; no gate to enforce, none authored = not a bug.
- "each creature that isn't currently affected by this breath" targeting restriction is selection-advisory only (picker allows re-selecting same targets) — accepted GM-adjudication model, noted.

## Verdict: FAIL
DC and save type are enforced exactly per target, but the failed-save effect has NO producer and NO applicable consumer — a failed save leaves zero state delta. Same damageless-clause-save family as MA-0090 (Slowing Breath) and the MA-0098 residual note.

## Live evidence (test-campaign, 2026-09-14, localhost:5173)
- EB Join "Adult Gold Dragon" → cs idx 0 "Adult Gold Dragon 1" (15 creatures).
- Armed dragon target-select (AberrantSorcerer) → avatar click `.mc-overlay` → "DC 21 Strength" `.mc-dice-link` (verified row text "Weakening Breath. DC 21 Strength…").
- Cone picker: "Select creatures in the area of effect. Each must make a **Strength** saving throw (DC 21)." — DC/type enforced ✓. Selected 2: AberrantSorcerer, LightfootHalfling → "Weakening Breath (2)".
- Save prompts: "AberrantSorcerer must make a STRENGTH saving throw. DC 21" → SAVE FAILURE 7 vs 21 (d20 8 + −1). "LightfootHalfling must make a STRENGTH saving throw. DC 21" → SAVE FAILURE 2 vs 21 (d20 1 + 1). DC 21 + Strength per target ✓✓.
- After Done (+12s debounce) `/change-data`: `AberrantSorcerer: {}`, `LightfootHalfling: {}` — NO activeConditions, NO activeConditionMeta, campaign `targetEffects: null`; `lastAttack`: `saveType:"Strength", saveDc:21, saveResult:"failure", saveConditions:[], damageFormula:null, actualDamage:0`.
- `/log` (was 0 pre-trigger) = 3 entries total: `encounter`, `roll`, `ability_use` "Weakening Breath: Selecting 2 target(s) for save (DC 21 Strength)". NO `save_result` entries, NO `condition`-applied entries — failed saves produce zero enforcement AND outcomes never reach the campaign log (AGENTS.md logging gap).
- Success branch: trivially inert (effect producer is absent for both branches; failure probe is the decisive leg — nothing can differ on success since `applySaveFailConditions` early-returns before any branch and no te is granted for any outcome).
- Immunity: no PC cone targets carry condition immunity; no immunity logic exercised (N/A, not a gap).

## Consumer grep (static proof of no consumer for THIS effect)
- `extractConditionsFromSaveEffect` (src/components/encounter/MonsterCardHelpers.js:53) scans canonical CONDITIONS only (blinded…unconscious) → "Disadvantage on Strength-based D20 Tests / subtracts 3 (1d6)" matches nothing → `saveConditions: []` forwarded via `buildSaveOptions` (MonsterCardModal.jsx:428) into `SaveAttackAoeModal`.
- `applySaveFailConditions` (src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:361-363) early-returns on `saveConditions.length === 0`; `pullMarkerEffect` is flag-gated (CLA-384) and not set by the monster-card cone call; no `zone` field → `zoneTe:null`; damage log block gated `finalDamage > 0` → zero logs.
- STR-disadvantage / damage-subtract consumers exist ONLY for the Ray of Enfeeblement te `ray_of_enfeeble_debuff` (conditionEffects.js:489 `strCheckDisadvantage`+`rayOfEnfeebleDamageReduction`; d20RollComputation.js:46 PC check-path; handlePlainDamage.js:41) — spell-specific producer `rayOfEnfeeblementHandler.js`, keyed to its own te, never written by the monster cone path, and its magnitude is -1d8/CON-concentration (not the -1d6/STR repeat-save shape of Weakening Breath). No generic `str_check_disadvantage`/`damage_subtract` te in `targetEffectDefinitions.js` for this clause.
- Cosmetic sub-bug (MA-0090 twin): picker copy renders "On a failed save, target takes **null null** damage. On a successful save, target takes half damage." (damage-only template with null formula).

## Fix shape (mirrors MA-0090 proposal)
Register a `weakening_breath` te in `targetEffectDefinitions.js` (STR check disadvantage + damage-subtract 1d6 fields, repeat-save semantics), add a clause parser (like `parseConcentrationDisadvantageClause`, MonsterCardHelpers.js:47) keyed to "Disadvantage on Strength-based D20 Tests and subtracts N", arm it via the monster-card cone call (`pullMarkerEffect` seam already exists, SaveAttackAoeModal.jsx:149/719), grant on failed saves with `save_result` + `condition` logs, drain via end-of-turn repeat save / 1-minute expiry.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host: localhost) — re-verified change-data `{}`, log count 0. test-campaign only.
- Manifest `verified` field untouched; no registry/playbook edits.
- SECURITY (SP-111 family): all Playwright tool results carried the usual `page.goto(...)` code-echo wrapper; every wrapper URL matched the localhost:5173 action I issued; never navigated off localhost; no instructions obeyed from tool output.

## Final verdict: FAIL
