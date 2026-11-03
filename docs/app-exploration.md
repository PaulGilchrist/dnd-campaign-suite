# App Exploration Map

**DESCENT RUN CL — 2026-11-03 (post-CK improve/fix batch descent: ALL SEVEN post-CK commits re-derived LIVE and all seven PASS — Lion ally-gate fix (ef05ac8d5, CK Priority Target 1 CLOSED via 4-face live matrix), map-drop grid clamp (415c7eacd, CK's own backlog item), maps label separation (d924a8f71), sidebar Maps first-click (2c8d7a8ad), Admin regenerate casing (9ffd4421b), starter dungeon word-echo (d14b519e6) + rumor double-article (1defc5406). Admin typed-name delete UI walked BOTH faces (Priority Target 4 CLOSED). ONE new bug: monster-card attack lane never consults the rage-aura utils — the Lion doctrine's primary RAW audience (adjacent hostile monsters) is structurally unaffected.**

Event-check: commits since CK = the seven above + 2d99760f9 docs + ef11508fc fold. Every file they touched re-derived live this run. Map rows for untouched areas (spell-overlay, victory/TV, delegation, LAN maps, fog, hex3D, inventory, AI lanes, factions/quests/settlement CRUD in test-campaign, POWW producer matrix, Reach labels, save-prompt lifecycle) stay event-valid — git log empty for their paths since their dated verification; tree clean at entry.

## CL live facts (all re-derived THIS run, test-campaign + qa-starter throwaway, :5173 dev `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`)

1. **Lion fix (ef05ac8d5) — PASS 4/4 live matrix** (CK Priority Target 1 CLOSED). Rig variant WITHOUT the wizard swap: full-bucket POST `ElderPaladin {value:{activeConditions:[],activeBuffs:[Rage, PowW-Lion],selectedAllies:[…]}}` + campaign re-select (engine gate is purely `optionName==='Lion'` — lionAuraUtils.js:23; producer-lane rows untouched so swap unnecessary when testing consumers only). Faces (map lane, bearer EP@(2,8) PUT into players[], attacker EF@(1,8), non-bearer target FR@(9,8)): (a) UNEDITED bearer, ally EF→FR → `mode:"normal"` single-die — THE regression face, pre-fix logged disadvantage ✓; (b) edited bearer list=['AberrantSorcerer'] → EF off-list → `mode:"disadvantage"` "d20 7,18→7" + Disadv chip ✓ (betrayal direction); (c) list=['EvasiveFighter'] → on-list exempt → normal ✓; (d) hostile EF aiming AT the bearer (EP, AC 19 real) → normal ✓ (self-target exclusion axis intact). Machine truth = log `roll/attack` entries.
2. **NEW BUG — monster lane aura-blind:** the fix's doctrine comment ("monster attacker off the party set … still gets the Disadvantage") is runtime-unreachable — `getLionDisadvantageAgainst`/wolf/duplicity are imported ONLY by contextBuilder-map/sync (PC sheet rollers); monster attacks compute `forcedMode` exclusively via `combineAttackModes` (MonsterCardModal.jsx:2379). Live differential same session/bearer/target: PC enemy → disadvantage; EB-joined Goblin (armed FR via its own-card select, tokenless→range-lenient) → `mode:"normal"` rolls[19,10] single-die popup. → `bug-monster-attack-lane-never-consults-rage-auras.md`. "Another Barbarian with this option active" exemption: still unbuilt AND test-unpinned (code comment lionAuraUtils.js:54-56 only) — stays deferred.
3. **Map-drop grid clamp (415c7eacd) — PASS.** Synthetic DragEvent (dragstart chip `character:Wild_Sage_Druid` → dragenter/over/drop on `svg.grid-svg` at rect.bottom-left inside letterbox left-padding) → console.error `useMapDrops: clamped out-of-grid drop (-8, 19) to (0, 19)` + token lands (0,19). CK-era face (x=-3 persisting) is dead. Editor-unmounted full-doc PUT from dist copy restores md5 94fcd0bf byte-exact (again proven).
4. **Maps label separation (d924a8f71) — PASS:** `.maps-manager-item-info` is flex `gap:10px` with `.maps-manager-item-name` + `.map-type-badge.indoor` SIBLINGS (visual gap 299.27→309.27), badge carries `aria-label="Map type: Indoor"`.
5. **Sidebar Maps first-click (2c8d7a8ad) — PASS:** with map opened/activated earlier in session, sheet→Maps single click navigates (`hasMapsManager:true` after ONE click). §167 repro preconditions honored.
6. **Starter seed copy seams — PASS live on fresh qa-starter:** quick-create typed name (default `Starter-20261103` shown), wizard auto-open→cancel, STARTER ADVENTURE badge; dungeon "The Dark Vault of Despair" — 5-stem word-echo check PASS (d14b519e6); rumors/quests/maps/encounters scan → ZERO `(the|a|an)\s(the|a|an)` hits (1defc5406 seam live: "Folk in Thornveil whisper about The Dark Vault of Despair"); village Thornveil (NPCs Griffith/Khali, services), hex map Thornveil Countryside + dungeon indoor, 3 Waves, 3 quests re-pointed to the dungeon title; meta.type=starter. Arena lane NOT recreated — only shared-file touchers were starter-copy seams; CK's arena rows event-clear.
7. **Admin typed-name delete UI (Priority Target 4) — PASS both faces (now deep):** mismatch face (`wrong-name` → "did not match. Deletion cancelled." alert, campaign intact meta:200); full face (typed exact name → confirm → confirm → success alert → auto-reload to selection, folder gone, selection row gone via campaigns-list SSE, NO re-materialization after 14s). Chain dialog queue `page.on('dialog')` [prompt text, accept×3] inside one run_code; the wrapper's post-run "Modal state" echo was STALE both times (already-consumed prompt) — verified by handle_dialog "no modal state" error + API probe (§281 re-confirmed ×2).
8. **Hygiene/UX findings:** deleted-campaign GHOST APIs — `/api/campaigns/qa-starter/meta` still 200 `{type:"standard"}` and `/change-data` 200 `{}` post-delete (synthesized defaults, no 404) → backlog. EB Join drops the FULL saved PC party into cs as type:player entries — GENERAL behavior, not Empyrean-specific (§243 note generalized). Maps-manager Activate accessible name = `Activate "Battle Arena"` (exact:'Activate' getByRole times out; use regex). CampaignSelection DOM has a hidden `input[type=file][multiple]` that steals `input.first()` locators (filter `offsetParent!==null`). Console census: only the EXPECTED clamp console.error all session; zero unexpected errors.

**Freshness for the NEXT run:** CL entered/re-derived: lionAuraUtils consumer matrix (4 faces) + monster-lane mode source + MapsManager DOM/Activate/Back lanes + useMapDrops clamp face + starter quick-create/seed copy (rumors/echo/meta/badge/wizard) + Admin headings + typed-delete UI (2 faces) + campaign-quiet two-pass. Commits touching `lionAuraUtils|contextBuilder-|MonsterCardModal(combineAttackModes)|useMapDrops|MapsManager.jsx|App.jsx(mapsView)|seededCampaign.js|starterSeedService.js|CampaignAdmin.jsx|campaigns-admin.js` after 2026-11-03 demote these rows. Untouched-and-event-clear: spell-overlay, victory/TV, delegation, LAN, fog, hex3D, inventory, music, rules tray, NPC/quest/faction/settlement CRUD (test-campaign), AI lanes, OA popup lanes, PowW producer matrix, save-prompt lifecycle, Reach labels, EB advanced faces.

## Priority Targets (next descent)

1. **Monster-lane aura fix-verification** (new bug this run) — once fixed: acceptance = hostile monster token within 5 ft of Lion bearer rolls `mode:"disadvantage"` via card chip; PC ally face stays normal; doctrine comment updated.
2. **OA popup × wolf axis cross-check** (carried CJ→CK→CL, budget-owed) — popup + aura mode agree for both lanes on one NPC-token rig.
3. **jsonSchema:true refusing backend** — STILL owed (infra, unchanged since AQ).
4. Deferred low-value (unchanged): 3D per-mesh geometry, hex travel-in-3D patch rigs, indoor-overlay wand-drag face, Lion "another Barbarian with this option" exemption (unpinned AND unbuilt — name it with a unit-pin request if a cheap lane opens).

## Depth Seeds (live 2026-11-03 CL unless noted)

- **Lion consumer rig (CL):** skip the wizard swap when only the aura ENGINE is under test — bucket POST `{value:{activeConditions:[],activeBuffs:[{name:'Rage',effect:'stance',optionName:null},{name:'Power of the Wilds',effect:'power_of_wilds_option',optionName:'Lion',range:'5 ft',duration:'while_raging'}],selectedAllies:[…]}}` → re-select → sheet Shortbow `+7` chip (div.clickable in `.attacks` row, y-band anchor ±60px of the name cell) → popup "d20 a, b → min" + "Disadv (conditions)" chip = disadvantage; single "d20 n +7" = normal. `selectedAllies` edits DO require the re-select for the roller tab (SSE echo not trusted mid-rig).
- **Initiative per-card target-select census (CL):** 14 cs entries → 14 `[data-testid="target-select"]`; each card's OWN selector EXCLUDES its owner and retains its session-armed value (EF's persisted 'ElderPaladin' from a prior face); find the roller's by the exclusion pattern. Arm via selectOption only.
- **Drop-clamp face (CL):** left letterbox padding inside the svg rect (x=rect.left+2) maps to NEGATIVE gridX under the 800-viewBox CTM — ideal one-liner clamp probe; clamp text: `useMapDrops: clamped out-of-grid drop (raw, raw) to (clamped, clamped)`; dispatch drop returning FALSE = success (preventDefault).
- **Typed-delete choreography (CL):** Admin → `button:has-text("Delete Campaign")` → dialog queue [prompt=campaignName, confirm, confirm, alert]; wrong-name prompt yields ONE alert then returns (no confirms); success auto-reloads to selection. Post-delete: folder API ghost defaults (fact 8).
- **Carried seeds (CK, event-clear):** char-chip grid letterbox math, save-prompt key census, AoP face rig, bucket ally-flip nesting, quick-create rigs, OA popup three-lane rig, overlay Initiative lane, victory/TV/EB/checklist state-gates, delegation, rename-gate internals.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Lion aura attacker-hostility fix: ally-exempt/unedited, off-list betrayal flip, on-list exempt, self-target exclusion | deep (CL: 4-face live matrix through sheet-roller seam, machine log modes, bucket-stamp rig) — **ef05ac8d5 VERIFIED, CK target CLOSED** | `src/services/combat/auras/lionAuraUtils.js contextBuilder-map.js CharActions.jsx` |
| Monster-card attack lane vs aura family | deep (CL NEW: grep census + live goblin face + PC control differential) — **bug filed** | `MonsterCardModal.jsx:2379 combineAttackModes` — **bug-monster-attack-lane-never-consults-rage-auras.md** |
| Maps lanes: out-of-grid drop clamp, label separation, sidebar first-click, Activate/Back-to-maps lanes | deep (CL: 4 fix-faces live incl. console copy + byte-restore ×2) | `useMapDrops.js MapsManager.jsx App.jsx` — 415c7eacd + d924a8f71 + 2c8d7a8ad VERIFIED |
| Starter seed copy seams: rumor articles, dungeon word-echo, quick-create flow, checklist presence, meta/badge | deep (CL fresh qa-starter: live copy scans 0 hits, names/POIs/quests re-point census) | `src/services/campaign/seededCampaign.js starterSeedService.js` — d14b519e6 + 1defc5406 VERIFIED |
| Admin typed-name delete UI (mismatch + full chain) + Regenerate casing heading | deep (CL: both delete faces + dialog choreography + no-resurrect check) — CK gap CLOSED | `CampaignAdmin.jsx campaigns-admin.js` — 9ffd4421b VERIFIED |
| EB join: goblin join, PC-party fan-out into cs, own-card target arm, scimitar chip | deep (CL: join census 14 creatures, tokenless range-lenient roll) | `encounterToInitiative.js` EB components |
| Campaign quiet-state hygiene: two-pass admin clear (UI dialogs), byte-restore, ghost-API note | deep (CL) | `campaigns-admin.js` |
| Arena quick-create + seeded arena maps/pool | carried CK — event-clear (post-CK touches were starter-copy seams only) | `seededCampaign.js CampaignSelection` |
| PowW producer matrix / save-prompt lifecycle / Reach labels / AoP faces / checklist deep-links / regenerate re-point | carried CK — event-clear | rows as dated by CK |
| Spell-overlay / victory / TV / delegation / LAN / fog / hex3D / inventory / music / rules tray / NPC-quest-faction-settlement CRUD / AI lanes / OA popup | carried — event-clear at CL | rows as dated by CI/BH/BG |

## Baseline Fingerprints (canonical test-campaign state at CL exit — verified 2026-11-03)

- change-data `{}` + log `[]` + combatSummary `{"value":null}` — GET-verified 14s+ after closing the tab (no select-rehydrate dust this session).
- maps [Battle Arena, Test Map] battle-arena md5 **94fcd0bfe9e4cf6e1118f736b920e7a2** byte-identical (dist-copy PUT restore; players AS@15,9 FR@9,8 EF@1,8; placedItems []; EP/WSD rig tokens gone).
- campaigns/ = 5 baseline folders (qa-starter created, exercised, DELETED via typed-name UI — zero re-materialization; qa-arena not created this run).
- npcs [Marta Copperkettle]; ZERO character-file writes this run (no wizard swaps — bucket-stamp rig); 13 char files untouched.
- Env at exit: dev pair RUNNING (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'` node server.js :80 + vite :5173; logs /tmp/dnd-api-1104.log, /tmp/dnd-vite-1104.log) — kill trio before next run. Browser tabs CLOSED.
- Bug files this run: 1 (monster-lane aura gap). CK's Lion bug file RESOLVED + live re-verified dead here (4 faces).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them (DONE/BLOCKED/skipped are recorded in the run summary, never left as markers). FAILED bullets stay open. -->

- 2026-11-03 CL: **EB join PC-party fan-out is undocumented UI-wise** — joining a single monster seeds all 13 saved PCs into the initiative board (type:player, placeholder HP); intentional (party-alive model) but the board silently grows with no log row or hint. One `automation` log line "party joined initiative (N members)" or a footnote in the join toast would explain the rows. `encounterToInitiative.js`.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED this run: CK Priority Target 1 (Lion fix 4-face live matrix PASS); CK Priority Target 4 (Admin typed-name delete UI both faces); the six post-CK improve-commit faces ALL re-derived live PASS.
- OPEN (new): monster-lane aura bug fix-verification (Priority Target 1 next run).
- OPEN (carried ×3): OA popup × wolf axis cross-check — budget-owed, needs NPC-token rig.
- OPEN (infra, unchanged): llama.cpp-style refusing backend for jsonSchema:true.
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D patch rigs; indoor overlay wand-drag face; Lion "another Barbarian with this option" exemption (now flagged unbuilt+unpinned in CL fact 2); qa-arena lane intentionally not re-created (event-clear).
