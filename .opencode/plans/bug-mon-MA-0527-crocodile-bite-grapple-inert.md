# MA-0527 — Crocodile Bite: Grappled/Restrained rider inert (DATA fix)

**Verdict:** FAIL(b) — MA-0434 claw-prone / MA-0522 couatl-poisoned twin.

## Row
Crocodile (`index: crocodile`) actions[0] Bite, +4 melee reach 5 ft., `damage_dice_primary: "1d8 + 2"`, Piercing. Prose riders: "If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition."

## Disk shape (public/data/monsters.json)
- `hit_conditions`: ABSENT
- `escape_dc`: ABSENT
- `hit_target_effect`: ABSENT
- Grapple lives ONLY in `description` + `save_effect` prose. `save_effect` is unconsumed on attack rows (no save_dc/save_type; plain-damage path never reads it).

## Live proof (test-campaign, :5173, 2026-09-19)
- EB Join: Crocodile 1 + Bandit 1 (AC12, resistances[], staged 999hp via full-store `/combatSummary` `{value}` POST). Target armed on Crocodile's OWN initiative-card `[data-testid="target-select"]`.
- 3/3 hits on "+4" chip: nat20 CRIT, nat18, nat13 (all ≥8 vs AC12).
- Damage exact: crit `formula "1d8*2+2 (6)" rolls:[6] total:14 isCrit:true` (flat +2 correctly NOT doubled), hp_change −14; normals `formula "1d8 + 2"` totals 8 and 10, hp_change −8/−10. Type Piercing on every entry.
- Grapple adjudication ZERO: post-hit Bandit 1 `activeConditions: None`, `activeConditionMeta: null`, top-level `targetEffects: null`, 0 `condition applied` log entries, no escape-dc stamp anywhere.

## Root cause
`buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526) reads ONLY `action.hit_conditions` / `action.escape_dc` / `action.hit_target_effect`; consumed live on hit by `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:488, MA-0010 seam — writes activeConditions + meta.dc = escapeDc + condition-applied log). The seam is LIVE but un-armed: Crocodile row authors none of the structured keys, so hits pay damage with zero condition state.

## Fix (data, monsters.json actions[0])
```json
"hit_conditions": ["grappled", "restrained"],
"escape_dc": 12
```
Note: Medium-or-smaller gate — RAW gate unmodellable by MA-0010 clause (no size filter in applyHitClauseConditions); Bandit (Medium) victim accepted as RAW-valid. If size gate required, needs structured extension — ticket separately.

## Cleanup / registry
Admin clear change-data + log, own-curl verified empty (keys [], log 0). Registry: Crocodile newly placed in docs/test-monster-registry.json, JSON.parse disk-checked.
