# Bug Report — MA-1546: Succubus "Charm" (Dominate Person) failed save applies NOTHING

**Verdict: FAIL** (per rubric FAIL(b): failed save applies no condition and no advisory)

## Manifest row

```json
{"id":"MA-1546","monster":"Succubus","monsterIndex":"succubus","actionName":"Charm","actionType":"save","saveDc":15,"saveType":"Charisma","description":"The succubus casts Dominate Person (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15)."}
```

## Environment

- Dev server `npm run dev` (Vite :5173 → Express :80), campaign `test-campaign` ONLY.
- EB exact "Succubus" + "Bandit" → Join Encounter → initiative: Succubus 1 (Init 22, HP 71), Bandit 1 (Init 5, HP 11).
- Target combobox on Succubus 1 set to Bandit 1 before firing.
- Charm row chip CONFIRMED on card: `button "DC 15 Charisma"` (sole Charm affordance).

## What works

1. **DC chip arms and fires**: pressing "DC 15 Charisma" prompts a CHA save for Bandit 1 (Quick-Roll face with Advantage/Disadvantage re-roll; no numeric override offered).
2. **DC enforced exactly at adjudication**: every adjudicated save logs `saveDc: 15`, `saveType: "Charisma"` against `Bandit 1`, attacker `Succubus 1`, `attackName: "Charm"`. Boundary honored: total 15 → success, total 10/7/5 → failure.
3. **No success-half-leak**: on successes nothing applied.

## FAIL(b) — failed save applies nothing

Captured FAILED faces (campaign log, `/api/campaigns/test-campaign/log`):

| total | saveDc | saveType | result |
|---|---|---|---|
| 7 | 15 | Charisma | failure |
| 5 | 15 | Charisma | failure |
| 10 | 15 | Charisma | failure |
| 5 | 15 | Charisma | failure |

Captured SUCCESS faces: 19, 20, 15 (≥ DC → success).

After ALL presses (failed and succeeded):

- `type: "condition"` log entries: **0** — no `charmed` badge, no `condition applied` record.
- `type: "automation"` advisory entries: **0** — no dominate/control advisory.
- `/change-data`: **no `Bandit 1` runtime key at all** — no `activeConditions`, no `activeConditionMeta`, no `targetEffects`; Bandit 1 HP 11/11 unchanged; combatSummary creature carries no conditions.
- `lastAttack` stamp confirms the producer side knows the gap: `"saveConditions": []`.

## Grep proof — why nothing lands

1. `public/data/monsters.json` (succubus → Charm): row carries ONLY `save_dc: 15`, `save_type: "Charisma"`. **No `save_effect`, no `conditions`/`saveConditions`, no automation metadata, no spell metadata** (`Dominate Person` / spell_level 8 exist only as prose in `description`).
2. `src/components/encounter/MonsterAction.jsx:122` — the DC chip builds `const saveConditions = extractConditionsFromSaveEffect(action?.save_effect);` → `save_effect` is undefined.
3. `src/components/encounter/MonsterCardHelpers.js:377-378` — `extractConditionsFromSaveEffect(saveEffect)` returns `[]` when `saveEffect` is not a string. So the chip presses with `saveConditions = []`.
4. `src/components/encounter/MonsterCardModal.jsx:1557,1568` — `buildAbilitySaveRollContext` threads `saveDc: action.save_dc` (works) and `saveConditions: []` (empty).
5. `src/hooks/combat/saveProcessing.js:653-658` — no `autoDamageFormula` → `applyDamagelessSaveConditions`; at `:1047-1048` it early-returns: `if (saveConditions.length <= 0) return;`. `applyFailedSaveConditions` (`:1057-1058`) likewise returns `false` on empty list — **failed save path terminates with zero writes, zero log**.
6. No name-based rescue exists: `charm_person`/`charm_monster`/`dominate_*` handlers (`src/services/automation/index.js:538-545`) are keyed to **PC spell-cast automation metadata**, never armed by a monsters.json save row; no succubus/Charm special case anywhere in `src/` (grep `succubus` → comment only, `MonsterCardHelpers.js:203`).

## Secondary cosmetic defect

The Quick-Roll popup for the NPC save renders **"⚠ DC Unknown — no success or failure"** (`src/components/char-sheet/DiceRollResult.jsx:375-377`, `showDcUnknown`) even though adjudication uses DC 15 correctly (log `saveDc: 15`). The save prompt should surface DC 15 CHA before Done.

## RAW notes

- Dominate Person = charmed condition + GM-controlled control. The app's mechanical floor is the `charmed` condition (canonical in `CONDITIONS`, `MonsterCardHelpers.js:55`; consumed by Draining Kiss prerequisite etc.). That floor never lands.
- Dominated-control layer is legitimately absent app-wide (CLA-325 §7 no-control-subsystem precedent — advisory would be acceptable); but even the advisory is missing.
- Bandit is Humanoid → valid Dominate Person target; no immunity interference.

## Suggested fix direction

Arm `saveConditions: ['charmed']` (+ duration note "until spell ends / ID, GM-enforced" per MA-0020/MA-0348 `conditionDurationNote` shape, dominated-control clause logged as GM-enforced advisory) for this row — either via authored `save_effect` on the Charm row in monsters.json or a narrowly-gated description parse for the innate "casts Dominate Person" wording (MA-0348 damageless-save precedent). Also thread `saveDc` into the NPC quick-roll popup.

## Cleanup performed

- Admin → Clear Change Data (accepted), Admin → Clear Campaign Log (accepted): log 0 entries, change-data cleared.
- Initiative → Clear (accepted): Succubus 1/Bandit 1 removed from combatSummary, round reset; residue is UI-pointer keys only.
