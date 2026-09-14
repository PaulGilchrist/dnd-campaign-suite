# Bug mon-MA-0097 — Adult Copper Dragon · "Unnamed lair actions 2" (mud/sink-restrain) · inert raw-string row (worse than MA-0096: not even a dict)

## Row
- MA-0097 · adult-copper-dragon · lair_actions[1] · type other · manifest label "Unnamed lair actions 2" (generator placeholder).
- **Authored source (monsters.json lair_actions[1]):** a RAW STRING, not a dict: "…ground turns into 3-foot-deep mud… DC 15 Dexterity saving throw or sink into the mud and become restrained… action to attempt a DC 15 Strength check… moving 1 foot costs 2 feet… initiative count 20 the mud hardens, Strength DC to 20."
- **Placeholder flag confirmed:** the entry has NO `name` key at all (no keys of any kind — string scalar). "Unnamed lair actions 2" is pure manifest fabrication; live DOM renders the prose with no header.

## Verdict
**FAIL** — inert row (MV-24 fingerprint, raw-string variant). No affordance, no DEX DC 15 roll, no restrained/slowed application, no logs, no refusal popup.

## Defect
- `MonsterCardBody.jsx:340` `MonsterLairAction`: `typeof la === 'string'` short-circuits to the static branch (:343-344) — plain sanitized `<span>` inside `DIV.mc-action`, cursor auto, zero interactive children. The `isLairRowClickable` name-gate (`monsterLairActions.js:26`, which already killed MA-0096's nameless dict) is never even reached; strings are excluded by type.
- Even if lifted to a dict, unresolvable-by-design: no `save_dc`/`attack_bonus`/`advisory`/`zone`/`damage_dice_primary` fields — DC 15 DEX and DC 15 STR exist only as prose. `lairRowAffordance` would return 'advisory'-nothing/unresolvable without authored metadata (header comment :17-19: "Legacy plain-string rows (and nameless dicts, MV-24) never become clickable").
- DC 15 DEX / restrained / mud-hardens-on-init-20 / difficult-terrain (2 ft per 1 ft) never reachable. No lair initiative seam anywhere (`LAIR_ADVISORY_NOTE` monsterLairActions.js:23: "GM-enforced — no initiative lair seam"); "mud hardens on initiative 20" unmodelable (§7 zone seam gap).
- `targetEffectDefinitions.js` registry: has `lair_darkness` / `lair_insect_cloud` / `lair_sand_cloud` but NO mud/sink/restrained-by-lair entry — no te producer or consumer exists for this effect even if the row became clickable.

## Grep (consumers)
- `lair` in src/: monsterLairActions.js (+4 lair modal tests: lair-actions/darkness/insect-cloud/sand-cloud), MonsterCardBody.jsx, MonsterCardModal.jsx (:1132 handleLairRow → resolveLairRow), npcStatBlockUtils.js (nulls lair_actions), monsterLegendaryUses.js, targetEffectDefinitions.js (:776/785/794). server/: zero real consumers (test-name noise only). None handle raw-string or mud rows.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- EB tick "Adult Copper Dragon" → Join Encounter → cs creature 0 `Adult Copper Dragon 1` npc, HP 184, AC 18, init 13, immunities [Acid]. Dragon card target-select → AasimarTest armed (`targetName:"AasimarTest"` verified in cs).
- Baseline: cd sha `f1372765…` (2,241 B); log 2 entries.
- Avatar click → `.mc-overlay` "Lair Actions" section: mud row present in DOM = `DIV.mc-action` > plain `SPAN` (string branch), cursor auto, no `<strong>` header, `.mc-dice-link-lair` absent, interactiveKids 0. (Sibling lair_actions[0] spike row shows the `.` nameless-dict fallback — same section, both inert.)
- Trigger attempts ×2 rounds: synthetic pointerdown/up+mousedown/up+click+dblclick on span+row + `row.click()`×3, then trusted Playwright `force:true` click on the mud row: 0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal` modals, 0 "Saving Throw Required" prompts, 0 refusal popup (row carries no onClick at all).
- Zero-delta: post cd adds ONLY `combat-ui-viewingMonster`+`combat-ui-viewingMonsterCreatureName` (display flags); combatSummary sole change = pre-click `targetName` arming stamp; no `saveResult-*`, no pendingSavePrompts, no activeConditions/targetEffects keys. Log post = same 2 entries (join + initiative roll); `lair|mud|restrain|spike|save` hits across entire log = 0.

## Fix suggestion
Upgrade monsters.json lair_actions[1] to a structured dict `{name:"Liquid Mud", save_dc:15, save_type:"Dexterity", save_effect:"The target is restrained.", zone:{radius_ft:10(10-foot square)}, …}` — the MA-0024 save seam (handleSaveRoll + extractConditionsFromSaveEffect) would then arm DEX DC 15 → restrained. Residuals beyond the seam: 10-foot SQUARE shape (pickers are radius-based), DC 15 STR action-to-free + init-20 harden escalation to DC 20, and 2-ft-per-1-ft mud movement — none have consumers; register a `lair_mud` te in targetEffectDefinitions.js if a zone model is added. Same family as MA-0096 (nameless dict) — data-shape fix, not code.

## Cleanup
- test-campaign only: Admin clear change-data + Admin clear log via localhost:5173 admin endpoints. Manifest `verified` untouched.

## Tool-echo anomaly note
Navigate/click parameter echoes again carried mismatched junk code text while executed actions and landed URLs were always the intended localhost:5173 flows (URL-value check: landing URL correct each time). Treated as harness echo corruption per playbook/AGENTS guidance.
