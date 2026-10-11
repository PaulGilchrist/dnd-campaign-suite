# MA-1859 — Behemoth "Earthshaker (Recharge 5-6)" — Recharge unenforced (data)

## Title
Behemoth Earthshaker: "(Recharge 5-6)" is name-text only; no `recharge` field authored, so the recharge gate is null and the action can be fired unlimited times per round.

## Overview
Row MA-1859 (`behemoth|actions|3`), actionType `save`, verified E2E on localhost / test-campaign 2026-10-10. Save core (DC, damage, half-on-success) resolves EXACTLY, but the recharge gate is absent: `monsters.json` authors no `recharge`/`usage` field, so `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:33-46) resolves null and every refire re-opens the full save prompt with zero enforcement. Secondary clause "each creature ... on the ground" is also inert (no `target_prerequisite` authored; gate at MonsterCardModal.jsx:2137 unarmed; grounded-state grep-zero).

## Expected Behavior
Row description: "Strength Saving Throw: DC 25, each creature within 60 ft. on the ground. Failure: 55 (10d10) Bludgeoning damage. Success: Half damage."
Row numbers: saveDc 25, saveType Constitution→Strength (authored Strength), damageDicePrimary `10d10` Bludgeoning, name carries "(Recharge 5-6)".
Per RAW and the recharge enforcement policy: after first use, the action is unavailable until a 5-6 recovery succeeds.

## Actual Behavior
- Save core EXACT (PASS axes):
  - Fail leg (warding_bond −30 rig): nat 19 → total −1 vs DC 25 → `save_result:false`, `lastAttack{saveDc:25,saveType:Strength}` → `10d10` [9,8,10,9,2,5,8,3,5,6]=65 FULL, Bludgeoning-only; HP 224→159 exact.
  - Success leg (wb +30): nat 5 +40 = 45 ≥ 25 → rolls [1,8,4,4,2,7,2,7,8,1]=44, `finalDamage 22 = floor(44/2)` EXACT; HP 159→137 exact.
- RECHARGE FAIL(b): refire #3 same turn re-opened the full save prompt. Zero `.mc-recharge-refusal`, zero `*_refused` log, no `monsterRecharge` change-data key, no `-spent` chip class, zero `ability_use` spend. Disk lacks `recharge`/`usage`; sole gate reader `rechargeUsageOf` (monsterRecharge.js:33-46) returns null. Same family as MA-0663 / MA-1843.
- "on the ground" clause inert: no `target_prerequisite`; non-grounded targets not excluded (advisory gap §400/§209).

## Steps to Reproduce
1. localhost app → test-campaign → Encounter Builder → Behemoth ×1 → Join Encounter.
2. Open Behemoth card, arm a PC target, press the unique "DC 25 Strength" chip (Earthshaker row) → full save resolves.
3. Press the same chip again immediately → prompt re-opens, second full save resolves; no recharge gate, no recovery die.

## Likely Location
`public/data/monsters.json` data drift — one-field fix `recharge:"5-6"` on behemoth actions[3] (consumers `rechargeUsageOf`/monsterRecharge.js live and proven working, MA-1164 precedent). Secondary: `target_prerequisite` for the grounded clause (gate exists at MonsterCardModal.jsx:2137).

## Notes
- Chip audit: "DC 25 Strength" chip unique to Earthshaker row (decoy pitfall MA-1850 checked).
- PC-prompt seam aggregates saveBonus into the verdict line (wb hidden on fail, explicit legend on success); cd `hitPoints` may stick at seed post-damage — hp truth is `hp_change.currentHp`.
- Save/damage/half-math core is exact; the FAIL is solely the recharge gate (MA-1843 twin verdict).
