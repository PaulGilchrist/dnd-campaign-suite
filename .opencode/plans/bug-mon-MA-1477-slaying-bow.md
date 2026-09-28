# Bug — MA-1477 Solar "Slaying Bow" (solar|actions|2) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA** — save adjudicates honestly but every promised numeric outcome is inert: HP-threshold instakill never fires AND both prose damage pools roll nothing. Three-field DATA fix required.

## Row
`{"stableKey":"solar|actions|2","actionName":"Slaying Bow","save_dc":21,"save_type":"Dexterity","range":"600 feet"}` — RAW: fail → ≤100 HP dies; otherwise 24 (4d8+6) Piercing + 36 (8d8) Radiant; success → none of it.

## Disk field dump (public/data/monsters.json, Solar actions[2])
| Field | Present? |
|---|---|
| name / description / save_dc:21 / save_type / range / save_effect (prose) | YES |
| damage_dice_primary ("4d8 + 6" only in prose) | **ABSENT** |
| damage_type_primary | **ABSENT** |
| damage_dice_secondary ("8d8" only in prose) | **ABSENT** |
| damage_type_secondary | **ABSENT** |
| hp_threshold_kill ("100 HP or fewer dies" only in prose) | **ABSENT** |
| dc_success (RAW success = take none → needs "none") | **ABSENT** → `half` default leak (MV-20) confirmed live stamped `dcSuccess:"half"` |

Prose-vs-fields: all three promised mechanics (4d8+6 Piercing, 8d8 Radiant, instakill ≤100) exist ONLY as prose → §54/§MA-1448 unparseable-numbers DATA drift family.

## Code seams (disk-verified)
- `MonsterCardHelpers.js:771 parseHpThresholdKillClause` — reads numeric `action.hp_threshold_kill` ONLY → null.
- `saveProcessing.js applyHpThresholdKill (~:1244)` — `if (!Number.isFinite(threshold)) return false` → instakill leg never consulted.
- No `damage_dice_primary` → save-leg damage pool has nothing to roll (MA-1475 registry already logged this row "prose-damage advisory").
- No `dc_success` → getSaveDcSuccess half hardcode (MV-20/§63).

## Live zero-delta table (test-campaign, :5173, initiative LIVE Solar 1 + Bandit 1)
| Face | Rig (cs currentHp) | Save (victim `roll save`, machine truth) | RAW expectation | Live actual | Delta |
|---|---|---|---|---|---|
| 1 instakill | Bandit 1 HP→**50** via card input (50 ≤ 100) | nat 11 +0 = 11 vs DC 21 → **failure** (dcSuccess:"half") | dies (drop to 0) | **HP 50 → 50**; no hp_change, no `hp_threshold_kill` automation log, no save-damage, targetEffects null, lastAttack null | **ZERO — instakill inert** |
| 2 dice pools | Bandit 1 HP→**999** via card input (>100) | nat 20 +0 = 20 vs DC 21 → **failure** (§303 raw-d20 seam, saveBonuses.dex:1 ignored) | fail → damage rolled (4d8+6 Piercing + 8d8 Radiant; half via default-half) | **HP 999 → 999**; zero `roll damage`, zero `save-damage`, zero hp_change | **ZERO — both dice pools inert** |
| 3 success | n/a | structurally unreachable this seam: raw d20 max 20 + 0 < DC 21 (§303 picker-key seam); warding_bond rig = mutation POST, forbidden by hard rules | take none | n/a (both fires were fail legs — the stronger evidence) | noted |

Popup chrome: "DC Unknown — no success or failure" attacker-dupe on both fires (§138 cosmetic); victim `roll save` entries (saveDc:21, saveResult:"failure") decisive per §96. Chip landed first click both times. Console 0 errors.

## Precedents
- §MA-1448 / MA-0352 (playbook :939): prose "N HP or fewer dies" NEVER parsed → save-fail survivor = FAIL(a/b)-DATA one-field fix; same rows need `dc_success:"none"` when RAW success is silent (:1032 half-default) — live half-stamp here confirms.
- §117 decoy save_effect + §6 zero-damage fingerprints: prose-only numeric payloads on save rows resolve to zero effect.

## Fix (three-field DATA, Banshee Deathly Wail byte-shape MA-0352)
```json
"damage_dice_primary": "4d8 + 6", "damage_type_primary": "Piercing",
"damage_dice_secondary": "8d8", "damage_type_secondary": "Radiant",
"hp_threshold_kill": 100,
"dc_success": "none"
```
(secondary rides MA-0427 threaded save transport; threshold rides saveProcessing.js:1244 choke point; dc_success:"none" kills the half-default leak.)

## Cleanup
Admin clear change-data + log executed from quiet state (card closed); verified: log 0 entries, combatSummary null, no tab resurrection.
