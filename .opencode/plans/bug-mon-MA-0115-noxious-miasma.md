# Bug MA-0115 — Adult Green Dragon "Noxious Miasma": half/full damage correct, but −2 AC fail-clause never applied and no uses/self-recharge gate

**Verdict: FAIL** (save core PASS; fail-clause te producer absent = MA-0090 fingerprint; uses/self-recharge gate absent = MA-0113 fingerprint; AoE sphere collapses to single-armed-target)

## Row
- MA-0115 · Adult Green Dragon (`adult-green-dragon`) · `legendary_actions` · actionType: aoe-save · DC 17 Constitution · 2d6.

## Data check (monsters.json, read 2026-09-14)
`legendary_actions[2]` Noxious Miasma: `save_dc: 17`, `save_type: "Constitution"`, `damage_dice_primary: "2d6"`, `damage_type_primary: "Poison"` — all match row.
**Row-description drift (noted, non-fatal):** row guesses "Poisoned condition on fail"; actual data fail-clause is **"the target takes a −2 penalty to AC until the end of its next turn"** — no Poisoned condition anywhere in the text. Success = half damage. Self-recharge prose in description ("The dragon can't take this action again until the start of its next turn") but **no `recharge` and no `uses` field authored** → ungated by design of the data-gated engines (MA-0113: header row also lacks `uses: 3`). Area = 20-ft-radius Sphere, point seen within 90 ft.

## Expected
DC 17 CON save per creature in area; fail = full 2d6 Poison + −2 AC penalty until end of target's next turn; success = half; action unusable again until dragon's next turn start.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
Setup: EB search "Adult Green Dragon" → tick → Join Encounter (dragon cs idx 0, init 14, hp 207, ac 19); armed ElderPaladin (server-verified cs[0].targetName). First click without armed target correctly refused ("no target is armed" popup — target gate live).
- **No AoE sphere picker**: clicking `span.mc-dice-link-save-clickable` "DC 17 Constitution" opened a **single-target** "Saving Throw Required — ElderPaladin… DC 17 / Half damage on successful save" prompt straight away; `.secondary-target-row` picker never rendered → "each creature in a 20-foot-radius Sphere" resolved for the armed target only.
- Fire 1: save 11+10=21 SUCCESS; log `save-damage` 2d6 [5,6]=11 → `finalDamage:5` (half floor), hp −5. ✓ half
- Fire 2 (same turn, activeCreatureName=AasimarTest unchanged): prompt opened again, 19+…=29 SUCCESS, [5,2]=6→half 3. ✓ ungated
- Fire 3 (same turn): 9+10=19 SUCCESS, [2,2]=4→half 2. ✓ ungated
- Fire 4 (same turn): **2+10=12 FAILURE**; `save_result` success:false DC 17 Constitution; `save-damage` 2d6 [5,4]=9 → `finalDamage:9` FULL, hp −9 (214→205). ✓ DC/type/dice/half/full all exact
- **Fail-clause NOT applied**: post-fail change-data `targetEffects:null`, `targetEffects-ElderPaladin:null`, zero condition/AC-penalty keys; no badge on card. −2 AC penalty = zero state, zero log.
- **Gate NOT enforced**: 4 full firings in one turn (fires 2–4 ungated); zero refusal log; no `monsterLegendaryUses`/recharge key created anywhere (change-data sweep empty).

## Root cause / Likely location
1. **Fail-clause te producer gap (MA-0090 fingerprint):** `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:53) matches canonical CONDITIONS only — "−2 penalty to AC" matches none; text has no "poisoned" token either, so `saveConditions=[]` and `SaveAttackAoeModal.applySaveFailConditions` (:361) is byte-inert. Registry entry `ac_penalty` exists (targetEffectDefinitions.js:805, defaults value:2) with a live consumer (conditionEffects.js:519 accumulates `acPenalty`), but **grep: zero producers write `effect:'ac_penalty'`** outside the Slow spell path (which deliberately avoids it, slowHandler.js:89). No clause parser maps "penalty to AC" → ac_penalty te.
2. **Uses/self-recharge gate gap (MA-0113 fingerprint):** header row lacks `uses` → `monsterLegendaryUses.js:127/:145` economy never engages; description prose "can't take this action again until the start of its next turn" has no consumer (grep: no parser for that clause anywhere in src). Row routes to generic ungated `handleSaveRoll` (MonsterCardBody.jsx:57 fallback, `legendaryGate` only on the gated branch :55).
3. **AoE→single-target:** generic save-roll path uses cs.targetName only; no `.sp-overlay` `.secondary-target-row` picker for sphere rows with authored save_dc (contrast §4 AoE picker / MA-0031 cone picker which works for breath rows with `recharge`).

## Steps to Reproduce
1. test-campaign → Encounters → search Adult Green Dragon → tick → Join Encounter.
2. Arm a PC on the dragon's initiative card; open dragon card; click "DC 17 Constitution".
3. Single-target prompt appears (no sphere picker); Roll Save ×N until a fail — fail deals full 2d6 but applies no −2 AC te; repeat clicks all fire same turn, no refusal.

## Notes / fix recipe
- Producer needed: parse AC-penalty clause in save_effect → push te `{effect:'ac_penalty', value:2, duration:'until_start_of_next_turn'}` at saveProcessing/applySaveFailConditions; consumer already live. Expiry seam caveat §7 (`until_start_of_next_turn` often lacks registrant).
- Gate: author `recharge` semantics or a `oncePerTurn`-per-dragon-turn latch on the row (MA-0021/MA-0031 engines exist; both data-gated on absent fields).
- Row manifest description should be corrected: fail-clause is −2 AC penalty, NOT Poisoned.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits.
