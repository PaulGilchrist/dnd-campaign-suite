# CLA-339 — Stroke of Luck — VERDICT: PASS

Date: 2026-10-09 · Host: AasimarTest (test-campaign ONLY, header verified `test-campaign` after select) · Supersedes prior FAIL row (manifest/registry 2026-09-06 note).

## Feature data (quoted)
`public/data/2024/classes.json` → Rogue, class_levels lv20:
> "Stroke of Luck" — "If you fail a D20 Test, you can turn the roll into a 20. Once per Short or Long Rest."
> automation: `{ type: "stroke_of_luck", target: "d20", casting_time: "passive", recharge: "short_or_long_rest" }`

**Home = BASE Rogue lv20 (universal), NOT a Thief major.** No subclass swap required; Arcane Trickster lv20 host qualifies as-is (2024 PHB lv20 matches). Task's "Thief lv13" hypothesis refuted by this app's data.

## Code map (grep `strokeOfLuck|stroke_of_luck`)
- Collector/modifier: `automationModifiers.js:97` → `effect:'stroke_of_luck'`
- ce flag: `conditionEffectsInternal.js:278/378` → `effects.strokeOfLuck=true`
- Check popup carry: `CharAbilities.jsx:88` BOOLEAN_CHECK_FEATURE_FLAGS; save popup `:166`
- Offer gate: `DiceRollResult.jsx:465` `show: p.strokeOfLuck && !s.strokeUsed && s.isD20 && s.d20TestFailed` (fail-only — **Sept no-`!hit`-gate bug fixed**)
- Convert+spend: `DiceRollResult.jsx:1021-1025` (separate `strokeUsed` vs `boonUsed` — **Sept boonOfCombatProwess collateral bug fixed**)
- Spend log: `CharSheet.handlers.js:75-93` (ability_use, `strokeOfLuckUsed=true`) — **Sept "popup-only, zero log" bug fixed**
- Latch suppress: `CharSheet.conditionEffects.js:57-59`; re-arm: `restRules-constants.js:85` (SHORT) + `:133` (LONG)
- Combat backstop reset: `useInitiativeEffects.js:102`

## Live ledger (change-data + log GET ground truth)
1. Feature row "Stroke of Luck:" renders on lv20 sheet ✓
2. Acrobatics check d20 9 +2 = 11 (fail) → popup carries "Stroke of Luck" `.dice-roll-reroll-btn` ✓
3. Spend → popup "d20 20 (Stroke of Luck) +2 … total 11 → 22" ✓; `strokeOfLuckUsed:true` latched ✓; log `ability_use` "…Acrobatics: d20 9 → 20 (total 11 → 22)." ✓
4. Control re-roll after spend → **no button** (latch holds) ✓
5. Short Rest ("Complete Short Rest") → `strokeOfLuckUsed:null` + re-offer renders ✓ = SR re-arm exact (data says short OR long rest)
6. Attack lane vs rigged NPC 1: **HIT (14 vs AC 8) → no SoL offer** (fail-only gate proven on adjudicated success) ✓ — this was the 2026-09-06 FAIL(a), now fixed
7. AC-rig 30 → MISS popup (28 vs AC 30) → SoL offered → click → "✓ HIT (28 vs AC 30) Stroke of Luck: d20 → 20 + 8 = 28" ✓; latch re-stamped ✓; second `ability_use` log line exact ✓
8. No boon collateral: `_Boon_of_Combat_Prowess_usedRound:null`, `boonOfFateUsed:false` after SoL spends ✓

## Advisory residuals (non-gating)
- DC-less sheet check cells: `computeD20TestFailed` (DiceRollResult.computed.js:67) returns `success !== true`, so unresolved DC-less rolls (even nat 19) are treated as failed and the offer appears. No DC ground truth exists in-app → fold-by-data advisory (CLA-270 family); adjudicable lanes (attack/computedHit, saves/saveResult) gate correctly per §6-7.
- AC-rig artifact: nat-20 vs AC 30 printed "✗ MISS" (attackCalc lacks crit-auto-hit) — rig artifact, outside CLA-339 scope; SoL math itself honest ("d20 20 → 20").

## Cleanup proof
- Admin clear: `POST /admin/clear-change-data` + `/admin/clear-log` → GET `change-data {}`, `log count 0` ✓
- EB NPC 1 + combat residue cleared with cs wipe; campaign deselected ("Select a Campaign" heading shown) ✓
- Subclass restore: **not required / not performed** — no wizard ran. Disk proof: `AasimarTest.json` = lv20, rules 2024, class Rogue, **subclass Arcane Trickster**, mtime 2026-10-09 10:58 (predates run) ✓ — CLA-376 AT lv13 lane intact.

## Console
1 pre-existing error only (featFinder probe family, seen in prior sessions); not SoL-related.
