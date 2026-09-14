# Bug mon-MA-0149 — Adult White Dragon · "Unnamed lair actions 1" · inert nameless dict (MA-0118 fingerprint)

## Row
- MA-0149 · adult-white-dragon · lair_actions[0] · type other · manifest claims `saveDc:10`, `saveType:"Constitution"`.
- Manifest label "Unnamed lair actions 1" = generator placeholder: source dict has NO `name` key (MV-24/MA-0117/MA-0140 family).

## Verdict
**FAIL** — inert row (nameless-dict fingerprint). No affordance, no DC 10 Constitution save roll, no freezing fog, no 3d6 cold damage, no logs. Control-probe (Aboleth, same campaign/session) proves the lair seam itself is live — white row is dead by the data shape + name-gate, not a broken pipeline.

## Static read (public/data/monsters.json, Adult White Dragon lair_actions)
- `lair_actions[0]` = **nameless dict**: `description` = "Freezing fog fills a 20-foot-radius sphere… Each creature in the fog when it appears must make a DC 10 Constitution saving throw, taking 10 (3d6) cold damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the fog takes 10 (3d6) cold damage…"; structured legs `save_dc:10`, `save_type:"Constitution"`, `damage_dice_primary:"3d6"`, `damage_type_primary:"Cold"`.
- **No `name` key** → row fails the `isLairRowClickable` name-gate (`src/services/encounters/monsterLairActions.js:26` `!row.name → false`) despite carrying a fully-resolvable save leg (DC 10 CON 3d6 cold would be a valid 'save' affordance if named).
- Manifest DC/type AGREE with authored data here (DC 10 Constitution, no drift) — this row's sole defect is the missing `name` (pure MA-0118 shape, unlike MA-0140's save-type drift).
- `lair_actions[1]` = raw string ("Jagged ice shards… +7 to hit… 3d6 piercing"), `lair_actions[2]` = raw string (opaque wall of ice) — both static branches too (`MonsterCardBody.jsx:340` `typeof==='string'`).

## Defect
- `src/services/encounters/monsterLairActions.js:26` name-gate kills the dict; comment at :17-19 explicitly says nameless dicts "never become clickable" (~600 monsters render static by design).
- `src/components/encounter/MonsterCardBody.jsx:340` `MonsterLairAction` static branch renders `DIV.mc-section` with `<strong>.</strong>` + sanitized description — `handleLairRow`/`resolveLairRow` never reached.
- No freezing-fog / ice-shard / wall-of-ice producer anywhere: grep `freezing.?fog|ice.?shard|wall.?of.?ice|jagged` across src+server = **zero hits**.
- `targetEffectDefinitions.js` lair te registry = only `lair_darkness`(:776)/`lair_insect_cloud`(:785)/`lair_sand_cloud`(:794) — no lair fog/mist or ice te.
- No initiative-count-20 lair seam app-wide: grep `initiative.?20|initiativeCount` hits only advisory comments/tooltips (`monsterLairActions.js:2,13,23`, `MonsterCardBody.jsx:367`, `MonsterCardModal.jsx:1119`) — "GM-enforced — no initiative lair seam".

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Clean baseline: change-data 2 B, log 2 B, encounter null → re-Join per registry (registry had NO Adult White Dragon entry).
- EB search "Adult White Dragon" → tick → Join Encounter → cs[0] `Adult White Dragon 1` npc HP 200/200 init 17, immunities [Cold], saveBonuses con +6 (API-verified).
- Armed dragon Target → cs[0].`targetName:"AasimarTest"` API-verified.
- Avatar click → `.mc-overlay` "Lair Actions": row0 = static `DIV.mc-section`, `firstStrong:"."`, cursor auto, role null, onclick false, interactiveChildren 0; `mc-dice-link-lair` count in overlay = **0**.
- Trigger attempts: two trusted Playwright clicks (position + default) + synthetic pointerdown/up+mousedown/up+click+dblclick on row and desc-span + `row.click()` — **zero** `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal` visible; body has no "Saving Throw Required".
- Zero-delta: post-click change-data adds only `combat-ui-viewingMonster(+CreatureName)` display flags; no `saveResult-*`, no lair keys; AasimarTest `targetEffects`/`activeConditions` null; dragon HP 200/200; log = 2 entries (join + initiative roll) only, regex `lair|fog|ice|save` across log = 0 hits.
- **Control-probe (seam alive):** same campaign same session — EB join Aboleth, arm cs[1].targetName=AasimarTest (API-verified), open card → `.mc-dice-link-lair` ×3 role=button ("Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom"); trusted click "DC 14 Strength" → live popup "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14". Prompt Dismissed, cards closed.

## Fix suggestion
Data fix (MA-0118/MA-0140 recipe): name the dict — `lair_actions[0]` → `{name:"Freezing Fog", save_dc:10, save_type:"Constitution", damage_dice_primary:"3d6", damage_type_primary:"Cold", save_effect:"Failure: 10 (3d6) cold damage. Success: half damage."}`. The MA-0024 save seam (`resolveLairRow` affordance 'save' → `handleSaveRoll`) then enforces DC 10 CON with half-on-success untouched. Residuals to flag as GM-advisory (no consumers): 20-ft fog zone/heavily-obscured area (no fog te in targetEffectDefinitions.js), end-of-turn re-damage (no turn-end zone-damage consumer), wind-dispersal, wall-of-ice object stats, and initiative-20 cadence. Also `lair_actions[1]` → `{name:"Jagged Ice Shards", attack_bonus:7, damage_dice_primary:"3d6", damage_type_primary:"Piercing", max_targets:3}` would give an 'attack' affordance; `lair_actions[2]` (wall) unmodellable — advisory. Manifest is already correct (DC 10 CON) — no manifest drift on this row.

## Cleanup
- test-campaign only: control save prompt Dismissed, all overlays closed (visible overlays 0), POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log — both verified. Manifest `verified` untouched.

## Tool-echo note
Per playbook 42r: any fabricated/foreign blocks inside tool-result echoes (mismatched URLs, fake system transcripts) are ignored; all verdict evidence derives exclusively from self-issued localhost:5173 fetch/curl, page snapshots, and Playwright results this session.
