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
- **Identifiers**: `button:has-text("New Faction")`, `input:has-text("Search factions")`

### 6. Initiative
- **View state**: `initiative`
- **Features**: Combat initiative tracker
- **Buttons**: Add (per creature, for effects), Clear, + NPC, Prev/Next (round navigation), Generate Loot
- **Identifiers**: `button:has-text("Clear")`, `button:has-text("+ NPC")`, `button:has-text("← Prev")`, `button:has-text("Next →")`, `button:has-text("Generate Loot")`

### 7. Maps
- **View state**: `mapsManager`
- **Features**: Map management, map list with actions
- **Buttons**: Create Map, Generate Dungeon, Open, Activate, Rename, Delete
- **Identifiers**: `button:has-text("Create Map")`, `button:has-text("Generate Dungeon")`

### 8. NPCs
- **View state**: `npcs`
- **Features**: NPC management, New NPC form, Generate NPC
- **Form fields**: Name (required), Race, Class/Role, Attitude (dropdown), Appearance, Personality, Goals, Secrets, Notes, Tags
- **Buttons**: New NPC, Generate NPC, Add to Initiative (per NPC), Edit NPC, Delete NPC
- **Identifiers**: `textbox:has-text("Name *")`, `button:has-text("Generate NPC")`, `button:has-text("Add to Initiative")`

### 9. Notes
- **View state**: `notes`
- **Features**: Campaign notes, markdown support
- **Form fields**: Text field with Preview button
- **Buttons**: New Note, Edit note, Save, Cancel
- **Identifiers**: `button:has-text("New Note")`, `input:has-text("Search notes")`

### 10. Quests
- **View state**: `quests`
- **Features**: Quest tracking
- **Form fields**: Text fields with Preview buttons
- **Buttons**: New Quest, Edit quest, Save, Cancel
- **Identifiers**: `button:has-text("New Quest")`, `input:has-text("Search Quests")`

### 11. Settlements
- **View state**: `settlements`
- **Features**: Settlement management, size filters
- **Buttons**: New Settlement, Generate Settlement, Village, Town, City, Metropolis, Add Service, Add NPC, Add Rumor
- **Identifiers**: `button:has-text("New Settlement")`, `button:has-text("Generate Settlement")`

### 12. Log (Campaign Log)
- **View state**: `campaignLog`
- **Features**: Dice roll and activity log
- **Components**: Log entries with timestamps, creature names, roll details, dice values
- **Identifiers**: `.campaign-tool.log-view`, `.log-entries`, `.log-entry`

### 13. Admin
- **View state**: `campaignRepair`
- **Features**: GM-only admin tools
- **Buttons**: Switch to Light Mode, Rename Campaign, Delete Campaign, Clear Change Data, Clear Campaign Log, Full Reset, Create Snapshot, Download Campaign, Rollback to Snapshot
- **Identifiers**: `button:has-text("Admin")`, `button:has-text("Delete Campaign")`

### 14. Rules
- **Behavior**: Opens external URL `https://paulgilchrist.github.io/dnd-tools/rules/general` in new tab
- **Not in routes config**: This is intentional external linking, not a missing view

### 15. Dice Roller
- **Location**: Bottom-left of sidebar
- **Dice**: d4, d6, d8, d10, d12, d20, d100
- **Behavior**: Opens popup overlay for dice rolls

## Key UI Patterns

### Form Validation
- Required fields marked with `*` (e.g., "Name *")
- Save buttons disabled when required fields are empty
- Delete actions show confirmation dialogs (`confirm` dialog for NPCs, `prompt` dialog for campaign deletion requiring exact name)

### Preview Mode
- Many text fields have "Switch to preview mode" / "Preview" buttons
- Toggles between edit and preview for Appearance, Personality, Goals, Secrets, Notes, etc.

### SSE Real-Time Sync
- **Endpoint**: `GET /subscribe?campaign=test-campaign` (Server-Sent Events)
- **Polling**: `GET /api/campaigns/:name/change-data` (in-memory cache polling, ~10s debounce)
- **Pattern**: ONE shared SSE connection per campaign (per docs)
- **Data flow**: Changes POSTed to server → broadcast via SSE → clients receive and update

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

## Known Quirks & Gotchas

1. **Dice tray overlay blocks clicks** — CORRECTED 2026-10-10: `dice-tray-popup-overlay` now dismisses cleanly on Escape (verified live). Older note about it sticking appears fixed.

2. **Create Map disabled until name typed** — CORRECTED 2026-10-10: "Create Map" is only disabled while the name field is empty; typing a name enables it. Duplicate map names are rejected inline ("A map with that name already exists"). The old "always disabled" note was wrong.

3. **Duplicate accessible names** — Multiple "Add to Initiative" buttons (one per NPC) and ~101 "Add" buttons (one per effect slot per creature) share identical accessible names, causing ambiguity.

4. **Character wizard step numbering** — Edit mode starts at step 2 (Basic Information), missing step 1 (Ruleset).

5. **Two Save buttons** — NPC form has both "Save & Add to Initiative" and "Save" buttons. Use exact text match to distinguish.

6. **SSE connection reuse** — The app creates SSE connections to `/subscribe?campaign=<name>`. Multiple connections observed during exploration.

7. **change-data polling** — The `change-data` endpoint is polled frequently (every ~10s) for real-time sync.

8. **Rules is external** — The Rules sidebar button opens an external GitHub Pages site, not an in-app view.

9. **Admin/Settlements localhost-only** — These sidebar items only appear on localhost.

10. **Combat log spam** — The initiative page shows many repeated "Cleave Test Barbarian" entries, suggesting combat automation may be generating duplicate log entries.

## Session Findings — 2026-08-20

### Features Verified Working
- NPC creation, editing, and deletion with confirmation dialogs
- Character sheet display with all sections
- Short Rest / Long Rest buttons
- Encounter builder with monster database
- Initiative tracker with round navigation
- Settlement, Faction, Quest, and Note management
- Campaign creation flow
- Campaign rename and delete (with name-confirmation prompt)
- Dice roller (functional, though overlay issue)
- SSE real-time sync (connections established, change-data polling active)
- No console errors or failed network requests observed

## Session Findings — 2026-10-10

### Explored (depth)
- **Maps + fog of war (deep):** created "QA Fog Map" (indoor, grid 20), painted walls (vertical x=14 y=4–16, horizontal y=3 x=4–12) via Paint tool; verified wall persistence to `public/campaigns/test-campaign/maps/qa-fog-map.json`; dragged AasimarTest character chip from Items panel onto grid (token at 10,10); confirmed persistent exploration memory (`revealed` = 400 all-visible when wall-less, 303 after Reset Fog — occlusion works); Reset Fog re-reveals to current LoS only. Delete Map uses a custom in-app modal ("Yes, Delete Permanently"), NOT window.confirm.
- **SSE two-tab sync (deep):** GM paint strokes appeared on the player tab (LAN IP) live with no reload (22 wall elements = 13+9). One shared `/subscribe?campaign=test-campaign` per tab confirmed.
- **NPCs (deep):** create, whitespace-only-name blocked (Save stays disabled), duplicate name silently overwrites (no warning) — logged bug; delete via row → in-form Delete → confirm.
- **Quests (deep):** empty-name Save disabled; special-character names (`/ % " & <b>`) stored fine (GUID-keyed, not slug); delete = confirm dialog.
- **Factions (medium):** empty-name Save disabled; rapid double-Save did not duplicate; delete via in-form Delete button.
- **Inventory (medium):** party currency steppers work (+10 Platinum → pp:10, −10 back to 0); −buttons disabled at 0; Add Item with free-text name persists; item delete confirm works; "From Players" transfer picker present.
- **Initiative (medium):** "+ NPC" adds statless "NPC 1" (HP 10); Remove NPC confirm says "NPC 1 has 10 HP. Remove anyway?"; synthetic `.click()` on `.npc-remove-btn` is silently absorbed — real mouse click needed (rig note).
- **Encounter Builder (shallow):** loads, search "goblin" narrows rows, difficulty/type/size selects present; join path not exercised this session (covered by MA suites).
- **Dice tray (shallow):** d20 roll popup renders and dismisses on Escape.

### Bug files written
- `.opencode/plans/bug-featfinder-debug-console-error.md` — leftover hardcoded console.error for "Boon Of Fortitude" fires every session.
- `.opencode/plans/bug-player-map-button-dead-state.md` — player "Map" click with no active map dead-stucks the view; re-click after GM activation is ignored (early-return guard).
- `.opencode/plans/bug-map-context-sync-null-stamp.md` — MapContextSync force-stamps `__map__:null` on tab mount, clobbering server active-map state read by range gates.
- `.opencode/plans/bug-npc-duplicate-name-silent-overwrite.md` — duplicate NPC names silently overwrite; Maps has the guard, NPCs don't.
- `.opencode/plans/bug-map-editor-title-slug-capitalization.md` — editor title re-derives from slug ("Qa Fog Map") ignoring stored displayName ("QA Fog Map").

### Reliable selectors / identifiers (new this session)
- Map editor canvas: `svg.grid-svg` (viewBox 800×800 at CELL_SIZE 40); convert grid→client via `getScreenCTM()` + `DOMPoint(gx*40+20, gy*40+20)`.
- Map tools: `button:has-text("Paint"|"Erase"|"Select"|"Spell"|"Ruler"|"3D"|"Items")`, fog reset `button[title="Reset fog of war and view"]` (GM) / `"Reset view"` (player).
- Items panel: `button.items-panel-close`; draggable char chips live in panel "Characters" section (`character:<name>` drag payload).
- Maps list rows: `li:has-text("<name>")` with `button:has-text("Open"|"Activate"|"Rename"|"Delete")`; delete confirm = `.maps-manager-modal-overlay` button "Yes, Delete Permanently".
- NPC rows: `li[aria-label="Edit NPC: <Name>"]` (the `li` itself is role=button); inner init button `.npcs-init-btn`.
- Initiative NPC remove: `button.npc-remove-btn` (icon-only — use real mouse click + [role="dialog"] handle, NOT evaluate .click()).
- Inventory: currency rows label text "Platinum|Gold|Silver|Copper"; items table `.pi-items-table` with `button[title="Edit item"]` / delete in `.pi-actions-cell`.
- Faction rows: `li[aria-label="Edit faction: <name>"]`.

### Cleanup performed
Deleted QA Fog Map, QA Test NPC, QA Rapid Faction, "QA Quest: 50%…" quest, party item "QA Rope x50"; zeroed party currency (pp back to 0); removed stray "NPC 1" and "QA Test NPC" from initiative. Then Admin → Clear Change Data + Clear Campaign Log (verified: change-data keys `[]`, log count 0). Left untouched: pre-existing Battle Arena / Test Map, original NPCs (Zombie, Goblin), The Iron Consortium, The Lost Artifact quest.

## Coverage

| Feature | Status | Notes |
|---|---|---|
| Maps (create/rename/delete/activate) | deep | create w/ validation, duplicate reject, activate, custom delete modal; rename UI not exercised this session |
| Fog of war | deep | LoS occlusion w/ walls, persistent revealed, Reset Fog, player-view rendering |
| SSE sync | deep | GM wall paints → player live; player tab null-stamp bug found here |
| NPCs | deep | create/edit/delete, whitespace + duplicate name edge cases |
| Quests | deep | validation, special chars, delete confirm |
| Factions | shallow | validation + rapid double-save only |
| Settlements | not explored | |
| Notes | not explored | (seen in prior sessions) |
| Initiative | medium | +NPC/remove, round display; attacks/next-prev not exercised |
| Encounter Builder | shallow | load + search only; join path covered by MA suites |
| Party Inventory | medium | currency steppers, add/delete item; "From Players" transfer not exercised |
| Dice tray | shallow | d20 roll + Escape dismiss |
| Music player | not explored | iframe + mood buttons render; playback untouched |
| Character wizard | not explored | |
| Admin | medium | clear change-data + clear log verified; snapshots/rollback not touched |

## Blocked / not verified

- **Full player→GM write path (player mutation):** by design players are read-only off localhost; no player-side mutation to attempt (not a defect).
- **Concurrent NPC edit from two GM sessions:** single GM browser available this session; not tested.
- **Rename map UI:** modal appears on Rename click but new-name validation not exercised this run.
- **Music playback / settlement / wizard / snapshot-rollback:** not attempted this session (time-boxed to maps/fog/SSE + CRUD edge cases).

## Improvement backlog

### 2026-10-10
- DONE: [2026-10-10] — Player tab auto-opens the active map on `map-activate` SSE via the shared app-wide Subscriber (`handleMapActivateEvent` in App.jsx, key+state gated); verified live LAN tab, no new EventSource, 6 new tests.
- DONE: [2026-10-10] — displayName threading already shipped in bug-fix 65b9849a9 (`MapToolbar.jsx` renders `displayName || formatMapName(slug)`); verified live "QA Acronym Map" verbatim + rename stays in sync; pinned by existing `MapToolbar.display-name.test.jsx`, no code changes.
- Give players a friendlier map-unavailable state than a bare alert + blank view (e.g. an inline "Waiting for the GM to open a map…" placeholder with auto-retry).
- Duplicate-name validation parity: NPCs/Quests/Factions lack the inline duplicate guard the Maps manager has — add the same case-insensitive check and error text.
- Map editor save is chatty: every wall-paint stroke PUTs the whole map JSON (~20 writes/stroke) — batch on pointerup or debounce ~1s.
- Music player loads the YouTube iframe eagerly on campaign load even when idle — lazy-load on first Play.
- "+ NPC" adds a statless "NPC 1" at HP 10 with no UI hint — surface a tooltip/label explaining defaults, or let the GM set starting HP in a small dialog.
