# bug-mon-MA-0600 — Dire Wolf "Bite" (actions[0]) — Prone rider inert

**Verdict: FAIL(b) — DATA GAP** (consumer live, one missing field in monsters.json)

## Row
- MA-0600 | `dire-wolf|actions|0` | Bite | attack | attackBonus 5 | "1d10 + 3" Piercing | reach 5 ft.
- Prose: "Hit: 8 (1d10 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition."

## Data gap (STEP 1, disk proof)
`public/data/monsters.json` → Dire Wolf actions[0] authored keys:
`['attack_bonus', 'damage_dice_primary', 'damage_type_primary', 'description', 'name', 'reach']`
— **`hit_conditions` ABSENT**. Manifest prose `conditions:["prone"]` never lands
(playbook §150: `buildHitConditionClause` reads `action.hit_conditions` only;
MonsterCardHelpers.js:543-547 — empty ⇒ null ⇒ clause inert).
Fingerprint: MA-0291/0361 family (fixed-app-wide precedent: Brown Bear Claw actions[2]
carries authored `hit_conditions: ["prone"]` with byte-identical prose clause).

## Live proof (STEP 2, test-campaign, 2026-09-20)
Rig: EB join Dire Wolf (cs "Dire Wolf 1", Large AC14) + Bandit qty1 ("Bandit 1",
Medium or Small, AC12, resistances[] clean piercing §75). HP staged 999 via card input.
Target armed on Dire Wolf's OWN initiative card select (§2/§148).

- 7 attack rolls vs AC12, all targetName:"Bandit 1": nat 20✓ 11✓ 9✓ 13✓ 9✓ 8✓ 6✗
  (boundary honest: nat6→11<12 MISS; lowest observed hit nat8).
- 6 damage rolls, every finalDamage == total == |hpΔ|, Piercing, resisted:false:
  - crit nat20: rolls[5] → 13 = 2×5+3 (dice doubled, flat mod not) ✓
  - normal hits: 9+3=12, 3+3=6, 9+3=12, 10+3=13, 1+3=4 ✓
  - hp chain: 999−(13+12+6+12+13+4)=939 matches cs currentHp ✓
- Miss (nat6): zero damage entry, zero hp_change ✓ (damageCount 6 == hitCount 6)
- **Prone rider: ZERO producers observed** — log holds NO `type:"condition"` entries
  (condLogCount:0), "prone" appears nowhere in log or change-data, Bandit 1 change-data
  `activeConditions` KEY ABSENT, no badge, after 6 hits vs Medium victim.

## Consumer (live — NOT the defect)
- `buildHitConditionClause` — src/components/encounter/MonsterCardHelpers.js:543
  (armed via attack context; returns null when hit_conditions absent).
- `maybeApplyHitClause` — src/hooks/combat/handlers/handlePlainDamage.js:581
  (early-returns at :583 on null clause) → `applyHitClauseConditions` :513
  (activeConditions + activeConditionMeta.source stamp + "condition applied" log).
- `isLargeOrSmallerTarget` size gate :488/:584 — handles "Medium or Small" (§MA-0553);
  Bandit 1 size parses fine, gate never reached because clause is null.
- escape_dc NOT needed (prone is not an escape check; escapeDc optional at :529).

## Fix (data only, one field)
Add to monsters.json Dire Wolf Bite (mirror Brown Bear Claw):
`"hit_conditions": ["prone"]`
No escape_dc. No code change. After edit: delete `combat-ui-viewingMonster` keys,
hard reload, re-join, re-probe hits → expect `condition applied` Prone + badge on Medium victim.

## Ledger
| roll | nat | vs AC12 | dmg roll | finalDamage | hpΔ | type | prone |
|---|---|---|---|---|---|---|---|
| 1 | 20 crit | HIT 25 | 5 | 13 | −13 | Piercing | ABSENT (FAIL) |
| 2 | 11 | HIT 16 | 9 | 12 | −12 | Piercing | ABSENT (FAIL) |
| 3 | 9 | HIT 14 | 3 | 6 | −6 | Piercing | ABSENT (FAIL) |
| 4 | 13 | HIT 18 | 9 | 12 | −12 | Piercing | ABSENT (FAIL) |
| 5 | 9 | HIT 14 | 10 | 13 | −13 | Piercing | ABSENT (FAIL) |
| 6 | 8 | HIT 13 | 1 | 4 | −4 | Piercing | ABSENT (FAIL) |
| 7 | 6 | MISS 11 | — | — | 0 | — | n/a ✓ |
