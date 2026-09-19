# bug-mon-MA-0487 — Chimera Ram: Prone-on-hit clause inert (DATA, hit_conditions missing)

**Row:** MA-0487 Chimera `actions[3]` Ram — Melee +7, reach 5 ft., Hit 10 (1d12 + 4) Bludgeoning; "If the target is a Medium or smaller creature, it has the Prone condition."
**Verdict:** FAIL (b) — DATA twin of MA-0434 / MA-0477 / MA-0480 (§125 fingerprint family).

## Verified working (live, test-campaign 2026-09-18, vs Bandit 1 AC12 Medium, HP-staged 999)
- Disk `public/data/monsters.json` chimera actions[3]: attack_bonus 7, damage_dice_primary "1d12 + 4", Bludgeoning, reach "5 ft." ✓
- 6 chip rolls: 5 hits (nat 8, 14, 13, 14, 19 → 15/21/20/21/26 vs AC12), 1 miss (nat 3 → 10 vs AC12). Bonus +7 boundary honest (hit+miss observed).
- Every hit: log `total == finalDamage == |hp_change.delta|` (16, 13, 13, 5, 14), formula "1d12 + 4", breakdown Bludgeoning, resisted:false.
- Miss: zero damage, zero hp_change ✓. No popup replay (6 distinct attack log entries).

## Defect
Prone never lands despite consumer being live:
- 0 `type:"condition"` log entries after 5 hits.
- Bandit 1 change-data: `activeConditions` absent (whole per-char bucket empty).
- combatSummary Bandit: no conditions.

## Root cause
`buildHitConditionClause` (MonsterCardHelpers.js, consumed by handlePlainDamage.js incl. Medium-or-smaller gate) reads ONLY `action.hit_conditions`. Ram row authors the clause as prose in `description` with NO `hit_conditions` field — prose is never parsed (same family as MA-0434 Brown Bear Claw, MA-0477 Sun Ray blinded, MA-0480 Chain).

## Fix (data-only, monsters.json chimera Ram)
Author `"hit_conditions": ["prone"]` on the Ram action. Medium-or-smaller gate already enforced by the live consumer; no code change needed. Re-verify after fix: ≥2 hits → `condition applied` log entry + victim activeConditions contains prone (§22 stale-/data-cache reload discipline for EB-joined combatants).

## Cleanup
Admin cleared change-data + campaign log (API-verified `{}` / `[]`). Registry Chimera verifiedRow merge-appended with MA-0487 segment (MA-0485/0486 intact, JSON.parse disk-checked). Manifest untouched (orchestrator-owned).
