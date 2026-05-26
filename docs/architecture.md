# Architecture — dnd-char-sheet

> **Generated:** 2026-05-25T00:00:00Z
> **Repository:** https://github.com/PaulGilchrist/dnd-char-sheet.git
> **Stack:** React 19.2 · Vite 8 · Express 5 · Vitest 4 · FontAwesome 7

---

## 1. High-Level Overview

`dnd-char-sheet` is a single-page web application for creating, managing, and playing Dungeons & Dragons character sheets. It supports both the classic 5th Edition (5e) and the 2024 Essentials rulesets, with full dual-ruleset logic throughout the codebase.

The application consists of three major subsystems:

1. **Character Sheet System** — A React SPA (Vite 8) providing character creation via a 12-step wizard, full character sheet display, initiative tracking, encounter building, hex map rendering, campaign notes, quest tracking, NPC management, faction management, and sidebar-based navigation.
2. **Express 5 Server** — Provides REST API endpoints for character/campaign CRUD, static file serving, and real-time multi-user sync via Server-Sent Events (SSE).
3. **Campaign Tools** — GM-focused subsystems for map management (indoor grid maps and outdoor hex maps), encounter generation, NPC management, faction tracking, quest logging, notes, and a campaign activity log.

The app is private (not published to npm), licensed under MIT, and authored by Paul Gilchrist. It runs on port 80 by default and is designed for local network multiplayer use.

---

## 2. Module-by-Module Breakdown

### 2.1 Entry Points

| File | Role |
|------|------|
| `index.html` | Vite HTML entry point; mounts React into `#root` |
| `src/main.jsx` | React root mount with `StrictMode`; renders `<App />`, imports FontAwesome CSS |
| `src/App.jsx` | Top-level state-based router: renders views based on `activeView`, `mapsView`, theme state, and wizard toggles |
| `server.js` | Express server: serves `dist/` (production SPA), `public/` (static data), REST API (`/api/*`), SSE (`/subscribe`), and health check (`/health`) |

### 2.2 Frontend Layers

#### Hooks (`src/hooks/`) — 46 files

Centralized state management via custom hooks — no class components exist. Each hook has a paired `.test.js`.

| Hook | Responsibility |
|------|----------------|
| `useAppData.js` | Loads all static game data (classes, races, spells, equipment) via `dataLoader` with caching |
| `useCampaignManagement.js` | Campaign selection, rename, delete, session storage |
| `useCharacterManagement.js` | Character list, active character, save/delete via API |
| `useCharacterWizard.js` | Wizard show/hide, complete/cancel handlers |
| `useTrackedResource.js` | Generic tracked resource (HP, spell slots, rage) with localStorage + server sync |
| `useWizardArrayToggle.js` | Generic array toggle for wizard form fields |
| `useEquipmentSearch.js` | Equipment search with filtering and custom item addition |
| `useWizardConfig.js` | Central wizard config: validation, slot fetching, pre-selection, warnings |
| `useWizardAbilities.js` | Wizard ability score management |
| `useWizardData.js` | Wizard form data management |
| `useWizardFeats.js` | Wizard feat selection |
| `useWizardForm.js` | Wizard form state management |
| `useWizardLanguages.js` | Wizard language selection |
| `useWizardNavigation.js` | Wizard step navigation |
| `useWizardResistances.js` | Wizard resistance/immunity selection |
| `useWizardSkills.js` | Wizard skill proficiency selection |
| `useWizardSpells.js` | Wizard spell selection |
| `useDiceRoll.js` | Integration of dice roller service with UI actions |
| `useLoggedDiceRoll.js` | Dice rolls that also write to the campaign log |
| `useActionPopup.js` | Action popup display for character sheet interactions |
| `usePopup.js` | Generic popup state management |
| `useEncounterManagement.js` | Encounter builder state management |
| `useFactionsManagement.js` | Faction management state |
| `useMonstersData.js` | Monster data loading for encounters |
| `useNotesManagement.js` | Campaign notes management |
| `useNPCsManagement.js` | NPC management state |
| `useQuestsManagement.js` | Quest tracking and management state |
| `useTravelManagement.js` | Hex map travel management |
| `useLog.js` | Campaign log reading |

#### Components (`src/components/`) — ~100 files across 16 directories

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `campaign-selection/` | `CampaignSelection` | Full-screen campaign gate; list/create/rename/delete campaigns |
| `character-creation/` | `CharacterCreationWizard` + 12 step components | Step-by-step character creation/editing wizard with progress bar, sidebar, and footer |
| `char-sheet/` | `CharSheet` + 13 sub-components (incl. `char-feats/`, `char-spells/`, `char-summary/`) | Full character sheet display (abilities, actions, inventory, spells, feats, summary, combat, short/long rest) |
| `initiative/` | `Initiative` | Initiative tracker, round counter, NPC management |
| `encounter/` | `EncounterBuilder` + 5 sub-components | Encounter builder for balancing encounters against party levels |
| `factions/` | `Factions` | Faction management for campaigns |
| `hex-map/` | `HexMap`, `HexGridLayer`, `TerrainLayer`, `POILayer`, `RiverLayer`, `RoadLayer`, `PartyMarkerLayer`, `TravelPathLayer`, `MarchingOrderPanel`, `TravelPanel`, `WeatherOverlay`, `EventDialog`, 9 SVG icons | Hex-based outdoor map with layered SVG components, POI markers, terrain, rivers, roads, party positioning, travel, and weather |
| `map/` | `Map` + 20+ SVG components + `ItemsPanel`, `GridAndWalls`, `PlacedItems`, `Players`, `FogOverlay`, `MapToolbar`, 5 hooks | Indoor map viewer with grid/wall rendering, placed items, players, furniture/monster SVGs, toolbar, fog overlay, and context menus |
| `maps-manager/` | `MapsManager`, `GenerateDungeonModal`, `GenerateTerrainModal` | GM map management with procedural dungeon and terrain generation |
| `notes/` | `Notes` | Campaign notes viewer/editor with privacy support |
| `npcs/` | `NPCs` | NPC management for campaigns |
| `quests/` | `Quests` | Quest tracking and management for campaigns |
| `log/` | `Log` | Campaign dice roll and activity log viewer |
| `sidebar/` | `Sidebar` | Sidebar navigation with view switching, theme toggle, character list, campaign management |
| `common/` | `Popup`, `Subscriber`, `HiddenInput`, `WarningList`, `AvatarImage`, `MarkdownPreview`, `PreviewToggle` | Shared UI primitives including rich text preview, SSE subscription, and image avatars |

#### Character Creation Wizard (12 steps)

Steps are defined declaratively in `src/config/steps-config.js`. Steps 1–3 are required; the rest produce warnings (non-blocking).

| Step | Title | Component |
|------|-------|-----------|
| 1 | Ruleset | `WizardStepRules` |
| 2 | Basic Information | `WizardStepBasic` |
| 3 | Race & Class | `WizardStepRaceClass` |
| 4 | Feats | `WizardStepFeats` |
| 5 | Ability Scores | `WizardStepAbilities` |
| 6 | Skill Proficiencies | `WizardStepSkills` |
| 7 | Languages & Fighting Styles | `WizardStepLanguages` |
| 8 | Resistances & Immunities | `WizardStepResistances` |
| 9 | Spells | `WizardStepSpells` |
| 10 | Magic Items | `WizardStepMagicItems` |
| 11 | Inventory | `WizardStepInventory` |
| 12 | Special | `WizardStepSpecial` |

Per-step hooks (`useWizardSkills`, `useWizardAbilities`, etc.) compose `useWizardConfig` with step-specific validation. Wizard UI shell: `CharacterCreationWizard.jsx` with `WizardHeader`, `WizardSidebar`, `WizardFooter`, `WizardProgressBar`. Shared UI: `CascadingSelect`, `EquipmentSearchModal`, `SelectableList`.

### 2.3 Config (`src/config/`)

| File | Purpose |
|------|---------|
| `constants.js` | Required fields, default form data for character creation |
| `steps-config.js` | Declarative wizard step definitions (step number, title, component, props function) |
| `utils.js` | Wizard utility functions (point buy costs, ability validation, step validation) |
| `outdoorConfig.js` | Hex map rendering constants (hex size, grid size, terrain types with colors/border styles, POI types, tool modes, zoom limits) |

### 2.4 Routing (`src/routes/`)

| File | Purpose |
|------|---------|
| `config.js` | **Single source of truth** for all views — defines `VIEWS`, `SIDEBAR_BUTTONS`, and `SIDEBAR_VIEWS` with full metadata (state variable type, component name, overlay flag) |

Views defined in `config.js`:
- **Sidebar views** (mutually exclusive via `activeView`): `charSheet`, `encounter`, `factions`, `initiative`, `mapsManager`, `map`, `notes`, `npcs`, `quests`, `campaignLog` (10 total)
- **Overlay views** (independent boolean toggles): `campaignSelection`, `characterWizard`, `editCharacterWizard`
- The `mapsView` state is an object `{ type: 'none' | 'manager' | 'map', mapName?: string }` controlling the maps sub-view

### 2.5 Services (`src/services/`) — ~82 files

Pure logic services with no UI dependencies. Every 5e file has a `*2024.js` pair where rules differ. Each service has a paired `.test.js`.

| Category | Files | Purpose |
|----------|-------|---------|
| **Core** | `dataLoader.js`, `storage.js`, `utils.js`, `rules.js`, `rulesFactory.js`, `campaignService.js`, `sanitize.js` | Data loading with per-ruleset caching, localStorage wrapper with server sync, unified rules dispatch, campaign API client, DOMPurify wrapper |
| **Calculations (5e ↔ 2024 pairs)** | `abilityCalc.js` / `abilityCalc2024.js`, `attackCalc.js` / `attackCalc2024.js`, `spellCalc.js` / `spellCalc2024.js`, `proficiencyUtils.js` / `proficiencyUtils2024.js` | Ability modifiers, weapon/spell attacks, spell lists and slots, proficiency calculation |
| **Spell Management** | `spellLimits.js`, `spellValidation.js`, `shared/spell-utils.js` | Spell slot limits per class/level, spell selection validation, shared spell utilities |
| **Class & Race Rules** | `classFeatures.js`, `classRules.js`, `classRules2024.js`, `race-rules/5e.js`, `race-rules/2024.js`, `race-rules/index.js` | Class-specific features, race traits (immunities, senses, bonuses) |
| **Feature Categorization** | `featureCategories5e.js`, `featureCategories2024.js`, `featureCategorizationUtils.js` | Categorizes class/race features into actions, bonusActions, reactions, characterAdvancement |
| **Validation** | `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `languagesFightingstylesValidation.js` | Validates selections against ruleset constraints (prerequisites, level requirements, limits) |
| **Encounter & Dungeon** | `encountersService.js`, `dungeonGenerator.js`, `monsterUtils.js`, `encounterGenerator.js`, `outdoorEncounterGenerator.js`, `randomEventService.js` | Encounter building, dungeon generation, monster utilities, random encounter suggestions, outdoor encounter seeding |
| **Hex Map** | `hexMapUtils.js`, `hexTerrainGenerator.js` | Hex grid math (coord systems, adjacency), terrain rasterization via marching squares algorithm |
| **Dice Roller** | `diceRoller.js` | D20, single/multi-die rolls, advantage/disadvantage, formula parsing (e.g. "2d6+3") |
| **Campaign Tools** | `factionsService.js`, `mapsService.js`, `notesService.js`, `npcsService.js`, `questsService.js`, `logService.js`, `travelService.js`, `weatherService.js` | Faction management, map management, campaign notes, NPC management, quest tracking, campaign log, travel, weather |

### 2.6 Static Data (`public/data/`)

JSON catalogs loaded at runtime by `dataLoader.js` with per-ruleset caching:

| Data | 5e Path | 2024 Path | Size (5e / 2024) |
|------|---------|-----------|-------------------|
| Classes | `data/classes.json` | `data/2024/classes.json` | 701KB / 432KB |
| Races | `data/races.json` | `data/2024/races.json` | 52KB / 36KB |
| Spells | `data/spells.json` | `data/2024/spells.json` | 507KB / 523KB |
| Feats | `data/feats.json` | `data/2024/feats.json` | 26KB / 162KB |
| Magic Items | `data/magic-items.json` | `data/2024/magic-items.json` | 250KB / 515KB |
| Monsters | `data/monsters.json` | `data/2024/monsters.json` | 1.8MB / 1.5MB |
| Backgrounds | — | `data/2024/backgrounds.json` | — / 13KB |
| Ability Scores | `data/ability-scores.json` | (shared) | 18KB |
| Equipment | `data/equipment.json` | (shared) | 125KB |
| Skills | `data/passive-skills.json` | (shared) | 56B |
| Actions | `data/actions.json` | (shared) | 195B |
| Alignments | `data/alignments.json` | (shared) | 185B |
| Languages | `data/languages.json` | (shared) | 249B |
| Fighting Styles | `data/fighting-styles.json` | (shared) | 289B |
| Rules Validation | `data/rules-validation.json` | `data/2024/rules-validation.json` | 2KB / 1KB |
| Resistances | `data/resistances-immunities.json` | (shared) | 194B |

### 2.7 Campaign Data (`public/campaigns/`)

**Directory structure per campaign:**
```
public/campaigns/<campaign>/
├── <CharacterName>.json          # Character files (validated against schema)
├── data/
│   ├── character-change-data.json # Runtime state (HP, slots, etc.)
│   ├── encounters.json
│   ├── factions.json
│   ├── notes.json
│   ├── npcs.json
│   ├── quests.json
│   └── campaign-log.json          # (optional)
├── extras/                        # Additional character files
├── images/                        # Character portrait images
└── maps/                          # Map JSON files (indoor + outdoor)
```

**Schemas** (all JSON Schema draft-07, located in `public/campaigns/`):
- `character.schema.json` — Character data (required: name, level, alignment, race, class, abilities, inventory, skillProficiencies, rules)
- `encounters.schema.json` — Encounter data with difficulty, player levels, monsters
- `factions.schema.json` — Faction data with influence scores
- `maps-indoor.schema.json` — Indoor grid map with walls, placed items, fog-of-war
- `maps-outdoor.schema.json` — Outdoor hex map with terrain, POIs, weather, party position
- `notes.schema.json` — Campaign notes with privacy and timestamps
- `npcs.schema.json` — NPC data with race, class, attitude
- `quests.schema.json` — Quest data with status tracking

**Existing campaigns:** `2024 Testing`, `5e Testing`, `General Testing`

### 2.8 Runtime State

- **In-memory (`characterChangeData` Map):** Server holds per-campaign transient state (HP, spell slots, positioning, etc.) in memory. Persisted to `character-change-data.json` on a 60-second debounce.
- **In-memory (`activeMaps` Map):** Tracks which map is active per campaign.
- **In-memory (`subscribers` Array):** Active SSE client connections for real-time broadcast.
- **In-memory (`logCache` Map):** Campaign log entries cached server-side, debounced write to `campaign-log.json`.
- **localStorage:** Client-side persistence for tracked resources and theme preference.

---

## 3. Data Flow Summary

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Static JSON  │      │  Character   │      │  Runtime     │
│  (data/*.json)│      │  Files       │      │  State       │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                      │                      │
       ▼                      ▼                      ▼
   ┌──────────┐        ┌──────────┐          ┌──────────┐
   │dataLoader│        │ Express  │          │ localStorage│
   │(cached)  │        │ REST API │          │ (client)   │
   └────┬─────┘        └────┬─────┘          └──────────┘
       │                      │
       ▼                      ▼
    ┌──────────┐        ┌──────────┐         ┌──────────────┐
    │ rules.js │        │ SSE      │         │ Hex Map      │
    │ + *-calc │        │/subscribe│         │ Services     │
    └────┬─────┘        └────┬─────┘         │(hexMapUtils, │
       │                      │              │ hexTerrain)  │
       ▼                      ▼              └──────┬───────┘
┌──────────────────────────────────────┐            │
│ React Components (UI)               │            ▼
│                                    │   ┌──────────────────┐
│ CharSheet · Initiative · Encounter │   │ HexMap Layered   │
│ Maps (indoor + outdoor hex)       │   │ SVG Rendering    │
│ Quests · Notes · Factions · NPCs  │   └──────────────────┘
│ CharacterCreationWizard           │
└──────────────────────────────────────┘
```

1. **Initialization:** `dataLoader.js` loads all static JSON catalogs (cached per ruleset). `useAppData.js` exposes this to components.
2. **Character CRUD:** `useCharacterManagement.js` calls Express REST API (`/api/campaigns/*`) for list/create/update/delete. Characters are persisted as JSON files on disk.
3. **Real-time sync:** `Subscriber` component connects to SSE (`/subscribe?campaign=<name>`). On connect, the server replays the full change-data snapshot for the campaign. Subsequent changes are broadcast via `publish()`.
4. **Ephemeral state:** HP, spell slots, and tracked resources are stored in per-campaign `character-change-data.json` (in-memory, debounced 60s save). Client also writes to localStorage and fire-and-forgets to the server API.
5. **Rules evaluation:** `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`. Calculation services compute modifiers, attacks, spells, and class features from the character data.
6. **Campaign tools:** Encounter, quest, faction, notes, NPC, and map data are stored as JSON files under campaign directories. Each has CRUD endpoints.
7. **Hex maps:** Outdoor hex maps use seeded procedural terrain generation (`hexTerrainGenerator.js`) with biome-specific feature placement (`outdoorEncounterGenerator.js`). Indoor maps support grid/wall/item/player placement with fog-of-war.

---

## 4. Dependency Graph (Textual)

```
main.jsx
   └── App.jsx
        ├── CampaignSelection
        ├── CharSheet
        │     ├── CharSummary → CharHitPoints, CharGold, CharClassFeatures, CharConditions, DeathSavingThrows
        │     ├── CharAbilities
        │     ├── CharActions
        │     ├── CharInventory
        │     ├── CharReactions
        │     ├── CharSpecialActions
        │     ├── CharCharacterAdvancement
        │     ├── CharFeats (char-feats/)
        │     └── CharSpells → CharSpellSlots, CharSpellSlotLevel (char-spells/)
        │           → LongRestButton, ShortRestButton, ShortRestModal
        ├── Initiative
        ├── EncounterBuilder → EncounterFilterPanel, EncounterGeneratorModal, EncounterModal, EncounterMonsterTable, EncounterSelectedMonsters, EncounterSummaryPanel
        ├── HexMap → HexGridLayer, TerrainLayer, POILayer, RiverLayer, RoadLayer, PartyMarkerLayer, TravelPathLayer, WeatherOverlay, MarchingOrderPanel, TravelPanel, EventDialog, POIContextMenu, POIPanel, 9 SVG icons
        │     └── useHexMapSSESync
        ├── Map → GridAndWalls, PlacedItems, Players, ItemsPanel, FogOverlay, MapToolbar, 20+ SVG components, BarrelContextMenu
        │     ├── useItemDragging, useNpcImageCache, usePlacedItems, usePlayerDragging, useSSESync
        ├── MapsManager → GenerateDungeonModal, GenerateTerrainModal
        ├── Factions
        ├── Notes
        ├── Quests
        ├── NPCs
        ├── Log
        ├── CharacterCreationWizard → 12 step components + WizardHeader, WizardSidebar, WizardFooter, WizardProgressBar
        └── Sidebar (theme toggle, character list, view nav, campaign management)

Hooks → Services:
   useAppData → dataLoader.js → public/data/*.json
   useCampaignManagement → campaignService.js → Express API
   useCharacterManagement → Express API
   useCharacterWizard → Express API
   useTrackedResource → localStorage + storage.js → Express API
   useWizardConfig → rules.js + validation services
   useEncounterManagement → encountersService.js → Express API
   useFactionsManagement → factionsService.js → Express API
   useMonstersData → public/data/monsters.json
   useNotesManagement → notesService.js → Express API
   useNPCsManagement → npcsService.js → Express API
   useQuestsManagement → questsService.js → Express API
   useDiceRoll → diceRoller.js (pure functions)
   useLoggedDiceRoll → diceRoller.js + logService.js
   useTravelManagement → travelService.js → Express API

Services (pure logic, no UI):
   rules.js → abilityCalc.js/abilityCalc2024.js
              attackCalc.js/attackCalc2024.js
              spellCalc.js/spellCalc2024.js
              proficiencyUtils.js/proficiencyUtils2024.js
              classRules.js/classRules2024.js
              race-rules/5e.js, race-rules/2024.js
   rulesFactory.js → rules.js (delegation wrappers)
   classFeatures.js → classRules.js/classRules2024.js
   featureCategorizationUtils.js → featureCategories5e.js/featureCategories2024.js
   spellLimits.js, spellValidation.js, shared/spell-utils.js
   featValidation.js, skillValidation.js
   resistancesValidation.js, languagesFightingstylesValidation.js
   sanitize.js (DOMPurify wrapper)
   encountersService.js, dungeonGenerator.js, monsterUtils.js
   encounterGenerator.js, outdoorEncounterGenerator.js, randomEventService.js
   hexMapUtils.js, hexTerrainGenerator.js
   diceRoller.js
   factionsService.js, mapsService.js, notesService.js, npcsService.js, questsService.js, logService.js, travelService.js, weatherService.js

Server:
   server.js
    ├── server/utils/changeData.js (in-memory state, SSE pub/sub, debounced persistence)
    ├── server/utils/encounterUtils.js (encounter file I/O)
    ├── server/utils/imageUtils.js (base64 image processing)
    └── server/routes/
        ├── sse.js (SSE /subscribe, /health, SPA fallback)
        ├── campaigns-basic.js (list campaigns, list character files)
        ├── campaigns-character.js (character CRUD + image handling)
        ├── campaigns-changedata.js (generic key/value change data)
        ├── campaigns-positioning.js (character positioning on maps)
        ├── campaigns-admin.js (create/rename/delete campaigns)
        ├── maps.js (map CRUD, rename, activate)
        ├── encounters.js (encounter CRUD + rename)
        ├── notes.js (notes CRUD with privacy filtering)
        ├── npcs.js (NPC CRUD)
        ├── quests.js (quest CRUD, GM-only)
        ├── factions.js (faction CRUD)
        └── log.js (campaign log with in-memory cache)
```

**Key dependency rules:**
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (`*-2024.js`) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic
- The hex map subsystem uses layered SVG rendering (each layer is a separate component)
- Campaign tool services follow the same pattern but operate on campaign-scoped JSON files

---

## 5. Key Architectural Decisions

### ADR-1: Dual Ruleset Architecture (5e ↔ 2024)
**Decision:** Every calculation service has paired 5e and 2024 versions. A factory (`rulesFactory.js` / `rules.js`) dispatches to the correct implementation based on the character's `rules` field.

**Rationale:** 5e and 2024 Essentials have significant mechanical differences (feats at level 1 vs 4, class majors vs subclasses, lineage races, energy systems, weapon mastery). Parallel files avoid conditional branching throughout the codebase.

**Trade-off:** ~2× the service files, but cleaner separation and easier maintenance.

### ADR-2: Server-Sent Events for Real-Time Sync
**Decision:** Use SSE (`/subscribe`) rather than WebSockets for multi-user sync.

**Rationale:** SSE is simpler (HTTP-based, auto-reconnect), sufficient for the push-only broadcast pattern needed. The server maintains an in-memory subscribers array and broadcasts character updates to all connected clients filtered by campaign.

**Trade-off:** No client-to-client messaging; server is the sole broadcaster. In-memory subscriber list means no horizontal scaling without sticky sessions.

### ADR-3: Declarative Wizard Configuration
**Decision:** Character creation wizard steps are defined declaratively in `steps-config.js` (step number, title, component, props function).

**Rationale:** Adding or reordering steps requires only editing the config, not the wizard orchestrator. Per-step hooks compose `useWizardConfig` with step-specific validation.

**Trade-off:** Slight indirection; understanding a step requires reading both the config and its component.

### ADR-4: Non-Blocking Validation with Warnings
**Decision:** Validation services produce warnings, not errors. Required fields are the only hard constraints (steps 1–3: ruleset, basic info, race & class).

**Rationale:** D&D character creation is creative; the app guides without blocking. Players can create "sub-optimal" characters and fix warnings later.

**Trade-off:** Risk of invalid characters being saved; mitigated by server-side schema validation.

### ADR-5: File-Based Character Storage
**Decision:** Characters are stored as JSON files on disk, served via Express, not a database.

**Rationale:** Simple, version-controllable, human-readable. JSON Schema (`character.schema.json`) provides structural validation.

**Trade-off:** No concurrent write protection; race conditions possible if two users edit the same character simultaneously (mitigated by SSE broadcast).

### ADR-6: Centralized View Configuration
**Decision:** All views (sidebar and overlay) are defined declaratively in `src/routes/config.js` with metadata about state variables, component names, and overlay status.

**Rationale:** Single source of truth for view behavior. Adding a new sidebar view requires only adding entries to `VIEWS`, `SIDEBAR_BUTTONS`, and `SIDEBAR_VIEWS`.

**Trade-off:** Tight coupling between sidebar and view config; changes to one require awareness of the other.

### ADR-7: Per-Campaign Character Change Data Files
**Decision:** Tracked resource state (HP, spell slots, rage, etc.) is persisted to per-campaign files at `public/campaigns/<campaign>/data/character-change-data.json` with a 60-second debounce.

**Rationale:** Campaigns are independent contexts; keeping change data scoped prevents cross-campaign state leakage and aligns with the existing per-campaign directory structure.

**Trade-off:** Slightly more complex file path resolution, but cleaner campaign isolation.

### ADR-8: Layered Hex Map Rendering
**Decision:** The outdoor hex map (`hex-map/`) uses a layered SVG architecture where each visual element type (grid, terrain, POIs, rivers, roads, party markers, travel paths, weather) is rendered by an independent React component.

**Rationale:** Each map layer can be independently toggled or styled without affecting other layers. The hex grid math (`hexMapUtils.js`) and terrain generation (`hexTerrainGenerator.js`) are decoupled utilities.

**Trade-off:** Multiple SVG layers add rendering overhead; pan/zoom affects all layers.

### ADR-9: Deterministic Outdoor Encounter Seeding
**Decision:** Random outdoor encounters on hex maps use a deterministic hash-based seed combined with the Mulberry32 PRNG. Every hex at given coordinates produces the same encounter features every time.

**Rationale:** Players can return to a hex and find the same terrain features. Biome-type feature pools are selected based on the hex's terrain type with min-distance constraints to prevent overlap.

**Trade-off:** Fixed seed pool is limited; the BIOME_FEATURES map must be extended for new terrain types.

### ADR-10: Pure Dice Roller Service
**Decision:** All dice rolling logic lives in a single service (`diceRoller.js`) with no dependencies.

**Rationale:** Pure utility functions are trivially testable. The UI layer accesses them through `useDiceRoll.js` and `useLoggedDiceRoll.js`, which manage roll history and integrate with character sheet actions.

**Trade-off:** No server-side authority for dice rolls; clients trust their own RNG (`Math.random()`).

### ADR-11: Theme Selection via localStorage
**Decision:** Dark/light theme is stored in `localStorage` as a simple preference string applied to `document.body` via `data-theme` attribute. The default is `'dark'`.

**Rationale:** Simple persistence without needing an API call or server configuration.

**Trade-off:** Theme is client-local only; no cross-device sync or per-user profile.

### ADR-12: State-Based Navigation (No Router)
**Decision:** All navigation uses a single `activeView` string state variable. No react-router or any routing library is used.

**Rationale:** Simplicity — the app has a flat view structure with one active sidebar view at a time. URL-based routing is unnecessary for this use case.

**Trade-off:** No deep linking, no browser history integration, no URL-driven navigation.

### ADR-13: GM/Player Role Differentiation via `isLocalhost`
**Decision:** Certain features (map management, quest editing, private notes) are only available when the client is running on localhost.

**Rationale:** Simple role-based access control without authentication. The GM runs the server locally; players connect over the network.

**Trade-off:** No granular permissions; anyone with localhost access has full GM privileges.

---

## 6. Known Constraints & Assumptions

- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or a message broker.
- **No TypeScript:** The project uses vanilla JS/JSX. Type safety is not enforced at compile time.
- **No coverage thresholds:** Vitest coverage thresholds are all set to 0 — tests exist but coverage is not enforced.
- **Port 80 default:** The server defaults to port 80 (requires root privileges on Unix).
- **Static data is bundled:** All D&D rule data is shipped as JSON files — no external API calls for game data.
- **Browser support:** Assumes modern browsers with ES module support (Vite 8 target).
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).
- **No concurrent edit protection:** Multiple users editing the same character simultaneously may cause race conditions. Only SSE broadcast provides awareness of changes.
- **Campaign tool schemas exist but are not validated at runtime:** JSON Schema files exist for encounters, NPCs, notes, quests, factions, and maps, but the server does not enforce them during writes.
- **Hex rendering performance:** Layered SVG on large hex grids (30×30 = 900+ hexes) may impact frame rate; zoom/pan operations trigger full layer re-renders.
- **Dice RNG:** Client-side only using `Math.random()`; not suitable for high-stakes or audit scenarios.
- **Campaign selection as gate:** The application always starts at the campaign selection overlay.
- **No CI/CD pipeline:** No GitHub Actions, GitLab CI, or other automation configured.
- **No containerization:** No Dockerfile or docker-compose configuration.
- **No environment configuration:** No `.env` files; only `PORT` environment variable is supported.

---

## 7. Recommended Future Improvements

1. **Coverage thresholds:** Set non-zero coverage thresholds in `vitest.config.js` to prevent test regressions.
2. **Runtime schema validation:** Enforce JSON Schema validation on the server for all campaign tool data writes (encounters, NPCs, quests, etc.).
3. **PWA support:** Add service worker for offline character sheet access and cached static data.
4. **Server-side dice verification:** Implement optional server-side RNG signing for auditability in multiplayer sessions.
5. **Hex map virtualization:** For grids larger than 30×30, implement viewport-aware hex rendering to avoid drawing off-screen hexes.
6. **Concurrent write protection:** Add optimistic locking or last-write-wins with conflict detection for character file edits.
7. **Authentication:** Replace the `isLocalhost` GM check with proper user authentication for multi-user deployments.
8. **CI/CD pipeline:** Add automated testing and deployment via GitHub Actions or similar.
9. **Containerization:** Add Dockerfile for consistent deployment across environments.
10. **TypeScript migration:** Consider migrating to TypeScript for compile-time type safety, especially for the large service layer.

---

## 8. File Inventory Summary

| Category | Count |
|----------|-------|
| Source files (.js) | ~82 services + ~46 hooks + ~13 server routes + ~4 server utils + ~4 config + 3 core = ~152 |
| React component files (.jsx) | ~100 (character-creation ~22, char-sheet ~20, hex-map ~18, map ~25+, others ~15) |
| Test files (.test.js / .test.jsx) | ~62 (paired with nearly all source files) |
| CSS files (.css) | ~25 (spread across component directories) |
| Static data JSON | 18 (public/data/ + public/data/2024/) |
| JSON Schema files | 8 (in public/campaigns/) |
| Campaign data files | ~30+ (across 3 test campaigns) |
| Image assets | ~20+ (character portraits, static examples, icons) |
| **Total (excl. node_modules)** | **~360+** |

---

*Document generated automatically. Last updated: 2026-05-25T00:00:00Z*
