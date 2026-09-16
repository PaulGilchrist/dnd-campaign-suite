# MA-0255 — Ancient Silver Dragon lair actions[1] "Unnamed lair actions 2": inert despite numeric DC 15 CON save fields

## Overview
Ancient Silver Dragon `lair_actions[1]` (cold wind) carries complete authored save data — `save_dc:15`, `save_type:"Constitution"`, `damage_dice_primary:"1d10"` Cold, `save_effect:"Failure: 5 (1d10) Cold damage."` — but NO `name` key, so the row renders as inert static prose (`<strong>.</strong>` + text) with zero clickable affordance. The DC/type/dice are never consumed: no save prompt, no damage, no log, ever. FAIL — exact MA-0222 name-gate fingerprint (cf MA-0254 lair[0] raw-string, same card).

## Expected
"Unprotected flames... must succeed on a DC 15 Constitution saving throw or take 5 (1d10) cold damage" → clickable `.mc-dice-link-lair` save chip ("DC 15 Constitution") firing the existing save seam (`handleSaveRoll` via `resolveLairRow` affordance `'save'`), half-on-success, 1d10 Cold on fail — as the NAMED lair dicts do (aboleth Grasping Tide DC14 STR live, MA-0118; adult-silver-dragon lair[1] "Cold Wind" template on disk, MA-0136 family).

## Actual
- Header test-campaign ✓; dragon init 15, HP 468/468, AC 22.
- Row[1] outerHTML: `<div class="mc-action"><strong>.</strong> <span>A blisteringly cold wind …</span></div>` — `hasDiceLink:false, hasRoleButton:false`, children `["STRONG.","SPAN."]`, firstStrongText `"."` (empty name renders as stray "."). Zero affordance despite `save_dc:15`.
- Click row + inner span → ZERO delta: log 131→131, lair/cold-wind log entries 0→0, no popup/sp-overlay (0→0), row HTML identical.
- Control probe (engine alive): `Paralyzing Breath` "DC 24 Constitution" chip click → live `.sp-overlay` picker ("90-ft Cone … Constitution saving throw (DC 24)") → Skip closed cleanly (sp=0).
- Static: `monsters.json` ancient-silver-dragon `lair_actions[1]` dict has save_dc/save_type/save_effect/dice, NO `name`; `lair_actions[0]` raw string (MA-0254).

## Steps
1. test-campaign → Initiative (dragon init 15) → open dragon card (.mc-overlay via persisted combat-ui-viewingMonster after reload).
2. Lair Actions → row[1]: static `<strong>.</strong>`+prose, no chip, no role=button.
3. Click row → no prompt, log unchanged 131→131, lair entries 0.
4. Control: Paralyzing Breath chip → sp-overlay cone picker live → Skip → overlays 0.

## Likely Location
- **DATA**: `public/data/monsters.json` `ancient-silver-dragon.lair_actions[1]` missing `name` key (fix template on disk: adult-silver-dragon lair[1] "Cold Wind" named dict with save_dc:15 + dc_success:"half" — MA-0074/MA-0136 pattern).
- **Engine gate**: `monsterLairActions.js:26` `isLairRowClickable` — `!row.name → false` HARD gate precedes save_dc branch (:27) and `lairRowAffordance` dc-branch (:42); `MonsterCardBody.jsx:340` static MV-24 fallback renders the empty-strong prose row.

## Notes
- Consumer status: lair save seam IS live for named dicts (MA-0118 aboleth control probe; MA-0107 `lair_dream_plane` grant in saveProcessing.js:617-643; zone consumer handleLairZone) — producer arm behind the name-gated chip is never reached for this nameless dict. Data-only fix, zero code change.
- Prose typo: description embeds "1dlO" (letter-O) for 1d10 — cosmetic; data field `damage_dice_primary:"1d10"` is correct.
- Registry delta: none made (per instructions).
## VERDICT: FAIL
