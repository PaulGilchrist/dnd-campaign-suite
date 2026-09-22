# Bug MA-0775 — Ghast Gravecaller Claw: Paralyzed-on-Hit rider never granted (FAIL(a)/DATA)

## Row
MA-0775 `ghast-gravecaller|actions|1` Claw — "+6, reach 5 ft. Hit: 13 (3d6 + 3) Slashing damage. If the target isn't an Undead, it has the Paralyzed condition until the end of its next turn."

## Verdict: FAIL(a) — DATA, one-field fix (§150, MA-0763 byte-twin; NOT §70 advisory per §212)

## Disk truth (public/data/monsters.json ghast-gravecaller actions[1])
```json
{
 "name": "Claw",
 "description": "Melee Attack Roll: +6, reach 5 ft. Hit: 13 (3d6 + 3) Slashing damage. If the target isn't an Undead, it has the <strong>Paralyzed</strong> condition until the end of its next turn.",
 "attack_bonus": 6,
 "reach": "5 ft.",
 "damage_dice_primary": "3d6 + 3",
 "damage_type_primary": "Slashing"
}
```
- `hit_conditions`: **ABSENT** — the ONLY transport the consumer reads.
- `save_dc`/`save_type`/`save_effect`: absent (correct — RAW rider has no save).

## Code seam (grep-proven)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:561) reads `action.hit_conditions` / `hit_target_effect` / `hit_condition_roll` keys only; description never parsed → returns null for this row.
- `maybeApplyHitClause` (src/hooks/combat/handlers/handlePlainDamage.js:581-583) early-returns on null clause → zero grant, zero log.
- "isn't an Undead" immunity gate: NO consumer app-wide (`Undead` grep in handlePlainDamage.js/buildHitConditionClause = zero hits; only creatureTypeResolver.test.js). Victim Bandit is Medium non-Undead → grant must fire regardless of the immunity clause; clause absence is moot for this adjudication. `isLargeOrSmallerTarget` gate (:584) passes Medium.

## Live E2E proof (test-campaign, 2026-09-21, :5173, CAMPAIGN_LOCK)
EB join exact td-text "Ghast Gravecaller" + "Bandit"; cs idx0 ghast-gravecaller AC16, Bandit 1 AC12 maxHp999 (full-store cs POST 200). Arm Bandit 1 on Ghast own-card target-select FIRST. Claw chip "+6" via `.mc-action strong startsWith('Claw')`. 4 fires, 4/4 hit, zero chips absorbed:

| # | nat+6 | vs AC12 | dice | fd | HP chain |
|---|-------|---------|------|----|----------|
| 1 | 10+6=16 | ✓ | [6,6,3]+3 | 18 | 999→981 |
| 2 | 18+6=24 | ✓ | [6,1,6]+3 | 16 | 981→965 |
| 3 | 6+6=12 | ✓ honest boundary | [6,4,1]+3 | 14 | 965→951 |
| 4 | 14+6=20 | ✓ | [5,5,2]+3 | 15 | 951→936 |

- Numeric axis PASS: every damage entry formula "3d6 + 3" Slashing, fd==Σdice+3 exact, |hp_change|==fd exact, ΣΔ63=18+16+14+15; distinct dice per pool kills §77 cached-replay; roll.total=raw d20 (§33); lastAttack.saveDc/saveType/dcSuccess null (§156 decoy-clean); rangeReason:null gridless-lenient (§197).
- Rider axis FAIL: **0/4 hits** produced `condition applied`; Bandit change-data `activeConditions`/`activeConditionMeta` keys ABSENT (never written); top-level `targetEffects` absent. 4/4 zero-grant.

## Fix
One DATA field, MA-0621/MA-0763 byte-shape: add `"hit_conditions": ["paralyzed"]` to ghast-gravecaller actions[1] (after damage_type_primary). Consumer is live on any authored row — no code change. Undead-immunity prose stays advisory (no consumer, consistent with registry-wide precedent).
