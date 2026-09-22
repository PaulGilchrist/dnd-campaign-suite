# Bug MA-0776 — Ghast Gravecaller Horrific Necrosis: Frightened-on-Hit rider never granted (FAIL(a)/DATA)

## Row
MA-0776 `ghast-gravecaller|actions|2` Horrific Necrosis — "Melee or Ranged Attack Roll: +7, reach 5 ft. or range 120 ft. Hit: 15 (2d10 + 4) Necrotic damage, and the target has the Frightened condition until the end of its next turn."

## Verdict: FAIL(a) — DATA, one-field fix (§150, §206/§212 codified — NOT advisory; MA-0775 same-monster same-day byte-twin)

## Disk truth (public/data/monsters.json ghast-gravecaller actions[2], quoted full)
```json
{
 "name": "Horrific Necrosis",
 "description": "Melee or Ranged Attack Roll: +7, reach 5 ft. or range 120 ft. Hit: 15 (2d10 + 4) Necrotic damage, and the target has the <strong>Frightened</strong> condition until the end of its next turn.",
 "attack_bonus": 7,
 "reach": "5 ft.",
 "range": "120 ft.",
 "damage_dice_primary": "2d10 + 4",
 "damage_type_primary": "Necrotic"
}
```
- `hit_conditions`: **ABSENT** — the ONLY transport the hit-rider consumer reads.
- `hit_target_effect` / `hit_condition_roll`: ABSENT. `save_dc`/`save_type`/`save_effect`: ABSENT (correct — RAW rider has no save).
- `damage_dice_ranged`: ABSENT (see dual-mode axis).
- avg check: avg(2d10)=11+4=15 ✓ printed. reach+range authored as SEPARATE fields (no "N/M" slash → §146/§195 band-inert N/A).

## Code seam (grep-proven)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:561; :562 reads `action.hit_conditions` key only) → returns null for this row; description never parsed.
- `maybeApplyHitClause` (src/hooks/combat/handlers/handlePlainDamage.js:581) early-returns on null clause → zero grant, zero log.

## Live E2E proof (test-campaign, 2026-09-21, :5173 CAMPAIGN_LOCK, header verified)
EB join exact td-text "Ghast Gravecaller" + "Bandit"; cs idx0 ghast-gravecaller, Bandit 1 AC12 resistances[] maxHp999 (full-store cs POST 200). Arm Bandit 1 on Ghast own-card target-select FIRST. Chip "+7" via `.mc-action` strong startsWith("Horrific Necrosis") — single chip (§116), lands after retry (§138 absorbed-family; ledger integrity held: 4 attack/4 damage/4 hp_change, no orphan entries).

| # | nat+7 | vs AC12 | dice | fd | Σdice+4 | HP chain |
|---|-------|---------|------|----|---------|----------|
| 1 | 10+7=17 | ✓ | [4,2]+4 | 10 | 10 ✓ | 999→989 |
| 2 | 13+7=20 | ✓ | [3,8]+4 | 15 | 15 ✓ | 989→974 |
| 3 | 9+7=16 | ✓ | [7,6]+4 | 17 | 17 ✓ | 974→957 |
| 4 | 5+7=12 | ✓ honest tie boundary | [2,2]+4 | 8 | 8 ✓ | 957→949 |

- **Numeric axis PASS**: 4/4 attacks bonus:7, total=raw nat (§33), all "2d10 + 4" Necrotic, fd==Σdice+4 exact, |hp_change|==fd exact, ΣΔ50=10+15+17+8 unclamped; distinct dice pools §77; no nat20 → no crit variant; lastAttack{total:12,hit:true,formula:"2d10 + 4",saveDc:null,saveType:null} (§156 decoy-clean); rangeReason:null + attackRange unstamped on all attacks = gridless-lenient fingerprint (§197) despite authored range 120 ft.
- **Rider axis FAIL**: **0/4 hits** granted Frightened. Whole-log grep `frightened` = 0 entries (substring-free of UUID-hex risk §190); zero `condition applied`; change-data has NO "Bandit 1" key at all (activeConditions/activeConditionMeta never written); top-level `targetEffects` absent; sole cd hit = cosmetic combat-ui-viewingMonster snapshot (echoes row description). Console 0 errors.
- **Dual-mode axis — ADVISORY, design-absence not FAIL (§147/§190/§436)**: `damage_dice_ranged` ABSENT disk → ranged chooser never arms (MonsterCardHelpers.js:739/748 field-gated). Live: popup buttons pre-Done = **["Done"] only**; whole-document + `.mc-overlay` + popup `[role=switch]/radiogroup/tablist` audit WITH popup OPEN = **0/0/0** (§147 proof surface). "Melee or Ranged" dice-swap seam is codified absent app-wide (MA-0325/0436/0657) — gridless-lenient single "+7" chip is expected behavior.

## Fix
One DATA field, MA-0621/MA-0763/MA-0775 byte-shape: add `"hit_conditions": ["frightened"]` to ghast-gravecaller actions[2] (after damage_type_primary). Consumer live on any authored row — zero code change. Duration "until end of next turn" rides the standard hit-clause expiry (MA-0766/0767 durationNote precedent).
