# MA-0877 — Gnoll Fang of Yeenoghu · Bite (actions[1]) — FAIL(a)

## Verdict
**FAIL(a)** — condition-not-applied on hit. Damage half PASSES exact.

## Expected (from disk description, monsters.json gnoll-fang-of-yeenoghu actions[1])
> "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage, and the target has the **Poisoned** condition until the start of the gnoll's next turn."

## Actual (live, test-campaign, 2026-09-22, Bandit 1 AC12 maxHp999 four-key rig)
### Half A — combined damage: ✓ EXACT (all 4 hits)
Bite "+5" chip, `.mc-action:has(> strong:text-is("Bite."))`, real-pointer Done on `button.dice-roll-reroll-btn` (4/4 applied, adjudicated by hp_change §MA-0869):

| Press | d20+bonus | primary fd | secondary sfd | hp_change | breakdown |
|---|---|---|---|---|---|
| 1 | 15+5=20 ✓ | 7 (`1d6 + 3` Piercing) | 7 (`2d6` Poison) | −14 (999→985) | Piercing:7+Poison:7 |
| 2 | 18+5=23 ✓ | 4 | 6 | −10 (→975) | 4+6 |
| 3 | 19+5=24 ✓ | 8 | 8 | −16 (→959) | 8+8 |
| 4 | 8+5=13 ✓ | 6 | 9 | −15 (→944) | 6+9 |

Every damage entry: `note:"combined_damage_roll"`, `formula:"1d6 + 3"` + `secondaryFormula:"2d6"`, sum==|Δ| exact (§140/§190). Combined transport is CORRECT semantics here — "plus 7 (2d6) Poison" = rider (§MA-0871 rider-vs-versatile distinction), NOT a versatile swap. lastAttack press-1: bonus:5, d20:15, total:20 (=raw+5 ✓), hit:true, damageFormula "1d6 + 3", secondaryFormula "2d6", damageApplied:true, weaponType:"melee". Cosmetic-only: lastAttack.secondaryDamageType stamped "Piercing" (damage log + breakdown carry Poison correctly) — cosmetic, not the defect axis.

### Half B — Poisoned on hit: ✗ NEVER APPLIED (0/4 hits)
Condition probe after each resolve:
- `Bandit 1` change-data `activeConditions`: **null**; `activeConditionMeta`: **null**; zero keys matching /cond/i.
- Top-level `targetEffects`: **null**.
- Whole log: **ZERO** `type:"condition"` entries (§274 grant fingerprint absent).

## Likely Location
- **DATA**: `public/data/monsters.json` gnoll-fang-of-yeenoghu Bite row has NO `hit_conditions` key (disk-dumped this session: keys = name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary, damage_dice_secondary, damage_type_secondary).
- **Consumer machinery EXISTS but is UNARMED** (grep evidence):
  - `src/components/encounter/MonsterCardHelpers.js:597` `buildHitConditionClause` reads `action.hit_conditions` ONLY (returns null when absent; description NEVER read).
  - Threaded at `src/components/encounter/MonsterCardModal.jsx:817` (`hitClause: buildHitConditionClause(action)`).
  - Applied on hit by `src/hooks/combat/handlers/handlePlainDamage.js:507+` `applyHitClauseConditions` (canonical activeConditions + meta{source} + `type:"condition"` log).
- §153 family: manifest/description prose `conditions` never lands; missing `hit_conditions` = DATA FAIL (MA-0291/0361/0763/0795 lineage).

## Fix
One-field DATA: add `"hit_conditions": ["poisoned"]` after `damage_type_secondary` (MA-0794/MA-0795 byte-shape for secondary-carrying rows; MA-0763/MV-0621 poisoned shape). Duration "until start of gnoll's next turn" rides the standard latch (§68/§274 residual — no explicit clock authored on twins). No code change needed — consumer live.

## Notes
- Rider damage half: ✓ PASS (combined transport exact 4/4).
- MA-0876 corroboration (earlier TODAY, same monster): multiattack session already observed "Poisoned rider ABSENT — Bite lacks hit_conditions key on disk (§153), condition grant rides MA-0877 adjudication" — pre-flagged hypothesis fully confirmed live.
- Miss leg not obtained within ≤2-extra-press budget (4/4 vs AC12 = 70% hit band; cheap-miss abandoned, documented).
- Expiration round-wrap probe: N/A (condition never applied).
- Cleanup: admin-clear cd+log 200/200, quiet-recheck logLen 0 cdKeys 0, single tab, dev :5173 up.

## Session ledger
4 Bite presses, 4 hits, 0 misses; 4 combined damage entries + 4 hp_change exact; 0 condition entries; popup-overlay flushed after every log-confirm (§MA-0873); Bandit four-key maxHp999 stamp held 999→944 unclamped (§MA-0874).
