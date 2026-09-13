# Bug mon-MA-0017 — Aboleth "Multiattack" — Dominate Mind inert on failed save

Row: monster "Aboleth" (monsterIndex `aboleth`) · "Multiattack" · multiattack
Text: "The aboleth makes two Tentacle attacks and uses either Consume Memories or Dominate Mind if available."

## Verdict: FAIL (MV-8 bar — one named mechanic has zero live effect path)

Multiattack row itself = display-only (no `attack_bonus`/`save_dc`/dice → no link by design, `MonsterAction.jsx`). Verified by exercising each named component via manual GM clicks. Two of three are live+exact; **Dominate Mind produces zero live effect on a failed save → FAIL.**

## Live evidence (test-campaign, Playwright :5173, target = AberrantSorcerer, INT/WIS weak)

- **Tentacle ×2 — PASS (live+exact).** Click technique MV-1 (row-text startsWith + boundingRect mouse click). Roll1 `+9` → d20 8 =17 vs AC 9 HIT; Done (`button.dice-roll-reroll-btn`) → 2d6 (1,4)+5 = **10** dmg, AberrantSorcerer 41→31. Roll2 → d20 19 =28 HIT; 2d6 (5,3)+5 = **13**, 31→18. Log: two `roll`(+9) + two `save-damage`/Bludgeoning + two `hp_change`. Dice formula `2d6 + 5` Bludgeoning matches data exactly.
- **Consume Memories — PASS (live+exact).** Data: Intelligence save DC 16, 3d6 Psychic (half on success). Live: `.sp-modal` "AberrantSorcerer must make a INTELLIGENCE saving throw. DC 16" → Roll Save → **SAVE FAILURE 2 vs DC 16** → Done → 3d6 (5,6,6) = **17** Psychic applied, HP 18→1. Log: `save_result`, `roll` save [3], `save-damage` 3d6 [5,6,6] Psychic finalDamage 17, `hp_change` −17. No stun applied — correct (row prompt "damage+stun?" not in data; data is full/half Psychic only).
- **Dominate Mind (2/Day) — FAIL (zero live effect on failed save).** Data: Wisdom save DC 16, `save_effect` = "Failure: the target has the Charmed condition…". Live: `.sp-modal` "AberrantSorcerer must make a WISDOM saving throw. DC 16" → Roll Save → **SAVE FAILURE 4 vs DC 16**. `lastAttack` stamp captured `saveConditions:["charmed"]`, `attackName/actionName:"Dominate Mind (2/Day)"`, `saveResult:"failure"`. **But `AberrantSorcerer.activeConditions` stays empty/absent, `combatSummary` carries no condition/targetEffect, and there is NO `condition/applied` log entry anywhere.** Failed save = chip no-op + no log.

## Root cause (grep + live)

`src/components/encounter/MonsterCardModal.jsx:578 handleSaveRoll` passes `saveConditions` into `rollSavingThrow({…, autoDamageFormula: saveDamageFormula, saveConditions})`. `saveDamageFormula` for Dominate Mind is `null` (no `damage_dice_primary`, no dice in description).

`src/hooks/combat/saveProcessing.js`:
- `processPlayerSave`/`processNpcSave` only call `applySaveDamage` when `context?.autoDamageFormula && saveDc != null` (lines 130–132, 283–285).
- `applyFailedSaveConditions` (writes `activeConditions` + logs `type:'condition' action:'applied'`) is called **only from inside `applySaveDamage`** (line 420).
- Therefore a save-based effect with **no damage formula** (Dominate Mind: pure Charmed, no damage) never reaches `applyFailedSaveConditions` → the condition is extracted, stamped to `lastAttack.saveConditions`, but never applied and never logged.

`extractConditionsFromSaveEffect` (`MonsterCardHelpers.js:38`) correctly yields `['charmed']` — extraction is not the defect; the application gate is.

## "if available" / resource gate — note (not a FAIL)

- No `usage`/`uses`/`recharge` field on Multiattack, Consume Memories, or Dominate Mind in monsters.json ("2/Day" exists only inside the display name). No use-tracking grep-hits in `src/services`, no uses keys in change-data. → No resource gate is enforced. Accepted GM model per MV-8; "either/if available" chooser is also unenforced (GM model). Reported honestly; not the failure driver.

## Fix direction

Decouple `applyFailedSaveConditions` from `applySaveDamage` in `saveProcessing.js`: apply + log `saveConditions` on failed saves whenever `context.saveConditions` is non-empty, regardless of whether an `autoDamageFormula` exists (call it directly in `processPlayerSave`/`processNpcSave` after the save resolves).

## Cleanup
Admin clear change-data + log POSTs performed; browser closed. No manifest/playbook edits.
