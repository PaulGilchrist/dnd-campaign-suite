# App Exploration Map

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
- **Save/Load round-trip (verified 2026-10-13)**: Save → `.encounter-modal` with name input → POST persists (visible in `GET /api/campaigns/test-campaign/encounters` with `savedAt`+`effectiveXP`); Load → `.encounter-modal-load .encounter-list` rows "<name><X> effective XP" each with buttons [download-load, pen(×), trash(×)]; LOAD button restores checked rows + exact quantities + closes modal; TRASH deletes with NO confirm dialog (inconsistent with every other delete flow). No visible save/load confirmation toast at all (backlog).
- **Identifiers**: `heading:has-text("Encounter Builder")`, `.encounter-modal-save input`, `.encounter-list > *` rows, `.selected-item`, `button.qty-btn`

### 5. Factions
- **View state**: `factions`
- **Features**: Faction management, New Faction form
- **Form fields**: Name*, Description, Goals, Influence slider (min=1 max=10 — DOM-enforced, 0 impossible), Notes; NO children/services UI (earlier doc note about "deep edit" is outdated — form is flat)
- **Validation**: Duplicate names rejected — inline error appears only AFTER clicking Save ("A faction with that name already exists"), not while typing; error banner stays even after fixing the name (minor UX); empty name disables Save; Cancel discards all edits
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
- **Editor + fog (verified 2026-10-13)**: map JSON model = `{displayName, name, gridSize, walls[], placedItems[], paintCells[], items[], players[], fog[], rooms[], terrain{}, pois[], zoom, panX, panY, revealed[]}`. Fog is COMPUTED (`useFogOfWar`): fog = cells neither in persistent `revealed[]` nor currently visible from tokens' line-of-sight; walls[] are the blockers; `revealed` monotonically grows on every client whenever tokens see new cells (auto-saved); "Reset Fog" (GM `button[title="Reset fog of war and view"]`) REFOGS — `revealed = current visible set only`. Grid size is an editable number input in the header (was 40, now 20 on Test Map → 20×20 cells; SVG renders viewBox 800×800). Wall painting persists within ~1.5s of pointerup.
- **CROSS-TAB SYNC DEFECT (2026-10-13)**: manager-Open passes the raw filename WITH `.json` as `mapName` → editor SSE expectedKey never matches broadcast key → GM editor tabs are permanently deaf to live map updates (see `bug-map-editor-sse-key-mismatch-json-suffix.md`)
- **Identifiers**: `button:has-text("Create Map")`, `button:has-text("Generate Dungeon")`, rows `li:has-text("<name>")`, delete confirm `.maps-manager-modal-overlay` ("Yes, Delete Permanently"), editor walls `svg.grid-svg rect.wall-cell`, grid extent `svg.grid-svg rect.grid-bg` (use its client rect /20 for cell px — viewBox does NOT span full svg element), tokens `g.creature-group`, `button[title="Reset fog of war and view"]`

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
- **Status**: Active/Completed/Failed select; row badge updates immediately after save; list preview shows RAW markdown (`**text**`) unstyled
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
| Map editor canvas | `svg.grid-svg` viewBox 800×800 BUT content spans only inner square — for cell px use `rect.grid-bg` client rect ÷ gridCols; wall cells `rect.wall-cell`; tokens `g.creature-group`; grid→client via `getScreenCTM()` + `DOMPoint(gx*CELL+CELL/2, …)` where CELL=viewBox/cols |
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

- **2026-10-13 — Sessions quick-action "To Initiative" not stat-gated:** button is always clickable; a statless NPC throws a raw `Error` to console ("Failed to run session quick action") and dumps the service message into `.sessions-form-error`. Pre-validate (disable chip like the NPCs-view `.npcs-init-btn` gate) and surface a toast instead of a throw. Files: `src/components/sessions/Sessions.jsx` (`handleQuickAction`), reuse `npcCombatService` pre-check.
- **2026-10-13 — Delete-guard inconsistency:** saved ENCOUNTER deletion (trash button in EB Load modal) and party-inventory item deletion fire with NO confirm, while Quests/Factions/NPCs use `window.confirm`, Maps uses a custom modal, Admin rollback uses `.ct-modal-overlay`. Pick one destructive-action guard convention (or at least confirm anything that deletes authored content). Files: EncounterBuilder load-modal, `PartyInventory.jsx`.
- **2026-10-13 — Duplicate-name error banner never clears while typing (Quests, and Factions per prior run):** after fixing the name the inline "…already exists" error stays visible until Save is pressed again. Clear the error on name change. Files: Quests + Factions edit modals.
- **2026-10-13 — Quest list preview prints RAW markdown** (`**bold**`, `[link](…)` literally) — render or strip markdown in row previews (unclamped open view already renders it). File: Quests list row.
- **2026-10-13 — Silent save/load confirmations:** encounter save/load, session quick-"Activate", music stop etc. produce no visible toast ("Saved"/"Loaded"/"Activated") — feedback is only the state change itself (+log entry). Add lightweight toasts; helps first-time GMs trust the app.
- **2026-10-13 — Map editor grid math exposed as raw viewBox:** painting cells requires measuring `rect.grid-bg` client rect (viewBox 800 does not span the svg element box; preserveAspectRatio none stretches). Expose a `data-cell` attribute or stable `aria-label` per cell for testability of paint/fog/token automation.
- **2026-10-13 — `revealed` array can balloon:** Test Map carried 31,200 stale revealed strings (from an old larger grid) until Reset Fog compacted it to 400 — every save/SSE payload ships the whole array. Prune cells outside the current grid bounds on load or on grid-size change. File: `src/components/map/Map.jsx` merge path + server maps route.


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
