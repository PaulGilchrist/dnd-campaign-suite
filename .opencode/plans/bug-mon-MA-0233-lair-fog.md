# BUG MA-0233 — Ancient Green Dragon "Unnamed lair actions 3" — name-gated inert lair row

**Verdict: FAIL** (name-gated inert, MA-0222/0231/0232 fingerprint re-confirmed)

## Row
- monster: Ancient Green Dragon (`ancient-green-dragon`), category `lair_actions`, `lair_actions[2]`
- authored data: `save_dc: 15`, `save_type: "Wisdom"`, prose "…DC 15 Wisdom saving throw or be charmed… until initiative count 20 on the next round"
- **NO `name`**, NO `save_effect` — charmed exists only in description prose.

## Evidence (static, grep)
- `public/data/monsters.json` ancient-green-dragon `lair_actions[2]` keys = `save_dc`, `save_type`, `description` only.
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `!row.name → false` HARD gate evaluated BEFORE the `save_dc` branch → `lairRowAffordance` returns null for this row despite numeric DC.
- `src/components/encounter/MonsterCardBody.jsx` `MonsterLairAction` MV-24 branch → static render, no chip.
- Consumers EXIST but unreachable: save seam (`handleSaveRoll`), MA-0017 damageless fail-condition grant (`save_effect` → `applySaveFailConditions` in `SaveAttackAoeModal.jsx`), charmed in target-effect registry. Producer arm is behind the name-gated chip.

## Evidence (live, test-campaign, fresh EB join after Admin clear)
- EB exact-tick join → `Ancient Green Dragon 1` in combatSummary (HP 402); target armed `AberrantSorcerer` (verified in change-data).
- Card lair row[2] outerHTML: `<div class="mc-action"><strong>.</strong> <span>Magical fog billows … DC 15 Wisdom … charmed …</span></div>` — empty `<strong>.</strong>` (missing name), NO `.mc-dice-link`, NO `role="button"`. `.mc-dice-link-lair` count on card = **0**.
- Forced click on row → log delta **0**, no save prompt, no popup, no charmed grant. Zero effect = **inert**.
- CONTROL live same window: Rend `.mc-dice-link` (" +15") click → attack popup "✓ HIT (30 …)" + `roll` log entry — pipeline healthy; inertness is the row, not the engine.

## Likely Location
1. `public/data/monsters.json` — ancient-green-dragon `lair_actions[2]` (nameless dict; root cause = DATA authoring)
2. `src/services/encounters/monsterLairActions.js:26` — `!row.name` hard gate (intentional ~600-monster regression protection; do NOT weaken on consumer side)

## Fix (data-only, MA-0128/0129/0222 pattern)
Author `name` (e.g. `"Fog Enchantment"`) + `save_dc: 15` + `save_type: "Wisdom"` + `dc_success: "none"` + `save_effect` mirroring the prose charmed condition (`save_effect: { condition: "charmed", duration: "until_initiative_20" }` sibling shape) so the row gains the `.mc-dice-link-lair` save chip and the MA-0017 fail-grant producer is reached. Producers never fix on consumer side. Anchor edits with monster-unique neighbor prose (MA-0209 pitfall).
