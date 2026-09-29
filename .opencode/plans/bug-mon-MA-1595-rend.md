# Bug Report — MA-1595: Tiger "Rend" — base attack live, "Large or smaller → Prone" rider INERT

**Verdict: FAIL(a)** — primary attack confirmed LIVE exact (+5, 2d6 + 3 Slashing, crit 4d6+3), but the hit-clause Prone rider grants NOTHING. `monsters.json` tiger actions[0] has **no `hit_conditions`** (MA-1555 Swarm-of-Crawling-Claws prose-only twin), so `applyHitClauseConditions` is never armed.

## Manifest row

```json
{"id":"MA-1595","monster":"Tiger","monsterIndex":"tiger","category":"actions","actionIndex":0,"actionType":"attack","actionName":"Rend","attackBonus":5,"damageDicePrimary":"2d6 + 3","damageTypePrimary":"Slashing","reach":"5 ft.","conditions":["prone"],"description":"Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition."}
```

(Row `conditions: ["prone"]` — prose-derived intent that the disk data does not carry.)

## Environment

- Dev server `npm run dev` (Vite :5173 → Express :80), campaign `test-campaign` ONLY (header verified).
- EB exact "Tiger" + "Bandit" → Join Encounter → initiative: Tiger 1 (Init +3), Bandit 1 (AC 12, HP raised 999).
- Tiger 1 row target combobox → `Bandit 1` (server confirmed `combatSummary.creatures[0].targetName = "Bandit 1"`).
- Card opened via avatar (`img[alt="Tiger 1"]` → `.mc-overlay`); chip CONFIRMED: `span.mc-dice-link "+5"` on the Rend row.

## Expected (RAW, per description)

> "Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. **If the target is a Large or smaller creature, it has the Prone condition.**"

Bandit 1 is Medium (≤ Large) → every non-crit-relevant HIT should stamp `prone` into `activeConditions` + log a `type: "condition"` entry.

## Actual — base LIVE, rider INERT

Live attack faces (roll modal + campaign log + `/api/campaigns/test-campaign/change-data`):

| d20 | total vs AC 12 | result | damage | Bandit HP |
|---|---|---|---|---|
| 20 | 25 | CRIT HIT | `2d6*2+3 (3, 6)` = **21** Slashing | 999 → 978 |
| 17 | 22 | HIT | `2d6 + 3 (2, 5)` = **10** Slashing | 999 → 989 (baseline re-set) |
| 4 | 9 | MISS (≤6 ✓) | none | unchanged 989 |

- Base verified exact: bonus +5, formula `2d6 + 3`, type Slashing, crit doubles dice to 4d6+3 (log formula `2d6*2+3`, total 21, `hp_change delta:-21`; normal hit `total:10`, `delta:-10`). MISS face applied zero damage.

- **Prone rider INERT after a HIT:**
  - `combatSummary.creatures[Bandit 1]`: `activeConditions: null`, `targetEffects: null`, `conditions: null`.
  - `/change-data` JSON full scan: **`prone` occurrences = 0**.
  - Campaign log (`data/campaign-log.json`, 10 entries at capture): **prone = 0**; zero `type: "condition"` entries; only initiative/attack/damage/hp_change/encounter-joined records.
  - Bandit initiative row UI: no Prone badge (only on-page "Prone" text was the card's prose description).

## Steps to reproduce

1. `npm run dev` → localhost:5173 → select **test-campaign**.
2. Encounters (EB) → search "Tiger" ✓, "Bandit" ✓ → **Join Encounter**.
3. Initiative → click Tiger 1 avatar → card; set Tiger 1 target combobox → Bandit 1; raise Bandit HP.
4. Press Rend **"+5"** chip → Done → damage popup → dismiss.
5. Observe: correct +5 / 2d6+3 Slashing / crit 4d6+3 / miss no-damage — **but Bandit never gains Prone**.

## Likely Location

`public/data/monsters.json` → `tiger.actions[0]` (Rend): disk row carries only `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`, `description`. **No `hit_conditions: ["prone"]`** — exact twin of MA-1555 (Swarm of Crawling Claws / "Swarm of Grasping Hands" row, same prose-only "Medium or smaller → Prone" structure, also no `hit_conditions` on disk).

Consumer chain (why nothing lands):
1. `src/components/encounter/MonsterCardHelpers.js` — `hitClauseAutoGrantConditions(action)`: `if (hitChoiceArmed(action) || !Array.isArray(action?.hit_conditions)) return [];` → `[]` for Rend.
2. `buildHitConditionClause(action)` → conditions empty + no rider payload → returns **null**.
3. `src/components/encounter/MonsterCardModal.jsx:975` — `const hitClause = buildHitConditionClause(action);` → null; `:986` `autoDamageFormula` stays null; `:993` `hitClause: null`.
4. `src/hooks/combat/handlers/handlePlainDamage.js:998` — `applyHitClauseConditions` is only called with an armed clause → never runs for Rend → no `activeConditions` write, no `activeConditionMeta` provenance, no `type:"condition"` log.

## Notes

- The **Medium-or-smaller gate** ("Large or smaller" in the 2024 text) is unexpressible today: the hit-clause lane (`hit_conditions` + `applyHitClauseConditions`) has no size-gate field, so granting is unconditional — acceptable here since the app's typical NPC targets (Bandit = Medium) satisfy the gate; RAW-wrong only vs Huge+ targets.
- Fix = author `hit_conditions: ["prone"]` into tiger actions[0] (lane already proven live by MA-0010/MA-1111/MA-1357/MA-1402 test lineage); add a size-gate field (`size_gate`) if the ≤ Large qualifier must be enforced mechanically.
- Cleanup done: initiative cleared, Admin → Clear Change Data + Clear Campaign Log (verified: change-data keys 0, campaign-log file removed, prone count 0 everywhere).
