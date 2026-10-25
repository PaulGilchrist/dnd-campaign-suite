# App Exploration Map

## Verified This Cycle (2026-10-25, day explore run — fix re-derivations + LOS/ZONES first descent)

Six fix/improve commits landed after the dawn pass (f26753991…e7a80d68f); every affected row re-derived live, and two dead-flag map lanes descended for the first time:

- **Movement-budget snap FIXED — dawn bug closed live (f26753991):** both dawn repro legs now pass. Fresh 30-ft budget, 8-cell drag: token lands SNAPPED cell — disk `EF gridX 1→7` (raw drop was 9) + `enforcement_denied {creature, bucket:'movement', source:'map-drag', reason:'…snapped to the remaining budget (30 ft this move)'}` + turnState `movementUsedFeet:30, hasMoved:true`. Zero-remaining leg: drag 2 cells → toast "snapped back to 0 ft", **disk holds (7,8)**, second denial logged. **NEW snap toast (37dc2c313):** `.map-toast[role=status]` " EvasiveFighter snapped back to N ft of movement." auto-hides (gone by ≥12s poll). **GM Shift+drag bypass lane intact:** shift-drag 3 cells on exhausted budget lands raw (7→10), zero toast/log/charge — restored to (1,8).
- **Quests dup guard is LIVE-TYPING again (096daddf9) — dawn correction SUPERSEDED:** typing "The Lost Artifact" char-by-char in New Quest → `.quests-form-error` "A quest with that name already exists" + Save disabled WHILE typing; lowercase variant also blocks (case-insensitive); appending " 2" clears banner + re-enables in same tick; whitespace-only → Save disabled, no dup banner. Save-click backstop + named delete confirm `Delete quest "QA Dup Guard Quest"?` re-verified; QA quest created→deleted, disk back to [The Lost Artifact]. Both `.ct-*` twins (factions+quests) now share the live-typing pattern.
- **Placed-token delete named confirm (f677853ee) — both legs proven:** contextmenu on token → `g.item-context-menu` (Hide/Delete/Rename/Rotate) → Delete fires `Delete "NPC 1" from the map?` / `Delete "NPC" from the map?` (item name; furniture falls back to type key). Cancel = fully inert — token stays AND no autosave write (disk 2 NPCs after cancel+debounce); Accept filters + persists (disk 0). Delete affordance is contextmenu-ONLY (no click-select-delete lane).
- **Enforcement LAN authority CLOSED IN EVERY MODE (e7a80d68f):** curl vs :80 with LAN Host — sub-flag staging while mode:'off' (`{mode:'off',turnLock:true}`) → **400** "only localhost (the GM) may change enforcement — enforcement is GM-owned in every mode" (dawn's accepted residual, gone); engage-forgery → 400; byte-identical full-blob re-post → 200 no-op (guard shape kept). Disk untouched all legs. **Residual shape-clobber found:** canonical-equal SUBSET no-op (`{"mode":"off"}`) is 200 AND replaces the stored 11-key blob with the posted subset — semantically null (missing keys read as defaults, reachable only when all-false already) but ugly; → backlog. **New free audit lane:** server-rejected enforcement writes surface client-side as log `enforcement_denied` "Server rejected write to enforcement: <reason>".
- **Initiative +NPC named defaults confirm re-captured live (5e0ab5db0):** "Add NPC with placeholder AC 10 / HP 10? Edit on the card." → accept → cs `{type:'npc', ac:10, currentHp:10, maxHp:10}`; removed via `.npc-remove-btn` at run end, board back to 12 PCs.
- **lineOfSight flag FIRST DESCENT — CLEAN (L5-003 §8.2):** rig = zones off, LoS on, wall painted (12,8), FeyRanger token (9,8) Longbow (150 ft > 8 ft gate) vs placed-NPC-token renamed "NPC 1" (matches cs combatant name — rename popover commits on ENTER, no button), armed via Initiative card-7 target-select. Blocked shot → popup "NPC 1 is behind a wall at (12,8) — no line of sight." + `enforcement_denied {bucket:'lineOfSight', source:'attack-row'}` + ZERO roll entries (pre-check runs before slot charge). Differential: Erase wall → same click rolls, HIT vs AC 10, damage commits after cancelling the Stalker's-Flurry chooser (three-stage sheet-attack family). Also proven: melee/touch ≤8 ft never consults the map; clear-line shots write stamp null (no stale tax).
- **zones flag FIRST DESCENT — HALF-COVER SIGN BUG (BUG FILED):** LoS off + zones on, EF token dragged onto the ray (12,8): every shot logs `enforcement_cover` "Half cover (−2 AC): EvasiveFighter interposes…" and the resolver taxes the TARGET: `targetAc:8 effectiveAc:8` (AC 10 − 2), `hit:true` on a 9-total that RAW-misses by 3 (3/3 shots AC 8; clear-line control returns to AC 10). RAW = +2 to target AC; the app's own other cover lanes use `coverAcBonus:+2` (MonsterCardModal/DiceRollResult.computed.js:45) — internally inconsistent. Root is byte-explicit: `coverService.js:30 HALF_COVER_AC=-2` → `targetAcComputation.js:44 targetAc += cover.ac`. `bug-zones-half-cover-ac-sign-inverted.md`. Secondary (adjudication owed, filed-not-asserted): nat-1 "Critical Miss!" is display-only (`showFumble`), resolver `hit:true` when total clears — app-wide, not zones-specific.
- **Select-rectangle group-move OA lane (useSelectMove §8.4) — CLEAN:** rect-select collects ONLY placedItems+walls (PC tokens can't be selected); rect-selected "NPC" token dragged out of FeyRanger's reach → `enforcement_triggered {creature:'FeyRanger', target:'NPC', bucket:'opportunityAttack', source:'token-move'}` "resolve the OA on FeyRanger's sheet" — PC reactor prompted, NOT charged at trigger (no turnState entry; sheet-resolution lane not walked). Pass-through move (adjacent→adjacent) correctly does NOT trigger.
- **Campaign-lock sanity:** `.campaign-name` header `test-campaign` at every nav hop. Final state: change-data `{}` log `[]` (admin clears, no resurrection), party gp:0/items:[], enforcement blob gone with store, Battle Arena baseline restored (walls [], placedItems [], SA@15,9 FR@9,8 EF@1,8), quests [The Lost Artifact].


## Verified This Cycle (2026-10-25 dawn run — post-fix re-derivation + ENFORCEMENT MAP LANES first descent)

Five fix/improve commits landed after the night pass (5904bff58…5e0ab5db0); every affected row re-derived live, and the top depth seed (token-drag enforcement lanes) descended for the first time:

- **Action-economy chooser-modal CHARGE — FIXED, full loop live (was DEAD):** enforcement ON + actionEconomy via Admin label-clicks, pointer armed on AasimarTest; Cunning Action chooser → **Cancel = zero spend** (bonusActionsUsed 0, log clean) → Dash Apply → **`turnState.AasimarTest.bonusActionsUsed:1` server truth** + 3 ability_use entries (chooser-choice/handler/confirm lanes) → same-turn re-click → **denied**: popup "No bonus action left this turn.", `{type:'enforcement_denied', creature, bucket:'bonusAction', source:'useCharActionsAutomation', reason}` log, zero delta. The `.sp-modal` that appears on the deny click is the PRIOR result panel (radios:0), not a re-offer. `bug-action-economy-chooser-modal-never-charges.md` CLOSED at fix-commit time; this is the live proof.
- **Party-inventory authority — CLOSED, all forged lanes 403/400 (was: fully player-writable):** LAN(:5173) player tab: currency rows render READ-ONLY (zero +/−/Give/Add-Item chips); POST /inventory → **403** "Access denied: GM-only feature", /inventory/deposit → **403**, transfer party-to-player → **403**. **Audited exception LIVE:** transfer player-to-party from LAN → **200** atomic honest debit (HexWarlock gold 10→7, party gp 0→3) — restored GM-side to gp:0/gold:10, disk-verified. Enforcement engage forgery POST /:c/enforcement (enforcement already engaged) → **400** "only localhost (the GM) may change enforcement while it is engaged" (0b6492583 LIVE) + activeCreatureName hijack → **400**; disk truth untouched both.
- **Admin audit panel (NEW visual surface, 0b6492583):** "Enforcement & AI audit" rows surfaced all three refusals without reload: LAN enforcement denial, LAN activeCreatureName denial, local economy denial. Free proof lane.
- **EB Load-modal stale-click gate (740228fad) — LIVE via throttled-fetch rig:** dev fetch resolves <50ms so the disabled window is normally invisible; `page.route('**/encounters*')` 900ms delay → **rows render during refresh with ALL row buttons disabled (31/31), enabled at resolve** — gate mechanically proven. Modal opens FIRST, then reloads (order flipped in hook).
- **+NPC defaults confirm (5e0ab5db0) — LIVE both legs:** native confirm names **"Add NPC with placeholder AC 10 / HP 10? Edit on the card."** Cancel → zero writes (cs unchanged). Accept → spawns NPC 1 (card hp inputs 10/10), remove confirm NOW names it: **"NPC 1 has 10 HP. Remove anyway?"** Board back to 12 PCs.
- **Enforced Initiative board NEW UI (L5-001, first mapped):** while enforcement master ON, board gains **`End Turn` button** (advances + resets economy, handleNextCreature) + per-card economy chips **`Action`/`Bonus`/`Reaction`/`⚡ 0/30 ft`** (spent buckets flip red: "Bonus used" seen live after the Dash charge) + active-creature economy strip in header. Not previously on the map (renders only enforcement-on). Prev-floor (name===creatures[0]&&round 1) re-OK'd live.
- **Enforcement MAP LANES — movementBudget + opportunityAttacks first descent (FIXED same-day by f26753991 — RAW-persist claim SUPERSEDED, see day section; OA lanes clean):** EB-joined Bandit; Battle Arena active. Token drags are **pointer-event** on `g.creature-group` (NOT HTML5 DnD — the `character:<Name>` DnD lane is Items-panel PLACEMENT only). NPC palette token placed via `DragEvent('npc')` dataTransfer at cell → lands `placedItems[]` (hostility = players[] vs non-player placedItems by design, no factions). **OA lane LIVE:** fresh-budget drag away from adjacent NPC (0,8) → `enforcement_triggered {creature:'NPC', target, bucket:'opportunityAttack'}` + **NPC reaction charged `reactionsUsed:1`**; 2nd trigger while spent → **denied** `enforcement_denied bucket:'reaction'` "NPC's reaction is already used", no double-charge. Exact-budget fit (30ft/6 cells) lands exact, charges exact (20ft move→movementUsedFeet:20 ✓). **BUG:** every OVER-budget drop logs enforcement_denied "snapped to remaining budget (N ft)" and charges the snapped cost, **but the token persists at the RAW drop cell** — decisive rig: remaining 0 ft, drag 2 cells → "snapped … (0 ft)" yet disk keeps gridX 1→3 (verified post-debounce, ≥9s). Clamp computes+bills+logs, never repositions. `bug-movement-budget-snap-logged-but-token-not-repositioned.md`. Root-cause guess: pointermove commits raw cells to live map state; clamped up-write loses persistence race (needs code read of Map.jsx persist seam).
- **Quests dup guard — CORRECTS prior map claim:** validation is **SAVE-CLICK fired, NOT live-typing** *(SUPERSEDED same day by 096daddf9 — see day section: live-typing restored)* ("live inline errors (factions+quests)" superseded): type existing quest name → NO banner, Save stays enabled; Save press → `.quests-form-error` "A quest with that name already exists" + blocked (disk count 1). Banner-clear-on-name-edit is unit-covered (`Quests.duplicate-name.test.jsx`). Server map rename dup: PUT /maps/:n/rename `{newName}` → 400 "A map with this name already exists" (param is `newName` — `name` alone 400s "New map name is required", easy probe trap).
- **Campaign-lock sanity:** `.campaign-name` header `test-campaign` at every nav, both tabs. Final state: change-data `{}`, log `[]`, party gp 0, HexWarlock gold 10, enforcement all-off, Battle Arena back to baseline 3 tokens (SA@15,9 FR@9,8 EF@1,8), placedItems [] (QA NPC token removed via GM PUT), Bandit cs residue cleared.



Ten fix/improve commits landed after the eve pass (a679ae28a…49ece24d0); every affected claim re-derived live this run, plus enforcement gate semantics (the eve's #1 depth seed):

- **Vite proxy Host fix (a679ae28a) — LEAK CLOSED, verified both lanes.** LAN curl of private note list via **:5173** now returns `[]` (eve: leaked full private note) and forged `activeCreatureName` LAN-via-proxy POST → **400** "only localhost (the GM)…" (eve: 200 saved). LAN UI: Notes page renders zero rows (sole campaign note is private), enforcement_engage differential holds (LAN 400 once engaged, localhost retains disengage). `bug-vite-proxy-localhost-guard-bypass.md` fix holds.
- **Add-Character gate (97e11931a) — FIXED both sides.** LAN player sidebar `hasAddChar:false` (eve: fully open); character-create POST from LAN host → **403** "Access denied: GM-only feature" (eve: 201+disk file). LAN campaign-select still no Add ✓.
- **Enforcement panel full row set (9aa89b0f5):** 11 checkboxes = master + 10 sub-flags; **Server dice row renders** with oracle hint (eve: serverDice persisted but UI-less). Fieldset disabled until master ON (`fieldset.disabled` + `:disabled` semantics; input.disabled IDL stays false inside disabled fieldset — probe with `fieldset.disabled` not child `.disabled`).
- **Enforcement debounce (3a1dccada):** burst of 5 checkbox clicks (master→turnLock→actionEconomy→autoRewards→serverDice, ~120ms apart) → **exactly ONE** POST /:c/enforcement carrying final blob (eve churn: 3 POSTs). Optimistic UI immediate.
- **Master-off zero-flags (161ee52c1):** master OFF while 4 flags ON → persisted blob `{mode:'off', all 10 sub-flags:false}` (eve: stale turnLock:true rode along). Re-engage starts all-false ✓.
- **EB empty-save gate (1ad97691a):** Save with zero selected monsters → inline `role=alert` banner **"Encounter has no monsters to save"**, NO modal (eve: empty saves succeeded ungated). Checked-rows count as the draft — Save with 1 checked opens the name modal honestly.
- **EB rename closes Load modal (fc903bfb9):** rename test-encounter→temp→restored, **modal closes on BOTH rename legs** (eve: stayed open), disk names verified each leg. Row pens are icon-only with aria `Rename <name>`/`Delete <name>`; flake note: synthetic pen click on a just-reloaded row list can silently close the modal (stale-node artifact — retry by index after fresh query works cleanly).
- **Dotted-key guard (49ece24d0):** POST /:c/Probe.json → **400** plain-English "Change-data keys cannot end in .json — … Save character files with PUT …" (eve: persisted undeletable junk key). Eve route-order trap CLOSED.
- **NPC init chip aria (3e417f959):** chip now `aria-label="Add Marta Copperkettle to Initiative"` mirroring title (eve: title-only selector note superseded).
- **Party item aria (a0211afcb):** item row buttons carry aria-labels ("Decrease quantity"/"Increase quantity"/"Edit item"/"Move to player"/"Delete item") — create "QA Night Rope" → verify → delete via named confirm, disk clean (eve icon-only/title-only lane superseded).
- **Enforcement SEMANTICS — turnLock (first live descent):** turn ON + Bandit EB-joined; walk pointer (join lands pointer on FIRST PC, round 1). Off-creature sheet Bonus Action click (`Cunning Action:` on non-active AasimarTest) → denial popup "It is AberrantSorcerer's turn — AasimarTest cannot act now." + `enforcement_denied {creature,bucket:'bonusAction',source:'useCharActionsAutomation'}` log + **zero economy delta**. Allow-leg when she is active: chooser `.sp-modal` opens, Dash resolves (ability_use ×2 lanes: modal + handler).
- **Enforcement SEMANTICS — actionEconomy DENY lane live, CHARGE lane DEAD on chooser modals (BUG FILED):** with flag ON + own turn, after a FULLY executed Cunning Action Dash `turnState.<char>.bonusActionsUsed` stays **0** (server read, 1.5s+), chooser re-offers unlimited — repeated Dashes same turn never refused. Manually POSTing valid turnState `bonusActionsUsed:1` → same click refused ("No bonus action left this turn." popup + log, NO chooser — clean-DOM proof). Root: `BonusActionChoiceModal.handleApply` never calls `chargeSlot` while `useCharActionsAutomation.js:453-459` defers modal charges to that apply seam. `bug-action-economy-chooser-modal-never-charges.md`.
- **Enforcement SEMANTICS — serverDice oracle live:** flag ON → POST /roll `2d6+3`→`{rolls:[6,1],total:10,roller:'server'}`, `1d20 advantage`→rolls[14,10] kept 14; bad expressions (`1d20+2d6`, `0d6`, `1d1`) → 400 bounds copy; flag OFF → 403 (both directions re-proved); every oracle roll audits to Log `{type:'roll',roller:'server'}`.
- **Enforcement SEMANTICS — autoRewards Clear lane live:** flag ON + Bandit cs currentHp→0 (full-store POST) + Clear (confirm) → `encounter {action:'loot_awarded',auto:true}` + `automation {auto_rewards_awarded}` "2 XP each to 12 characters (encounter 25 XP, 0 loot items)" + runtime `xp:2` stamped per char (floor(25/12), matches Award maths). Clear also renamed dead Bandit→NPC 1 + round 1 (renumber lane intact).
- **Initiative `+ NPC` GM lane (was carried-unverified):** spawns **NPC N with DEFAULTS ac:10/hp:10 in cs** — NOT byte-statless (playbook "+NPC = BARE statless" needs correction: bare = no monster data, but ac/currentHp/maxHp 10 defaults are stamped). Remove via `.npc-remove-btn` + confirm-override technique, board back to 12 PCs.
- **Music autoplay edge FORCED (was never forced):** mood click = AUTOPLAY (embed `autoplay=0` chrome but transport flips to Pause-active immediately, `.music-mood-btn.active` tracks selection); mid-playback Tavern→Combat→Dungeon swaps re-mount cleanly; Stop → active cleared, transport back to Play disabled baseline. Zero app console errors (all 4-6 errors were YouTube doubleclick/CORS third-party noise — attributed, not filed).
- **Wizard mid-flow reload:** wizard open at step ~2 → reload → lands on Campaign-select (known), re-select → wizard does NOT reopen, draft lost, disk untouched (no autosave/restore lane — noted, backlog-level).
- **Cross-tab SSE:** GM d20 tray roll on localhost tab → LAN player tab (on Log view) renders entry WITHOUT reload ✓ re-confirmed. 3-tab concurrency: player-tab +1×4 vs GM-tab +10×3 → server settles honest **gp:34** (no lost update at this interleave; MCP serializes tool calls so true same-frame races unproven — noted).
- **NEW HOLE (BUG FILED):** party inventory is fully player-writable from LAN — `+100` chip click from :5173 player tab → server gp 0→100, `−100`→0, `Add Item` renders; `server/routes/inventory.js` has ZERO hostname guards (3 POST routes). `bug-player-clients-can-write-party-inventory.md`.
- **Campaign-lock sanity:** header `test-campaign` verified every nav, both tabs.

## Overview
D&D Character Sheet is a full-stack React 19 + Express 5 app for managing D&D 5e/2024 campaigns. Vite dev server on port 5173 proxies to Express on port 80.

## Main Sections/Pages

### 1. Campaign Selection (Dashboard)
- **URL**: `/` (when no campaign selected)
- **Heading**: "Select a Campaign"
- **Features**: Lists all campaigns as buttons, "Add" button to create new campaign
- **Identifiers**: `button:has-text("Select a Campaign")`, `button:has-text("Add")`

### 2. Character Sheet
- **View state**: `charSheet`
- **Features**: Full character display with abilities, actions, features, inventory
- **Buttons**: Edit, Delete, Upload, Download, Short Rest, Long Rest
- **Sections**: Summary (AC, HP, Speed, Gold, Proficiency, Initiative, Inspiration, Background, Allies), Abilities table, Actions table, Bonus Actions, Reactions, Features, Character Advancement
- **Identifiers**: Character name buttons in sidebar, `button:has-text("Short Rest")`, `button:has-text("Long Rest")`

### 3. Characters (Sidebar Submenu)
- **Features**: Lists characters in campaign, "Add Character" button
- **Wizard**: 17-step character creation wizard (Ruleset → Basic Info → Race → Subrace → Background → Class → Subclass → Feats → Ability Scores → Skill Proficiencies → Tool Proficiencies → Languages → Resistances → Spells → Magic Items → Inventory → Special Actions)
- **Wizard deep-dive 2026-10-10**:
  - Ruleset step: Next is NOT gated — can proceed with no ruleset selected (defaults to 5e; subclass options become 5e schools)
  - Step 2 name: empty/whitespace blocks Next (good); duplicate names NOT blocked — create silently OVERWRITES existing character JSON (data-loss bug filed)
  - Indicator skips step 5 ("4 Subrace" → "6 Class"); content headings then renumber independently ("Step 4: Feats", "Step 5: Ability Scores" etc. vs indicator 8/9) — indicator and content numbering disagree from Feats onward
  - Background step (5e): shows only "not available for 5e" notice, yet skills step says "2 from your background" — background skills unobtainable in create flow for 5e
  - Skills step: cap display-only — checks beyond allowed stay checked, counter shows "3 of 2", Next enabled (bug filed)
  - Point buy: overspend input silently reset to 8 with no message (silent clamp)
  - Final footer button is "Create Character" (indicator "✓ Save" stays disabled — cosmetic); cancel discards edits incl. slider changes; empty name edit-revert is silent-but-safe

### 4. Encounters (Encounter Builder)
- **View state**: `encounter`
- **Features**: Full encounter builder with monster database
- **Buttons**: Save encounter (`button[title="Save encounter"]`), Load encounter (`button[title="Load encounter"]`), Generate (`button[title="Generate encounter from environments"]`)
- **Components**: Party list (auto-populated from characters), Difficulty selector (Easy/Medium/Hard/Deadly), Monster search and filter (Type, Size, CR Min/Max), Monster table with checkboxes; checked rows get qty steppers `button.qty-btn` (− N +) in the qty cell + a `.encounter-selected` "Selected Monsters (N) <xp> XP" summary card with `.selected-item` rows and × removers
- **Save/Load round-trip (verified 2026-10-24)**: Save → `.encounter-modal` with name input → POST persists + `.encounter-toast` "Encounter saved" (auto-hides ~2.5s; errors toast in `.encounter-toast-error`); Load → `.encounter-modal-load .encounter-list` rows "<name><X> effective XP" each with buttons [download-load, pen(×), trash(×)]; LOAD button restores checked rows + exact quantities, closes modal, toasts "Encounter loaded"; TRASH deletes with confirm (`window.confirm`, leaf-owned in EncounterModal — NOT unguarded as earlier noted).
- **Identifiers**: `heading:has-text("Encounter Builder")`, `.encounter-modal-save input`, `.encounter-list > *` rows, `.selected-item`, `button.qty-btn`

### 5. Factions
- **View state**: `factions`
- **Features**: Faction management, New Faction form
- **Form fields**: Name*, Description, Goals, Influence slider (min=1 max=10 — DOM-enforced, 0 impossible), Notes; NO children/services UI (earlier doc note about "deep edit" is outdated — form is flat)
- **Validation**: Duplicate names rejected — derived guard now validates WHILE typing (Save disabled + inline "A faction with that name already exists", since 2026-10-24 run); server-400 duplicate error also clears on name edit; empty name disables Save; Cancel discards all edits
- **Delete**: `window.confirm("Delete this faction?")` then removal persists (~10s debounce)
- **Identifiers**: `button:has-text("New Faction")`, rows `li[aria-label="Edit faction: <name>"]`, slider `slider "Influence Level"`

### 6. Initiative
- **View state**: `initiative`
- **Features**: Combat initiative tracker
- **Buttons**: Add (per creature, for effects), Clear, + NPC, Prev/Next (round navigation), Generate Loot
- **Behavior**: "+ NPC" adds statless "NPC N" (default 10 HP) with title tooltip and inline `npc-statless-hint` badge; removal asks for confirmation
- **Identifiers**: `button:has-text("Clear")`, `button:has-text("+ NPC")`, `button:has-text("← Prev")`, `button:has-text("Next →")`, `button:has-text("Generate Loot")`, NPC remove `button.npc-remove-btn`

### 7. Maps
- **View state**: `mapsManager`
- **Features**: Map management, map list with actions
- **Buttons**: Create Map, Generate Dungeon, Open, Activate, Rename, Edit description, Delete
- **Behavior**: "Create Map" disabled only while name is empty; duplicate map names rejected inline ("A map with that name already exists"); delete uses a custom in-app modal ("Yes, Delete Permanently"), not `window.confirm`; editor autosaves debounced ~1s with flush on pointerup/unmount/map-switch; ACTIVE badge shown in list next to active map
- **Rename (verified 2026-10-10)**: inline row textbox (no modal) prefilled with name; Enter commits; empty rename silently reverts (safe); duplicate rename shows inline "A map with that name already exists" and keeps original; valid rename renames the file (test-map.json → qa-renamed-map.json) within ~12s debounce
- **Editor + fog (verified 2026-10-13)**: map JSON model = `{displayName, name, gridSize, walls[], placedItems[], paintCells[], items[], players[], fog[], rooms[], terrain{}, pois[], zoom, panX, panY, revealed[]}`. Fog is COMPUTED (`useFogOfWar`): fog = cells neither in persistent `revealed[]` nor currently visible from tokens' line-of-sight; walls[] are the blockers; `revealed` monotonically grows on every client whenever tokens see new cells (auto-saved); "Reset Fog" (GM `button[title="Reset fog of war and view"]`) REFOGS — `revealed = current visible set only`. Grid size is an editable number input in the header (was 40, now 20 on Test Map → 20×20 cells; SVG renders viewBox 800×800). Wall painting persists within ~1.5s of pointerup. Stale out-of-bounds `revealed` entries are pruned server-side at GET/PUT (`pruneRevealedToGrid`, server/routes/maps.js — fixed 2026-10-24; shrinking gridSize permanently forgets the pruned cells — accepted).
- **CROSS-TAB SYNC DEFECT (2026-10-13)**: manager-Open passes the raw filename WITH `.json` as `mapName` → editor SSE expectedKey never matches broadcast key → GM editor tabs are permanently deaf to live map updates (see `bug-map-editor-sse-key-mismatch-json-suffix.md`)
- **Identifiers**: `button:has-text("Create Map")`, `button:has-text("Generate Dungeon")`, rows `li:has-text("<name>")`, delete confirm `.maps-manager-modal-overlay` ("Yes, Delete Permanently"), editor cells `rect.grid-cell[data-cell="gx,gy"]` (machine-readable hitboxes), walls `svg.grid-svg rect.wall-cell[data-cell]`, grid extent `svg.grid-svg rect.grid-bg` (legacy), tokens `g.creature-group`, `button[title="Reset fog of war and view"]`

### 8. NPCs
- **View state**: `npcs`
- **Features**: NPC management, New NPC form, Generate NPC
- **Form fields**: Name (required), Race, Class/Role, Attitude (dropdown), Appearance, Personality, Goals, Secrets, Notes, Tags
- **Buttons**: New NPC, Generate NPC, Add to Initiative (per NPC; disabled until AC and HP are filled in), Edit NPC, Delete NPC
- **Validation**: Whitespace-only names keep Save disabled; duplicate names rejected (case-insensitive, self-edit exempt)
- **Combat-readiness gate**: "+ Add to Initiative" is disabled without numeric AC + positive HP; with stats but no usable attack the row shows a "No attacks" badge and adding asks for a weapon first (Cancel joins anyway with an Unarmed Strike fallback)
- **Identifiers**: `textbox:has-text("Name *")`, `button:has-text("Generate NPC")`, `button:has-text("Add to Initiative")`, rows `li[aria-label="Edit NPC: <Name>"]` (the `li` itself is role=button), inner init button `.npcs-init-btn` (may be `disabled`)

### 9. Notes
- **View state**: `notes`
- **Features**: Campaign notes, markdown support; title optional (content-only saves render "No location" in list); list preview clamped to 2 lines with ellipsis, open view unclamped; GUID-keyed persistence
- **Buttons**: New Note, Edit note, Save, Cancel
- **Identifiers**: `button:has-text("New Note")`, title `input[placeholder*="Skull Creek"]`, body `[placeholder="Write your note here…"]`, rows `li.ct-list-item`

### 10. Quests
- **View state**: `quests`
- **Features**: Quest tracking; empty/whitespace-name Save disabled; duplicate names rejected case-insensitively (inline `.sessions-form-error`-style error inside `.ct-modal quests-modal`); special characters in names stored fine (GUID-keyed); delete = `window.confirm("Delete quest \"<name>\"?")` (cancel respected, row stays)
- **Status**: Active/Completed/Failed select; row badge updates immediately after save; list preview renders sanitized markdown, clamped to 2 lines (shared `MarkdownPreview`, Notes-list pattern)
- **Delete defect (2026-10-13)**: accepting delete removes the row but leaves the Edit modal open with the deleted quest's data — see `bug-quest-edit-modal-stays-open-after-delete.md`
- **Buttons**: New Quest, Edit quest, Save, Cancel, Delete (`button.ct-btn-danger` in `.ct-modal-footer`)
- **Identifiers**: `button:has-text("New Quest")`, `input[placeholder="Quest name"]`, rows `button[aria-label="Edit quest: <name>"]`, search `input[placeholder*="Search Quests"]`, empty state `No quests found matching “<q>”`

### 11. Settlements
- **View state**: `settlements` (GM/localhost)
- **Buttons**: New Settlement, Generate Settlement (opens fully pre-filled local draft modal), size filter toggles `.settlements-size-btn` (Village/Town/City/Metropolis), per-card Add Service/Add NPC/Add Rumor repeaters, Preview (aria-label "Switch to preview mode")
- **Validation**: Duplicate names rejected (client inline `.settlements-form-error` + server 400, self-edit exempt)
- **Note**: add-row clicks AUTO-FILL all empty textarea fields from the local generator
- **Identifiers**: repeaters `input[placeholder="Business name"]`/`[placeholder="NPC name"]`/`[placeholder*="rumor"]`; service type select = first `.ct-modal select`

### 12. Log (Campaign Log)
- **View state**: `campaignLog`
- **Features**: Dice roll and activity log
- **Components**: Log entries with timestamps, creature names, roll details, dice values; damage entries `type:hp_change {targetName, delta, currentHp, maxHp, damageBreakdown[]}`
- **Identifiers**: `.campaign-tool.log-view`, `.log-entries`, `.log-entry`

### 13. Admin
- **View state**: `campaignRepair`
- **Features**: GM-only admin tools
- **Buttons**: Switch to Light Mode, Rename Campaign, Delete Campaign, Clear Change Data, Clear Campaign Log, Full Reset, Create Snapshot, Download Campaign, Rollback to Snapshot
- **Behavior**: Snapshots are timestamped archives (`<c>-YYYY-MM-DDTHH-mm-ss-mmm.zip`, capped at 10, legacy `<c>.zip` fallback); rollback confirm is a custom `.ct-modal-overlay` ("Cancel"/"Confirm"), not `window.confirm` — after rollback the page reloads with the campaign deselected, then a post-restore banner ("Campaign restored from <file>") auto-re-selects it and lands on the Admin view
- **Identifiers**: `button:has-text("Admin")`, `button:has-text("Delete Campaign")`, rollback confirm `.ct-modal-overlay`

### 14. Rules
- **Behavior**: Opens external URL `https://paulgilchrist.github.io/dnd-tools/rules/general` in new tab
- **Not in routes config**: This is intentional external linking, not a missing view

### 15. Dice Roller
- **Location**: Bottom-left of sidebar
- **Dice**: d4, d6, d8, d10, d12, d20, d100
- **Behavior**: Opens popup overlay for dice rolls; dismisses on Escape; `.dice-tray-popup-overlay` intercepts page clicks until dismissed
- **Defect**: rolls are client-local only — nothing POSTs to `/log`, nothing arrives via SSE in other tabs (see `bug-dice-tray-rolls-not-logged.md`)

### 15b. Music Panel
- **Location**: Sidebar, above dice tray
- **Moods**: Town / Outdoors / Combat / Dungeon / Tavern (mood chip highlights when selected)
- **Behavior**: Selecting a mood AUTO-STARTS playback (Play flips to Pause with no Play click); embedded YouTube iframe player (`YouTube Video Player` generic, real YouTube videos e.g. "Village | D&D/TTRPG Ambience"); Pause/Stop + Volume slider; play/stop actions WRITE to campaign log (`type:'music'`, "GM stopped ambience")
- **Track editor (verified 2026-10-13)**: pencil button opens an INLINE `.music-editor` panel in the sidebar (NOT a modal — earlier "modal unexplored" note reframed) with Mood select `#music-editor-mood`, textarea `#music-editor-urls` pre-filled with video IDs (one per line), Save/Reset/Cancel. Save with no parseable lines = silent no-op, console-only error (bug filed).
- **Note**: depends on external YouTube — offline tables get silence; autoplay may vary by browser policy

### 16. Sessions (GM planner)
- **View state**: `sessions`; sidebar button "Sessions"
- **Features**: session planning — list of plans with status badge (`planned`/`played`), search, checkbox progress, linked-resource chips
- **Modal** (`.sessions-modal`, heading "New Session" / "Plan Session — <name>"): Name* `#session-name` (whitespace blocked, duplicate-name inline guard), Date, **Suggest XP Budget** + **Generate Rumors** (copy AI prompts to clipboard — button flips to "Prompt copied"), Linked Resources pickers (maps/encounters/npcs/quests/settlements/notes via `select[aria-label^="Link "]`, linked chip `.sessions-link-row` with quick actions: map→"Activate", npc→"To Initiative"), Contingencies (`input[aria-label="Contingency N trigger"]`/`"…outcome"` + `select[aria-label="Contingency N branch"]` Negotiation/Alternate route/Failure-consequence), auto+custom Session Checklist (auto items scale with linked resources, `input[aria-label="New checklist item"]` + exact-text `button:text-is("Add")`), Notes
- **Row**: `button[aria-label="Edit session: <name>"]`; "Mark as Played" (opens inside EDIT modal — fires `prompt` dialog "Session recap (optional)…" → `session-played` log entry "Session \"X\" marked as played"; recap may be left empty); progressbar `aria-label="Checklist N of M complete"` shows "N/M ready"; delete via row → modal Delete → confirm — modal CLOSES cleanly (contrast with Quests bug)
- **Deep-verified 2026-10-13**: checklist ticks persist across modal close/reopen (auto + custom); contingencies persist incl. branch select value (`alternate`); linked items are REMOVED from their picker dropdowns once linked; quick "Activate" writes `__map__.activeMapName` silently; quick "To Initiative" on a statless NPC shows inline `.sessions-form-error` AND throws console "Failed to run session quick action" (button is not gated like NPCs view — backlog)

## Key UI Patterns

### Form Validation
- Required fields marked with `*` (e.g., "Name *")
- Save buttons disabled when required fields are empty
- Duplicate names rejected (case-insensitive) across NPCs, Maps, Quests, Factions, Settlements, Sessions — client inline error + server 400, self-edit exempt
- Delete actions show confirmation dialogs (`confirm` dialog for NPCs, `prompt` dialog for campaign deletion requiring exact name, custom modals for maps and admin rollback)

### Preview Mode
- Many text fields have "Switch to preview mode" / "Preview" buttons
- Toggles between edit and preview for Appearance, Personality, Goals, Secrets, Notes, etc.

### SSE Real-Time Sync
- **Endpoint**: `GET /subscribe?campaign=<name>` (Server-Sent Events)
- **Polling**: `GET /api/campaigns/:name/change-data` (in-memory cache polling, ~10s debounce)
- **Pattern**: ONE shared SSE connection per campaign — use `subscribeToSSE()` from `src/services/ui/sseClient.js`, never `new EventSource` directly
- **Data flow**: Changes POSTed to server → broadcast via SSE → clients receive and update (e.g. GM map paints appear live on player tabs; `map-activate` auto-opens the map for players)
- **Player "no active map"**: shows inline `MapUnavailable` placeholder ("Waiting for the GM to open a map…" + Check Again) instead of alerting
- **NPCs management list live-syncs (fixed 2026-10-10)**: server routes publish `npcs-list-<campaign>` (`{action:'created'|'updated'|'deleted'|'replaced'}`) on NPC mutations; `NPCs.jsx` subscribes via `Subscriber`/`subscribeToSSE` and re-fetches the list — guarded so an open edit form's draft is never squashed (sync resumes after close). Verified live two-tab: create gained row ~0.5s, delete lost row <0.1s.

### Concurrent GM edits (verified 2026-10-10, two tabs same NPC)
- Last-write-wins with ZERO conflict detection: Tab A opened edit form, Tab B saved a newer value, Tab A then saved its stale form → Tab B's persisted edit silently lost, no version stamp/E409/warning anywhere.

### Navigation
- Single `activeView` state variable for mutually exclusive sidebar views
- Wizards are overlays that don't affect `activeView`
- Campaign selection uses `showCampaignSelection` boolean

### Sidebar Structure
```
- Campaign name (header)
- Character name (active indicator)
- Campaigns (button)
- Characters (section with submenu)
  - Add Character
  - [Character buttons]
- [Sidebar buttons per config]
- Rules (external link)
- [Settlements, Admin] (localhost only)
- Dice tray (footer)
```

## Reliable Selectors

| Element | Selector |
|---------|----------|
| Campaign buttons | `button:has-text("<campaign-name>")` |
| Sidebar navigation | `button:has-text("<view-name>")` |
| Save button (exact) | `button:has-text("Save")` with exact match |
| Cancel button | `button:has-text("Cancel")` |
| Close button (×) | `button:has-text("×")` |
| NPC name field | `textbox:has-text("Name *")` |
| Search inputs | `input:has-text("Search <type>")` or `textbox:has-text("Search <type>")` |
| Create Map | `button:has-text("Create Map")` |
| Generate NPC | `button:has-text("Generate NPC")` |
| Add to Initiative | `button:has-text("Add to Initiative")` |
| Dice buttons | `button:has-text("d20")`, `button:has-text("d4")`, etc. |
| Short Rest | `button:has-text("Short Rest")` |
| Long Rest | `button:has-text("Long Rest")` |
| Map editor canvas | `svg.grid-svg` — cells now carry `data-cell="gx,gy"` (invisible `rect.grid-cell` hitboxes, full grid; walls `rect.wall-cell[data-cell]`, fog `rect.fog-cell*[data-cell]`); prefer `[data-cell]` center rect for paint/fog automation over legacy grid-bg÷cols viewBox math |
| Map tools | `button:has-text("Paint"|"Erase"|"Select"|"Spell"|"Ruler"|"3D"|"Items")`; fog reset `button[title="Reset fog of war and view"]` (GM) / `"Reset view"` (player) |
| Items panel | `button.items-panel-close`; draggable char chips in panel "Characters" section (`character:<name>` drag payload) |
| Maps list rows | `li:has-text("<name>")` with `button:has-text("Open"|"Activate"|"Rename"|"Delete")`; delete confirm `.maps-manager-modal-overlay` ("Yes, Delete Permanently") |
| NPC rows | `li[aria-label="Edit NPC: <Name>"]` (role=button); inner `.npcs-init-btn` |
| Initiative NPC remove | `button.npc-remove-btn` (icon-only — use real mouse click, not synthetic `.click()`) |
| Inventory | currency rows labelled "Platinum|Gold|Silver|Copper"; items table `.pi-items-table` with `button[title="Edit item"]` / delete in `.pi-actions-cell`; party `button:has-text("Move")` → "Move to Player"; player-side `button:has-text("To Party")` per `li` |
| Sessions | `.sessions-modal`, `select[aria-label^="Link "]`, `.sessions-link-row`, `.sessions-checklist input[type=checkbox]`, row `button[aria-label="Edit session: <name>"]`, progressbar `aria-label="Checklist N of M complete"` |
| Settlements | filter `.settlements-size-btn[.settlements-size-btn-active]`; repeaters `input[placeholder="Business name"]`/`[placeholder="NPC name"]`/`[placeholder*="rumor"]`; service type select = first `.ct-modal select` |
| Notes | title `input[placeholder*="Skull Creek"]`, body `[placeholder="Write your note here…"]`, rows `li.ct-list-item` |
| EB join | `.encounter-btn-join` (enabled with ≥1 checked); qty cell `td[data-testid="qty-<rowIndex>"]` (no numeric input exists at qty 0; renumbers on filter) |
| Combat | `[data-testid="target-select"]` (arm target), `.mc-overlay` (monster card, stays open after attack — close via ×), `.mc-action:has-text("<Attack>")` |
| Admin rollback | custom `.ct-modal-overlay` ("Cancel"/"Confirm") — not `window.confirm`; re-select campaign after reload |
| Quests | name `input[placeholder="Quest name"]`; rows `button[aria-label="Edit quest: <name>"]`; footer delete `button.ct-btn-danger` (confirm dialog, but modal stays open after accept — bug); empty-state `No quests found matching “<q>”` |
| EB save/load | `button[title="Save encounter"]` → `.encounter-modal-save input`; `button[title="Load encounter"]` → `.encounter-list > *` rows (buttons: `Load`, pen, trash — trash deletes WITHOUT confirm); qty `button.qty-btn`; selection card `.encounter-selected`/`.selected-item` |
| Music editor | pencil `button[title="Edit tracks for this mood"]` opens INLINE `.music-editor` (`#music-editor-mood`, `#music-editor-urls`, `.music-editor-actions` Save/Reset/Cancel) — not a modal |
| Inventory add-item | party `button:has-text("Add Item")` → `.pi-modal` `#pi-item-name`/`#pi-item-qty`/`#pi-item-desc`; equipment desc autofill currently inert (wrong-key bug) |
| Sessions additions | `#session-name`; `input[aria-label="New checklist item"]` + `button:text-is("Add")` (exact, avoid "Add Contingency"); `input[aria-label="Contingency N trigger"|"Contingency N outcome"]`, `select[aria-label="Contingency N branch"]` (values `negotiation|alternate|failure`-style slugs); linked pickers drop already-linked options |

## Known Quirks & Gotchas

1. **Duplicate accessible names** — Multiple "Add to Initiative" buttons (one per NPC) and many "Add" buttons (one per effect slot per creature) share identical accessible names, causing ambiguity.

2. **Character wizard step numbering** — EDIT mode renumbers from 1 (indicator "1 Basic Information…11 Languages", content heading "Step 1: Basic Information" — indicator and content AGREE in edit mode, verified 2026-10-13; the disagree-from-Feats numbering is CREATE-mode only). Edit opens prefilled (name etc.) and Cancel discards cleanly.

3. **Two Save buttons** — NPC form has both "Save & Add to Initiative" and "Save" buttons. Use exact text match to distinguish.

4. **SSE connection reuse** — ONE shared `/subscribe?campaign=<name>` connection per tab via `subscribeToSSE()`; never create additional EventSources (exhausts the browser's ~6-connection-per-host pool). Debug tip: `import('/src/services/ui/sseClient.js')` in page context → `__getSources().get(campaign)` exposes `{eventSource, handlers}` — inspect readyState, attach probe listeners, or wrap handlers to trace delivery (used to prove the map-editor key-mismatch bug).

5. **change-data polling** — The `change-data` endpoint is polled frequently (every ~10s) for real-time sync.

6. **Rules is external** — The Rules sidebar button opens an external GitHub Pages site, not an in-app view.

7. **Admin/Settlements localhost-only** — These sidebar items only appear on localhost.

8. **Map editor monster-card overlay persists** — `.mc-overlay` stays open after an attack popup; close it via × before other interactions.

9. **Synthetic clicks absorbed** — Some icon buttons (e.g. `.npc-remove-btn`) silently ignore `evaluate`-driven `.click()`; use real mouse clicks in automation.

10. **Playwright mouse events do NOT reach background tabs** — wall-painting / qty-stepper drags on a hidden tab are silently lost (2026-10-13). `bringToFront()` the acting tab first; verify state afterwards, never assume the dispatch landed.

11. **Playwright auto-accepts `window.confirm`/`prompt`** — a dialog vanishes instantly and `browser_handle_dialog` then reports "no modal state". To prove whether a delete uses confirm at all, override `window.confirm` in page context to record+return false (then true) before clicking.

12. **EB qty `+` clicks** — `page.mouse.click` at a freshly-computed rect can be absorbed while `locator.click()` on `button.qty-btn` increments reliably (2026-10-13); the same button on a DIFFERENT row absorbed-then-worked — diff the row text by exact `td[1]` name match, not `tr:has-text`, "Wolf" also matches Dire/Winter Wolf rows.

13. **run_code_unsafe needs `async (page) => {}` function form** and ABSOLUTE URLs in `page.evaluate(fetch)` (relative paths throw "Failed to parse URL").

## Not Yet Verified / Untested Areas

- **Admin Download / Upload Campaign:** buttons present; upload replaces the whole folder, untested.
- **EB "Generate encounter from environments":** button known; never exercised.
- **True player-view (non-localhost) fog rendering + player token drag:** cannot be exercised from a localhost-only session (all tabs are GM) — fog math verified GM-side + in source only.
- **Inventory currency "Give" transfer to a player + per-character inventory:** party add/remove item verified; currency chips/Give not exercised.
- **Music Reset button + YouTube playback with saved override:** editor Save of a valid override not exercised (would swap real tracks).

## Improvement Backlog


## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Campaign selection | deep | select/deselect, reload re-select, multi-tab |
| Character sheet | deep | prior sessions + rest/ally/HP seams |
| Character wizard (create) | deep | full 17-step walk 2026-10-10: ruleset-skip, dup-name overwrite (bug), skill over-cap (bug), point-buy clamp, numbering |
| Character wizard (edit) | medium | 2026-10-13: opens at renumbered step 1, indicator/content agree, prefilled, cancel clean; destructive edit-save not exercised |
| NPCs | deep | create/edit/save/delete/dupe-guard, two-tab concurrent lost-update verified 2026-10-10 |
| Quests | deep | 2026-10-13: create w/ special chars, whitespace-block, case-insensitive dupe guard (banner-stickiness noted), status badge edit persists, search + empty-state, delete confirm+cancel+accept paths — delete-leaves-modal-open bug filed |
| Factions | deep | flat CRUD 2026-10-10: create+dupe guard, influence slider bounds (min 1), cancel-discard, delete confirm+persist; list rows |
| Encounters (EB) | medium | 2026-10-13: monster check/qty stepper/selected-card, SAVE round-trip (server list w/ XP), mutate, LOAD restores exact quantities, trash-delete (no confirm); Generate + Join covered by MA suite |
| Maps manager | deep | create/list/activate/rename validation matrix (empty/dup/valid) 2026-10-10; ACTIVE badge; editor paint 2026-10-13 |
| Map editor fog of war | deep | 2026-10-13: fog model (revealed memory + LoS), wall paint persist, Reset Fog re-fog semantics, cross-tab SSE probe → manager-open SSE key-mismatch bug filed (`bug-map-editor-sse-key-mismatch-json-suffix.md`); token-move live reveal not proven (blocked by that bug) |
| Initiative tracking | deep | prior runs (+NPC statless, walk, loot) |
| Inventory | shallow-medium | 2026-10-13: party add item (modal fields), equipment autofill DEAD (wrong-key bug filed), edit modal prefill, row delete; currency chips/Give NOT tried |
| Notes | deep | 2026-10-13: create (title+markdown body), list preview, markdown renders in open view, delete via detail-view `.ct-btn-danger` with confirm "Delete this note?" |
| Sessions | deep | 2026-10-13 full cycle: create w/ 3 linked resources (auto checklist scales 6+custom→7), checklist tick persistence across reopen, contingencies persist, XP/rumor clipboard flips, quick Activate writes __map__, quick To-Initiative statless-error path, Mark as Played (prompt+`session-played` log+PLAYED badge), delete closes cleanly |
| Settlements | shallow | prior coverage |
| SSE sync | deep | verified GM-management views are mount-fetch-only (no live create/delete sync) 2026-10-10; map-data broadcast fires but manager-opened editor drops it (key mismatch bug 2026-10-13); probe recipe via sseClient `__getSources` |
| Dice roller | deep | client-local only, no log/SSE (bug filed) 2026-10-10 |
| Music panel | medium | mood auto-play, pause/stop (+`music` log entry), track editor OPENED inline (`#music-editor-urls` prefill) 2026-10-13; invalid-save silent bug filed; valid override save/Reset not exercised |
| Admin | deep | clears verified 2026-10-10 + 2026-10-13 (cd{} log{} two-pass); snapshot/rollback from prior runs; upload/download untested |

## Blocked / Not Verified

- (2026-10-13) True player-view fog rendering / non-localhost read-only mode — all Playwright tabs run on localhost (GM); no second host available. Fog logic was verified via GM canvas + source reading instead.
- (2026-10-13) Live token-drag reveal sync across tabs — untestable end-to-end because manager-opened editors never receive SSE updates (the filed key-mismatch bug swallows the `players` merges too); single-tab drag+reveal autosave path also skipped to keep board untouched.
- (2026-10-13) EB "Generate encounter from environments", Admin upload/download, Inventory currency Give, Music Save of a valid override — not exercised this session (time/benign-risk triage).
