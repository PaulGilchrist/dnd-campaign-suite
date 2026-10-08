# bug-MN-014 — Precision Attack: offered on hits, never offered on miss, superiority die never rolled/added

Verdict: FAIL — trigger inverted and core lane inert (playbook §1: trigger gate inverted/unenforced + zero consumer on the real trigger = FAIL).

## Expected Behavior (canonical)
"When you miss with an attack roll, you can expend one Superiority Die, roll the die, and add it to the attack roll, potentially turning the miss into a hit." (Battle Master maneuver; app data trigger `attack_roll_miss`, cost `superiority_die`.)

## Actual Behavior (live 2026-10-07, EvasiveFighter lv18 2024 Battle Master, glaive +8, d12 superiority dice ×6, victim Cambion 1 AC19, test-campaign)
- **Offered on HIT**: post-hit chooser "Battle Master — Attack Rider Maneuver — Choose an attack rider maneuver to use on this hit:" lists Precision Attack on 7/7 hits. Root: attackRollRiders.js:26 hit branch → getAttackRiderOptions → getAvailableAttackRiderManeuvers (combatSuperiorityQueries.js:31) → getManeuversByType gates only `*_hit` triggers (:24-25) — `attack_roll_miss` passes open on hits (MN-018 trigger fix never wired to this branch).
- **NEVER offered on MISS**: 3 clean misses (d20 3+8=11, d20 5+8=13, nat1 9 vs AC19; `lastAttackRoll.hit:false`, `pendingCombatSuperiorityPrompt.attackContext.hit:false` persisted armed >7s) — no Precision Attack overlay / combatSuperiority modal across two page mounts; useAttackDamageResolution.js:527 resume gate `hit !== false` discards miss-armed choosers; prompt unconsumed.
- **Die never rolled/added, zero spend**: superiorityDice 6→6 entire session; log grep "Precision" = 0/47; no recalculated-roll log; no miss→convert path exercised.

## Steps to Reproduce
1. EvasiveFighter (Battle Master, d12 dice, glaive +8) in combat vs AC19 Cambion (EB join).
2. Attack until a hit → chooser lists Precision Attack (wrong: should only appear on miss).
3. Attack until miss → no offer at all; pendingCombatSuperiorityPrompt armed with hit:false but modal never mounts.
4. Superiority ledger never changes; no maneuver logs.

## Likely Location
- `src/services/combat/automation/**/combatSuperiorityQueries.js:24-31` — getManeuversByType trigger filtering must route `attack_roll_miss` maneuvers to the miss branch only.
- `attackRollRiders.js:26` — hit branch admits miss-triggered maneuvers.
- `useAttackDamageResolution.js:527` — resume gate `hit !== false` kills the miss-armed chooser (inverted consumer).
- Real chain: attackPostProcessing.js:195 → useCombatSuperiorityModal.js:188 poller / :92 handlePrecisionAttack → executeManeuver.js. Manifest paths combat/automation/handlers/maneuverHandler.js grep-zero (stale).

## Notes
- Host EF also has Relentless (free d8 first maneuver/turn) — masks spend evidence in retests; retest with dice ledger anyway.
- Shield Master/Charger hit-prompt hijack abandons queued damage popups (CLA-188 family) — use chooser Skip; anchored script misfires logged stray STR checks.
- Cambion AC is 19 (not 18) in app data — good high-AC miss-forcing rig for maneuver retests.
