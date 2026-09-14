# Bug mon-MA-0129 — Adult Red Dragon · "Unnamed lair actions 2" (tremor knock-prone) · inert raw-string row (MA-0117/0118/0128 fingerprint)

## Row
- MA-0129 · adult-red-dragon · lair_actions[1] · category lair_actions · type other · manifest claims `saveDc:15`, `saveType:"Dexterity"`, effect "knocked prone" (60-ft radius tremor, ground creatures other than the dragon).

## Step-1 static read (public/data/monsters.json, Adult Red Dragon lair_actions[1])
- **RAW STRING**, not a dict, not named:
  `"A tremor shakes the lair in a 60-foot radius around the dragon. Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone."`
- Prose CONFIRMS the row's numbers: DC 15 Dexterity, knocked prone on fail. But there are **no structured fields** (`name`/`save_dc`/`save_type`/`save_effect`) — nothing machine-readable for the affordance pipeline.
- "Unnamed lair actions 2" is the generator placeholder for the nameless entry. Sibling drift context: [0] magma geyser is a nameless dict with drifted dc:13/CON (MA-0128), [2] volcanic gases is also raw-string.

## Verdict
**FAIL — INERT ROW.** No named affordance exists; nothing can enforce DC 15 DEX or apply Prone. The correct numbers live only in prose.

## Defect
- `MonsterCardBody.jsx:339-340` `MonsterLairAction`: `typeof la === 'string'` hits the STATIC branch first — renders `DIV.mc-action` > sanitized description `<span>`. No `.mc-dice-link-lair`, no `role=button`, no `onClick`; `handleLairRow`/`resolveLairRow` never reached.
- `monsterLairActions.js:26` `isLairRowClickable`: requires an object WITH `row.name`; a raw string returns false. Header comment (:17-19): legacy plain-string rows "never become clickable" (~600 monsters regression-protected by design).
- No lair prone producer: prone has healthy CONSUMERS (`conditionUtils.js:40` CONDITIONS includes `prone`; applyConditionToTarget / conditionEffects / extractConditionsFromSaveEffect regex would match "prone"), but the lair path never reaches them for this row. Per MA-0115/42n there is also no `te.effect:'topple'` producer (toppleCleanup inert). No initiative-count-20 lair seam app-wide (only `LAIR_ADVISORY_NOTE` monsterLairActions.js:23, GM-enforced). No 60-ft-radius zone/shape consumer, no "other than the dragon / on the ground" gate producer.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state clean: change-data `{}`, log `[]` (0 entries, sha `97d170e1`). Adult Red Dragon not in test-monster-registry.json → EB re-Join: search "Adult Red Dragon" → tick → Join Encounter → cs[0] `Adult Red Dragon 1` npc HP 256/256 init 16. Armed via dragon-card `[data-testid="target-select"]` → cs[0].`targetName:"AasimarTest"` API-verified.
- Avatar click → `.mc-overlay` lair rows DOM: tremor row = `DIV.mc-action` > `SPAN` ("A tremor shakes the…"), `cursor:auto`, `mc-dice-link-lair:false`, `role:null`, `onclick:false`, `interactiveKids:0`. (Sibling [0] geyser = nameless-dict "." STRONG fallback; [2] gases raw-string static.)
- Trigger attempts ×9: synthetic pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + description span, `row.click()` ×3, then trusted `page.mouse.click` at row center → **0** `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal`, no "Saving Throw Required", no refusal popup.
- Zero-delta post: change-data adds ONLY `combat-ui-viewingMonster(+CreatureName)` display flags — all `lair|tremor|prone` text hits (11) are inside the `combat-ui-viewingMonster` card-prose snapshot, ZERO game-state keys; no `saveResult-*` (grep 0); AasimarTest `targetEffects:null` `activeConditions:null`. Log unchanged semantically: 2 entries total = `encounter joined` + `initiative roll` only; grep `lair|tremor|prone|dexterity` across log = 0 hits. Console 0 errors.
- **Control-probe (seam alive):** same campaign/session — EB Join Aboleth (cs `Aboleth 1` 150/150 init 19), arm AasimarTest, open card → named-dict lair chips render: "Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom"; click "DC 14 Strength" → live popup "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14. Half damage on successful save. Roll Save / Dismiss". Dismissed. Pipeline healthy → red-dragon tremor row is dead by its own raw-string shape, NOT a broken lair seam.

## Fix suggestion
Data fix in `public/data/monsters.json` lair_actions[1]: convert to named structured dict
`{ "name": "Tremor", "description": "<existing prose>", "save_dc": 15, "save_type": "Dexterity", "save_effect": "The target is knocked prone." }`.
Then `isLairRowClickable` passes, `lairRowAffordance` → `save`, and the MA-0024 seam (`handleSaveRoll` + `extractConditionsFromSaveEffect` — "prone" is in the canonical CONDITIONS list, MonsterCardHelpers.js:40) arms DC 15 DEX + Prone-on-fail. Manifest label updates from placeholder to "Tremor". Residuals to GM-adjudicate (no consumers, §7): 60-ft-radius area shape, "other than the dragon" exclusion, "on the ground" ground-contacts gate, initiative-20 cadence, 24-hour immunity.

## Cleanup
- test-campaign only: control save prompt Dismissed, both cards closed, POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (both 200), hard reload, post-debounce verify: change-data `{}` (2 B), log `[]` (2 B). Manifest `verified` untouched. EB monsters (dragon + Aboleth control) cleared with admin wipe — re-join expected per playbook.
