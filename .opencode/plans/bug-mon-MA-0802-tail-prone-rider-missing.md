# BUG MA-0802 — Giant Crocodile Tail: Prone-on-hit rider never granted (FAIL(a)/DATA one-field)

Row: `giant-crocodile|actions|2` — Tail, +8, reach 10 ft., 3d8 + 5 Bludgeoning, "If the target is a Large or smaller creature, it has the Prone condition."

## Verdict: FAIL(a) / DATA one-field fix (MA-0791 Talons byte-twin; MA-0763 same axis)

## Disk (public/data/monsters.json giant-crocodile actions[2], FULL)
```json
{"name":"Tail","description":"Melee Attack Roll: +8, reach 10 ft. Hit: 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the <strong>Prone</strong> condition.","attack_bonus":8,"reach":"10 ft.","damage_dice_primary":"3d8 + 5","damage_type_primary":"Bludgeoning"}
```
- `hit_conditions`: **ABSENT**. avg 18 = 3d8(13.5→13)+5 ✓ numeric prose honest.
- Consumer key-only: `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:561-562) reads `action.hit_conditions` ONLY → null → `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:513/600) never fires. Description never read (§52/§150).

## Live ledger (test-campaign, admin-cleared baseline log:[] cd:{}, EB joins exact td "Giant Crocodile"+"Bandit", Bandit AC12 Medium-or-Small resistances[] maxHp/currentHp 999 full-store cs POST, own-card target-select armed Bandit 1 before every chip, gridless reach-10 lenient §146)
| # | nat+8 | vs AC12 | damage formula | rolls | fd | hpΔ | Prone grant |
|---|-------|---------|----------------|-------|----|-----|-------------|
| 1 | 7+8=15 | HIT | "3d8 + 5" Bludgeoning | [1,4,7] | 17 | −17 (999→982) | ZERO |
| 2 | 20+8=28 | CRIT | "3d8*2+5 (2, 6, 7)" | [2,6,7] | 35 | −35 (→947) | ZERO |
| 3 | 6+8=14 | HIT | "3d8 + 5" Bludgeoning | [1,4,6] | 16 | −16 (→931) | ZERO |
| 4 | 16+8=24 | HIT | "3d8 + 5" Bludgeoning | [7,6,3] | 21 | −21 (→910) | ZERO |

- Numeric axis LIVE: total=nat+8 exact, hit iff nat≥4 (all 4 ≥4; no miss obtained — +8 vs AC12 structurally miss-light), formula byte-exact ×3 non-crit + crit dice-only doubling flat +5 undoubled (§32), |Δ|==fd every leg, distinct dice ×4 (§77 replay-suspicion dead), rangeReason:null gridless-lenient fingerprint (§197), console 0 errors.
- Prone axis DEAD on every HIT: whole-log `type:'condition'` entries = 0; Bandit change-data `activeConditions`/`activeConditionMeta` ABSENT; top-level `targetEffects` null. Prose-only rider = zero state (§150/§212 pattern).

## Fix (one DATA field, MA-0621/MA-0010 byte-shape)
Add `"hit_conditions":["prone"]` to giant-crocodile actions[2] (placed after `damage_type_primary`, sibling crocodile-Bite MA-0010 template). Large-or-smaller gate is already in the live consumer (handlePlainDamage); Bandit Medium passes. No code change — consumer live.

## Siblings on this axis (same fingerprint, own tickets)
- MA-0791 giant-axe-beak Talons (identical "Large or smaller → Prone" prose, hit_conditions absent).
- MA-0763 gas-spore-fungus Tendril (Poisoned rider, same key-gap).
- MA-0801 crocodile Bite (grappled+restrained+escape_dc two-field gap).

## Cleanup
Admin clear cd+log verified `log:[] cd:{}`. test-campaign ONLY; no manifest/git writes.
