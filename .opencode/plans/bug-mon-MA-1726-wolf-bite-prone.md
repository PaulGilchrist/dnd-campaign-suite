# MA-1726 — Wolf Bite: prone rider inert (FAIL(a)/DATA)

## Overview
Wolf Bite's description grants the target the Prone condition on a hit against a Medium-or-smaller creature. The damage leg resolves exactly, but prone never lands: disk `wolf.actions[0]` carries only free-text, no structured `hit_conditions` key, and the consumer arms structured keys only (same defect lane as MA-1723 Winter Wolf Bite, fixed pattern MA-1534/MA-1541).

## Expected Behavior (row + monsters.json)
- Row MA-1726 / disk `wolf.actions[0]` numerics identical: attack_bonus 4, reach "5 ft.", damage "1d6 + 2" Piercing.
- Description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. **If the target is a Medium or smaller creature, it has the Prone condition.**"
- Manifest row additionally carries `conditions: ["prone"]` (generator extracted the rider from text), confirming the rider is part of the row.
- Expected: on a hit vs Medium-or-smaller target, `prone` lands in victim `activeConditions` + a condition log entry (victim here: Bandit 1, Medium — as-written prone must land).

## Actual Behavior (live, MA-1726 run 2026-09-30)
| roll | result | damage | hpΔ | Bandit activeConditions |
|---|---|---|---|---|
| d20 5 +4 = 9 | MISS | — | 0 | absent |
| d20 3 +4 = 7 | MISS | — | 0 | absent |
| d20 12 +4 = 16 | HIT | "1d6 + 2" = 8 Piercing (log finalDamage 8, hp_change −8) | −8 ✓ | **absent — no "prone"** |

Damage/hit math exact; prone never surfaces (change-data + condition log). Subagent noted "prone rider not surfaced as a condition badge/change-data entry" — that IS the defect (its PASS call is corrected to FAIL(a)/DATA by orchestrator per strict trichotomy).

## Static proof chain (established MA-1723)
- Consumer `buildHitConditionClause` (MonsterCardHelpers.js ~:874-903) arms ONLY structured `hit_conditions` (no prose fallback); chain → MonsterCardModal.jsx:975/1992 → useLoggedDiceRollAttack.js:208 → handlePlainDamage.js:555.
- Disk holders: 97 `hit_conditions` rows incl. stone-giant Boulder `["prone"]` (MA-1534) and storm-giant Thunderbolt (MA-1541, one-field fix precedent). `wolf.actions[0]` has NO such key → prone inert, verified live.

## Steps to Reproduce
1. test-campaign → EB join "Wolf" + Bandit (Medium, AC12, GM-fill HP).
2. Arm Bandit on Wolf's initiative-row target select; open Wolf card → Bite "+4" chip; roll to a hit.
3. Observe full 1d6+2 Piercing damage but no prone condition (change-data activeConditions / condition log).

## Likely Location
`public/data/monsters.json` DATA drift — one-field fix: `"hit_conditions": ["prone"]` on `wolf.actions[0]` (MA-1534/MA-1541 template). Resolution consumer is live.

## Notes
- "Medium or smaller" size gate: Bandit is Medium, so the gate is satisfied — its absence cannot excuse the miss. App-side size gating on this lane unprobed (§70 advisory).
- Manifest `conditions:["prone"]` field exists on this row but is an extracted label, not a consumer key (playbook: manifest actionType/label ≠ affordance; renderer keys disk fields only, MA-0548).
- Board cleared via Admin after run; verified only — no monsters.json edit performed (data fix requires its own row-fix pass + re-verification per bug file).
