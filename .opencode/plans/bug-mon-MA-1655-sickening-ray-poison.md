# BUG MA-1655 — Vampire Umbral Lord Sickening Ray: Poisoned-on-hit never granted — FAIL(a)/DATA (2026-09-30)

## VERDICT
FAIL(a)/DATA. Core numeric axis LIVE (3/3 hits vs AC12, formula byte-exact, fd==|hpΔ| unclamped); the row's own hit-text rider "the target has the Poisoned condition until the start of the vampire's next turn" grants ZERO — `hit_conditions` ABSENT on disk, consumer chain live-unarmed. One-field DATA fix.

## Expected (manifest row MA-1655 / monsters.json actions[2] description quote)
> "Ranged Attack Roll: +10, range 120 ft. Hit: 16 (2d10 + 5) Necrotic damage, and the target has the Poisoned condition until the start of the vampire's next turn."

Expected behavior: every hit deals 2d10+5 Necrotic AND applies the Poisoned condition (attacker-next-turn duration).

## Disk truth (STEP 1)
- `public/data/monsters.json` vampire-umbral-lord actions[2] keys: `{name, description, attack_bonus:10, range:"120 ft.", damage_dice_primary:"2d10 + 5", damage_type_primary:"Necrotic"}` — description byte-matches manifest.
- ABSENT: `hit_conditions`, `hit_target_effect`, `hit_condition_roll`, `escape_dc`, `save_dc`, `save_type`, `save_effect`, `automation`. No `conditions` key (manifest `conditions:["poisoned"]` is prose-parsed; §1086 zero attack-path consumer).
- No escape clause ("until…" duration, not a save ends); no 2024 twin (/data/2024/ grep: no umbral monster).

## Consumer proof (live-unarmed)
- `hitClauseAutoGrantConditions` MonsterCardHelpers.js:826-829 — returns `[]` unless `Array.isArray(action.hit_conditions)`; description NEVER read.
- `buildHitConditionClause` :850-853 — returns `null` with zero conditions and zero riders → clause never armed.
- `applyHitClauseConditions` handlePlainDamage.js:553 — never invoked; §918/§950 fingerprint: attack-row prose condition text never grants.
- Same-row save alternative absent (no save_dc/save_effect → not MA-0586/§159 lane).

## Live hit-ledger (test-campaign, Bandit 1 ac12 HP999 resistances[])
| press | nat | total | hit | formula | dice | fd | Bandit HP |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 16 | ✓ vs AC12 | "2d10 + 5" | 6,1+5 | 12 | 999→987 |
| 2 | 6 | 16 | ✓ vs AC12 | "2d10 + 5" | 7,1+5 | 13 | 987→974 |
| 3 | 18 | 28 | ✓ vs AC12 | "2d10 + 5" | 5,1+5 | 11 | 974→963 |

- 3/3 hits (miss face nat≤1 ~5%/press, honest straddle §MA-1632; crit nat20 did not land, record-not-chase §32).
- fd==|hpΔ| per press unclamped at maxHp999; Σfd 36 == Σ|Δ| 36; damage entries dtype Necrotic, zero `secondary*` keys (by design); attack entries `total`=raw nat (§810), rolls-dupe [6,8]/[6,2]/[18,7] §414 fingerprint.
- ZERO Poisoned grants: log `type:"condition"` entries 0; log poison-text scan 0; victim `Bandit 1` change-data dict KEY-ABSENT (§1116 strictest zero-grant proof); top-level `targetEffects` KEY-ABSENT.
- Chip audit §442: Sickening Ray row = 1× "+10" mc-dice-link only (no DC chip; row-scoped §693 anchor vs Grave Strike "+10" twin §694 held — Grave Strike NEVER pressed). Hunger of Hadar "DC 18 Charisma" + Umbral Strike "Expend Legendary" UNPRESSED.
- Console: 0 app errors.

## Fix (DATA, one field)
In `public/data/monsters.json` vampire-umbral-lord actions[2], append after `damage_type_primary`:

```json
"hit_conditions": ["poisoned"]
```

Row after fix = byte-shape identical key-order to ranged poison twins:
- MA-0984 hill-giant Trash Lob actions[0] (`name, description, attack_bonus, range, damage_dice_primary, damage_type_primary, hit_conditions:["poisoned"]`) — perfect ranged byte-twin.
- MA-0621 dracolich SAME-NAME "Sickening Ray" legendary_actions[2] `hit_conditions:["poisoned"]`.
- MA-0763 gas-spore-fungus Tendril; MA-0775 ghast Claw `["paralyzed"]` analogue. No `escape_dc` on poison twins (none needed — duration ride, not grapple).

## §87 duration note
"until the start of the vampire's next turn" stays §70/§MA-1541 advisory after the fix: the hit_conditions/applyHitClauseConditions lane (:553) carries NO addExpiration clock — the attacker-next-turn clock lives only on the hit_target_effect lane. Post-fix grant = condition stamp + meta{source} + badge; expiry GM-enforced (accepted precedent MA-0984/MA-0763/MA-1541).

## Cleanup
Tab closed FIRST (§15) → admin/clear-change-data 200 (cd keys [], cs null double-unwrap §MA-1645) → admin/clear-log 200 (log 0). Board CLEARED after MA-1655.
