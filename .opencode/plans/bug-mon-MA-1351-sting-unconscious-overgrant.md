# bug-mon-MA-1351 — Pseudodragon Sting: Unconscious granted ungated (fail-by-5 band in save_effect, no save_margin)

**Row:** `pseudodragon|actions|2` Sting (public/data/monsters.json actions[2]) — FAIL(b)/DATA (MA-1344/MA-0904 over-grant shape)
**Date:** 2026-09-26 · test-campaign · localhost:5173

## Disk (truth)
- `save_dc:12`, `save_type:"Constitution"`, `damage_dice_primary:"2d4"`, `damage_type_primary:"Poison"`, `dc_success` ABSENT (half-on-success = §523 app convention, ticket-prescribed).
- `attack_bonus:0` junk → spurious "+0" chip §490 (unpressed). Triple-chip §409/§705 confirmed live: `+0` + `2d4` + `DC 12 Constitution` (save-clickable) — DC chip only pressed; zero attack/damage-log entries whole session.
- `save_effect` == `description` byte-identical, carries BOTH bands incl. "`<strong>Unconscious</strong>`".
- No structured fields: `save_margin` / `fail_by` / `fails_by` grep-ZERO across whole pseudodragon block; `rg "Failure by" src/ -g '!*.test.*'` = ZERO (no prose splitter).

## Defect
Magnitude machinery is LIVE but ARMED-ONLY-BY-STRUCTURED-KEY: `parseSaveMarginClause` (MonsterCardHelpers.js:332) reads `action.save_margin` only; consumer `applySaveMarginRider` (saveProcessing.js:665) applies `(saveDc − saveTotal) >= failsBy` gate with one merged rounds:600 clock — INERT here (no key).
Meanwhile the deep band lives inside `save_effect`, so `extractConditionsFromSaveEffect` (Helpers:341, word-boundary scan of the whole string; CONDITIONS includes poisoned AND unconscious) returns `["poisoned","unconscious"]` → `applyFailedSaveConditions` (saveProcessing.js:1043) grants BOTH on **ANY** failed save. The RAW margin gate ("Failure by 5 or more") is not merely unbuilt — it is bypassed: the app over-applies Unconscious.

## Live evidence (Bandit AC12 con+1 unpadded, own-card armed, inline seam)
- 11 presses DC chip → 11 saves / 11 save-damage / 11 hp_change (1:1, zero absorb, zero double-apply).
- **Fail-by-<5 over-grant (decisive):** totals 9 (margin 3), 10×3 (margin 2), 8×2 (margin 4) → every fail leg logged `condition applied "Poisoned, Unconscious"`; `lastAttack.saveConditions:["poisoned","unconscious"]`; Bandit activeConditions `["poisoned","unconscious"]` + per-cond meta.source. RAW: fails-by-1..4 = Poisoned ONLY.
- **RAW-correct-by-coincidence:** total 7 (fail by exactly 5) and total 4 (fail by 8) both grant both bands — same ungated path.
- **Core exact:** DC 12/CON stamped every leg; boundary total 12 = SAVE SUCCESS (tie-to-target); fail legs full rolled (2/7/8/7/4/3/3 = raw dice); success legs half floor (rolls [2,1]→1, [1,2]→1×2, [4,4]→4), zero condition entries on success. Σ|hpΔ| 41 == Σfd 41, chain 999→958 unclamped.
- Duration: meta.durationNote = "until it takes damage or … shake it awake (GM-enforced)" — the UNCONSCIOUS clause stamped on BOTH conditions; "Poisoned for 1 hour" never reaches Poisoned meta (§70 advisory + mislabel); no addExpiration clock (legacy fail-save grant shape, byte-identical MA-0063 family).
- Console 0 errors.

## Fix (zero code, MA-1000/MA-0642 byte-shape, Drow Hand Crossbow MA-0639 twin)
1. Truncate `save_effect` to SHALLOW band only: `"Failure: 5 (2d4) Poison damage, and the target has the <strong>Poisoned</strong> condition for 1 hour."`
2. Add `save_margin: { "fails_by": 5, "also": "unconscious" }` → rides live applySaveMarginRider (margin-gated grant + one merged rounds:600 clock covering both legs; "shake awake"/wake-on-damage stay §70 advisory).
(description byte-unchanged; rider refuses on success and on margin<5.)

## Adjudication
Not §MA-1347 movement-gated advisory (no movement gate). Not zero-consumer inert: an existing consumer actively misapplies a discrete-condition grant against its RAW gate = implemented-but-skippable → FAIL(b)/DATA. PASS-subset denied per §11 (ungated gate fires).

## Cleanup
admin-clear log+change-data, quiet-recheck 12s clean; cs left: Pseudodragon 1 + Bandit (per registry pattern).
