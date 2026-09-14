# Bug mon-MA-0119 — Adult Green Dragon · "Unnamed lair actions 3" (fog → Charmed) · inert raw-string row (MA-0097/MA-0118 fingerprint)

## Row
- MA-0119 · adult-green-dragon · lair_actions[2] · category lair_actions · type other · manifest claims `saveDc:15`, `saveType:"Wisdom"`, effect "charmed by the dragon until initiative count 20 next round".
- **Authored source (public/data/monsters.json lair_actions[2], static read):** a RAW STRING, not a dict — "Magical fog billows around one creature the dragon can see within 120 feet of it. The creature must succeed on a DC 15 Wisdom saving throw or be charmed by the dragon until initiative count 20 on the next round."
- **Numbers CONFIRMED in source prose:** DC 15 Wisdom ✓, Charmed-by-dragon ✓, init-count-20 expiry clause ✓ — but ONLY as prose; no `name`/`save_dc`/`save_type`/`save_effect` machine-readable fields exist (string scalar). "Unnamed lair actions 3" is pure manifest-generator fabrication; live DOM renders the prose with NO header.

## Verdict
**FAIL** — inert row (raw-string fingerprint, identical to MA-0097 Copper-mud / MA-0118 Green-thorn-wall). No affordance, no WIS DC 15 roll, no Charmed applied, no expiry, no logs, no refusal popup.

## Defect
- `MonsterCardBody.jsx:339` `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` — string short-circuits to the static branch (:341-343): plain sanitized `<span>` inside `DIV.mc-action`, cursor auto, zero interactive children, no onClick. Header comment :334-338: "legacy plain-string rows (and nameless dicts, MV-24) keep the static render untouched (~600 monsters regression-protected)". `handleLairRow`/`resolveLairRow` never reachable.
- `monsterLairActions.js:26` `isLairRowClickable` name-gate is never even reached for strings; even if lifted to a nameless dict it fails `!row.name → false` (MA-0117 gate).
- Even if named + save-legit, `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:53) would apply Charmed with NO initiative-count-20 expiry — grep `initiative.?count.?20` (src+server, non-test): ZERO hits; only `LAIR_ADVISORY_NOTE` (monsterLairActions.js:23, "GM-enforced — no initiative lair seam").
- No fog/charm lair te: `targetEffectDefinitions.js` lair registry is ONLY `lair_darkness`(:776)/`lair_insect_cloud`(:785)/`lair_sand_cloud`(:794) — no `lair_fog`/charm te. Grep `charmed by the dragon|fog.*lair|lair.*fog` (src+server, non-test): ZERO producers. Charmed has generic spell/consumer paths but zero lair-path producer.
- `npcStatBlockUtils.js` nulls `lair_actions` for non-lair flows.

## Grep (consumers)
- `charmed by the dragon|fog.*lair|lair.*fog` (src/, server/, non-test): ZERO hits — no fog-charm producer anywhere.
- `initiative.?count.?20` (src/, server/, non-test): ZERO hits — no initiative lair seam by design (advisory per MA-0024).
- lair te registry (`targetEffectDefinitions.js`): `lair_darkness`/`lair_insect_cloud`/`lair_sand_cloud` only (:776/785/794). No fog/charm entry.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state: campaign empty (change-data `{}`, log `[]`) → re-Join per registry. EB search "Adult Green Dragon" → tick → Join Encounter → cs[0] `Adult Green Dragon 1` npc, HP 207/207, init 19.
- Armed via initiative-card Target select → cs[0].`targetName:"AasimarTest"` API-verified (target-select needed trusted `selectOption`; synthetic native change-dispatch no-opped).
- Baselines: cd sha `5c2bac1f` (2285 B); log sha `3bb553b1` (2 entries).
- Avatar click → card open, h5 "Lair Actions" + `.mc-section` with 3 `.mc-action` rows. **Target row lair_actions[2]: `childTags ["SPAN."]`**, firstChild `<span>Magical fog billows around one creature…` — NO `<strong>` header, `.mc-dice-link-lair` false, `role` null, `hasOnClick` false, `interactiveKids` 0, cursor auto. String-branch static render confirmed live. Siblings [0] nameless-dict `"."` fallback (MA-0117) and [1] raw string (MA-0118) — all three inert.
- Trigger attempts: trusted Playwright click on row + synthetic pointerdown/up+mousedown/up+click+dblclick on row+span + `row.click()`×3 → 0 `.sp-overlay`, 0 `.popup`, 0 `.mc-prerequisite-refusal`, 0 "Saving Throw Required" prompts.
- Zero-delta: post cd sha `3b78b07d` adds ONLY `combat-ui-viewingMonster`+`combat-ui-viewingMonsterCreatureName` display flags (opened card); removed none; cs[0].targetName still AasimarTest; no `saveResult-*`, no pendingSavePrompts, no lair/fog/charm keys; AasimarTest targetEffects/activeConditions null. Log post sha `3bb553b1` UNCHANGED (2 entries); regex `lair|fog|charm|save|wisdom` across entire log = 0 hits. Console: 0 errors.
- Seam-alive control: established in MA-0118 (same fingerprint test) — Aboleth named-dict lair rows render `.mc-dice-link-lair` role=button and fire live "Saving Throw Required — DC 14" popup. Pipeline healthy; the fog row is dead by its own raw-string shape, not a broken lair seam.

## Fix suggestion
Data-shape fix: author `lair_actions[2]` → `{name:"Fog Charm", save_dc:15, save_type:"Wisdom", save_effect:"The target is charmed by the dragon."}` — then the MA-0024 save seam arms DC 15 WIS and `extractConditionsFromSaveEffect` applies Charmed on fail. Residuals beyond the seam (GM-adjudicate): the "until initiative count 20 on the next round" expiry has NO consumer (no initiative lair seam app-wide; condition would persist until manually cleared — flag in bug-report), "different lair action each round" cadence, 24h immunity, and fog-as-zone/obscurement state (no zone te; register `lair_fog` te in targetEffectDefinitions.js if a zone model is added). String short-circuit (MonsterCardBody.jsx:339) + name-gate (monsterLairActions.js:26) are the dead wires either way. Same family as MA-0097/MA-0108/MA-0118.

## Cleanup
- test-campaign only: card closed, POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log — both 200 ("Change data cleared"/"Campaign log cleared"), verified empty (`{}` / `[]`). Manifest `verified` untouched. Dragon combatant removed via campaign clear (EB monsters don't survive admin-clear; re-join is expected).

## Tool-echo anomaly note
Navigate/type/click/evaluate parameter echoes again carried mismatched junk (aliyuncs-style proxy URLs) while executed code and landed URLs were always the intended localhost:5173 SPA flows — verified by landing-URL value (`http://localhost:5173/`) and UI-state corroboration at every step (campaign select → EB join → arming → overlay → inert fog-row probe → click rounds → zero-delta → cleanup). Treated as harness echo corruption per AGENTS/playbook guidance; no off-localhost action occurred.
