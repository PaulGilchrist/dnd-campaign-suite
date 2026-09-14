# Bug mon-MA-0108 — Adult Gold Dragon · "Unnamed lair actions 2" (dream-plane banishment) · inert raw-string row (MA-0097 fingerprint; sibling halves of MA-0107's drifted dict)

## Row
- MA-0108 · adult-gold-dragon · lair_actions[1] · type other · manifest label "Unnamed lair actions 2" (generator placeholder).
- **Authored source (public/data/monsters.json lair_actions[1], static read):** a RAW STRING, not a dict — "One creature the dragon can see within 120 feet of it must succeed on a DC 15 Charisma saving throw or be banished to a dream plane, a different plane of existence the dragon has imagined into being. To escape, the creature must use its action to make a Charisma check contested by the dragon's. If the creature wins, it escapes the dream plane. Otherwise, the effect ends on initiative count 20 on the next round. When the effect ends, the creature reappears in the space it left or in the nearest unoccupied space if that one is occupied."
- **DC 15 Charisma save + banishment/escape-contest/init-20 expiry text CONFIRMED in the source prose.** No `name`/affordance keys exist at all (string scalar) — "Unnamed lair actions 2" is pure manifest fabrication; live DOM renders the prose with no header.
- Context: this is the row whose save trio was half-promoted into lair_actions[0] (the contradictory nameless dict already FAILed as MA-0107). [1] itself remains the inert raw string.

## Verdict
**FAIL** — inert row. No affordance, no CHA DC 15 roll, no banishment/te application, no logs, no refusal popup, no initiative-count-20 expiry seam.

## Defect
- `MonsterCardBody.jsx:339-343` `MonsterLairAction`: `typeof la === 'string'` short-circuits to the static branch — plain sanitized `<span>` inside `DIV.mc-action`, cursor auto, zero interactive children. The `isLairRowClickable` name-gate (`monsterLairActions.js:26`) is never even reached; strings are excluded by type ("Legacy plain-string rows … never become clickable", header comment :17-19). Same raw-string variant as MA-0097 (Copper mud).
- Even if lifted to a dict, unresolvable-by-design: no `save_dc`/`save_type`/`save_effect`/`advisory`/`zone` on THIS row — DC 15 CHA exists only as prose here (the numeric trio was misfiled onto sibling [0], MA-0107 drift). `lairRowAffordance` (monsterLairActions.js:36) would return null/unresolvable; refusal-popup branch only.
- `extractConditionsFromSaveEffect` (handleSaveRoll consumer) matches canonical CONDITIONS only — "banished to a dream plane" parses to nothing (MA-0090 failure layer).
- No dream-plane te: `targetEffectDefinitions.js` has `banishment` (:354, spell-only producer `banishmentHandler.js`), `lair_darkness`/`lair_insect_cloud`/`lair_sand_cloud` (:776/785/794) — NO lair dream-plane entry; grep `dream.?plane` across src/+server/ non-test = **0 consumers**.
- No initiative-count-20 seam anywhere: grep `initiative count 20|initiativeCount|count.?20` (src/+server/, non-test) = **0 hits**; only `LAIR_ADVISORY_NOTE` (monsterLairActions.js:23) "GM-enforced — no initiative lair seam". Escape-contest (action CHA check vs dragon) also has no producer.
- `npcStatBlockUtils.js` nulls `lair_actions` for non-lair flows.

## Grep (consumers)
- lair consumers (src, non-test): monsterLairActions.js, MonsterCardBody.jsx, MonsterCardModal.jsx (handleLairRow→resolveLairRow), monsterLegendaryUses.js, npcStatBlockUtils.js, targetEffectDefinitions.js — none handle raw strings, dream-plane, or init-20 cadence.
- banish consumers: banishmentHandler.js, prismaticSprayHandler.js, mazeHandler.js, execution/index.js + spellCastService blocks — spell paths only, zero lair linkage.
- dream plane: ZERO non-test hits app-wide.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state: campaign clean post-prior-cleanup (change-data `{"value":null}`, log empty) → re-Join per registry. EB search "Adult Gold Dragon" → tick → Join Encounter → cs creature 0 `Adult Gold Dragon 1` npc, HP 243/243, AC 19, init 9, immunities [Fire], saveBonuses cha:+7.
- Armed via dragon initiative-card `[data-testid="target-select"]` → cs `targetName:"AasimarTest"` verified by API.
- Baseline: change-data sha `f7fd41b8…` (14 B, wrong-endpoint probe; authoritative `/change-data` store sha `ae06acce…` 10,976 B post-setup), log 2 entries (encounter join + initiative roll).
- Avatar click → `.mc-overlay` "Lair Actions" (h5): lair_actions[1] row = `DIV.mc-action` > plain `SPAN` (string branch), cursor auto, `firstChildTag SPAN` (no `<strong>` header at all — string), `.mc-dice-link-lair` absent, role=button absent, interactiveKids 0. (Sibling lair_actions[0] shows the nameless-dict `<strong>.</strong>` fallback, MA-0107.)
- Trigger attempts: synthetic pointerdown/up+mousedown/up+click+dblclick on span+row + `row.click()`×3 → 0 modals; trusted Playwright `force:true` click on row text → 0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal`, 0 "Saving Throw Required" prompts (row carries no onClick).
- Zero-delta: `/change-data` holds only AasimarTest{fanaticalFocusUsed,hitPoints}, `__campaign__`, `__map__`, activeCreatureName, combat-ui-viewingMonster(+CreatureName) display flags, combatSummary (sole change = pre-click targetName arming stamp). No `saveResult-*` keys, pendingSavePrompts null, AasimarTest targetEffects/activeConditions null. The 4 "dream" substring hits = embedded statblock lore prose inside viewingMonster/combatSummary payloads, zero state keys. Log post = same 2 entries; regex `lair|dream|banish|save` across entire log = 0 hits.

## Fix suggestion
Same family as MA-0097/MA-0107 — data-shape fix: complete the half-migration by making lair_actions[1] `{name:"Dream Plane Banishment", save_dc:15, save_type:"Charisma", save_effect:"…"}` (and stripping the orphaned save trio from [0], leaving [0] an `advisory` advantage-grant). Even then residuals beyond the seam: "banished to a dream plane" needs a canonical-clause save_effect (e.g. restrained/incapacitated proxy) or a new `lair_dream_plane` te registered in targetEffectDefinitions.js with a producer; escape-contest + reappear-in-space + initiative-count-20 expiry have ZERO consumers (no initiative lair seam by design, §7). Name-gate (monsterLairActions.js:26) and the string short-circuit (MonsterCardBody.jsx:340) are the dead wires either way.

## Cleanup
- test-campaign only: POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log — both 200 "cleared", verified empty (change-data 2 B, log 2 B). Manifest `verified` untouched.

## Tool-echo anomaly note
Navigate/click/evaluate parameter echoes again carried mismatched junk (aliyuncs-style URLs, fake injected directive blocks) while executed code and landed URLs were always the intended localhost:5173 flows — verified by landing-URL value and UI-state corroboration at every step (campaign select → EB join → target arm → overlay → clicks → cleanup). Treated as harness echo corruption/injection noise per playbook §42r/AGENTS guidance; no off-localhost action occurred.
