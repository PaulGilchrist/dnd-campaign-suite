# Bug mon-MA-0096 — Adult Copper Dragon · "Unnamed lair actions 1" (spike growth) · MV-24 inert (nameless dict blocks the MA-0024 affordance)

## Row
- MA-0096 · adult-copper-dragon · lair_actions[0] · type other · `save_dc:15`, `save_type:"Dexterity"`, `save_effect:"The target is restrained."`, conditions [restrained], spike_growth-equivalent, duration "until the dragon uses this lair action again or until the dragon dies".
- **Placeholder flag:** row has NO `name` key → manifest label "Unnamed lair actions 1" is a generator placeholder; live overlay renders `<strong>.</strong>` (empty header, corroborated in probe).

## Verdict
**FAIL** — inert row (MV-24 fingerprint). No affordance, no DEX DC 15 roll, no restrained application, no logs.

## Defect
- The app DOES now have a lair-action affordance pipeline (new since MA-0074/75/85/86): `monsterLairActions.js` (`isLairRowClickable`/`lairRowAffordance`/`resolveLairRow`, MA-0024) routes structured save rows through the same save seam as legendary rows, wired at `MonsterCardBody.jsx:339-373` (`MonsterLairAction`, `.mc-dice-link-lair` span) → `MonsterCardModal.jsx:1132 handleLairRow` → `handleSaveRoll(action, saveDamageFormula, extractConditionsFromSaveEffect(save_effect))`.
- **Gate:** `isLairRowClickable` (:26) returns false unless `row.name` is truthy — even for dicts carrying `save_dc`. Copper's lair_actions[0] has save metadata but no `name` → falls into the static `<div className="mc-action">` branch (`MonsterCardBody.jsx:340-352`): inert span, cursor auto, 0 interactive children. `save_dc:15`/`save_type:"Dexterity"`/restrained never reachable.
- If it HAD a name, `lairRowAffordance` → 'save' and the seam is credible ("The target is restrained." parses via canonical extractConditionsFromSaveEffect), but that path is never taken — per strict verdict policy, metadata behind a dead gate = FAIL.
- No lair initiative anywhere: header comment + `LAIR_ADVISORY_NOTE` state "GM-enforced — no initiative lair seam". No turn-start save registered for this zone; "until lair action again / until dragon dies" duration unmodeled (§7 zone seam). `npcStatBlockUtils.js` nulls `lair_actions`; targetEffectDefinitions.js has no spike/restrained-by-lair entry.

## Grep (consumers)
- `lair` in src/: monsterLairActions.js (+test), MonsterCardBody.jsx, MonsterCardModal.jsx, npcStatBlockUtils.js (null), monsterLegendaryUses.js, plus "clairvoyant"/"declared"-style substring noise in automation/rest files. server/: zero real consumers (test-name noise only).

## E2E evidence (2026-09-13, localhost:5173, test-campaign)
- EB search "Adult Copper Dragon" → tick → Join Encounter → cs: `Adult Copper Dragon 1` npc, HP 184, init 3. Dragon card `[data-testid="target-select"]` → AasimarTest armed (`targetName:"AasimarTest"` verified in cs).
- Baseline cd sha `c00ab0dd…` (2,328 B); log 2 entries.
- Avatar click → `.mc-overlay` "Lair Actions" section: spike row = `DIV.mc-action`, cursor auto, `firstChildTag STRONG` text `"."` (nameless fallback), interactiveKids 0, no `.mc-dice-link`.
- Forced pointerdown/up+mousedown/up+click+dblclick+`.click()`×3 ×2 rounds on the row (hit-target = description SPAN): 0 modals, 0 "Saving Throw Required" prompts. "DC 15" visible in DOM = static row description text only.
- Zero-delta: post cd adds ONLY `combat-ui-viewingMonster` (display flag incl. embedded statblock lore containing "restrained"); no `saveResult-*`, no pendingSavePrompts, no targetEffects/activeConditions deltas. Log post = same 2 entries (join + initiative roll); lair|spike|restrain|save hits = 0.

## Fix suggestion
Add `name:"Spike Growth"` (canonical) to monsters.json lair_actions[0] — the existing save seam then arms at DC 15 DEX with restrained via extractConditionsFromSaveEffect. Duration ("until used again/dies") needs a GM-remove convention or a keyed zone te + re-use replacement; no initiative-20 cadence exists (advisory per MA-0024 design). Same gate kills Copper's lair_actions[1] (raw mud string, MV-24 family).

## Tool-echo anomaly note
Throughout the run, navigate/type parameter echoes carried mismatched junk URL/target strings while the executed code and landed page were always the intended localhost:5173 flows (URL-value check: landing URL correct; actions matched intent). Treated as harness echo corruption per playbook guidance — no off-localhost navigation occurred.
