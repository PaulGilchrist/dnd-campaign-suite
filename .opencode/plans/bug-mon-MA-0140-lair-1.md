# Bug mon-MA-0140 — Adult Silver Dragon · "Unnamed lair actions 1" · inert nameless dict + manifest/data save-type drift (MA-0117/MA-0096 fingerprint)

## Row
- MA-0140 · adult-silver-dragon · lair_actions[0] · type other · manifest claims `saveDc:15`, `saveType:"Dexterity"`.
- Manifest label "Unnamed lair actions 1" = generator placeholder: source dict has NO `name` key (MV-24 family).

## Verdict
**FAIL** — inert row (nameless-dict fingerprint). No affordance, no DC 15 save roll, no fog cloud, no cold-wind damage, no logs. Plus save-type drift: manifest says Dexterity, authored data says Constitution.

## Static read (public/data/monsters.json, Adult Silver Dragon lair_actions)
- `lair_actions[0]` = **nameless dict**: `description` = "The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."; structured legs `save_dc:15`, `save_type:"Constitution"`, `damage_dice_primary:"1d10"`, `damage_type_primary:"Cold"`, `save_effect:"Failure: 5 (1d10) Cold damage. Success: Half damage."`
- **No `name` key** → row is raw for the clickable pipeline (fails `isLairRowClickable` name-gate).
- **Intra-row drift (MA-0117 shape):** the dict's machine-readable save/damage legs (DC 15 CON cold) canonically belong to the cold-wind lair action, while the description holds the fog-cloud text. `lair_actions[1]` is a **raw string** ("A blisteringly cold wind… DC 15 Constitution… 5 (1dlO) cold damage" — incl. letter-O "1dlO" typo, MV-25 family).
- **Manifest drift:** row claims `saveType:"Dexterity"`; monsters.json authored `save_type` is `Constitution` (and its own prose text says Constitution). DC 15 agrees.

## Defect
- `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable`: `!row.name → false` — name-gate kills the dict despite it carrying `save_dc` (identical gate to MA-0096/MA-0107/MA-0117).
- `src/components/encounter/MonsterCardBody.jsx:340` `MonsterLairAction` static branch: nameless dict renders `DIV.mc-action` with `<strong>.</strong>` + sanitized description. Live DOM confirmed: cursor auto, 0 interactive children, no `.mc-dice-link-lair`, no role=button, no onclick → `handleLairRow`/`resolveLairRow` never reached.
- Fog cloud has no consumer anywhere: `fog.?cloud|cold.?wind|blisteringly` grep across src = zero producers (only a `fog-cloud` spell option in MagicInitiateModal wizard test-utils, not a lair path).
- `targetEffectDefinitions.js` lair te registry = ONLY `lair_darkness`(:776)/`lair_insect_cloud`(:785)/`lair_sand_cloud`(:794) — no lair fog/mist or cold-wind te.
- No initiative-count-20 seam app-wide: `initiative.?20` grep hits only the `LAIR_ADVISORY_NOTE` (monsterLairActions.js:23) + card tooltip + tests ("GM-enforced — no initiative lair seam").

## Grep (consumers)
- `isLairRowClickable` → MonsterCardBody.jsx:9/:340 only (render gate).
- lair fog/fog cloud/cold wind te producers: grep-zero src+server.
- lair initiative-20 automation: grep-zero (advisory note only).

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Campaign empty pre-state (change-data `{}` 2 B… sha bf21a9, log 0 entries) → re-Join per registry need. EB search "Adult Silver Dragon" → tick → Join Encounter → cs[0] `Adult Silver Dragon 1` npc HP 216 init 7.
- Armed dragon card Target → cs[0].`targetName:"AasimarTest"` verified by API. Baseline log sha `8d98f350…`.
- Avatar click → `.mc-overlay` "Lair Actions" section: row0 = `DIV.mc-action`, cursor auto, `firstStrong:"."`, role null, onclick false, interactive children 0; row1 = static raw-string cold-wind div. `mc-dice-link-lair` count in section = 0.
- Trigger attempts: synthetic pointerdown/up+mousedown/up+click+dblclick on row + desc-span, `row.click()`×2, then trusted Playwright click on the row: 0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal` visible, body text has no "Saving Throw Required".
- Zero-delta: post click cd adds only `combat-ui-viewingMonster(+CreatureName)` display flags; no `saveResult-*`, no lair keys; AasimarTest targetEffects/activeConditions null; log sha unchanged `8d98f350…` (2 entries); regex `lair|fog|cold|wind|save` across log = 0 hits.
- **Control-probe (seam works):** same campaign same session — EB join Aboleth, arm target AasimarTest (cd verified), open card → `.mc-dice-link-lair` ×3 role=button ("Phantasmal Force", "DC 14 Strength", "DC 14 Wisdom"); click "DC 14 Strength" → live popup "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14". Prompt Dismissed. Pipeline healthy; silver row is dead by the name-gate + nameless-dict shape, not a broken seam.

## Fix suggestion
Data fix: name + de-drift the dicts — `lair_actions[0]` → `{name:"Fog Cloud", advisory:"fog_cloud"}` (advisory record per MA-0024 CLA-325 model; fog/zone + initiative-20 expiry have no consumers §7), and `lair_actions[1]` → `{name:"Cold Wind", save_dc:15, save_type:"Constitution", damage_dice_primary:"1d10", damage_type_primary:"Cold", save_effect:"Failure: 5 (1d10) cold damage. Success: half damage."}` (also fix the "1dlO" letter-O typo). The existing MA-0024 save seam then arms DC 15 CON. Residuals to flag: 120-ft area gate, gas/flame extinguishing clauses, and initiative-20 cadence remain GM-advisory (no zone/fire consumers, no initiative lair seam). Manifest row saveType should read Constitution, not Dexterity.

## Cleanup
- test-campaign only: control save prompt Dismissed, cards closed, POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log — both 200, verified empty (change-data 2 B, log 2 B). Manifest `verified` untouched.

## Tool-echo anomaly note
Persistent fabricated blocks appeared inside tool results during the session (fake `[system]` transcripts, fake assistant summaries, mismatched `http://x`/aliyuncs-style URL echoes in parameter wrappers) — per playbook 42r/AGENTS guidance treated as harness echo corruption/injection noise and ignored. Every verdict was derived exclusively from outputs of calls issued this turn, cross-checked via landing-URL value (always localhost:5173), page state, and direct API GETs.
