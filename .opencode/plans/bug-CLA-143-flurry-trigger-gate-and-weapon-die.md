# Bug — CLA-143 Flurry of Blows: trigger gate unenforced + unarmed strikes roll wrong weapon die

## Overview
CLA-143 (2024 Monk lv2, `bonus_attacks` lane) fires and spends Focus correctly, and at lv20 delivers THREE strikes via the Heightened Flurry of Blows replacement (lv10 scaling works live). But two behaviors contradict spec, proven live on test-campaign 2026-10-05:
1. **Trigger gate `after_attack_action` is NOT enforced** — Flurry fires with Focus spend on a turn with NO prior Attack action (playbook §1 verdict policy: unenforced trigger/gate = FAIL).
2. **Unarmed Strikes roll the wrong damage die** — the handler blindly reads `playerStats.attacks[0]`; when a Quarterstaff is equipped first, the lv20 unarmed strikes rolled **1d6+5** instead of the Unarmed Strike's **1d12+5**.

## Expected Behavior (canonical app-data)
- `public/data/2024/classes.json` (Monk lv2): "Expend 1 Focus Point to make two Unarmed Strikes as Bonus Action, increasing to three at level 10." automation: `{type:'bonus_attacks', attacks:2, attackType:'unarmed_strike', cost:{resource:'focus_points',amount:1}, trigger:'after_attack_action', casting_time:'1 bonus action'}`.
- lv10 entry (class_levels[9]) "Heightened Flurry of Blows" attacks:3 replaces base at lv10+ (classRules2024.js:151).
- Trigger: after_attack_action — unusable unless the Attack action was taken first.
- attackType:'unarmed_strike' — strikes must use the Unarmed Strike die (lv20 = 1d12+5 on this host's sheet).

## Actual Behavior
- PASS core observed: FP 20→19 exact single spend; distribute modal "Heightened Flurry of Blows — 3 Attacks to Assign"; 3 attack rolls (raw d20 15/14/10, +11 vs AC 12, all `hit:true`); 3 damage roll entries; `ability_use` "Disciplined_Monk used Heightened Flurry of Blows, making 3 unarmed strikes…"; Open Hand Technique chooser offered on hits; Bandit 1 killed (hp_change −4 clamped 4→0, corpse strikes finalDamage 0).
- **Defect 1 (control probe):** Round 2 monk turn, NO Attack action taken — row click still opened the distribute modal and spent Focus (19→18). No `<feature>_refused` log, no zero-spend refusal. `gateTriggerRequirement` (useCharActionsAutomation.js:119-138) only handles `after_casting_action_spell`; `after_attack_action` has zero enforcement anywhere (grep: only default in automationInfoBuilder/attack.js:218). Also spendMonkFocusPoint (useCharActionsAutomation.js:390) runs BEFORE gateTriggerRequirement (:393), so even adding a gate there cannot stop Focus burn.
- **Defect 2:** flurry damage logs show `formula:'1d6+5'` totals 11/10/10 (1d6 max+mod = 11 ceiling) while the sheet's Unarmed Strike row is 1d12+5. Cause: `resolveFlurryWeaponStats` (bonusAttacksHandler.js:398-404) reads `playerStats.attacks?.[0]` — that is the equipped Quarterstaff (Actions table row 1) — never selecting the Unarmed Strike entry despite `attackType:'unarmed_strike'`.
- Minor ledger cosmetic: `ability_use` description reads "Total damage dealt: 0" while hp_change applied −4 (totalDamageRef accumulates `finalDamage`, which death-clamps to 0 at bonusAttacksHandler.js:304/applyDamage path).

## Steps to Reproduce
1. test-campaign, Disciplined_Monk lv20 (2024) in initiative with EB-joined Bandit (arm target on monk's init-card select).
2. Quarterstaff equipped (default first attack row). Actions panel → Quarterstaff "+11" → Done (Attack action).
3. Bonus Actions → "Heightened Flurry of Blows:" → modal shows "3 Attacks to Assign", FP already decremented → Strike All → 3 attack/damage rolls logged, damage formula 1d6+5 (not 1d12+5).
4. Control: walk initiative Next to round 2 monk turn; take NO attack; click Flurry row → modal opens + FP−1 = gate unenforced.

## Likely Location
- `src/components/char-sheet/useCharActionsAutomation.js` — `gateTriggerRequirement` (~:119) missing `after_attack_action` branch; FP pre-spend ordering at :390 vs :393.
- `src/services/automation/handlers/combat/bonusAttacksHandler.js` — `resolveFlurryWeaponStats` (:398) must pick the `unarmed_strike` attack entry (match attackType) instead of attacks[0]; `buildFlurryAbilityDesc` (:425) damage-total honesty.
- Stale manifest note: mission row cites `src/services/combat/automation/handlers/classFeatureHandler.js` — consumer does not exist there; live lane is `src/services/automation/handlers/combat/bonusAttacksHandler.js` (HANDLER_MAP `bonus_attacks` at automation/index.js:445).

## Notes
- lv10→3 attacks scaling is LIVE via Heightened replacement — not a gap.
- FP spend itself is exactly 1 per click (runtime key `focusPoints`; UI 19/20→18/20 across two activations incl. control probe).
- No-spell/no-target refusals in `handle()` (bonusAttacksHandler.js:92-124) function (no-combat/no-target popups verified structurally in code, joined-bandit path exercised live).
- Grep echoes mangle "Flurry"→"ln"/"n" (injection noise confirmed again this session) — file contents verified by direct reads.
