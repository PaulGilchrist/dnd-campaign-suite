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
- **Note**: Step 1 "Ruleset" is missing in edit mode

### 4. Encounters (Encounter Builder)
- **View state**: `encounter`
- **Features**: Full encounter builder with monster database
- **Buttons**: Save encounter, Load encounter, Generate encounter
- **Components**: Party list (auto-populated from characters), Difficulty selector (Easy/Medium/Hard/Deadly), Monster search and filter (Type, Size, CR Min/Max), Monster table with checkboxes
- **Identifiers**: `heading:has-text("Encounter Builder")`, `combobox:has-text("Difficulty")`

### 5. Factions
- **View state**: `factions`
- **Features**: Faction management, New Faction form
- **Form fields**: Text fields with Preview buttons, Save/Cancel
- **Validation**: Duplicate names rejected (case-insensitive, client inline error + server 400); self-edit exempt
- **Identifiers**: `button:has-text("New Faction")`, rows `li[aria-label="Edit faction: <name>"]`

### 6. Initiative
- **View state**: `initiative`
- **Features**: Combat initiative tracker
- **Buttons**: Add (per creature, for effects), Clear, + NPC, Prev/Next (round navigation), Generate Loot
- **Behavior**: "+ NPC" adds statless "NPC N" (default 10 HP) with title tooltip and inline `npc-statless-hint` badge; removal asks for confirmation
- **Identifiers**: `button:has-text("Clear")`, `button:has-text("+ NPC")`, `button:has-text("← Prev")`, `button:has-text("Next →")`, `button:has-text("Generate Loot")`, NPC remove `button.npc-remove-btn`

### 7. Maps
- **View state**: `mapsManager`
- **Features**: Map management, map list with actions
- **Buttons**: Create Map, Generate Dungeon, Open, Activate, Rename, Delete
- **Behavior**: "Create Map" disabled only while name is empty; duplicate map names rejected inline ("A map with that name already exists"); delete uses a custom in-app modal ("Yes, Delete Permanently"), not `window.confirm`; editor autosaves debounced ~1s with flush on pointerup/unmount/map-switch
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
- **Behavior**: Opens popup overlay for dice rolls; dismisses on Escape

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

- **Character wizard (17-step create):** not explored — no automated exploration coverage yet.
- **Admin Download / Upload Campaign:** buttons present; upload replaces the whole folder, untested.
- **Map rename modal:** new-name validation untested.
- **Concurrent write conflicts (two GM tabs editing the same entity):** untested.
- **Faction deep edit (children/services):** only validation covered.

## Improvement Backlog

- Settlement "Add Service/Add NPC/Add Rumor" row-clicks silently auto-fill every empty textarea (Government/Description/Atmosphere/Threats/Population) from the local generator. A GM adding one service is surprised by unrelated prose appearing. Suggest scoping generation to the clicked row, or an explicit "Auto-fill" button. Likely `src/components/settlements/Settlements.jsx`.
