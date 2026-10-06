# BUG CLA-148 — Frost's Chill fires on MISS (attacker hit-gate not enforced)

## Title
CLA-148 Frost's Chill (Goliath / Frost Giant, 2024): chip fires and deals damage + spends a use on a MISS.

## Overview
On-hit trigger is not enforced. After a confirmed MISS (`lastAttack.hit:false`, total 1 vs AC 22), the "Frost's Chill" chip still resolved: rolled 1d6 Cold, dealt 5 damage to the missed target, stamped a `speed_reduction` te, and spent a use. Identical family defect to CLA-141 Fire's Burn — the shared `attackerRollGate` never consults `lastAttack.hit`.

## Expected Behavior (canonical app-data, public/data/2024/races.json, Goliath → Frost Giant)
> "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn. You can use this a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."

A MISS must produce ZERO: no damage roll, no hp_change, no speed_reduction te, no use spent.

## Actual Behavior
- HIT path is exact: Bandit 1 (AC 12) hit 27 → chip rolled 1d6:3 Cold; `hp_change` -3 (11→8); `condition` log speed_reduction 10 ft; te `{target:"Bandit 1", source:"Frost's Chill", effect:"speed_reduction", value:10, duration:"until_end_of_next_turn"}`; `frostsChillUses` 6→5; Long Rest removed key (re-arm to PB 6 via null-fallback).
- MISS path (BUG): attack total 1 vs AC 22 (`lastAttack.hit:false`, Disciplined_Monk) → chip popup "1d6: 5 / 5 damage applied to Disciplined_Monk"; logs `hp_change` -5 (183→178), `roll damage` Cold total 5, `condition` speed_reduction; use spent.

## Steps to Reproduce
1. test-campaign, ElderPaladin (Goliath/Frost Giant, lvl 20, PB +6) in initiative with Bandit 1 (EB Join).
2. Arm Disciplined_Monk (AC 22) on ElderPaladin's initiative-card target-select.
3. Roll "Attack (to hit)" from ElderPaladin sheet until MISS (lastAttack.hit:false).
4. Click the "Frost's Chill:" chip on the sheet → popup deals 1d6 cold to the missed target, spends a use, stamps speed_reduction.

## Likely Location
- `src/services/automation/handlers/class-other/giantAncestryUtils.js:181` `attackerRollGate` — checks `attackEvent`, `attackerName`, `rollType==='attack'`, `targetName` but NEVER `lastAttack.hit`.
- `src/services/automation/handlers/class-other/giantAncestryUtils.js:199` `frostsChillAttackerGate` — pure alias of `attackerRollGate`; used by both `handleFrostsChillDirect` (giantAncestryTraits.js:96) and `handleFrostsChill` (giantAncestryDispatch.js:87).
- Manifest paths in row JSON (`src/services/combat/automation/...`) are STALE; live code is under `src/services/automation/...`.

## Notes
- Same root cause as bug-CLA-141-fires-burn-fires-on-miss.md; a single `if (!lastAttack.hit) return refusal` in `attackerRollGate` fixes the whole family (Fire's Burn, Frost's Chill), but must respect CLA-141 gate semantics elsewhere.
- Duration wording divergence (advisory): app-data says "until the start of your next turn"; code stamps `duration:"until_end_of_next_turn"` and log prose "end of their next turn".
- Cleanup: change-data + campaign log cleared via Admin; log verified `[]`. Character left as Goliath/Frost Giant.
