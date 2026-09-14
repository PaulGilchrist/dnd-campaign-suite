# Bug mon-MA-0107 — Adult Gold Dragon · "Unnamed lair actions 1" (glimpse the future) · inert nameless dict + intra-row data drift

## Row
- MA-0107 · adult-gold-dragon · lair_actions[0] · type other · `save_dc:15`, `save_type:"Charisma"`, `save_effect:"The target is banished to a dream plane…"`.
- Manifest label "Unnamed lair actions 1" = generator placeholder: the source dict has NO `name` key (MV-24 family, cf. MA-0096).

## Verdict
**FAIL** — inert row (MV-24 nameless-dict fingerprint) AND a confirmed intra-row data bug (description↔numbers mismatch authored in monsters.json itself).

## Data drift adjudication (static read of public/data/monsters.json Adult Gold Dragon)
- `lair_actions[0]` (dict, no name):
  - `description`: "The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round."
  - `save_dc`: 15 · `save_type`: "Charisma" · `save_effect`: "The target is banished to a dream plane. To escape, the creature must use its action to make a Charisma check contested by the dragon's."
- `lair_actions[1]` (RAW STRING): "One creature the dragon can see within 120 feet of it must succeed on a DC 15 Charisma saving throw or be banished to a dream plane… effect ends on initiative count 20 on the next round…"
- **Mismatch confirmed at the source, not fabricated by the manifest:** lair_actions[0]'s description is a self-contained advantage-until-init-20 effect with NO saving throw, yet the same dict carries `save_dc:15/Charisma/save_effect:"banished to a dream plane"` — save numbers whose prose canonically lives in lair_actions[1]. The row faithfully mirrors its (internally contradictory) source dict. Either the save trio belongs to [1] (promoted from string, half-migrated), or the description was pasted onto the banishment row. Canonical text of [0] per its own description = **advantage grant, no save**; the DC 15 CHA banish legs are orphaned metadata of [1].

## Defect
- `monsterLairActions.js:26` `isLairRowClickable`: `!row.name → false` — name-gate kills the dict despite it carrying `save_dc` (identical to MA-0096). `MonsterCardBody.jsx:340` `MonsterLairAction` static branch renders `DIV.mc-action` > `<strong>.</strong>` + sanitized description span; cursor auto, zero interactive children, no `.mc-dice-link-lair`, no onClick anywhere.
- Even if the gate were lifted, DOUBLE-broken: (a) affordance would be 'save' → handleSaveRoll at the WRONG mechanic (DC 15 CHA banish) vs the row's own true effect (advantage grant) — DC-type mismatch baked into data; (b) the advantage-until-init-20 effect has ZERO consumers: grep "initiative count 20"/initiativeCount across src/+server/ = 0 non-test hits; only `LAIR_ADVISORY_NOTE` (monsterLairActions.js:23) states "GM-enforced — no initiative lair seam".
- `targetEffectDefinitions.js`: has `banishment` (:354), maze (:338), prismatic violet (:719), lair_darkness/lair_insect_cloud/lair_sand_cloud (:776/785/794) — NO lair dream-plane te; no producer emits "banished to a dream plane" from any lair path (banishment consumers = banishment spell, Prismatic Spray violet, badges only). `extractConditionsFromSaveEffect` (used by handleLairRow) matches canonical conditions only — "banished to a dream plane" would parse to nothing (same failure layer that killed MA-0090 Slowing Breath).

## Grep (consumers)
- lair consumers: monsterLairActions.js (+test), MonsterCardBody.jsx, MonsterCardModal.jsx (handleLairRow→resolveLairRow), npcStatBlockUtils.js (nulls lair_actions), monsterLegendaryUses.js, targetEffectDefinitions.js (3 lair te). None for initiative-20 cadence, advantage grant, or dream-plane.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- EB search "Adult Gold Dragon" → tick → Join Encounter → cs: `Adult Gold Dragon 1` npc HP 243, AC 19, init 15 (re-Join per registry; campaign was post-cleanup empty). Baseline cd sha `cbdd5680…` (1,099 B), log 0 entries; post-join cd sha `af3c615b…`.
- Avatar click → `.mc-overlay` "Lair Actions" section (h5.mc-section-title), rowCount 2: row[0] = `DIV.mc-action`, cursor auto, `firstChildTag STRONG` text `"."` (nameless fallback), text ". The dragon glimpses the future, so it has advantage…" — interactive kids 0, no `.mc-dice-link-lair`, no role=button, no onclick. Row[1] = raw-string span (MA-0097 sibling), interactive kids 0.
- Trigger attempts ×2 rounds: synthetic pointerdown/up+mousedown/up+click+dblclick on row+span + `row.click()`×3, then trusted Playwright force click on the row text: 0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal`, 0 "Saving Throw Required" prompts. "DC 15" visible in DOM = static text of row[1] only.
- Zero-delta: post cd sha `2c2fb5a4…` adds ONLY `combat-ui-viewingMonster` + `combat-ui-viewingMonsterCreatureName` (display flags; embedded statblock lore contains "banished"); combatSummary unchanged; no `saveResult-*` keys, no pendingSavePrompts, `targetEffects` null. Log post = 2 entries (encounter join + initiative roll); regex `lair|dream|banish|advantage|save` hits across entire log = 0.

## Fix suggestion
Data fix, two-part: (1) split the contradictory dict — make lair_actions[0] `{name:"Glimpse the Future", advisory:true}` (advantage-until-init-20 stays GM-adjudicated advisory per CLA-325; no advantage-timed-by-init-20 consumer exists, same residual as all advisory lair rows), and promote lair_actions[1] to `{name:"Dream Plane Banishment", save_dc:15, save_type:"Charisma", save_effect:…}`. (2) Even then, the escape-contest + init-20 expiry + dream-plane te have no consumers — register a `lair_dream_plane` te in targetEffectDefinitions.js and a saveResult handler, or accept advisory-only. Name-gate (monsterLairActions.js:26) is the first dead wire either way.

## Cleanup
- test-campaign only: POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log. Manifest `verified` untouched.

## Tool-echo anomaly note
Navigate/type/click parameter echoes again carried mismatched junk URLs (aliyuncs-style) while executed code and landed URLs were always the intended localhost:5173 flows (URL-value check: landing URLs correct at each step; UI state corroborated: campaign select → test-campaign sheet → EB → initiative). Treated as harness echo corruption per playbook/AGENTS guidance.
