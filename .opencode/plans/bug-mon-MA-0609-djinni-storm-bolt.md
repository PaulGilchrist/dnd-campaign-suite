# bug-mon-MA-0609 — Djinni "Storm Bolt" (actions[2]) — Prone rider inert

**Verdict: FAIL(b) — DATA GAP** (consumer live, one missing field in monsters.json; ranged twin of MA-0600/MA-0605; save_effect decoy per §115/MA-0522)

## Row (Expected, verbatim)
- MA-0609 | `djinni|actions|2` | Storm Bolt | attack | attackBonus 9 | "3d8" Thunder | range 120 feet
- Prose: "Ranged Attack Roll: +9, range 120 feet. Hit: 13 (3d8) Thunder damage. If the target is a Large or smaller creature, it has the Prone condition."
- Manifest conditions: ["prone"]

## Data gap (STEP 1, disk proof)
`public/data/monsters.json` → Djinni actions[2] authored keys:
`['attack_bonus', 'damage_dice_primary', 'damage_type_primary', 'description', 'name', 'range', 'save_effect']`
- **`hit_conditions` ABSENT**, **`hit_target_effect` ABSENT**.
- `save_effect: "If the target is a Large or smaller creature, it has the Prone condition."` present on a
  row with **NO `save_dc`** → §115/MA-0522 decoy: save_effect never consumed on a no-save_dc attack row;
  only `hit_conditions` arms the hit path (§150: `buildHitConditionClause` reads `action.hit_conditions`
  only, MonsterCardHelpers.js:544 — empty ⇒ null ⇒ clause inert).
- `canRollExpression("3d8")` = true (diceRoller.js) — dice transport fine, rider is the sole gap.

## Live proof (STEP 2, test-campaign, 2026-09-20)
Rig: EB join Djinni ×1 ("Djinni 1", Large AC17) + Bandit ×1 ("Bandit 1", "Medium or Small", AC12,
resistances clean thunder). HP staged 999 both via card current-HP input (cs currentHp 999 confirmed).
Target armed on Djinni 1's OWN initiative-card `[data-testid="target-select"]`, re-armed each roll.
Gridless session → range 120ft lenient (rangeReason:null, never consulted — §range note).

- Storm Bolt row renders ONE `+9` attack chip, NO DC chip (render-level decoy confirm).
- 3 attack rolls vs AC12, all targetName:"Bandit 1": nat 1✗(10, crit-miss) nat10✓(19) nat9✓(18)
  (AC-flip honest: nat1+9=10<12 MISS; hits 19, 18 ≥12).
- Damage applied on both Done-confirmed hits, every finalDamage == total == |hpΔ|, Thunder, resisted:false, modifier 0:
  - 3d8:[3,4,4] → 11 → hp 999→988 ✓
  - 3d8:[5,2,1] → 8 → hp 988→980 ✓
- Miss (nat1): zero damage entry, zero hp_change ✓ (control clean)
- **PRONE rider: ZERO producers observed** —
  - log: condLogCount 0 (`type:"condition"` entries = none); "prone" appears NOWHERE in log
  - change-data: only `/combat-ui-viewingMonster/actions/2/description` + `/actions/2/save_effect`
    strings (viewing-card snapshot prose, NOT condition state); Bandit 1 absent from change-data keys
  - cs Bandit 1 `activeConditions` KEY ABSENT; no prone badge on Bandit card —
    after 2 hits vs a "Medium or Small" victim the prose names.
  - lastAttack: saveDc:null saveType:null dcSuccess:null statusEffects:null — attack chip
    rode no save; save_effect decoy never transported (§117/MA-0551 attack-chip nulls save fields).

## Consumer (live — NOT the defect)
- `buildHitConditionClause` — src/components/encounter/MonsterCardHelpers.js:544
  (returns null when hit_conditions absent).
- `maybeApplyHitClause` — src/hooks/combat/handlers/handlePlainDamage.js:581
  (early-return on null clause) → `applyHitClauseConditions` :513 (activeConditions + source stamp +
  "condition applied" log).
- `isLargeOrSmallerTarget` size gate handles "Medium or Small" (§MA-0553); gate never reached.

## Fix (data only, one field)
Add to monsters.json Djinni Storm Bolt (mirror Brown Bear Claw / MA-0600 / MA-0605 template):
`"hit_conditions": ["prone"]`
No escape_dc. Optionally delete decoy `save_effect` or leave (inert). No code change. After edit:
DELETE `combat-ui-viewingMonster` keys (§106), hard reload, remove+re-join EB combatants (stale
snapshots §21), re-probe hits → expect `condition applied` Prone + badge on Medium victim.

## Ledger
| roll | nat | vs AC12 | dmg roll | finalDamage | hpΔ | type | prone |
|---|---|---|---|---|---|---|---|
| 1 | 1 crit-miss | MISS 10 | — | — | 0 | — | n/a ✓ |
| 2 | 10 | HIT 19 | 3,4,4 | 11 | −11 | Thunder | ABSENT (FAIL) |
| 3 | 9 | HIT 18 | 5,2,1 | 8 | −8 | Thunder | ABSENT (FAIL) |

Bandit 1 cs hp 980 = 999 − 11 − 8 ✓.

## Notes
- Ranged prone family: MA-0600 (Dire Wolf Bite, melee), MA-0605 (Displacer Beast Rend, melee),
  MA-0602/0361 fingerprint — this is the first RANGED member (+ range 120ft lenient gridless).
  Identical one-field gap: prose names Prone, transport field missing.
- MA-0609 adds the save_effect-decoy wrinkle over its twins: prose duplicated into `save_effect`
  on a no-save_dc row = §115 decoy; fix is still `hit_conditions:["prone"]` only.
- Multiattack MA-0607 PASS-unaffected: header-text row ("three attacks, Storm Blade or Storm Bolt");
  components ride individual chips, inherit this rider's inertness (same flag as MA-0604→MA-0605).
- Corroboration (MA-0607 disk+live): Storm Bolt 3d8 Thunder +9 120ft exact; live hit damage exact;
  prone rider inert: save_effect with no save_dc + no hit_conditions → zero condition entries ever observed.
