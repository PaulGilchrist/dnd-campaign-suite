# bug-mon-MA-0501 Cockatrice Petrifying Bite — save-fail rider grants ZERO state

**Verdict: FAIL(b)** — attack leg + rider save adjudication PASS; failed-save condition grant INERT (MA-0090 class).

## Row
MA-0501 / cockatrice / actions[0] "Petrifying Bite" (attack+save compound), test-campaign, 2026-09-18.

## Disk shape (public/data/monsters.json actions[0])
- attack_bonus 3, reach "5 ft.", damage_dice_primary "1d4 + 1", damage_type_primary "Piercing"
- save_dc 11, save_type "Constitution", save_effect prose (First Failure Restrained + repeat EOT; Second Failure Petrified 24h)
- **NO structured staged keys** (no staged_petrified/staged_restrained, no repeat_save, no hit_target_effect), **no dc_success**
- Precedents §67: staged_sleep (MA-0068), staged_paralysis (MA-0248), staged_roar (MA-0268) — ladder services arm ONLY on authored structured keys; none here → ladder is advisory-unbuilt by construction.

## Live proof (Bandit 1 AC12 CON+1, EB join, Cockatrice 1 idx0)
- Card renders THREE affordances on one row: "+3" attack chip, "1d4 + 1" damage chip, "DC 11 Constitution" save chip (mc-dice-link-save-clickable).
- MISS nat4 → 7 vs AC12, ✗ MISS popup, log `roll attack hit:false`, ZERO damage, rider save did NOT fire (no save-damage entry) ✓
- HIT nat16 → 19 vs AC12, Done → damage "1d4 + 1" = 2 Piercing applied (hp_change 11→9) exact ✓ + rider save auto-fired inline: ✗ SAVE FAILURE (d20 3 +1 = 4 vs DC 11) ✓ DC/type correct, miss-suppression correct.
- **DEFECT:** on that failed save, Bandit 1 got ZERO conditions — change-data `Bandit 1` absent, no `condition applied` log, no targetEffects, no ladder, no Petrified path. Machine truth = `roll save-damage saveResult:"failure"` + empty victim state.

## Root cause (disk)
- `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:273, CONDITIONS:45) matches whole-word prose → would return `['petrified','restrained']` (petrified FIRST — would over-grant even if it ran).
- But the serving seam was the EB-NPC inline save-damage consumer: `handleNpcSaveDamage.js:222-250` `applyFailedSaveConditions` consumes ONLY `context.statusEffects` (+ infernalWound) — `saveConditions` is NEVER read there (grep-zero in that file). saveProcessing's condition-applying `applyFailedSaveConditions` (saveProcessing.js:786/1079) rides the PC-prompt path only.
- Fingerprint: MA-0090 class (§53) — failed save leaves zero state.

## Fix direction (do not blindly grant both — prose extraction over-grants petrified)
1. DATA: author structured staged fields per §67 template (e.g. `staged_petrified:{restrained_first:true, repeat_save:true, petrified_hours:24}` analogue of MA-0248 staged_paralysis) + `dc_success:"none"` (MV-20 half-leak: save gates the petrify rider, not damage — default half on this row wrongly halves hit damage on save success).
2. CODE: parser clause in MonsterCardHelpers armed ONLY on the structured key → thread staged rider → grant Restrained on first fail + repeat-save-at-EOT latch + second-fail Petrified (24h clock) across BOTH seams (saveProcessing PC-prompt + handleNpcSaveDamage NPC-inline), with grant logs. Repeat-save ladder needs authored fields (§67); advisory-only fallback = Restrained-grant + advisory log is the minimum honest floor.

## Residuals (accepted §69/§84)
- 24h Petrified clock + EOT repeat ladder unmodellable without authored fields — advisory-unbuilt is expected until fix.
