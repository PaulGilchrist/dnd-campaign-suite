# BUG MA-1530 — Steam Mephit "Steam Breath": fail-leg Speed−10 rider zero-state (FAIL(a)/DATA)

**Row:** steam-mephit|actions|1 | DC 10 Constitution, 15-foot Cone, 2d4 Fire, dcSuccess half (default, RAW-correct).
**Verdict:** FAIL(a) — 2d4 Fire core adjudicates exact both faces, but RAW fail-clause "the target's Speed decreases by 10 feet until the end of the mephit's next turn" has ZERO transport and is NOT documented as GM-advisory (unlike MA-0303 tail note for the same row). MA-1451/1489/1520 standard.

## Static (disk public/data/monsters.json actions[1])
- save_dc 10, save_type Constitution, damage_dice_primary "2d4", damage_type_primary Fire, range "15-foot Cone" — all numeric/parseable ✓
- Speed−10: PROSE-ONLY in description/save_effect. No structured field (no hit_target_effect / speed_reduction / hit_conditions / automation / zone).
- Pickers arm flat/halved/zero Speed only via save_effect regexes: parseSpeedHalfClause `/speed is halved/i` (Helpers:70), parseSpeedZeroClause `/speed is 0\b/i` (:81), parseSlowedClauses (:145). NOTHING matches "Speed decreases by N feet" (grep `decreases by` app-wide: only frozen_grip registry comment at targetEffectDefinitions.js:1230).
- SaveAttackAoeModal + MonsterCardModal grep ZERO `hit_target_effect` → MA-0995/MA-1147 hit-route one-field fix shape does not reach the picker/save route.
- Consumers are LIVE: te `speed_reduction` registered (targetEffectDefinitions.js:1279, value default 10), conditionEffects.js:386 folds `speedReduction += te.value||10`, badge ConditionEffectBadges.js:185 "Speed -N" → this is a producer/data gap, not a zero-consumer flavor.
- parseBothOutcomesClause (Helpers MA-0303) byte-inert for this row's tail ("Steam Mephit resistance notes" named in comment) ✓ — tail correctly grants nothing.

## LIVE E2E (test-campaign, Steam Mephit 1 17hp + Bandit 993, battle-arena cone gate satisfied by placing adjacent NPC tokens renamed to exact combatant names)
| Face | Save | 2d4 raw | finalDamage | hpΔ | Rule check |
|---|---|---|---|---|---|
| SAVE | nat14 +0 ≥10 | [2,4]=6 | 3 | −3 (993→990) | floor(6/2)=3 ✓ §96 |
| FAIL | nat6 +0 <10 | [4,3]=7 | 7 (FULL) | −7 (990→983) | full on fail ✓ |

- save-damage entry carries saveResult/saveDc:10/saveType:Constitution/dcSuccess:"half" machine truth ✓ (§96).
- Chip "DC 10 Constitution" → picker "15-ft Cone (GM positions tokens; selection advisory)", Bandit selectable AFTER token placement; with no tokens on positioned-map, picker PRE-CHECK drops all targets (rangeCheck.js:30; §62 known).
- FAIL-leg Speed audit: targetEffects null, activeConditions null, whole-log `speed` grep = 0 entries, results popup copy "Failed — takes 7 Fire damage" only — zero transport, zero advisory surface.

## Fix design (producer needed; consumer exists)
One DATA+CODE pair on picker route, MA-0146 speed_zero shape:
1. `parseSpeedReduceClause(saveEffect)` → `/speed\s+decreases?\s+by\s+(\d+)\s+feet/i` → `{effect:'speed_reduction', value:N}` (byte-inert for rows without clause).
2. Thread MonsterCardModal:433 conePicker → SaveAttackAoeModal prop → resolveSaveFailGrant: registerTargetEffect `speed_reduction` value:N + ONE addExpiration clock (until attacker-next-turn → rounds:1 anchor advisory twin MA-0995/MA-1147) + grant log "Speed Reduced −N ft".
3. Refire scoping: per-(caster,target) dedupe so repeat breaths replace not stack (value additive in consumer — conditionEffects:386 accumulates).
Siblings carrying identical picker-route clause text to audit same pass: steam-mephit only among mephits; ice-mephit Frost Breath has no speed clause.

## Cleanup done
Admin Clear Change Data + Clear Campaign Log via Admin UI (dialogs accepted, verified server-side: log 0, change-data keys []). Session tokens removed from battle-arena (placedItems []). Map activeMapName runtime key cleared with cd.

(2026-09-28, MA-1530 run; MA-1531 stirge|actions|0 not run.)
