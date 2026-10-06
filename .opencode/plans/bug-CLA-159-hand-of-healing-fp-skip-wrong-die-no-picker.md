# Bug — CLA-159 Hand of Healing: no Focus Point spend, wrong Martial Arts die (d12), no target picker

## Overview
Standalone Hand of Healing (Warrior of Mercy, Disciplined_Monk lv20, 2024 rules) triggers from the
sheet `b.clickable "Hand of Healing:"` affordance and shows the handOfHealing result modal, and the
WIS modifier now resolves to a number (+7) — CLA-144's unresolved-token flaw is fixed. But it
(a) expends ZERO Focus Points, (b) rolls 1d12 instead of the canonical 1d10 lv20 Martial Arts die,
and (c) never presents a target picker — it always self-heals, so the wounded Bandit 1 (HP 1) was
never healed (delta 0, capped at full HP).

## Expected Behavior (canonical, mission row + 2024 Warrior of Mercy)
"As a Bonus Action ... you can touch a creature and expend one use of your Focus Points. Roll a
Martial Arts die, and the creature regains a number of Hit Points equal to that roll plus your
Wisdom modifier." (lv20 → 1d10 + WIS(+7); 1 Focus Point spent; target selectable.)

## Actual Behavior
- Focus Points: 20/20 before AND after two successful heals (UI "Focus Points: 20/20 (cur/max)").
  No FP is ever spent. Root cause: `shouldSkipFocusPointCost`
  (src/components/char-sheet/useCharActionsAutomation.js:47-52) returns true for ANY
  'Hand of Healing' use when the character merely HOLDS 'Flurry of Healing and Harm'
  (`hasFlurryHealingHarm && FOCUS_COST_SKIP_FEATURES.includes(action.name)`), so the FP gate +
  decrement at lines 85-88 are never reached for the standalone lane. The 2024 free-cost exemption
  applies only to Hand of Healin' used AS PART OF Flurry of Healin' and Harm' (CLA-144 lane), not
  standalone. Consequence: the 0-FP refusal control probe is also untestable (gate unreachable).
- Wrong die: modal/log formula "1d12 + 7 + 2" (rolls 1d12=12, 1d12=4). Canonical lv20 2024
  Martial Arts die is d10. Underlying data defect: public/data/2024/classes.json Monk
  class_levels has `"martial_arts_die": 12` at levels 17 and 20 (2024 PHB table: d4/d6@5/d8@11/d10@17).
  Handler healingHandler.js:162 faithfully uses `martialArtsDie` — data bug, not handler arithmetic.
- No target picker: click → `resolveMonkHealTarget` (healingHandler.js:147-151) → no armed
  target / no picker UI → defaults to self (`playerStats.name`). Log hp_change entries both show
  targetName "Disciplined_Monk", currentHp 183/183, delta 0 — visible healing on the pre-damaged
  Bandit 1 never occurred.
- Bonus stacking: Fortified Health (+2) rides the heal and gets marked used even at delta 0
  healAmount display ("1d12 + 7 + 2: 12 +9= 21 HP restored" at full HP).

## Steps to Reproduce
1. test-campaign, join Bandit 1 via Encounter Builder (joined, rolled init 2, 11 HP); set its
   card HP to 1 via `input[aria-label="Bandit 1 current HP"]`.
2. Open Disciplined_Monk sheet (lv20, Warrior of Mercy, WIS 24/+7, Focus Points 20/20).
3. Dismiss any lingering `.short-rest-overlay`; click `b.clickable` "Hand of Healing:".
4. Modal appears: "Hand of Healing — Disciplined_Monk (183/183 HP) — 1d12 + 7 + 2: … restored".
   Click Done. No target picker at any point; Focus Points stays 20/20.
5. GET /api/campaigns/test-campaign/log → hp_change entries:
   {targetName:"Disciplined_Monk", sourceName:"Hand of Healing", delta:0, rollInfo:"1d12=12 (12)", bonusDetails:[{name:"Fortified Health",amount:2}]}

## Likely Location
- src/components/char-sheet/useCharActionsAutomation.js:45-52 (FOCUS_COST_SKIP_FEATURES includes
  'Hand of Healing' + hasFlurryHealingHarm blanket skip; line 51's `action.name !== 'Hand of Healing'`
  exemption exists only on the cloakActive branch, not the flurry branch) — primary FAIL.
- public/data/2024/classes.json — Monk class_levels 17/20 `martial_arts_die: 12` (should be 10).
- src/services/automation/handlers/healing/healingHandler.js:147-151 — resolveMonkHealTarget falls
  back to self with no picker when untargeted (mission requires target picker).
- Note: mission row's handler/router paths (src/services/combat/automation/...) are stale; real files
  are src/services/automation/handlers/healing/healingHandler.js.

## Notes
- PASS-subset criteria explicitly say "no FP spend … = FAIL" — FP spend is exact-zero here.
- CLA-144 (flurry-replacement variant) remains separately filed; its unresolved-WIS flaw did NOT
  carry into this lane — WIS resolved numerically (+7) in both rolls.
- Control probe (0 FP refusal) untestable: FP gate dead due to skip bug above.
- No ability_use log for standalone HoH; only hp_change is logged.
