# bug-mon-MA-0038 — Adult Black Dragon "Cloud of Insects" — concentration-disadvantage clause never applied; once-per-turn gate absent

## Title
MA-0038 Adult Black Dragon · Cloud of Insects · legendary_actions · save · FAIL (save core exact; named fail-effect clause + recharge-style gate unimplemented)

## Overview
The legendary row IS clickable (amends MV-17: rows carrying save_dc render affordances via MonsterActionSection→MonsterAction). DC 17 DEX save + full/half 4d10 Poison resolve correctly. But the named clause "Disadvantage on saving throws to maintain Concentration until end of its next turn" has zero producer and is never applied on a failed save, and "can't take this action again until the start of its next turn" has zero consumers. (Recorded by orchestrator from subagent run; subagent filed only checkpoint.)

## Expected Behavior (row)
"DC 17 Dexterity, one creature within 120 ft. Failure: 22 (4d10) Poison damage, and the target has Disadvantage on saving throws to maintain Concentration until the end of its next turn. Failure or Success: The dragon can't take this action again until the start of its next turn."
monsters.json: save_dc 17, save_type Dexterity, damage_dice_primary 4d10 Poison.

## Actual Behavior
- Save core exact: click chip "4d10" → save card "DC 17 DEX", failure → full 4d10, success → half (dcSuccess:'half' correct RAW here).
- Failed save: extractConditionsFromSaveEffect(saveEffect)=[] (Concentration-disadvantage not in MonsterCardHelpers.js:36 CONDITIONS vocabulary); no te written; no condition/te log; grep cloud_of_insects = 0 in src.
- Once-per-turn gate: grep "can't take this action again" consumers = 0; repeat clicks ungated (same-round re-fire, MV-21 recharge fingerprint).

## Steps to Reproduce
1. localhost:5173 → test-campaign → EB join "Adult Black Dragon".
2. Arm PC target; open .mc-overlay → legendary section Cloud of Insects → click "4d10" chip → save prompt → Roll Save → Done.
3. Observe damage applied, but no concentration-disadvantage te/condition on target; click chip again same round → fires again ungated.

## Likely Location
- Clause producer gap: MonsterCardHelpers.js saveEffect vocabulary (extractConditionsFromSaveEffect) — MV-14 family (no producer for non-condition/non-damage effects).
- Gate gap: MonsterCardModal.jsx no uses/round latch (MV-21 family).

## Notes
- Amends MV-17: legendary rows WITH numeric authored fields render clickable and resolve via generic save/attack paths; only no-affordance legendary rows are inert.
- ConcentrationPromptModal CAN consume disadvantage sources (playbook 46g) — a te producer at failed-save is the missing seam.
