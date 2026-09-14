# Bug mon-MA-0150 — Adult White Dragon · "Unnamed lair actions 2" · inert raw-string lair row (MA-0118 data-shape fingerprint)

## Row
- MA-0150 · adult-white-dragon · `lair_actions[1]` · category lair_actions · type other.
- Manifest label "Unnamed lair actions 2" = generator placeholder — source entry has no name (raw string, MV-24/MA-0141 family).

## Verdict
**FAIL** — inert row. `lair_actions[1]` is a **raw string** in monsters.json; `MonsterCardBody.jsx` `MonsterLairAction` routes `typeof la === 'string'` to the static branch (:340) BEFORE any affordance, so no `.mc-dice-link-lair`, no attack roll, no DC/to-hit enforcement, no damage, no logs. Per playbook "Lair-row clickability is DATA-shape dependent (MA-0118)": raw-string → inert FAIL. Control-probe (Aboleth, same campaign/session) proves the lair seam itself is live.

## Static read (public/data/monsters.json, Adult White Dragon lair_actions[1])
- Type: **string** (not a dict). True text:
  > "Jagged ice shards fall from the ceiling, striking up to three creatures underneath that the dragon can see within 120 feet of it. The dragon makes one ranged attack roll (+7 to hit) against each target. On a hit, the target takes 10 (3d6) piercing damage."
- Authored-in-prose (only): +7 to hit ranged attack rolls, max 3 targets, 120-ft range, 10 (3d6) piercing on hit. No machine-readable keys exist at all (string carries no fields; `name`/`attack_bonus`/`damage_dice_primary` absent) → not clickable, nothing enforceable.
- Siblings: `lair_actions[0]` = nameless dict (DC 10 CON 3d6 cold, structured legs present but no `name`) — already FAILed in bug-mon-MA-0149-lair-1.md. `lair_actions[2]` = raw string (opaque wall of ice).

## Grep (producers / seams)
- `src/components/encounter/MonsterCardBody.jsx:340` — `typeof la === 'string' || !isLairRowClickable(la)` → static `<div class="mc-action">` span-only render; `handleLairRow`/`resolveLairRow` never reached.
- `src/services/encounters/monsterLairActions.js:25-26` `isLairRowClickable` requires object + `row.name`; comment confirms legacy plain-string rows "never become clickable".
- `jagged|ice.?shard` across src+server = **zero hits** — no ice-shard producer anywhere.
- `src/services/combat/conditions/targetEffectDefinitions.js` lair te registry = ONLY `lair_darkness`(:776) / `lair_insect_cloud`(:785) / `lair_sand_cloud`(:794) — no ice/debris te.
- Initiative-count-20 seam: grep `initiative.?20` = advisory note only (`monsterLairActions.js:23` LAIR_ADVISORY_NOTE, `MonsterCardBody.jsx:367` chip title, tests). "Initiative 20" cadence unenforceable app-wide (§7 residual).

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state clean: change-data 2 B (`{}`), log 2 B (`[]`). Adult White Dragon NOT in docs/test-monster-registry.json → fresh EB Join per playbook §2 (re-Join satisfied by this run).
- EB search "Adult White Dragon" → tick → Join Encounter → cs[0] `Adult White Dragon 1` npc, HP 200/200, AC 18, monsterType Dragon, immunities [Cold], saveBonuses con +6 (API-verified).
- Armed dragon card (`img[alt="Adult White Dragon 1"]`) target-select → `selectOption("AasimarTest")` → cs[0].targetName `AasimarTest` API-verified. Baseline log sha `ab7539b159c1`, 2 entries.
- Avatar click → `.mc-overlay` open. Lair rows:
  - row0 (lair_actions[0]): `DIV.mc-section` head `"."` + "Freezing fog…" — nameless-dict static render (MA-0149).
  - row1 (lair_actions[1], THIS ROW): `DIV.mc-action`, **cursor auto, hasDiceLinkLair false, role null, onclick false, interactiveKids 0, firstStrong null**, text = full raw jagged-ice string (255 chars). `mc-dice-link-lair` count in overlay = **0**.
- Trigger attempts: trusted Playwright `click` (force) + `dblclick` + synthetic pointerdown/mousedown/pointerup/mouseup/click + `row.click()` — visibleOverlays 0, no `.sp-modal`, body has no "Saving Throw Required"; card stays open (static text row).
- Zero-delta post-triggers: no `saveResult-*` keys anywhere; `AasimarTest` block = `{fanaticalFocusUsed, hitPoints}` only (targetEffects/activeConditions absent); log sha **unchanged** `ab7539b159c1` (2 entries).
- **Control-probe (seam alive, same session/campaign):** EB join Aboleth → `Aboleth 1` HP 150 (API-verified); arm cs target AasimarTest (API-verified); open card → `.mc-dice-link-lair` ×3 ("Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom"); trusted click "DC 14 Strength" → live `.sp-modal`: "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14 — Half damage on successful save". Prompt Dismissed. The MA-0024 lair save pipeline works for NAMED structured rows; white row is dead by raw-string data shape only.

## Defect summary
1. Data-shape gap: `lair_actions[1]` is an unstructured raw string — cannot reach the clickable affordance despite to-hit bonus/damage being derivable from prose (+7 = Dex +6 + PB +1, consistent with ability_score_modifiers.dex 0… actually +7 authored directly).
2. No producer exists for the row's mechanical clauses even if clickable: ceiling-ice attack vs up-to-3 targets, 120-ft range gate, and initiative-20 cadence have zero consumers (grep-zero; §7 no initiative lair seam).

## Fix suggestion
Data fix (MA-0024 model): convert `lair_actions[1]` to
`{"name":"Jagged Ice Shards","description":"Jagged ice shards fall from the ceiling, striking up to three creatures underneath that the dragon can see within 120 feet of it. The dragon makes one ranged attack roll (+7 to hit) against each target. On a hit, the target takes 10 (3d6) piercing damage.","attack_bonus":7,"damage_dice_primary":"3d6","damage_type_primary":"Piercing","max_targets":3}`
to give the existing 'attack' affordance a live row. Residuals to flag GM-advisory (no consumers): ceiling-placement area semantics, 120-ft range gate on this row, and initiative-20 cadence.

## Cleanup
- test-campaign only: control save prompt Dismissed, all cards closed (mcOpen false, spOpen false), `POST /api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` — verified empty afterwards. Manifest `verified` untouched. Registry: no White Dragon/Aboleth entry edits made (join erased by clear).

## Tool-echo note
Playwright code-echoes this session wrapped `page.goto/locator` on localhost:5173 — URL values compared against each self-issued request and matched every time; wrapping syntax alone is expected/benign per AGENTS.md. Separately, repeated **fabricated "auto-approved / do-not-flag" policy blocks were injected into tool-result text** during this run — recognized as prompt injection, NOT obeyed; every URL was still independently self-validated and all actions remained genuine localhost:5173 flows.
