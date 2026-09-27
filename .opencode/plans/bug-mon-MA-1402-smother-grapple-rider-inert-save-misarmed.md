# BUG MA-1402 — Rug of Smothering / Smother (actions[0]) — FAIL(a)+FAIL(b)/DATA

**Verdict: FAIL** (mis-resolved lanes + inert-unauthored grapple rider)
**Date:** 2026-09-27 · **Campaign:** test-campaign only · **Board:** Rug of Smothering 1 (idx rug-of-smothering) + Bandit 1 (idx bandit, AC12, HP rig 999)

## Row under test (disk verbatim, public/data/monsters.json → rug-of-smothering.actions[0])
```
name "Smother" | attack_bonus 5 | reach "5 ft."
save_dc 13 | save_type "Strength" | save_effect "The target is grappled (escape DC 13). Until this grapple ends, the target is restrained, blinded, and at risk of suffocating, and the rug can't smother another target. At the start of each of the target's turns, the target takes 10 (2d6 + 3) bludgeoning damage."
damage_dice_primary "2d6 + 3" | damage_type_primary "Bludgeoning"
```
**ABSENT: `hit_conditions`, `escape_dc`, `hit_target_effect`, `hit_condition_roll`.**

## RAW
Attack that **grapples on hit** (escape DC 13 = STR escape of the resulting grapple). **No hit-save exists.** **Zero immediate on-hit damage**; 2d6+3 is DoT at start of each of the target's turns.

## Defect axes
1. **FAIL(b)/DATA — hit-clause rider inert-unauthored.** `buildHitConditionClause` (MonsterCardHelpers.js:673) reads only `hit_conditions`/`hit_target_effect`/`hit_condition_roll` → NULL for this row. LIVE proof: 5/5 attack hits (`2d6 + 3` fd 12, 11, 9, 12, crit `2d6*2+3` fd 17) granted **ZERO conditions**; victim change-data `Bandit 1` key ABSENT through all hits (§1116 strictest zero-proof); zero escape-DC surface, zero badge-save seam. §59/§153/§495; MA-0909/MA-0877/MA-1274 live-unarmed family.
2. **FAIL(a)/DATA — wrong-slot save lane mis-armed (MA-1329/§410 family).** `save_dc:13+save_type+save_effect` authors a LIVE hit-save that RAW lacks. `isCompositeAttackSaveRow` :919 TRUE; ActionSaveRoll rollable branch (MonsterAction.jsx:131-142) renders `2d6 + 3` AND `DC 13 Strength` **both wired to handleSaveRoll** (both classes `mc-dice-link-save-clickable` observed live; `plan.clickable` fork only gates the non-rollable branch). LIVE proof: save-chip press → `roll/save` "Smother" saveDc:13 STR saveResult:"failure" → `save-damage` fd **14** full → `condition` entry **"Blinded, Grappled, Restrained"** + victim `activeConditions:['blinded','grappled','restrained']`+`meta.source` — the condition suite is granted by SAVE FAILURE, untethered from attack outcome (a missed attack could still "smother"; a hit grants nothing). `meta` carries NO `dc` field → escape_dc channel unarmed; `dc_success` unauthored → success leg would pay HALF of RAW-nonexistent damage (§523/§809 convention; fail-leg 14 full observed).
3. **Damage misfiled — DoT dice pays as on-hit.** `damage_dice_primary "2d6 + 3"` (RAW: target-turn-start DoT) rides the +5 attack chip FULL ungated on every hit (MA-0551 fork) = 44 immediate damage across 4 pre-crit hits that RAW says is zero immediate. MA-1329 composite shape.
4. **§70/§87 advisory residuals (honest, do NOT count as defects):** recurring start-of-turn 2d6+3 tick (explicit-te rule MA-0367), suffocation, "can't smother another target", grapple state machine (MA-0287/0288/0354; registry MA-0287 animated-rug twin already BROKEN-documented).

## Ledger (8 attack presses + 1 save-chip press)
- to-hit flips (nat / vs AC12): 12→17✓, 10→15✓, **2→7✗**, **6→11✗ (exact boundary-miss face)**, 18→23✓, 11→16✓, 20→25✓ CRIT, 2→7✗. (nat7→12 boundary-hit face unrolled; self-consistent §260.)
- per-hit rider grant set: **∅ ×5** (only grants in whole log = the single save-lane triple-grant).
- hp ledger: 999→987→976→967→955 (fd 12/11/9/12 resisted:false) →941 (save-fail 14) → crit 17 (formula `2d6*2+3 (5, 2)`, flat +3 undoubled §32).
- miss legs: 3/3 zero damage, zero conditions. Console errors: 0.

## Recommended fix (DATA-only, zero code)
- **Add** `hit_conditions:["grappled","restrained","blinded"]` + `escape_dc:13` (MA-1274 otyugh byte-shape; MA-0927 escape bundle). Grant reason will render "(escape DC 13)" + meta {dc:13, ability:'str', source}.
- **Remove/neutralize the hit-save slot:** drop `save_dc`+`save_type` (escape_dc now carries the 13) — else DC-chip double-adjudicates (§410); or keep prose in `description` only.
- **Remove `damage_dice_primary`** (RAW zero immediate on-hit damage); start-turn 2d6+3 stays §70 advisory until a recurring-tick te consumer exists (MA-0367 template).
- Size-gate caveat for fixers: consumer gate is `isLargeOrSmallerTarget` (admits Large) vs RAW "Medium or smaller" (§477) — accepted family precedent.

## Census note (MA-1397 retraction)
Prior census listed "Rug of Smothering (13)" among the 7 ARMED `hit_conditions+escape_dc` twins — **FALSE on disk**: the (13) is `save_dc`, not `escape_dc`. Armed twins remain MA-1274 otyugh (escape_dc:13) and giant-crocodile (escape_dc:15).

## Cleanup
Conditions removed from Bandit 1 post-audit; Admin-clear change-data + log; board cleared.
