# BUG MA-0795 — Giant Centipede Bite: Poisoned rider never granted (FAIL(a)/DATA, one-field)

**Row:** giant-centipede|actions|0 "Bite" (+4, reach 5 ft., 4 (1d4 + 2) Piercing, and the target has the Poisoned condition until the start of the centipede's next turn).
**Verdict:** FAIL(a)/DATA — condition axis standalone. Numeric axis live (hit/damage ledger exact). Console 0 errors. MA-0763/MA-0791 FAIL twins byte-confirmed; NOT the MA-0785 ghoul twin (that row authors save_dc/save_effect — this row has no save chip, hit-condition rider only).

## Disk (public/data/monsters.json giant-centipede actions[0], quoted FULL)
```json
{
  "name": "Bite",
  "description": "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage, and the target has the <strong>Poisoned</strong> condition until the start of the centipede's next turn.",
  "attack_bonus": 4,
  "reach": "5 ft.",
  "damage_dice_primary": "1d4 + 2",
  "damage_type_primary": "Piercing"
}
```
- `hit_conditions` **ABSENT** — Poisoned exists only as `<strong>Poisoned</strong>` prose inside `description`.
- No `save_dc`/`save_type`/`save_effect` — zero save-chip affordance (correct per row; MA-0785 ghoul Claw is the save-chip twin elsewhere).
- avg check: 1d4 avg 2.5 + 2 = 4.5 → manifest avg 4 ✓.
- Consumer (§150): `buildHitConditionClause` (MonsterCardHelpers.js:561-562) reads `action.hit_conditions` ONLY — description never read → clause [] → handlePlainDamage early-return (:582 twin, MA-0763 fingerprint byte-identical). Manifest `conditions:["poisoned"]` is prose label, never lands (§150/MA-0291/0361 family).

## Live proof (test-campaign, header verified; Giant Centipede 1 cs idx0 + Bandit 1 AC12 maxHp999 full-store cs POST; own-card target-select armed "Bandit 1")
- 4 honest rolls vs AC12 (nat≥8 hits): nat7→11✗, nat2→6✗ (stage-1 done-less backdrop §94), nat14→18✓, nat8→12✓ honest tie-goes-to-attacker boundary (§203). Chip "+4" landed first click 4/4 (`span.mc-dice-link` inside `.mc-action strong` startsWith('Bite'); no §116 absorb observed this session).
- HIT ledger ×2 exact: `roll damage` Bite formula `"1d4 + 2"`, rolls[4] fd6 / rolls[2] fd4, `damageType:"Piercing"`, note cosmetic `combined_damage_roll` on single-primary (§183/§185); `hp_change` Bandit 1 Δ−6 (999→993) + Δ−4 (993→989), breakdown Piercing exact, unclamped (§181). Stage-2 popup "1d4 + 2: 4 +2 → 6 damage applied — HP: 999 → 993" then click-to-dismiss preserves damage (§196).
- Poisoned rider DEAD: whole-log `condition applied` = 0 entries; whole-log /poison/i = 0 mentions; Bandit 1 change-data `activeConditions` absent, `activeConditionMeta` {} , top-level `targetEffects` [] — zero grant on BOTH hits, zero duration-stamp anywhere ("until start of centipede's next turn" lives only in disk prose).
- Misses zero-damage zero-cond ✓. Console 0 errors.

## Fix (one field, MA-0621/0763/0791/0794 byte-shape)
Add `hit_conditions:["poisoned"]` to giant-centipede actions[0]. buildHitConditionClause arms; handlePlainDamage grants Poisoned on hit incl. duration note/anchor handling (§150 consumer live). Verify post-fix: hit → `condition applied` Poisoned + activeConditionMeta{source, durationNote "until the start of the centipede's next turn"} + badge; miss zero.

## Ops notes
- No NEW recipe/pitfall: all seams (first-click attack chip, done-less miss, combined_damage_roll cosmetic note on single-primary, own-card arm, maxHp999 staging) already codified (§27/§29/§94/§116/§120/§181/§183/§185/§196).
- Injection re-confirmed: navigate echo rewrote to OSS proxy URL; `location.href` self-verified localhost throughout; one run_code_unsafe self-inflicted bare-`document` ReferenceError re-confirmed sandbox rule (§130).
- Cleanup: admin clear cd+log; test-campaign only; no manifest/git writes.
