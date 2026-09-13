# Bug MA-0048 — Adult Blue Dracolich Frightful Presence: failed DC 18 WIS save never applies Frightened (MV-14 re-confirmed on FP-owned row)

## Verdict: FAIL

## Expected
Row (category ACTIONS, save): DC 18 Wisdom save; on FAILURE target becomes Frightened 1 minute, repeat save at end of each turn (success ends), and immunity to this dracolich's FP for 24h after success/effect-end. NO damage on fail per this data (row has save_dc/save_type/save_effect only, no dice).

## Actual
- Affordance live: `.mc-overlay` FP row renders "DC 18 Wisdom" `.mc-dice-link` (MonsterAction.jsx:46-47) → opens sp-modal "ElderPaladin must make a WISDOM saving throw. DC 18. Half damage on successful save" (boilerplate wrong — FP deals NO damage, MV-19).
- Roll #1 natural FAILURE: d20 4 +10 (+5 aura from ElderPaladin) = 14 vs DC 18 → SAVE FAILURE → Done.
- POST-fail state: ElderPaladin change-data `activeConditions` ABSENT (null); zero condition/fright keys in EP store; NO Frightened badge on initiative card; campaign log = 5 entries (joined, initiative, save roll ×2, save_result) — ZERO condition-applied entries.
- Extraction works, application dead: `lastAttack` = {attackerName:"Adult Blue Dracolich 1", targetName:ElderPaladin, d20:4, bonus:10, total:14, saveType:"Wisdom", saveDc:18, saveResult:"failure", saveConditions:["frightened"]}; `Adult Blue Dracolich 1/_lastRollContext` = {type:"save", actionName:"Frightful Presence", oldSuccess:false} — no autoDamageFormula key → gate never opens.
- Second click (immediately after fail): new "Saving Throw Required / DC 18 / Roll Save" prompt fires again — ungated. 24h-immunity clause has no model in code (RAW note: a failed save grants no immunity, so re-trigger is RAW-legal; defect is the absence of ANY immunity/repeat-save machinery).
- Repeat-save/24h grep: repeat-save consumers exist ONLY for fear spell (fearHandler.js:156), cleric Avenging Angel Frightful Aura (avengingAngelHandler.js:141-228), and generic poisoned/unconscious rider text (attackRiderHandler.js:315/664). ZERO consumers keyed on "Frightful Presence" (only npcGenerator.js:59 free-text template). ZERO FP 24h-immunity tracking (only Friends spell friendsService.js + Heroes' Feast 24h buffs).

## Root cause (independent re-confirm of MA-0044 fingerprint on FP-owned row)
`applyFailedSaveConditions` (src/hooks/combat/saveProcessing.js:304) is invoked ONLY from inside `applySaveDamage` (:420), gated `if (context?.autoDamageFormula && saveDc != null)` (:130/:283). FP has save_dc but NO damage dice → applySaveDamage never entered → applyFailedSaveConditions never runs → Frightened structurally unreachable for damageless monster saves. NPC variant (handleNpcSaveDamage.js:648) requires context.statusEffects, never populated by the monster FP path.

## Repro
1. test-campaign (header MV-18) → Encounters → tick "Adult Blue Dracolich" → Join Encounter (HP 225, init 1).
2. `.creature-card.npc` target-select → ElderPaladin.
3. Avatar → `.mc-overlay` → FP row "DC 18 Wisdom" → Roll Save → FAIL (rolled 14 vs 18 naturally) → Done.
4. ElderPaladin activeConditions null, no badge, no condition log. Repeat click → fresh prompt (no gate).

## Likely Location
- `src/hooks/combat/saveProcessing.js:130,283,420` — condition application coupled to autoDamageFormula presence.
- `src/components/encounter/MonsterCardModal.jsx` / `MonsterAction.jsx:33` — saveConditions extracted, no consumer without damage.

## Notes
- Prompt text in both modals is the same sp-modal seen in MA-0044; same fingerprint, independently reproduced including ungated second click and grep-zero repeat-save/24h consumers.
