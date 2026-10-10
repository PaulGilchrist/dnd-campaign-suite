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
- **Buttons**: Save encounter, Load encounter, Generate encounter
- **Components**: Party list (auto-populated from characters), Difficulty selector (Easy/Medium/Hard/Deadly), Monster search and filter (Type, Size, CR Min/Max), Monster table with checkboxes
- **Identifiers**: `heading:has-text("Encounter Builder")`, `combobox:has-text("Difficulty")`

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
- **Behavior**: "Create Map" disabled only while name is empty; duplicate map names rejected inline ("A map with that name already exists"); delete uses a custom in-app modal ("Yes, Delete Permanently"), not `window.confirm`; editor autosaves debounced ~1s with flush on pointerup/unmount/map-switch
- **Rename (verified 2026-10-10)**: inline row textbox (no modal) prefilled with name; Enter commits; empty rename silently reverts (safe); duplicate rename shows inline "A map with that name already exists" and keeps original; valid rename renames the file (test-map.json → qa-renamed-map.json) within ~12s debounce
- **Identifiers**: `button:has-text("Create Map")`, `button:has-text("Generate Dungeon")`, rows `li:has-text("<name>")`, delete confirm `.maps-manager-modal-overlay`

### 8. NPCs
- **View state**: `npcs`
- **Features**: NPC management, New NPC form, Generate NPC
- **Form fields**: Name (required), Race, Class/Role, Attitude (dropdown), Appearance, Personality, Goals, Secrets, Notes, Tags
- **Buttons**: New NPC, Generate NPC, Add to Initiative (per NPC), Edit NPC, Delete NPC
- **Validation**: Whitespace-only names keep Save disabled; duplicate names rejected (case-insensitive, self-edit exempt)
- **Identifiers**: `textbox:has-text("Name *")`, `button:has-text("Generate NPC")`, `button:has-text("Add to Initiative")`, rows `li[aria-label="Edit NPC: <Name>"]` (the `li` itself is role=button), inner init button `.npcs-init-btn`

### 9. Notes
- **View state**: `notes`
- **Features**: Campaign notes, markdown support; title optional (content-only saves render "No location" in list); list preview clamped to 2 lines with ellipsis, open view unclamped; GUID-keyed persistence
- **Buttons**: New Note, Edit note, Save, Cancel
- **Identifiers**: `button:has-text("New Note")`, title `input[placeholder*="Skull Creek"]`, body `[placeholder="Write your note here…"]`, rows `li.ct-list-item`

### 10. Quests
- **View state**: `quests`
- **Features**: Quest tracking; empty-name Save disabled; duplicate names rejected (case-insensitive); special characters in names stored fine (GUID-keyed, not slug); delete = confirm dialog
- **Buttons**: New Quest, Edit quest, Save, Cancel
- **Identifiers**: `button:has-text("New Quest")`, `input:has-text("Search Quests")`

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
- **Behavior**: Selecting a mood AUTO-STARTS playback (Play flips to Pause with no Play click); embedded YouTube iframe player (`YouTube Video Player` generic, real YouTube videos e.g. "Village | D&D/TTRPG Ambience"); Pause/Stop + Volume slider; "Edit tracks for this mood" per-mood track editor
- **Note**: depends on external YouTube — offline tables get silence; autoplay may vary by browser policy

### 16. Sessions (GM planner)
- **View state**: `sessions`; sidebar button "Sessions"
- **Features**: session planning — list of plans with status badge (`planned`/`played`), search, checkbox progress, linked-resource chips
- **Modal** (`.sessions-modal`, heading "New Session" / "Plan Session — <name>"): Name* (whitespace blocked, duplicate-name inline guard), Date, **Suggest XP Budget** + **Generate Rumors** (copy AI prompts to clipboard — button flips to "Prompt copied"), Linked Resources pickers (maps/encounters/npcs/quests/settlements/notes via `select[aria-label^="Link "]`, linked chip `.sessions-link-row` with quick actions: map→"Activate", npc→"To Initiative"), Contingencies (if/then + branch select), auto+custom Session Checklist (auto items scale with linked resources), Notes
- **Row**: `button[aria-label="Edit session: <name>"]`; "Mark as Played" (recap prompt → `session-played` log entry); progressbar `aria-label="Checklist N of M complete"`; delete via row → modal Delete → confirm

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
- **GM management views do NOT live-sync (verified 2026-10-10)**: NPCs list in a second tab neither gained a newly created NPC nor lost a deleted one (server truth differed immediately); list refreshes only on re-navigation/mount. Open edit forms also stay stale by design (no squash mid-edit).

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
| Map editor canvas | `svg.grid-svg` (viewBox 800×800 at CELL_SIZE 40); grid→client via `getScreenCTM()` + `DOMPoint(gx*40+20, gy*40+20)` |
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

## Known Quirks & Gotchas

1. **Duplicate accessible names** — Multiple "Add to Initiative" buttons (one per NPC) and many "Add" buttons (one per effect slot per creature) share identical accessible names, causing ambiguity.

2. **Character wizard step numbering** — Edit mode starts at step 2 (Basic Information), missing step 1 (Ruleset).

3. **Two Save buttons** — NPC form has both "Save & Add to Initiative" and "Save" buttons. Use exact text match to distinguish.

4. **SSE connection reuse** — ONE shared `/subscribe?campaign=<name>` connection per tab via `subscribeToSSE()`; never create additional EventSources (exhausts the browser's ~6-connection-per-host pool).

5. **change-data polling** — The `change-data` endpoint is polled frequently (every ~10s) for real-time sync.

6. **Rules is external** — The Rules sidebar button opens an external GitHub Pages site, not an in-app view.

7. **Admin/Settlements localhost-only** — These sidebar items only appear on localhost.

8. **Map editor monster-card overlay persists** — `.mc-overlay` stays open after an attack popup; close it via × before other interactions.

9. **Synthetic clicks absorbed** — Some icon buttons (e.g. `.npc-remove-btn`) silently ignore `evaluate`-driven `.click()`; use real mouse clicks in automation.

## Not Yet Verified / Untested Areas

- **Admin Download / Upload Campaign:** buttons present; upload replaces the whole folder, untested.
- **Encounter save/load/generate round-trips:** not covered this run.
- **Map editor fog-of-war + token interplay across tabs:** not covered this run.
- **Sessions deep flows (checklist persistence, mark-as-played):** only structure known.

## Improvement Backlog

- (2026-08) Settlement "Add Service/Add NPC/Add Rumor" row-clicks silently auto-fill every empty textarea (Government/Description/Atmosphere/Threats/Population) from the local generator. A GM adding one service is surprised by unrelated prose appearing. Suggest scoping generation to the clicked row, or an explicit "Auto-fill" button. Likely `src/components/settlements/Settlements.jsx`.
- (2026-10-10) Wizard step indicator numbering: indicator omits step 5 (Background) and content headings renumber independently from Feats onward ("Step 4: Feats" under indicator "8"). One shared step-index should drive both. Likely wizard stepper + step-content components in `src/components/wizard/`.
- (2026-10-10) Background step for 5e characters shows only an "unavailable" notice, yet the skills step promises "2 from your background" — background skills are unobtainable in the 5e create flow. Either offer the skills or fix the copy.
- (2026-10-10) Point-buy overspend silently resets the input to 8 with no feedback — show a toast/inline "not enough points" message. Ability-score wizard step.
- (2026-10-10) Faction "already exists" error appears only after Save and persists after the name is fixed — validate while typing and clear the banner on edit.
- (2026-10-10) Lost-update on concurrent GM edits: two tabs editing the same NPC, stale save silently overwrites newer persisted value. Consider a `lastModified` stamp + conflict warning on save. Server route + client edit forms.
- (2026-10-10) NPCs management list never live-syncs (create/delete in another GM tab invisible until re-navigation). Wire it to the shared SSE subscription like the map flows.
- (2026-10-10) Music panel auto-plays YouTube ambience on mere mood selection (no Play press) — surprising and YouTube-dependent; prefer requiring explicit Play, and show a friendly error if the iframe/embed fails.
- (2026-10-10) `SelectableList` React unique-key console warning fires on the wizard Spells step — assign stable keys in `SelectableList.jsx`.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Campaign selection | deep | select/deselect, reload re-select, multi-tab |
| Character sheet | deep | prior sessions + rest/ally/HP seams |
| Character wizard (create) | deep | full 17-step walk 2026-10-10: ruleset-skip, dup-name overwrite (bug), skill over-cap (bug), point-buy clamp, numbering; edit-mode not re-covered |
| NPCs | deep | create/edit/save/delete/dupe-guard, two-tab concurrent lost-update verified 2026-10-10 |
| Quests | shallow | validation known from prior runs; not re-exercised this run |
| Factions | deep | flat CRUD 2026-10-10: create+dupe guard, influence slider bounds (min 1), cancel-discard, delete confirm+persist; list rows |
| Encounters (EB) | shallow this run | monster join/attack deeply covered by MA suite; encounter save/load not touched |
| Maps manager | deep | create/list/activate/rename validation matrix (empty/dup/valid) 2026-10-10; editor paint covered by prior runs |
| Map editor fog of war | shallow | tool affordances known; cross-tab fog sync not re-tested this run |
| Initiative tracking | deep | prior runs (+NPC statless, walk, loot) |
| Inventory | shallow | selectors documented; not re-exercised this run |
| Notes | shallow | prior coverage |
| Sessions | shallow | structure documented |
| Settlements | shallow | prior coverage |
| SSE sync | deep | verified GM-management views are mount-fetch-only (no live create/delete sync) 2026-10-10; map/combat SSE from prior runs |
| Dice roller | deep | client-local only, no log/SSE (bug filed) 2026-10-10 |
| Music panel | medium | first contact 2026-10-10: mood select auto-plays YouTube, pause/stop; track editor modal unexplored |
| Admin | deep | clears verified 2026-10-10; snapshot/rollback from prior runs; upload/download untested |

## Blocked / Not Verified

- (2026-10-10) Music "Edit tracks for this mood" modal — not opened (time). YouTube playback verified; offline/embed-failure path untested.
- (2026-10-10) Character wizard EDIT mode re-verification — create mode was destructive-tested this run (overwrote then restored AasimarTest); edit mode numbering unchanged from doc.
- (2026-10-10) Admin Campaign Upload — intentionally not exercised (replaces whole folder).
