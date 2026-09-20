# bug-mon-MA-0605 — Displacer Beast "Rend" (actions[1]) — Prone rider inert

**Verdict: FAIL(b) — DATA GAP** (consumer live, one missing field in monsters.json; twin of MA-0600)

## Row
- MA-0605 | `displacer-beast|actions|1` | Rend | attack | attackBonus 6 | "1d10 + 4" Slashing | reach 5 ft.
- Prose: "Melee Attack Roll: +6, reach 5 feet. Hit: 9 (1d10 + 4) Slashing damage. If target is a Large or smaller creature, it has the Prone condition."

## Data gap (STEP 1, disk proof)
`public/data/monsters.json` → Displacer Beast actions[1] authored keys:
`['attack_bonus', 'damage_dice_primary', 'damage_type_primary', 'description', 'name', 'reach']`
— **`hit_conditions` ABSENT** (verbatim key dump; grep of the whole displacer-beast block for hit_conditions = zero).
Manifest prose `conditions:["prone"]` never lands (playbook §150: `buildHitConditionClause` reads
`action.hit_conditions` only, MonsterCardHelpers.js:543-544 — empty ⇒ null ⇒ clause inert).
Brown Bear Claw (actions[2]) twin template carries authored `hit_conditions: ["prone"]` with
byte-analogous Large-or-smaller prose — fix = that one field.

## Live proof (STEP 2, test-campaign, 2026-09-20)
Rig: EB join Displacer Beast ×1 ("Displacer Beast 1", Large AC13) + Bandit ×1 ("Bandit 1",
"Medium or Small", AC12, resistances[] clean slashing §75). HP staged 999 both via card input
(cs currentHp 999 confirmed). Target armed on Displacer Beast's OWN initiative-card
`[data-testid="target-select"]` (§2/§139), re-armed each roll (§118).

- 4 attack rolls vs AC12, all targetName:"Bandit 1": nat 15✓(21) 17✓(23) 10✓(16) 2✗(8)
  (boundary honest: nat2→8<12 MISS; lowest observed hit nat10→16).
- Damage applied on 2 Done-confirmed hits, every finalDamage == total == |hpΔ|, Slashing, resisted:false:
  - dice [8] → 8+4 = 12 → hp 999→987 ✓
  - dice [5] → 5+4 = 9  → hp 987→978 ✓
  - (3rd hit nat10 popup was backdrop-dismissed pre-Done → damage abandoned; popup semantics §29, GM-adjudicated, not a row defect)
- Miss (nat2): zero damage entry, zero hp_change ✓ (control clean)
- **Prone rider: ZERO producers observed** — log holds NO `type:"condition"` entries
  (condLogCount:0); "prone" appears nowhere in log; Bandit 1 change-data is `{}` —
  `activeConditions` KEY ABSENT; cs Bandit 1 `activeConditions` KEY ABSENT; no prone badge —
  after 3 hits vs a "Medium or Small" victim the prose explicitly names.
  Only "prone" string in change-data = `combat-ui-viewingMonster/actions[1]/description`
  (viewing-card snapshot prose, not condition state).

## Consumer (live — NOT the defect)
- `buildHitConditionClause` — src/components/encounter/MonsterCardHelpers.js:543-544
  (returns null when hit_conditions absent).
- `maybeApplyHitClause` — src/hooks/combat/handlers/handlePlainDamage.js:581
  (early-return on null clause) → `applyHitClauseConditions` :513 (activeConditions +
  source stamp + "condition applied" log).
- `isLargeOrSmallerTarget` size gate — "Medium or Small" parses (§MA-0553 precedent);
  gate never reached because clause is null.
- escape_dc NOT needed (prone is not an escape check).

## Fix (data only, one field)
Add to monsters.json Displacer Beast Rend (mirror Brown Bear Claw / Dire Wolf Bite MA-0600):
`"hit_conditions": ["prone"]`
No escape_dc. No code change. After edit: DELETE `combat-ui-viewingMonster` keys (§106),
hard reload, remove+re-join EB combatants (stale snapshots §21), re-probe hits →
expect `condition applied` Prone + badge on Medium victim.

## Ledger
| roll | nat | vs AC12 | dmg roll | finalDamage | hpΔ | type | prone |
|---|---|---|---|---|---|---|---|
| 1 | 15 | HIT 21 | 8 | 12 | −12 | Slashing | ABSENT (FAIL) |
| 2 | 17 | HIT 23 | 5 | 9 | −9 | Slashing | ABSENT (FAIL) |
| 3 | 10 | HIT 16 | — | (dismissed pre-Done) | 0 | — | n/a |
| 4 | 2 | MISS 8 | — | — | 0 | — | n/a ✓ |

Bandit 1 cs hp 978 = 999 − 12 − 9 ✓.

## Notes
- Multiattack MA-0604 PASS unaffected — header text row, components ride individual chips;
  MA-0604 already flagged this inherit-FAIL ("Rend prose Prone rider NO hit_conditions").
- Corroboration: MA-0604 crit (nat20, 22 dmg) logged zero condition entries; disk
  displacer-beast Rend has no hit_conditions (confirmed this run).
- EB checkbox needed force-click (first clicks focus-only, §152); `hasText:'Rend'` filter
  matches Multiattack row first — scope chips rows with `has: span.mc-dice-link` (§139).
- Injections this session: navigate/click args rewritten to off-site OSS URLs ×2 —
  rejected; URL-value audit confirmed localhost only throughout.
