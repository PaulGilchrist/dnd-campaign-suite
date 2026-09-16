# Bug MA-0231 — Ancient Green Dragon "Unnamed lair actions 1" (lair_actions[0])

## VERDICT: FAIL (MA-0222/MA-0118 nameless-lair-gate fingerprint CONFIRMED live)

## Row
monsters.json `ancient-green-dragon.lair_actions[0]` — NAMELESS dict:
`{description:"Grasping roots and vines erupt in a 20-foot radius… DC 15 Strength saving throw or be restrained…", save_dc:15, save_type:"Strength"}` — NO `name` key.

## Evidence
### STEP 1 static
- Gate: `src/services/encounters/monsterLairActions.js:26` — `if (!row || typeof row !== 'object' || !row.name) return false;` HARD gate in `isLairRowClickable`, evaluated BEFORE the `save_dc` branch (:27). Nameless dict → `false` despite numeric `save_dc:15`/`save_type:"Strength"`.
- `lairRowAffordance` (:38-39) short-circuits to null → `resolveLairRow` save seam (:91-93) never reached.
- Render: `src/components/encounter/MonsterCardBody.jsx:340` — `!isLairRowClickable(la)` → static `mc-action` prose branch (MV-24).
- Consumers: no `grasping_roots` te key anywhere; only `targetEffectDefinitions.js:871` (mud-restrained, GM-enforced prose). Restrained-via-lair-save producer arm exists only behind the name-gated clickable chip → never reached.

### STEP 3/4 live (test-campaign, EB join, dragon card open, target LightfootHalfling)
- lair row[0] outerHTML: `<div class="mc-action"><strong>.</strong> <span>Grasping roots…</span></div>` — NO `.mc-dice-link` (0), NO buttons (0), NO href (0). Nameless rows render literal `<strong>.</strong>` header.
- Click on row: zero affordance — no save prompt, no popup, log delta 0, `targetEffects` null, no restrained te. Name-gated INERT despite numeric DC 15 STR.
- CONTROL (pipeline alive): `.mc-action` strong /^Rend/i inner `.mc-dice-link` ("+15") → popup "HIT (21 vs AC 14)", +1 roll log entry. Engine live; row defect isolated.

## Likely Location
1. `public/data/monsters.json` `ancient-green-dragon.lair_actions[0]` — nameless row (root cause, DATA authoring)
2. `src/services/encounters/monsterLairActions.js:26` — name-gate (correct-by-design per MV-24, protects ~600 static monsters)

## Fix (DATA authoring)
Give the row a `name` (e.g. `" Grasping Roots and Vines"`) + `save_effect` mirror carrying the restrained condition (sibling clickable-lair shape, MA-0107), so it routes through the save seam at authored DC 15 STR. Wilt-away/repeat-lair-action and DC 15 Strength-check-to-free = GM-adjudicated advisory residual (no rescue-engine consumer). Do NOT loosen the name-gate (producer-side fix, consumer gate untouched).

## Cleanup verified
Admin Clear Change Data + Clear Campaign Log (dialogs accepted); log `[]`; change-data `{}`; zero visible overlays.
