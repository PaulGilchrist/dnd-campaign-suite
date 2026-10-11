# MA-1901 — Garmr "Knockdown Howl" — Prone payload inert (data)

## Title
Row authors NO `save_effect` — the Prone payload is prose-only, so the DC 23 STR legendary save adjudicates with byte-exact damage math but applies NO condition on a failed save. MA-1894 Fenrir Winter's Howl twin (one-field fix).

## Expected (RAW)
Strength save DC 23, each creature within 30 ft. Failure: knocked Prone + 9 (2d8) Thunder. Success: half damage, not Prone.

## Static (monsters.json garmr legendary_actions[2])
- save_dc 23 ✓, save_type "Strength" ✓, damage_dice_primary "2d8" ✓ (avg 9), damage_type_primary "Thunder" ✓.
- **save_effect ABSENT** — save lane word-scans `save_effect` ONLY (§52 MV-31/§180/§346); `hit_conditions:["prone"]` is authored but `buildHitConditionClause` is ATTACK-lane only (§153) — decoy on a save row.
- dc_success ABSENT → default half = RAW-correct here (success half damage) — no MV-20 leak.
- range ABSENT, description "within 30 ft" carries no shape token → picker never opens (§211) — single-target prompt seam; advisory range-adjudication residual only.

## Live proof (test-campaign, :5173, 2026-10-11)
- Garmr 1 EB exact-filter join (init 17, HP460); victim ElderPaladin 224 (disk resistances[] immunities[] — Thunder-clean; Aura strips Frightened only, Prone unaffected — MA-1894 note re-verified: no aura interference).
- Header uses:3 live: FAIL press spent 3->2, SUCCESS press spent 2->1, refusal press zero-spend.
- FAIL leg (wb −30): nat6 + (−20 = +5 aura + STR mod − wb) = −14 < 23 → `save_result success:false`; save-damage 2d8 [7,8]=15 full, Thunder, finalDamage 15; hp_change −15, 224→209 exact. **ElderPaladin.activeConditions:[] — ZERO Prone; zero `condition applied` entries whole-log; activeConditionMeta null; targetEffects empty.**
- SUCCESS leg (wb +30, fresh boundary via Next-walk to AberrantSorcerer): nat15 +40 = 55 ≥ 23; raw 2d8 [8,4]=12 → finalDamage 6 = floor(12/2) exact; hp 209→203 exact; conditions [] (vacuous pass).
- DC 23 / STR byte-honest on prompt, save_result, roll-save, popup ("✓ SAVE SUCCESS (55 vs DC 23)"). Thunder-only every damage entry.
- Console 0 errors.

## Root cause / fix
`applyFailedSaveConditions` early-returns on empty saveConditions (saveProcessing.js:1107) — extractor never sees a `save_effect`. One-field fix: add `save_effect` carrying canonical word, e.g. `"The target is knocked Prone until it stands, and takes half damage on a successful save."` (MA-1884 Dracolich / MA-1894 fix template, proven live).

## NEW pitfalls
- Save-row authored `hit_conditions:["prone"]` looks like a condition transport but is structurally inert (attack-lane-only reader) — misleading household junk on save rows; check WHICH lane field is authored, not just that a conditions field exists.
- §484 cs-frozen-mirror refusal reproduced on this chip: Next-walk advanced top-level `activeCreatureName` to AberrantSorcerer while `cs.activeCreatureName` froze at AasimarTest → honest zero-spend `legendary_use_refused (turn)`; full-store cs POST activeCreatureName=walk-truth unstuck the fresh boundary (2nd press spent honestly).
- Refusal "Done" lives inside `.popup-modal` inside `.popup-overlay` — same flush both classes.

## Steps to reproduce
1. test-campaign → EB join Garmr → arm ElderPaladin (wb rig −30/+30).
2. Fresh boundary → press "DC 23 Strength" chip on Knockdown Howl → save fails → damage lands, NO Prone ever applied.
