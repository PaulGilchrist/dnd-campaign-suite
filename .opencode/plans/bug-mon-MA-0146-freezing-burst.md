# Bug MA-0146 — Adult White Dragon "Freezing Burst" (legendary AoE-save): Speed-0 effect never applied; sphere degrades to single-target; ungated by legendary budget

**Verdict: FAIL** (clickable + DC/type/damage/half-on-save exact — but the authored failed-save "Speed is 0" effect has ZERO producer and applies nothing; 30-ft sphere collapses to single armed target; repeat-fire ungated, no legendary uses — MV-31/MV-21/MV-17+MA-0145 composite fingerprint)

## Row
- MA-0146 · Adult White Dragon (`adult-white-dragon`) · `legendary_actions[1]` "Freezing Burst" · category: legendary_actions · actionType: aoe-save · expected DC 14 Constitution.
- monsters.json (`adult-white-dragon.legendary_actions[1]`, read 2026-09-14): keys `[description,name,save_dc:14,save_type:"Constitution",damage_dice_primary:"2d6",damage_type_primary:"Cold",save_effect]`. Text: "Constitution Saving Throw: DC 14, each creature in a 30-foot-radius **Sphere** centered on a point the dragon can see within 120 feet. **Failure:** 7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. Failure or Success: The dragon can't take this action again until the start of its next turn."
- CLICKABLE: YES — numeric `save_dc` + dice render affordances (MV-23 exception): live card row exposes `span.mc-dice-link` "2d6" + `span.mc-dice-link-save-clickable` "DC 14 Constitution".

## Expected
AoE sphere picker at DC 14 CON; fail = full 2d6 cold + Speed 0 until end of target's next turn (te/condition with expiry); success = half damage; once per dragon-turn (legendary gating; MA-0145 header `uses` absent is that row's bug, but the row's OWN "can't take this action again until the start of its next turn" latch should hold).

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: clean baseline (change-data `{}`, log `[]`). EB search "Adult White Dragon" → Join → `Adult White Dragon 1` init 14, hp 200/200, AC 18 (single instance). Header verified test-campaign.
- Card overlay: Freezing Burst row clickable — exactly 2 affordances ("2d6", "DC 14 Constitution"); NO AoE/sphere picker affordance.
- Fire #1 (target armed ElderPaladin): prompt "ElderPaladin must make a CONSTITUTION saving throw. DC 14. Half damage on successful save" — **single-target save, no sphere area picker** (`breathAoeShape` MonsterCardModal.jsx:45 matches only Cone/Line; "Sphere" → null → generic single-target handleSaveRoll path). Save 25 vs 14 SUCCESS → save-damage log formula "2d6" rolls [2,3] total **2** (5 halved floor) + hp_change −2. Half-on-save math EXACT.
- Failure branch (re-armed AberrantSorcerer, +4 save; 4 SAVE FAILUREs, totals 12/7/13/7 vs DC 14): full damage applied EXACT — failed-save save-damage logs carry FULL roll totals 7/9/8 (formula "2d6", rolls [1,6],[4,5],[4,4]) matching hp_change deltas −7 (35→28), −9 (28→19), −8 (13→5); final 11-total roll killed at 5→0 (+1 tail on the death flow). Success legs halved exactly (floor). DC/type/damage/half all correct.
- **EFFECT NOT APPLIED:** after 4 failed saves: `AberrantSorcerer.activeConditions: []`, `activeConditionMeta: null`, per-char and top-level `targetEffects` absent/null, campaign log **zero** condition/speed entries. "Speed is 0" is absent from `extractConditionsFromSaveEffect` CONDITIONS vocabulary (MonsterCardHelpers.js:40 — canonical conditions only) → `saveConditions: []` captured in lastAttack, nothing written. No monster-save-path `speed_zero` producer exists (only Sentinel handlePlainDamage.js:32, HypnoticPatternModal, MA-0010 hit-clause — none reachable from this row). Fails MV-31/MV-9 bar.
- **UNGATED:** 14 fires across the same initiative window (6+8 clicks, dragon never acted, no turn walk) — every click opened a fresh DC 14 prompt, resolved, dealt damage. Zero refusals, zero `*_refused`, zero legendary/regain log entries; `monsterLegendaryUses` key never created (header row lacks `uses` — MA-0145 fingerprint). Row's own "can't take this action again until the start of its next turn" latch: no round latch producer (grep zero for any Freezing Burst latch).
- Control: Rend "+11" `.mc-dice-link` live → popup "✓ HIT (14 vs AC 9)" — engine alive; the row-specific effect/gate/AoE layers are the gap.

## Root cause / Likely location
1. **Effect (primary):** `src/components/encounter/MonsterCardHelpers.js:40` CONDITIONS list has no speed-zero vocabulary; no clause parser like MA-0038's `parseConcentrationDisadvantageClause` exists for "Speed is 0"; consumer EXISTS (`speed_zero` activeCondition + te consumed by conditionEffects.js:179/charSummaryCalc.js:109/MonsterCardBody speedZero) — fix = clause parse + `speed_zero` condition/te write with `until_start_of_next_turn` expiry (CLA-342/334 addExpiration shape) on failed saves in the monster save resolution seam.
2. **AoE:** `MonsterCardModal.jsx:45 breathAoeShape` matches Cone|Line only — extend to Sphere/radius so the SaveAttackAoeModal multi-target picker (MA-0031) engages for this row.
3. **Gating:** row-level once-per-turn latch has no producer; legendary budget ungated upstream (MA-0145 data fix `uses:3` on header carries it once authored — header still lacks `uses`).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult White Dragon" → Join (lands init 14, hp 200).
2. Arm ElderPaladin on dragon card → open `.mc-overlay` → Freezing Burst row shows "2d6" + "DC 14 Constitution" links; click save link → single-target DC 14 CON prompt (no sphere picker) → success halves exactly.
3. Re-arm AberrantSorcerer → loop click→Roll Save: failed saves deal full 2d6 (hp deltas match totals) but activeConditions stay `[]`, no te, no condition/speed log — Speed 0 never lands.
4. Same-turn spam x8: all fire, no refusal, `monsterLegendaryUses` never in change-data, log zero refusal/regain.
5. Control Rend "+11" hits normally.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. Manifest `verified` untouched. Registry untouched (orchestrator owns; Adult White Dragon re-entry noted by MA-0145).
