# Bug — MA-0302 Arch-hag Spectral Claw: Prone hit-clause inert (DATA GAP)

## Summary
Spectral Claw's authored Prone clause ("If the target is a Large or smaller creature, it has the Prone condition") never applies on hit. Consumer seam EXISTS in code; data field absent in monsters.json → data-gap FAIL of the clause (MV-9/MV-23 prose-clause family).

## Evidence (2026-09-16, test-campaign, live)
- Data grep: `public/data/monsters.json` arch-hag actions[1] has attack_bonus/damage_dice_primary/damage_type_primary/reach/range ONLY. No `hit_conditions`, no `hit_target_effect`, no automation.
- Consumer grep: `MonsterCardHelpers.buildHitConditionClause` (MonsterCardHelpers.js:354) reads `action.hit_conditions`; `handlePlainDamage.maybeApplyHitClause`→`applyHitClauseConditions` (handlePlainDamage.js:488-530) writes Prone to activeConditions + activeConditionMeta + condition log. No description-text parser for prone-from-attack exists.
- Live hit roll2: d20 11 +14=25 vs AC19 HIT (popup + change-data lastAttackRoll.hit=true). Damage exact: popup "3d6 + 7: 3, 5, 6 +7 = 21, HP 224→203"; log roll [3,5,6] total 21 ts 1789551227604; hp_change delta -21 currentHp 203 same ts. EXACT ts-paired.
- Prone after hit: EP activeConditions=['cursed'] only (no prone); zero condition-type log entries post-hit; EP initiative card DOM badge = "Cursed DC 22" only, no Prone badge.
- Live miss roll1: d20 2 +14=16 vs AC19 ✗ MISS; zero damage rolls, zero hp_change (EP 224 unchanged).

## Fix
Add `"hit_conditions": ["prone"]` to arch-hag Spectral Claw dict (no escape_dc; prone via badge per MA-0010 seam). No code change required.

## Verdict
Core damage PASS-exact; prone clause FAIL (data-gap, consistent with MA-0010-family prose-clause fingerprint). Overall row: PASS-subset only.
