# BUG MA-1639 — Vampire Bite (actions[2]): HP-max drain + vampire regain both UNAUTHORED/unresolved

**Verdict: FAIL(a)/DATA** (drain lane expressible+live but field absent; regain lane grep-zero transport = second layer named per §942).

## Evidence (test-campaign, dev:locked, own-curl/DOM truth)

### Static (STEP 1)
- monsters.json vampire actions[2] keys: name, description, save_dc 17, save_type Constitution, range "5 feet", damage_dice_primary "1d4 + 4" Piercing, damage_dice_secondary "3d8" Necrotic, save_effect (free-text "Grappled And Incapacitated And Restrained" grant live per MA-1637).
- **`save_hp_max_reduce` ABSENT** — in-file byte-twins exist: Succubus Draining Kiss :58473 and Succubus/Incubus :58624 `{equal_to:"damage"}`; Specter Life Drain `hit_hp_max_reduce` :56547.
- No `dc_success` field → saveProcessing/MonsterCardModal.jsx:268 defaults `'half'` for save_dc>0 rows (MA-1637 half-leak explained).
- No `target_prerequisite` field (MA-0019/MA-0687 gate lane live but unauthored → chip fires on ungrappled victim; advisory-or-data, gate-not-converter §868).

### Grep lanes
- Max-HP-reduce SEAM LIVE save-path: parseSaveHpMaxReduce (MonsterCardHelpers.js:807, structured-key-only) → buildAbilitySaveRollContext → saveProcessing.js:1313-1326 applySaveHpMaxReduceLeg → hpMaxReduceService.applyHpMaxReduce (:150, cs maxHp drop + clamp + te `hp_max_reduce` + face logs). Unarmed on this row = byte-inert.
- Attacker-regain lane: **grep-zero app-wide** for any caster-self heal folded from damage on attack/save lanes. `self_heal` exists ONLY for legendary actions (MonsterCardModal.jsx:787-788 applyLegendarySelfHeal). No te, no parser, no seam → transport gap (MA-1115 escape-frame analogue); fix needs new structured key + consumer (MA-1451/MA-1489 conversion precedent) or GM-enforced advisory.
- Spawn clause ("buried rises as Vampire Spawn"): kill-summon clauses grep-zero (§942) → advisory.

### Live rig (STEP 2-4)
- EB exact-td join Vampire + Bandit; cs full-store POST: Bandit ac12 cur/max 999/999 res[]; Vampire 1 cur 150/max 195, targetName Bandit 1. Regen-visible stamp held post-reload.
- Chip audit: Bite row exactly one save chip "DC 17 Constitution"; "1d4 + 4" decoy NEVER pressed (§282).
- **FAIL face (press3, ability_score_modifiers.con −19):** roll log total −12 vs DC 17 failure; legs byte-exact "1d4 + 4"→8 Piercing (Δ−8) + "3d8"→14 Necrotic (Δ−14); Bandit hp_change maxHp 999 FROZEN; Vampire cur **150→150** (expected 150→164). te null, no drain/regain/reduce string anywhere in log.
- **SUCCESS face (press4, +19):** total 22 vs 17 success; half-leak Δ−3 Piercing (raw 7) + Δ−6 Necrotic (raw 13); dcSuccess:half stamped on roll log (default, unauthored); maxHp 999 frozen; Vampire **150→150** (expected +6). Zero drain/regain proof complete.
- Console: 0 errors clean rig. (press1/2 NaN console.error = rig artifact of numeric `saving_throws.con` — getCreatureSaveModifier Helpers:612 expects `.modifier` object or `ability_score_modifiers`; NOT an app defect on this row, logged as pitfall.)

## Fix (REGISTRY-DELTA proposal, do-not-apply)
1. DATA one-field: `"save_hp_max_reduce": { "equal_to": "damage" }` on vampire actions[2] → drain lands both faces (fail=full nec amount, success=halved) via MA-1547 seam; badge "Max HP −N", LR clears existing keys.
2. Drain-seam twin needed for regain: `save_attacker_recover:{equal_to:"damage"}`-class key + consumer in applySaveHpMaxReduceLeg/applyHpMaxReduce (currently zero producers of attacker-side heal) — FAIL(b) transport until built; interim advisory log.
3. Optional: `target_prerequisite:{conditions:["grappled","incapacitated","restrained"], by_attacker:false, allow_willing:true}` — "willing" has no te vocabulary today = advisory residual.
4. `dc_success:"half"` author explicit to freeze the :268 default (cosmetic-par-defect §1120).

## BEFORE/AFTER table
| side | Bandit cur | Bandit max | Vampire cur | expected |
|---|---|---|---|---|
| pre FAIL | 960 | 999 | 150 | — |
| post FAIL | 938 | **999** | **150** | max 985, V 164 |
| pre SUCCESS | 938 | 999 | 150 | — |
| post SUCCESS | 929 | **999** | **150** | max 993, V 156 |
