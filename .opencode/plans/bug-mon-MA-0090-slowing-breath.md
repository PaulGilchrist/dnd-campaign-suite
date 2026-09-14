# Bug: MA-0090 Adult Copper Dragon — Slowing Breath (save rolls, effect never applied)

## Title
MA-0090 Slowing Breath: DC 18 CON save resolves but the slowed condition (no Reactions / Speed halved / action-XOR-bonus-action) is never applied to failed-save targets — mechanic inert.

## Overview
`Adult Copper Dragon > Slowing Breath` (`monsterIndex: adult-copper-dragon`, category `actions`, actionType `aoe-save`) routes through `MonsterCardModal` → `executeBlockSaveRoll` → cone `SaveAttackAoeModal`. The picker renders, DC 18 Constitution is enforced, and per-target saves roll — but on a FAILED save nothing is applied: no condition, no targetEffect, no speed-halve, no reaction block, no action/bonus-action restriction, no duration tracking, and no `condition`/`save_result` campaign-log entries. The row's entire effect clause is dead text.

## Expected Behavior (row + monsters.json)
Row MA-0090 and `public/data/monsters.json` (`adult-copper-dragon`, actions[3] "Slowing Breath", `save_dc: 18`, `save_type: "Constitution"`, no damage dice) both state on failure:
> "The target can't take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn."

So each cone target that fails the DC 18 CON save should gain an enforced slowdown state (visible in `activeConditions`/`targetEffects`, with a `condition` log entry) lasting until the end of its next turn; successful saves get nothing (no damage exists to halve).

## Actual Behavior (live probe 2026-09-14, test-campaign)
- Cone picker opened: "Select creatures in the area of effect. Each must make a **Constitution** saving throw (DC 18)." — DC/save type enforced ✓; area targets selectable ✓ (2 selected: AberrantSorcerer, LightfootHalfling).
- GM Quick-Rolls: AberrantSorcerer 8+4=**12 vs 18 = FAILURE**; LightfootHalfling 3+4=**7 vs 18 = FAILURE** (change-data `saveResult-AberrantSorcerer` / `saveResult-LightfootHalfling`: `success:false, saveBonus:4, mode:"normal"`).
- After Done: change-data shows **no** `activeConditions`, **no** `activeConditionMeta`, campaign `targetEffects: null`, no speed/reaction/slow keys on either target; `lastAttack.saveConditions: []`, `lastAttack.damageFormula: null`.
- Campaign log has only 3 entries total: `encounter joined`, `initiative`, `ability_use` "Slowing Breath: Selecting 2 target(s) for save (DC 18 Constitution)". No `save_result` entries, no `condition` applied entries — failed saves produce zero enforcement and the save outcomes themselves are never logged to the campaign log (AGENTS.md logging gap).
- Cosmetic sub-bug: picker copy prints "On a failed save, target takes **null null** damage. On a successful save, target takes half damage." (null damage formula rendered raw into the damage-only template).

## Steps to Reproduce
1. http://localhost:5173 → campaign `test-campaign` → Encounters (Encounter Builder).
2. Search "Adult Copper Dragon" → tick → qty 1 → **Join Encounter** (14 party PCs join as cone targets).
3. Initiative → dragon card → Target combobox set to AberrantSorcerer → click dragon avatar → MonsterCardModal.
4. Click the "DC 18 Constitution" dice link on Slowing Breath → `.sp-modal` cone picker → tick 2 PCs → "Slowing Breath (2)".
5. Roll Save on each prompt (both failed at DC 18) → Done.
6. GET `/api/campaigns/test-campaign/change-data` + `/log`: targets have no conditions/effects; log shows only the target-selection `ability_use`.

## Likely Location
- `src/components/encounter/MonsterCardHelpers.js:53` `extractConditionsFromSaveEffect` — scans only the canonical `CONDITIONS` list (blinded…unconscious); "can't take Reactions; its Speed is halved; …" matches nothing → `saveConditions = []`.
- `src/components/encounter/MonsterCardModal.jsx:428` (`buildSaveOptions`) / `:141` (`executeBlockSaveRoll` → `setConePicker`) — forwards the empty `saveConditions` and `zoneTe:null` (monsters.json row has no `zone` field) into the picker.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:361` `applySaveFailConditions` — early-returns on `saveConditions.length === 0` ("byte-inert when empty", MA-0063); `pullMarkerEffect` is flag-gated (CLA-384) and not set by the monster-card cone call; damage log block runs only `if (finalDamage > 0)`.
- `applyDamage.js` — nothing to apply (no damage on this row; by design).
- Data: no drift — monsters.json save_dc 18 / Constitution / effect text match the manifest row exactly.

## Notes / design gaps
- Every required consumer already exists for the **Slow spell** family but has no monster-path producer: te `no_action_and_bonus_action` (`targetEffectDefinitions.js`, producers `slow2024.js` / stinking cloud), speed-halve consumer `CharSheet.conditionEffects.js:167` (keyed on `stunned_speedHalved`, producer Stunning Strike only), reaction-block consumers in `CharReactions`. A fix shape could mirror MA-0063: parse the slowing clause into a dedicated te (registered in `targetEffectDefinitions.js`) with `duration:'until_end_of_target_next_turn'` + `addExpiration`, or extend `extractConditionsFromSaveEffect`/a dedicated clause parser (like `parseConcentrationDisadvantageClause`, MonsterCardHelpers.js:47) to arm `speed_halved`/`no_reactions`/`no_action_and_bonus_action` te for this save_effect text, and grant on failed saves in `SaveAttackAoeModal.applySaveFailConditions` (NPC + PC legs) with `condition`/`save_result` logs.
- PC save outcomes never reach the campaign log for this flow (only the selection `ability_use`), so even audit trail is missing.

VERIFIED: FAIL
