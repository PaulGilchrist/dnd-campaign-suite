# bug-mon-MA-0523-couatl-constrict-half-leak-on-save-success

- Row: MA-0523 Couatl Constrict (save, DC 15 Strength, 1d6 + 5 Bludgeoning, Grappled escape DC 13 + Restrained until grapple ends)
- Verdict: FAIL(a) — half damage leaks on RAW save success
- Date: 2026-09-19 (test-campaign, :5173, EB join Couatl 1 + Bandit 1, Bandit staged 999 via /combatSummary)

## Leg 1 — Disk shape (public/data/monsters.json Couatl.actions[1])
- Authored: save_dc 15, save_type Strength, range "5 feet", damage_dice_primary "1d6 + 5", damage_type_primary Bludgeoning, save_effect prose (Grappled escape DC 13 + Restrained until grapple ends).
- ABSENT: `dc_success` (no half-on-success clause in prose → RAW success pays ZERO), `escape_dc`, `statusEffects`, `conditions` array, `hit_conditions`.

## Leg 2 — Live saves (victim Bandit 1, STR save +0, raw d20 both sides)
- Cast 1: nat 5 FAIL → save-damage rolls [4] total 9 (1d6+5), hp_change −9 exact full == |hpΔ| ✓
- Cast 2: nat 16 SUCCESS vs DC 15 → save-damage total 4 (half of 9 floored, saveSuccess:true), hp_change −4 → **RAW-ZERO VIOLATED = FAIL(a)**. Cause: `dc_success` unauthored → default `'half'` (MonsterCardModal.jsx:682 `action?.dc_success ?? 'half'`). MA-0514/MV-20 fingerprint.
- Cast 3: nat 11 FAIL → rolls [1] total 6, hp_change −6 exact full ✓
- lastAttack: saveResult "failure", saveDc 15, saveType Strength ✓; chip "DC 15 Strength" renders and fires.

## Leg 3 — Adjudication on fails
- Grappled + Restrained: LANDED — change-data `Bandit 1.activeConditions = [grappled, restrained]`, `condition applied` log (condition "Grappled, Restrained", source Couatl 1, ability Constrict) ×2 fails; NOT granted on success (correct subset).
- escape_dc 13 stamp: ABSENT — no escapeDc in activeConditionMeta/lastAttack; save path has zero escape_dc consumers (hit-clause seam only, MonsterCardHelpers.js:532 / handlePlainDamage.js:483). Meta-dc unrepresentable (MA-0514 precedent).
- Duration "until grapple ends": advisory TEXT ONLY — activeConditionMeta.durationNote "until the grapple ends (GM-enforced)"; no expiry clock/anchor (grapple state-machine zero producers, playbook §70 accepted-advisory class).

## Defect count: 1 primary + 2 sub
1. FAIL(a) DATA: `dc_success` unauthored → half-leak on success (−4 paid vs RAW zero).
2. Sub: `escape_dc: 13` unauthored + no save-path escape_dc consumer → unrepresentable.
3. Sub: no grapple expiry clock; duration is GM-enforced advisory note only.

## Fix
DATA: author `dc_success: "none"` on Couatl Constrict (MA-0481 byte-shape family; honest copy both surfaces — popup + log). escape_dc/grapple-clock = separate ticket-class (no consumer app-wide; do not rebuild without ticket).

## Cleanup verified
Admin clear-change-data + clear-log both 200 via page.evaluate; own curl re-verify: change-data keys [] , log len 0.
