# Bug mon-MA-0079 — Adult Bronze Dragon · Repulsion Breath · aoe-save

**Verdict: FAIL.** Live FAILED STR save confirmed (d20[18] + (-1) = 17 vs DC 19) but zero fail-branch effect: Prone never applied, push never recorded, no cone picker, no recharge gate. MV-14/27 damageless-save seam reproduced.

## Live evidence
- Header test-campaign ✓; target armed pre-click to AberrantSorcerer (STR 8, mod −1) via tracker Target select.
- Save prompt modal: "AberrantSorcerer must make a STRENGTH saving throw. DC 19" — exact; boilerplate "Half damage on successful save" wrong for damageless effect.
- Roll Save → "SAVE FAILURE — Total: 17 vs DC 19, d20 (18) + -1".
- change-data lastAttack: saveResult:"failure", saveDc:19, saveType:"Strength", bonus:-1, **saveConditions:[]**, damageFormula:null.
- Log: `save_result` "AberrantSorcerer failed Strength save (DC 19, rolled 18 +-1 = 17)" + named roll "Repulsion Breath".
- Post-fail: AberrantSorcerer activeConditions absent (runtime + combatSummary); targetEffects zero push entries. 60-ft push: no mechanism, no marker.

## Root cause (static)
- `extractConditionsFromSaveEffect` (src/components/encounter/MonsterCardHelpers.js:38) correctly parses "Prone" → ["prone"], and handleSaveRoll passes it as context.saveConditions.
- But conditions are applied ONLY by `applyFailedSaveConditions` (src/hooks/combat/saveProcessing.js:304), called ONLY from `applySaveDamage` (:420), gated by `context?.autoDamageFormula && saveDc != null` in both processPlayerSave (:131) and processNpcSave (:283). Repulsion Breath has no damage dice → gate false → applySaveDamage never runs → prone never applied. Same hole for every damageless monster save (evasion roll, bane/gate bookkeeping also skipped).
- Note: live lastAttack.saveConditions was [] — context.saveConditions also lost between SavePromptModal quick-roll path and stampPlayerSaveLastAttack; secondary to the gate.

## Other gaps
- Cone/area picker: none — save is single-target via tracker Target select only; "each creature in a 30-foot Cone" unmodeled.
- Recharge gate: no `recharge` field on action in monsters.json; UI shows "(5-6)" on Lightning Breath as display text only; Repulsion Breath row has no recharge marker or gate.
- `push` targetEffect exists in registry (targetEffectDefinitions.js:738, manual-add + PC handlers) but no monster-save producer.

## Fix suggestion
Hoist `applyFailedSaveConditions` out of `applySaveDamage` to run unconditionally after save resolution in both player/NPC paths when `saveConditions.length && !saveSuccess`; suppress "Half damage" boilerplate when no damageFormula.

Cleanup: admin clear-change-data + clear-log POSTs (Host: localhost); browser closed; no manifest/playbook edits.
