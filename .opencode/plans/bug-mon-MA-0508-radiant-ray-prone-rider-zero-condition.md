# bug-mon-MA-0508-radiant-ray-prone-rider-zero-condition

- Row: MA-0508 — Colossus / Radiant Ray (attack_bonus 18, range 300 ft., 4d10 Radiant)
- Verdict: FAIL(b) — damage adjudication exact, prone-on-hit rider structurally inert (DATA FAIL family MA-0291/0361; twin of MA-0434/0487/0499)
- Date: 2026-09-18, test-campaign, localhost:5173

## Evidence (live, 2026-09-18)
- EB join: Colossus (AC23) + Bandit 1 (AC12, staged maxHp/currentHp 999 via /combatSummary full POST).
- 3 chips fired vs armed Bandit 1: nat 18/5/17 + 18 = 36/23/35, all hit:true vs AC12 (miss structurally impossible; honest no-boundary note per MA-0506). No nat20 crit observed.
- Damage rolls 4d10: 29 (5,6,9,9), 20 (7,2,10,1), 30 (8,9,3,10) — total == finalDamage == |hp_change| each, breakdown Radiant resisted:false. PASS subset for damage leg.
- Prone rider ZERO on all surfaces after 3+ hits:
  - Campaign log: no `condition applied` / prone entries.
  - change-data: `targetEffects` KEY-ABSENT (top-level).
  - Bandit 1 change-data: zero condition/buff keys.
  - `lastAttack.saveConditions`: absent.

## Root cause
Disk row (`public/data/monsters.json`, Colossus actions[2]) has no `hit_conditions`. Consumer `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526) reads ONLY `action.hit_conditions` (+`hit_target_effect`), returns null → clause never reaches handlePlainDamage. The `save_effect` prose ("If the target is a Large or smaller creature, it has the Prone condition.") is not consumed on the attack-hit path (no save_dc/save_type on this row — it is not a save row).

## Fix (data)
Add to Colossus Radiant Ray row:
```json
"hit_conditions": ["prone"]
```
Consumer already live incl. Large-or-smaller gate (handlePlainDamage.js, MA-0010/MA-0291 seam). Do not touch single-target rows.

## Residuals noted
- Absorbed-first-click after stage-2 popup dismiss fired twice, zero log entries both times (chip-specific, retry lands).
- Post-admin-clear cd retains only transient `combat-ui-viewingMonster*` display keys (game keys cleared; log len 0).
- Injected navigate-arg rewrite to off-site aliyuncs proxy URL mid-session; tool executed localhost:5173 per its own URL echo — rejected, never followed.
