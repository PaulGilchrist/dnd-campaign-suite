# MA-1728 — Wraith Life Drain: HP-maximum reduction inert (FAIL(a)/DATA)

## Overview
Wraith Life Drain (ATTACK row, +6 to hit, reach 5 ft.) resolves its attack and 4d8+3 Necrotic damage legs exactly live, but the described "If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken" rider is byte-inert: victim cs maxHp never moves, no `hp_max_reduce` te, no drain log. Damage/hit/miss math verified exact.

## Expected (row MA-1728 + disk `wraith.actions[0]`)
- Byte-consistent: `attack_bonus: 6`, `reach: "5 ft."`, `damage_dice_primary: "4d8 + 3"`, `damage_type_primary: "Necrotic"`.
- Description rider: "If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken."
- On each hit: victim max HP drops by exactly the necrotic damage applied (MA-1489 Specter twin behavior).

## Disk structured-key table (DISK WINS)
| key | specter.actions[0] Life Drain | wraith.actions[0] Life Drain |
|---|---|---|
| attack_bonus | 4 | 6 |
| reach | "5 ft." | "5 ft." |
| damage_dice_primary | "2d6" | "4d8 + 3" |
| damage_type_primary | "Necrotic" | "Necrotic" |
| **hit_hp_max_reduce** | **{"equal_to":"damage"}** | **ABSENT** |
| hit_target_effect | — | absent |
| hit_conditions | — | absent |
| automation | — | absent |

## Root cause (static + live)
The attack-hit-path HP-max-drain seam is LIVE (MA-1489, playbook §MA-1489): structured `hit_hp_max_reduce` → `parseHitHpMaxReduce` (src/components/encounter/MonsterCardHelpers.js:797, STRUCTURED-KEY-ONLY, never prose) → `buildHitConditionClause` rider payload (:887-895) → `handlePlainDamage.maybeApplyHitClause` → `applyHitHpMaxReduce` → `hpMaxReduceService.applyHpMaxReduce` (cs maxHp drop by finalDamage + te ledger {baseMax,reduced,max} + logs). **wraith.actions[0] lacks the key → clause riders null → byte-inert.** Live proof: 2 hits paid 19/19 exact while cs maxHp stayed 11 across BEFORE/BETWEEN/AFTER probes; zero `hp_max_reduce` log entries app-wide for this run; victim te null throughout. Same family as MA-1718 (Wight, save-path twin lacking `save_hp_max_reduce`).

## Live evidence (test-campaign, 2026-09-30)
Board: Wraith 1 (AC13) + Bandit 1 (AC12), GM-filled 999/999 via real keyboard (cs stored currentHp 999, maxHp stayed stat-block 11 — display quirk, victim kept alive).
| roll | d20+6 | vs AC12 | damage | popup/log | cs Bandit HP | maxHp |
|---|---|---|---|---|---|---|
| 1 | 18+6=24 | HIT | 4d8+3 [8,1,1,6]+3=19 | formula "4d8 + 3" Necrotic, finalDamage 19 | 999→980 (Δ−19=rolled ✓) | 11→11 ✗ (RAW → 0 lethal) |
| 2 | 3+6=9 | MISS | — zero ✓ | no damage/hp_change entry | 980 | 11 |
| 3 | 1(nat)+6=7 | CRIT MISS | — zero ✓ | "Critical Miss!" | 980 | 11 |
| 4 | 4+6=10 | MISS | — zero ✓ | no damage/hp_change entry | 980 | 11 |
| 5 | 9+6=15 | HIT | 4d8+3 [4,1,8,3]+3=19 | formula "4d8 + 3" Necrotic, finalDamage 19 | 980→961 (Δ−19=rolled ✓) | 11→11 ✗ (RAW → 0 lethal) |

- maxHp BEFORE=11 / BETWEEN=11 / AFTER=11 → rider inert live (cited).
- No nat-20 rolled in 5 presses → crit dice-doubling face UNVERIFIED (honest residual; seam unchanged for crit path).
- te `hp_max_reduce` registered (targetEffectDefinitions.js:347) with producer armed only by the missing key — no te on victim.

## Steps to reproduce
1. test-campaign → EB "Wraith" +1, "Bandit" +1 → Join; GM-fill Bandit 1 HP 999.
2. Arm Bandit 1 on Wraith 1 target select; open Wraith card (.mc-overlay) → Life Drain "+6" chip; roll to a hit.
3. Observe exact 4d8+3 Necrotic damage on Bandit, but GET /api/campaigns/test-campaign/change-data maxHp stays 11; log carries zero hp_max_reduce entries.

## Fix (ONE FIELD — key = whatever specter row uses)
`monsters.json` DATA drift. Author on `wraith.actions[0]`:
```json
"hit_hp_max_reduce": { "equal_to": "damage" }
```
Exact key per `parseHitHpMaxReduce` (MA-1489 byte-twin of specter.actions[0]). No consumer change needed — attack lane live (specter twin verified FIXED §MA-1489).

## Notes
- "Create Specter" spawn/consumer advisory family = grep-zero do-not-chase (§70 family), out of scope.
- Verified 2026-09-30 by MA-1728 subagent run; test-campaign cleared after (change-data {}, log 0).
- Manifest NOT edited; git read-only; disk unfixed per MA-1718 precedent.
