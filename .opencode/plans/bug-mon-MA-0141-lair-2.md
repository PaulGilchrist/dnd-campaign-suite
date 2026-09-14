# Bug mon-MA-0141 — Adult Silver Dragon · "Unnamed lair actions 2" · inert raw-string lair row (MA-0118 data-shape fingerprint)

## Row
- MA-0141 · adult-silver-dragon · `lair_actions[1]` · category lair_actions · type other.
- Manifest label "Unnamed lair actions 2" = generator placeholder — source entry has no name (raw string, MV-24 family).

## Verdict
**FAIL** — inert row. `lair_actions[1]` is a **raw string** in monsters.json; `MonsterCardBody.jsx` `MonsterLairAction` routes `typeof la === 'string'` to the static branch (:339-346) BEFORE any affordance, so no `.mc-dice-link-lair`, no save prompt, no DC 15 CON save, no cold-wind damage, no logs. Per playbook "Lair-row clickability is DATA-shape dependent (MA-0118)": raw-string → inert FAIL.

## Static read (public/data/monsters.json, Adult Silver Dragon lair_actions[1])
- Type: **string** (not a dict). True text:
  > "A blisteringly cold wind blows through the lair near the dragon. Each creature within 120 feet of the dragon must succeed on a DC 15 Constitution saving throw or take 5 (1dlO) cold damage. Gases and vapors are dispersed by the wind, and unprotected flames are extinguished. Protected flames, such as lanterns, have a 50 percent chance of being extinguished."
- Authored-in-prose (only): DC 15, Constitution save, 5 (1d10) cold damage (with letter-O "1dlO" typo, MV-25 family). No machine-readable `save_dc`/`save_type`/`damage_dice_primary` keys exist (string has no fields); no `name` → not clickable.
- Sibling `lair_actions[0]` is a nameless dict (DC 15 CON cold legs + fog-cloud description drift) — already FAILed in bug-mon-MA-0140-lair-1.md.

## Grep (producers / seams)
- `src/components/encounter/MonsterCardBody.jsx:339` — `typeof la === 'string' || !isLairRowClickable(la)` → static `<div class="mc-action">` span-only render; `handleLairRow`/`resolveLairRow` never reached.
- `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable` requires object + `row.name`; comment confirms legacy plain-string rows "never become clickable".
- Cold wind / blisteringly / fog cloud lair producers: grep `cold.?wind|blisteringly|fog.?cloud` across src+server = zero lair consumers (only a `Fog Cloud` wizard pre-select in getPreSelectedSpells.js — not a lair path).
- `src/services/combat/conditions/targetEffectDefinitions.js` lair te registry = ONLY `lair_darkness`(:776) / `lair_insect_cloud`(:785) / `lair_sand_cloud`(:794) — no cold-wind, gas-dispersal, or flame-extinguish te.
- Initiative-count-20 seam: grep `initiative.?20` = advisory note only (monsterLairActions.js:23 LAIR_ADVISORY_NOTE, card tooltip, tests). "Lasts until initiative count 20" / "each round" cadence unenforceable app-wide (§7 residual).

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state clean: change-data `{}` (2 B), log `[]` (0 entries). Adult Silver Dragon NOT in docs/test-monster-registry.json → fresh EB Join per playbook §2.
- EB search "Adult Silver Dragon" → tick → Join Encounter → cs[0] `Adult Silver Dragon 1` npc, HP 216/216, AC 19, init 19 (API-verified).
- Armed dragon card (card idx 0 via `img[alt="Adult Silver Dragon 1"]`) target-select → `selectOption("AasimarTest")` → cs[0].targetName `AasimarTest` API-verified. Baseline log sha `e371eb3fa0b0`, 2 entries.
- Avatar click → `.mc-overlay` → "Lair Actions" heading → row children:
  - row0 (lair_actions[0]): `DIV.mc-action`, cursor auto, firstStrong ".", 0 interactive children.
  - row1 (lair_actions[1], THIS ROW): `DIV.mc-action`, **cursor auto, hasDiceLinkLair false, role null, onclick false, interactiveKids 0**, text = full raw cold-wind string (357 chars). `mc-dice-link-lair` count in section = **0**.
- Trigger attempts: pointerdown/mousedown/pointerup/mouseup/click/dblclick dispatch + `row.click()`×2 + span click, then a **trusted** Playwright click on the row: visibleOverlays 0, no `.sp-modal`, body text has no "Saving Throw Required".
- Zero-delta post-triggers: change-data adds only `combat-ui-viewingMonster`/`...CreatureName` display flags; no `saveResult-*`, no lair keys; `AasimarTest` block = `{fanaticalFocusUsed, hitPoints}` only (targetEffects/activeConditions absent); log sha **unchanged** `e371eb3fa0b0` (2 entries), regex `lair|fog|cold|wind|save` across log = **0 hits**.
- **Control-probe (seam alive, same session/campaign):** EB join Aboleth → cs[1]; arm target AasimarTest (API-verified targetName); open card → `.mc-dice-link-lair` ×3 role=button ("Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom"); click "DC 14 Strength" → live `.sp-modal`: "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14 — Half damage on successful save". Prompt Dismissed. The MA-0024 lair save pipeline works for NAMED structured rows; silver row is dead by raw-string data shape only.

## Defect summary
1. Data-shape gap: `lair_actions[1]` (and lair_actions[0]) are unstructured/nameless — cannot reach the clickable save affordance despite DC/type/damage being derivable from prose.
2. No producer exists for the row's mechanical clauses even if it were clickable: 120-ft wind area, gas dispersal, flame extinguishing, and initiative-count-20 duration all have zero consumers (grep-zero; §7 no initiative lair seam).

## Fix suggestion
Data fix (MA-0024 model): convert `lair_actions[1]` to
`{"name":"Cold Wind","description":"A blisteringly cold wind blows through the lair near the dragon. Each creature within 120 feet of the dragon must succeed on a DC 15 Constitution saving throw or take 5 (1d10) cold damage. Gases and vapors are dispersed by the wind, and unprotected flames are extinguished. Protected flames, such as lanterns, have a 50 percent chance of being extinguished.","save_dc":15,"save_type":"Constitution","damage_dice_primary":"1d10","damage_type_primary":"Cold","save_effect":"Failure: 5 (1d10) cold damage. Success: half damage."}`
(also fixes the "1dlO" letter-O typo). The existing save seam then enforces DC 15 CON half-on-success. Residuals to flag GM-advisory: 120-ft area gate, gas/flame extinguishing clauses, initiative-20 cadence (no producers).

## Cleanup
- test-campaign only: save prompt Dismissed, cards closed, `POST /api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` → both 200; verified empty (change-data `{}`, log `[]`). Manifest `verified` untouched. Registry: Silver Dragon join left in cleared campaign (join erased by clear); no registry edit made.

## Tool-echo note
All Playwright tool code-echoes this session wrapped `page.goto/locator` on **localhost:5173** — URL value compared and matched the requested URL each time; per AGENTS.md the wrapper syntax alone is expected and benign. No off-host navigation issued or obeyed.
