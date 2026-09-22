# Bug MA-0831 — Giant Toad "Bite": grapple rider prose-only, ZERO grant

**Verdict: FAIL(a) / DATA one-field** (numbers axis live-exact; grapple authored-absent)

## Row
MA-0831 · giant-toad actions[0] · Bite · attack_bonus 4 · reach 5 ft.

## Disk (public/data/monsters.json giant-toad actions[0], FULL quote)
```json
{
  "name": "Bite",
  "description": "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 12).",
  "attack_bonus": 4,
  "reach": "5 ft.",
  "damage_dice_primary": "1d6 + 2",
  "damage_type_primary": "Piercing",
  "damage_dice_secondary": "2d4",
  "damage_type_secondary": "Poison"
}
```
- `damage_dice_secondary:"2d4"` + `damage_type_secondary:"Poison"` — **AUTHORED, rides live** ✓
- `hit_conditions` **ABSENT** · `escape_dc` **ABSENT** — grapple + escape DC 12 exist ONLY in prose.

## Machine proof (consumer live, key-only)
- `buildHitConditionClause` (MonsterCardHelpers.js:561) reads `action.hit_conditions`/`escape_dc` ONLY; description never read (§150/§59). Absent keys → `null` clause (MA-0010 seam).
- `applyHitClauseConditions` (handlePlainDamage.js:513) therefore never fires; escape-DC meta stamp (:529) unreachable.

## Live ledger (test-campaign, fresh session, header verified)
- Board admin-cleared first (cd `[]`, log 0). EB exact td-text joins Giant Toad + Bandit (Captain/Crime Lord/Deceiver traps avoided). Bandit 1 full-store cs POST maxHp/currentHp **999** read-back ✓. AC12 resistances[] clean victim (§75).
- 4 chip clicks / 4 attack entries, 4/4 FIRST-click zero-absorbed (§138 non-absorb family):
  - HIT nat19+4=23✓ · MISS nat2+4=6✗ (stage-1 Done-less backdrop dismiss §94, zero damage) · HIT nat8+4=12✓ AC12 honest tie-to-attacker boundary · HIT nat15+4=19✓
- Damage entries 3/3 = hits only, byte `formula:"1d6 + 2"` Piercing + `secondaryFormula:"2d4"` Poison, `note:"combined_damage_roll"` same entry (§140/§531):
  - fd6 [4] + secFD3 [1,2] → Δ−9 (999→990), brk Piercing6+Poison3
  - fd7 [5] + secFD6 [4,2] → Δ−13 (990→977)
  - fd5 [3] + secFD7 [3,4] → Δ−12 (977→965)
  - `|Δ|==fd+secFD` 3/3 exact; Σlegs 34 == Σ|hpΔ| == 999−965 unclamped chain (§181); distinct dice pools every roll (§77); `rangeReason:null` gridless-lenient fingerprint (§146); targetName Bandit 1 + AC12 on every entry.
- No nat20 in 4 honest attacks — crit recorded-not-forced (§32); crit twin quote MA-0825 same family: dice-doubled formula, flat mod undoubled (§189).

## Grapple axis (per-HIT audit, 3/3 hits) = ZERO GRANT
- `condition applied` entries: **0** · whole-log `/grappl|escape|restrain/i`: **0**
- Bandit 1 change-data keys: `[]` · `activeConditions`/`activeConditionMeta`: null
- Top-level `targetEffects`: absent · no escape-save badge/prompt
→ Grappled (escape DC 12) never lands = prose-only = **FAIL(a)**.

## Fix (DATA, no code)
Author MA-0010 byte-shape on giant-toad actions[0] (ankheg/MA-0807-family template):
`"hit_conditions": ["grappled"], "escape_dc": 12` — consumer live, grants + escape-DC meta on every hit (Medium-or-smaller gate: Bandit Medium, honest).

## Out of scope / advisory
- Swallow row (actions[1]) = MA-0808 twin PASS-subset shape, separate ticket.
- Sustained-grapple state machine = §59/§70 zero-consumer residual.

Console 0 errors. Cleanup: admin clear verified log `[]` cd `{}`; test-campaign only.
