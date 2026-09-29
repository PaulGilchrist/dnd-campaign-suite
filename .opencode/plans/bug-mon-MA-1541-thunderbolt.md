# Bug MA-1541 — Storm Giant Thunderbolt: hit-condition rider unimplemented

**Verdict: FAIL** (attack + damage verified exact; hit-applied `blinded`/`deafened` never applied — no structured data on the authored row, no consumer for the free-text clause)

## Row
- Monster: Storm Giant (`storm-giant`), Action: Thunderbolt (`attack`, +14, range 500 ft.)
- Damage: `2d12 + 9` Lightning — single pool
- Manifest conditions: `["blinded","deafened"]`, duration "until the start of the giant's next turn" (no save)

## What passed
- **To-hit exact**: d20+14 fired twice → 12+14=26 HIT vs AC 12; 3+14=17 HIT vs AC 12. Miss arithmetically unreachable vs AC 12 (min total 15) — hit-only verification, documented.
- **Damage exact**: single pool `2d12 + 9` Lightning. Hit 1: `1, 5 +9` = 15 → HP 15 → 0. Hit 2 (Bandit healed to 100 to avoid death-masking): `12, 9 +9` = 30 → HP 100 → 70. Log `hp_change` deltas −15 and −30 match rolled totals exactly; `damageBreakdown` Lightning only.
- **Logs present**: attack rolls, damage roll (`formula: "2d12 + 9"`, `finalDamage`, `damageType: "Lightning"`), `hp_change` entries all logged.

## Failure — hit-condition rider
On both hits the Bandit gained **zero** conditions: no `blinded`/`deafened` badges on the tracker card, no `activeConditions`/`activeConditionMeta`/`targetEffects` write (no `Bandit 1` key ever appears in change-data: `keys: [AasimarTest, Storm Giant 1, __campaign__, __map__, activeCreatureName, combat-ui-viewingMonster, combat-ui-viewingMonsterCreatureName, combatSummary, lastAttack]`), and no condition-application log entry.

### Static root cause
1. **Authored data lacks the structured field.** `public/data/monsters.json` Storm Giant → Thunderbolt carries only: `attack_bonus, damage_dice_primary, damage_type_primary, description, name, range`. No `conditions`, no `hit_conditions`. The manifest's `conditions:["blinded","deafened"]` came from parsing the *description free text* ("Hit: … and the target has the Blinded and Deafened conditions until the start of the giant's next turn") — not real structured data.
2. **The rider consumer exists but reads only structured keys.** Grep evidence:
   - `src/components/encounter/MonsterCardHelpers.js:794` `hitClauseAutoGrantConditions` — `if (hitChoiceArmed(action) || !Array.isArray(action?.hit_conditions)) return [];` (returns empty for Thunderbolt)
   - `src/components/encounter/MonsterCardHelpers.js:818` `buildHitConditionClause` — returns `null` when `conditions.length === 0` and no riders
   - `src/components/encounter/MonsterCardModal.jsx:975` `buildAutoDamageOptions` mounts `hitClause = buildHitConditionClause(action)` onto the attack-roll options
   - `src/hooks/combat/useLoggedDiceRollAttack.js:208` passes `hitClause: context?.hitClause || null` into damage handling
   - `src/hooks/combat/handlers/handlePlainDamage.js:547-553` `applyHitClauseConditions` — the sole hit-condition grant point (`for (const cond of hitClause.conditions)`); never reached with non-empty conditions for this row.
   - `extractConditionsFromSaveEffect` (used to salvage conditions from free text) is wired **only** to save-effect rows (e.g. lair actions / breath weapons), never to the attack-hit path. No description-parsing fallback exists for attack rows.
3. **Duration clock**: moot — conditions never granted, so no "until start of giant's next turn" expiration metadata can exist.

### Live probe
- 2 Thunderbolt hits on Bandit 1 (survived second hit at HP 70). Page-wide grep for `Blinded|Deafened` after hits: only match is the stat-block description text. Zero condition delta, zero store write, zero condition log.

## Fix options
1. **Data fix (preferred, matches existing mechanism):** add `"hit_conditions": ["blinded","deafened"]` to the authored Thunderbolt row in `public/data/monsters.json` (83 rows already use this key). The existing `buildHitConditionClause → applyHitClauseConditions` seam then grants both conditions and stamps an attacker-next-turn expiry (see `handlePlainDamage.js:1046` `until the start of ${attackerName}'s next turn` reason pattern).
2. **Or** implement a description-clause parser for attack rows feeding `hitClause` (heavier; risks false positives across the 83 already-structured rows).

## Cleanup performed
- Initiative cleared (all NPCs removed), Admin → Clear Change Data (`change-data keys: []`) and Clear Campaign Log (`logEntries: 0`), all within `test-campaign` only.
