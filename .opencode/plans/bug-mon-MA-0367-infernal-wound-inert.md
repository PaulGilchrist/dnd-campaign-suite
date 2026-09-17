# Bug — MA-0367: Bearded Devil "Infernal Glaive" infernal wound never recorded + no start-of-turn bleed tick (save-leg damage-only; wound clause prose-inert)

Verdict: **FAIL** (core THEN-clause mechanic advertised, zero wound state lands; MA-0320/MA-0366 prose-inert class with additional save-semantics mismatch)
Date: 2026-09-17 | Campaign: test-campaign ONLY (header verified at every step; native confirms echoed "test-campaign")

## Row
- MA-0367 | Bearded Devil (monsterIndex `bearded-devil`) | actions[2] `Infernal Glaive` | attack+save
- +5 to hit | 1d10 + 3 Slashing | reach 10 ft | THEN (if no existing wound): CON save DC 12 → FAIL: infernal wound, loses 1d10 (5) HP **at start of each of its turns**; closes after 1 min / any healing / DC 12 WIS (Medicine) action.

## Disk keys dump (read-only) — monsters.json actions[2]
Keys present: `name`, `description`, `attack_bonus` 5, `reach` "10 ft.", `save_dc` 12, `save_type` "Constitution", `damage_dice_primary` "1d10 + 3", `damage_type_primary` "Slashing", `save_effect` (full wound prose).
**Absent:** any structured wound key — no `hit_target_effect`, `hit_conditions`, wound te, bleed die, expiry, or medicine-DC field. Wound exists solely as prose inside `description`/`save_effect`.

## Grep — wound/bleed/turn-start consumers (pre-live, ground truth)
- `rg -il "infernal.?wound|infernalWound" src/ server/` → **0 hits** (only unrelated Fiendish Legacy "infernal" matches).
- `rg -in "wound|bleed" src/services/combat/conditions/targetEffectDefinitions.js src/services/rules/effects/turnStartEffects.js` → **0 hits**: no registered infernal-wound te, no turn-start bleed consumer.
- `src/components/encounter/MonsterCardHelpers.js` failed-save clause parsers: concentration-disadvantage (MA-0038), speed_half (MA-0073), speed_zero (MA-0146), subtract-die (MA-0093), weakening-breath (MA-0102), push, success-immunity (MA-0030) — **no wound parser**. `extractConditionsFromSaveEffect` (line 194) matches only canonical CONDITIONS list; "infernal wound" is not canonical → `[]`.
- `src/hooks/combat/saveProcessing.js` failed-save grants: hardcoded per-MA branches listed above + MA-0017 conditionless-save conditions. No wound/bleed grant branch; `rg -in "wound|bleed|startOfTurn|turnStart" saveProcessing.js` → 0 hits.

## Live evidence (localhost:5173, target HexWarlock AC 9, CON 10 → save +0)
EB "Bearded Devil" exact → Join → cs armed via POST `/api/campaigns/test-campaign/combatSummary` `{value:cs}` (note: `/change-data` is GET-only; first whole-payload POST to it landed under literal `change-data` key — deleted, re-POSTed correctly). Curl-verified: `Bearded Devil 1` ac13 hp58/58 init5 **targetName=HexWarlock**; HW target combobox = HexWarlock; sheet HP 73 max.

Fired Infernal Glaive "+5" chip ×2 (popup cycles §290-292, full dismiss both stages MA-0273):
1. d20 nat 18 +5 = **23 vs AC 9 → HIT** → save-prompt log (formula 1d10+3, dcSuccess half) → "Saving Throw Required" modal Roll Save → nat 17 +0 = 17 **SUCCESS** → save-damage finalDamage **2** (half of 5, rounded down) → hp_change −2 → HP 71/73 ✓
2. d20 nat 8 +5 = **13 vs AC 9 → HIT** → save nat 3 +0 = 3 **FAILURE** vs DC 12 → save-damage finalDamage **5** = full 1d10+3 [2+3] → hp_change −5 → HP 66/73 ✓

Damage legs exact both sides (+5 vs AC 9 flip: nat≥4 hit ✓; half-on-success/full-on-fail ✓ per engine's dcSuccess:'half' block model).

## FAILED-save wound probe (curl change-data — truth)
After the confirmed failed save on HexWarlock:
- `HexWarlock.activeConditions`: **null**; `activeConditionMeta`: **null**
- `HexWarlock.statusEffects` / `targetEffects`: **null**; `pendingExpirations`: **[]**
- No `wound` / `infernal_wound` / `bleed` / `startofturn` keys anywhere in the payload (needles occur ONLY inside action description/save_effect prose strings).
- **No wound state of any shape recorded.**

## Start-of-turn bleed tick test
Advanced initiative (GM "Next →") until `activeCreatureName: "HexWarlock"` (HW turn start, round 1). Post-settle curl: HP still **66**, no hp_change, zero log entries containing bleed/wound/turn-tick. **No 1d10 bleed tick fires** — impossible by construction (no wound record, no turnStart consumer).

## Close-condition tracking
1-minute expiry, "closes on healing", and DC 12 WIS Medicine action are unbacked: no te/expiry written, nothing to close.

## Secondary defect (save-semantics mismatch)
Engine models this save as damage-mitigating ("Half damage on successful save" modal text; success applied half damage −2). RAW for this row: the Glaive hit deals full 1d10+3 regardless; the DC 12 CON save is **only** vs the infernal wound. MA-0365 precedent recorded this 'half' block as PASS under MV-3, but for this row it both under-damages on success (−2 instead of full) and misrepresents the save's purpose.

## Log audit (pre-cleanup, 12 entries)
encounter joined → initiative → attack nat18 → save-prompt (half) → save nat17 success → hp −2 → save-damage fd2 → attack nat8 → save-prompt → save nat3 failure → hp −5 → save-damage fd5. Zero condition/effect/wound/tick rows.

## Conclusion
Attack+save seam and damage math live and exact, but the advertised core THEN-clause — infernal wound with recurring 1d10 start-of-turn bleed — never lands: no wound te/condition/meta/expiry recorded on a failed save (live curl truth), no turn-start tick (live turn advance), and no wound/bleed consumer exists anywhere in `src/` (grep-evidenced). monsters.json `save_effect` wound prose has no parser; `saveProcessing.js` failed-save branches have no wound grant. **NO wound-state at all = FAIL** per criteria.

## Fix surface (not applied — no edits to monsters.json/docs per task rules)
1. Author structured wound key (e.g. `hit_target_effect: "infernal_wound"` + bleed die/expiry/medicine-DC fields) on bearded-devil actions[2].
2. Register `infernal_wound` te in `targetEffectDefinitions.js` with turn-start bleed group; consume in `turnStartEffects.js` (1d10 HP loss at start of target's turn).
3. Add wound clause parser in `MonsterCardHelpers.js` + grant branch in `saveProcessing.js` failed-save seam (MA-0073/MA-0146 shape); honor close conditions (1-min expiry, healing-removal, Medicine DC12 action).
4. Fix save-leg semantics for this row: save vs wound only, attack damage never halved.

## Cleanup verified
Admin native confirms ("test-campaign") for Clear Change Data + Clear Campaign Log; curl read-back: change-data `{}`, log `[]`.

## Status
COMPLETE — VERDICT **FAIL**.
