# Bug MA-0138 — Adult Silver Dragon "Cold Gale": DC/type/dice/half correct + line picker live, but push fail-clause never applied and no uses/self-recharge gate

**Verdict: FAIL** (save core PASS — DC/type/damage/half exact with working 60-ft Line picker; push fail-clause te producer absent = MA-0090/MA-0115 fingerprint; self-recharge/legendary-uses gate absent = MA-0136/MA-0113 fingerprint; row save_type drift noted)

## Row
- MA-0138 · Adult Silver Dragon (`adult-silver-dragon`) · `legendary_actions` · actionType: aoe-save · row claims DC 19 Constitution · description admits "likely cold damage / knockdown / speed-halve effect".

## Data check (monsters.json, read 2026-09-14)
`legendary_actions[2]` Cold Gale: `save_dc: 19`, `save_type: **"Dexterity"**` (row's "Constitution" is drift — DEXTERITY proven live, MA-0115 precedent: drift noted non-fatal), `damage_dice_primary: "4d6"`, `damage_type_primary: "Cold"`, `save_effect: "14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. Success: Half damage only"`.
Text: "Dexterity Saving Throw: DC 19, each creature in a 60-foot-long, 10-foot-wide **Line**. **Failure:** 14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. **Success:** Half damage only. Failure or Success: The dragon can't take this action again until the start of its next turn."
Clickable: YES — row carries `name` + numeric `save_dc`/dice → renders `span.mc-dice-link` "4d6" + `span.mc-dice-link-save-clickable` "DC 19 Dexterity" (live DOM: 2 interactive children). But header row `legendary_actions[0]` lacks `uses` (MA-0136) → generic ungated `handleSaveRoll` path (MonsterCardBody.jsx:57 fallback; gated branch :54 requires `legendaryHeader`).

## Expected
DC 19 DEX save per creature in 60-ft Line; fail = full 4d6 Cold + pushed up to 30 ft straight away; success = half (floor); unusable again until dragon's next turn start (self-recharge) and costs a legendary use.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
Setup: EB search "Adult Silver Dragon" → tick → Join Encounter (`Adult Silver Dragon 1` cs idx 0, init 5, hp 216); armed ElderPaladin via card `[data-testid="target-select"]` (server-verified cs[0].targetName). Baseline: change-data empty-ish pre-probe, log 0.
- Card overlay: Cold Gale row clickable ("4d6", "DC 19 Dexterity"). Click → REAL **60-ft Line AoE picker** (`.secondary-target-row` ×14, "Cold Gale (0)" disabled until pick) — line picker works here (contrast MA-0115 sphere collapse). Picker text: "Select creatures in the area of effect. Each must make a **Dexterity** saving throw (DC 19)… On a failed save, target takes 4d6 Cold damage. On a successful save, target takes half damage." NO mention of the push clause anywhere in picker/prompt.
- Fire 1 (ElderPaladin): prompt "DEXTERITY… DC 19… Half damage on successful save… Source: Adult Silver Dragon 1" → Roll Save → **SAVE FAILURE 13 vs DC 19** (d20 5 +8) → log `save_result` failure + `save-damage` 4d6 [1,5,1,6]=13 `finalDamage:13` **FULL**, hp −13 (224→211). ✓ DC/type/dice/half-on-success/full-on-fail exact.
- **Fail-clause NOT applied**: post-fail change-data `ElderPaladin.targetEffects:null`, `activeConditions:null`; zero push/position keys; zero movement/condition log lines. "pushed up to 30 feet" = zero state, zero log.
- Fire 2 (same turn — `activeCreatureName` still `AasimarTest`, dragon never acted): clicked "DC 19 Dexterity" again → picker opened again, no refusal popup → 8+8=16 **FAILURE** → 4d6 [5,2,4,1]=15 FULL, hp −15 (211→196). ✓ **ungated double-fire**.
- Gate sweep: change-data keys `[AasimarTest, ElderPaladin, __campaign__, __map__, activeCreatureName, combat-ui-viewingMonster*, combatSummary, lastAttack, pendingSaveListenerPrompts, saveResult-ElderPaladin]` — **zero keys containing "legendary"/"recharge"**; log holds only generic `ability_use` "Cold Gale: Selecting 1 target(s)…" ×2 + save-damage/hp pairs — zero refusal/regain entries.
- Control-probe Rend "+13": `mc-dice-link` → attack roll d20 13 +13 → **HIT (26 vs AC 19)** — attack/save engines alive; the row's fail-clause + gate are the unwired gaps.

## Root cause / Likely location
1. **Push fail-clause te producer gap (MA-0090/MA-0115 fingerprint):** `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:53) matches canonical CONDITIONS only — "pushed up to 30 feet" matches none → `saveConditions=[]` → SaveAttackAoeModal `applySaveFailConditions` byte-inert. Registry HAS `push` te (targetEffectDefinitions.js:815, defaults value:10), but grep: producers of `effect:'push'` exist ONLY in player-feature paths (combatSuperiorityUtils.js, openHandTechniqueHandler.js, weaponMasteryHandler.js, tavernBrawlerPush.js) and attackRiderHandler.js:529 ("just log and popup, no targetEffect — push is instant"). Zero monster-save-path producer parses a push clause; and no token-position consumer exists app-wide (§7: "NO grid token move — no position consumer exists"), so even a written te could not move tokens.
2. **Self-recharge/uses gate gap (MA-0136 fingerprint, re-proven):** header `legendary_actions[0]` lacks `uses` → `monsterLegendaryUses.js` header gate returns null → MonsterCardBody.jsx:54 gated branch not taken → Cold Gale routes to generic `handleSaveRoll` (:57 fallback); description clause "can't take this action again until the start of its next turn" has no consumer (MA-0113 grep: zero). Double-fire live.
3. **Row drift:** row manifest `saveType:"Constitution"` vs authoritative `Dexterity` (live prompt + log confirm DEX). Row description should be corrected.

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult Silver Dragon" → tick → Join Encounter (lands init 5, hp 216).
2. Arm a PC (ElderPaladin) on the dragon's initiative card; open dragon card; click "DC 19 Dexterity".
3. Line picker appears; tick target → "Cold Gale (1)" → Roll Save. On a fail: full 4d6 Cold lands but NO push effect/state/log.
4. Click "DC 19 Dexterity" again same turn (another creature still active): picker + save re-open, second full fire, no refusal, no counter, no `monsterLegendaryUses` key ever.

## Notes / fix recipe
- Producer needed: parse "pushed up to N feet" clause in `save_effect` → push te `{effect:'push', value:30, source:dragon}` via the MA-0038 clause-parse seam (MonsterCardHelpers.js `parseConcentrationDisadvantageClause` pattern) + advisory popup/log at `applySaveFailConditions`; instant-effect semantic (attackRiderHandler.js:529 precedent — log/popup only, no lingering te) is a valid minimum bar; GM adjudicates token move (picker already says "GM positions tokens").
- Gate: author `uses: 3` on header row → MA-0021 economy + self-recharge latch activate unchanged (MA-0031 recharge engine precedent for per-row latch if header stays unamended).
- Correct row manifest: saveType = Dexterity; effect = 4d6 cold + push up to 30 ft (not knockdown/speed-halve).

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data empty + log `[]`. No manifest `verified` edits. Registry not modified (orchestrator owns registry/manifest).
