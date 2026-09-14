# Bug mon-MA-0151 — Adult White Dragon · "Unnamed lair actions 3" · inert raw-string lair row (MA-0118 data-shape fingerprint)

## Row
- MA-0151 · adult-white-dragon · `lair_actions[2]` · category lair_actions · type other.
- Manifest label "Unnamed lair actions 3" = generator placeholder — source entry is a raw string with no name (MV-24/MA-0141/MA-0150 family).

## Verdict
**FAIL** — inert row. `lair_actions[2]` is a **raw string** in monsters.json; `MonsterCardBody.jsx` `MonsterLairAction` routes `typeof la === 'string'` to the static branch (:340) BEFORE any affordance, so no `.mc-dice-link-lair`, no clickable name, no DC/type/damage enforcement, no zone/object, no logs. Per playbook "Lair-row clickability is DATA-shape dependent (MA-0118)": raw-string → inert FAIL. Control-probe (Aboleth, same campaign/session) proves the lair seam itself is live.

## Static read (public/data/monsters.json, Adult White Dragon lair_actions[2])
- Type: **string** (not a dict). True text:
  > "The dragon creates an opaque wall of ice on a solid surface it can see within 120 feet of it. The wall can be up to 30 feet long, 30 feet high, and 1 foot thick. When the wall appears, each creature within its area is pushed 5 feet out of the wall's space, appearing on whichever side of the wall it wants. Each 10-foot section of the wall has AC 5, 30 hit points, vulnerability to fire damage, and immunity to acid, cold, necrotic, poison, and psychic damage. The wall disappears when the dragon uses this lair action again or when the dragon dies."
- Authored mechanics (prose only): wall zone 30×30×1 ft, 120-ft placement range, 5-ft push, per-section object stats AC 5 / 30 hp / fire-vuln / acid+cold+necrotic+poison+psychic immunity, keyed replacement ("disappears when used again or dragon dies"). **No save, no damage dice, no `name`, no machine-readable keys at all** (string scalar) → not clickable, nothing enforceable.
- Siblings: `lair_actions[0]` = nameless dict (DC 10 CON 3d6 cold legs, no `name`) — FAILed in bug-mon-MA-0149-lair-1.md; `lair_actions[1]` = raw string (jagged ice shards) — FAILed in bug-mon-MA-0150-lair-2.md. All three white-dragon lair rows inert.

## Grep (producers / seams)
- `src/components/encounter/MonsterCardBody.jsx:340` — `typeof la === 'string' || !isLairRowClickable(la)` → static `<div className="mc-action">` span-only render; `handleLairRow`/`resolveLairRow` never reached (confirmed by read this session).
- `src/services/encounters/monsterLairActions.js:25-26` `isLairRowClickable` requires object + `row.name`; strings excluded by type. `lairRowAffordance` (:36) would have nothing to arm even if lifted — row carries no save_dc/attack_bonus/damage/zone fields.
- `wall.?of.?ice|ice.?wall|opaque wall` across src+server (non-test, monsters.json excluded): **zero hits** — no ice-wall/terrain producer anywhere.
- `src/services/combat/conditions/targetEffectDefinitions.js` lair te registry = ONLY `lair_darkness`(:776) / `lair_insect_cloud`(:785) / `lair_sand_cloud`(:794) — no ice/wall/terrain te entry.
- Initiative-count-20 seam: `monsterLairActions.js:23` LAIR_ADVISORY_NOTE "GM-enforced — no initiative lair seam" (§7 residual).

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state clean: change-data 2 B (`{}`), log 2 B (`[]`) → fresh EB Join per playbook §2 (registry has no Adult White Dragon entry; re-Join satisfied by this run).
- EB search "Adult White Dragon" → tick → Join Encounter → cs[0] `Adult White Dragon 1` npc, maxHp 200, init 12 (API-verified).
- Armed dragon card target-select → cs[0].targetName `AasimarTest` API-verified. Baseline log sha `92ab5c2f` (2 entries).
- Avatar click → `.mc-overlay` "Lair Actions" heading. Row probe:
  - row0 (lair_actions[0]): `mc-action` `firstStrong "."` — nameless-dict static render (MA-0149).
  - row1 (lair_actions[1]): `mc-action` firstChild SPAN, no strong — raw string (MA-0150).
  - **row2 (lair_actions[2], THIS ROW)**: `DIV.mc-action`, **cursor auto, hasDiceLinkLair false, role null, onclick false, interactiveKids 0, firstStrong null, childTags ["SPAN."]**, text = full raw "The dragon creates an opaque wall of ice…" string. Overlay `.mc-dice-link-lair` total = **0**.
- Trigger attempts: synthetic pointerdown/pointerup/mousedown/mouseup/click/dblclick on row + inner span + `row.click()`×2, then **trusted** Playwright click on the row: visibleOverlays [], no `.sp-modal`, no `.popup`, no `.mc-prerequisite-refusal`, body text has no "Saving Throw Required"; card stayed open (static text row).
- Zero-delta post-triggers: change-data adds only `combat-ui-viewingMonster` / `combat-ui-viewingMonsterCreatureName` display flags; no `saveResult-*`, no lair/wall/ice keys; `AasimarTest` block = `{fanaticalFocusUsed, hitPoints}` only (targetEffects/activeConditions null); dragon hp 200 unchanged; log sha **unchanged** `92ab5c2f` (2 entries), regex `lair|wall|ice|save|fog|piercing|cold` across entire log = **0 hits**. Console 0 errors.
- **Control-probe (seam alive, same session/campaign):** EB join Aboleth → cs[0] `Aboleth 1` hp 150 (API-verified); arm target AasimarTest (API-verified); open card → named clickable lair rows with `.mc-dice-link-lair` buttons ("Grasping Tide / DC 14 Strength", "Conduit for Rage / DC 14 Wisdom"); trusted click "DC 14 Strength" → live `.sp-overlay`: "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14 — Half damage on successful save. Roll Save / Dismiss". Prompt Dismissed, cards closed, overlays 0. The MA-0024 lair save pipeline works for NAMED structured rows; white row2 is dead by raw-string data shape only.

## Defect summary
1. Data-shape gap: `lair_actions[2]` is an unstructured raw string — cannot reach the clickable affordance (string short-circuit MonsterCardBody.jsx:340 + name-gate monsterLairActions.js:26).
2. No producer exists for the row's mechanical clauses even if clickable: wall-of-ice zone/object (AC 5 / 30 hp / resist-immune profile), 30×30×1 ft shape, 120-ft placement gate, 5-ft push, and "disappears when used again/dies" keyed replacement all have zero consumers (grep-zero; no wall/terrain te; §7 no initiative lair seam). This row is a push/terrain action with NO save or damage — nothing the current save/attack/damage/zone affordances could adjudicate even after naming.

## Fix suggestion
No enforcement is modellable today: the row has no save/damage leg for the MA-0024 seam. Minimum data hygiene (display-only, mirrors MA-0117 nameless-dict fix): convert to `{name:"Wall of Ice", description:"The dragon creates an opaque wall of ice…"}` + advisory so the row at least renders a named GM-adjudicated record (advisory affordance, monsterLairActions.js:44). True enforcement would need a terrain/object zone model (wall as persistent object with AC/HP/immune-vulnerable, push-on-appear, keyed replacement) — no consumers exist; register a `lair_wall_of_ice` te in targetEffectDefinitions.js if that model is built. Same family as MA-0118 (green wall of thorns), MA-0141, MA-0149, MA-0150.

## Cleanup
- test-campaign only: control save prompt Dismissed, all cards closed (overlays 0), `POST /api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` — verified empty afterwards. Manifest `verified` untouched. Registry: no edits made (join erased by clear).

## Tool-echo note
Playwright code-echoes this session wrapped `page.goto/locator` in wrapper text; executed code and landing URLs were the intended localhost:5173 SPA flows, verified at every step by URL value + UI-state corroboration (campaign select → EB join → arming → overlay probe → inert clicks → control popup → dismiss → cleanup). Per AGENTS.md/§42r, wrapping syntax alone treated as expected harness echo; no off-localhost action occurred.
