# Architecture — dnd-char-sheet

> **Generated:** 2026-05-24T00:00:00Z
> **Repository:** https://github.com/PaulGilchrist/dnd-char-sheet.git
> **Stack:** React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome

---

## 1. High-Level Overview

`dnd-char-sheet` is a single-page web application for creating, managing, and playing Dungeons & Dragons character sheets. It supports both the classic 5th Edition (5e) and the 2024 Essentials rulesets, with full dual-ruleset logic throughout the codebase.

The application consists of three major subsystems:

1. **Character Sheet System** — A React SPA (Vite 8) providing character creation via a 12-step wizard, full character sheet display, initiative tracking, encounter building, hex map rendering, campaign notes, quest tracking, NPC management, faction management, and sidebar navigation.
2. **Express 5 Server** — Provides REST API endpoints for character/campaign CRUD, static file serving, and real-time multi-user sync via Server-Sent Events (SSE).
3. **Campaign Tools** — GM-focused subsystems for map management (indoor and outdoor hex maps), encounter generation, NPC management, faction tracking, quest logging, notes, and random outdoor encounter seeding.

The app is private (not published to npm), licensed under MIT, and authored by Paul Gilchrist.

---

## 2. Module-by-Module Breakdown

### 2.1 Entry Points

| File | Role |
|------|------|
| `src/main.jsx` | React root mount with `StrictMode`; renders `<App />` |
| `src/App.jsx` | Top-level state-based router: renders views based on `activeView`, theme state, and wizard toggles |
| `server.js` | Express server: serves `dist/` (production SPA), `public/` (static data), REST API (`/api/*`), and SSE (`/subscribe`) |

### 2.2 Frontend Layers

#### Hooks (`src/hooks/`)

Centralized state management via custom hooks — no class components exist.

| Hook | Responsibility |
|------|----------------|
| `useAppData.js` | Loads all static game data (classes, races, spells, equipment) with caching |
| `useCampaignManagement.js` | Campaign selection, rename, delete, session storage |
| `useCharacterManagement.js` | Character list, active character, save/delete via API |
| `useCharacterWizard.js` | Wizard show/hide, complete/cancel handlers |
| `useTrackedResource.js` | Generic tracked resource (HP, spell slots, rage) with localStorage persistence |
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
| `useDiceRoll.js` | Integration of dice roller service with UI actions |
| `useActionPopup.js` | Action popup display for character sheet interactions |
| `usePopup.js` | Generic popup state management |
| `useEncounterManagement.js` | Encounter builder state management |
| `useFactionsManagement.js` | Faction management state |
| `useMonstersData.js` | Monster data loading for encounters |
| `useNotesManagement.js` | Campaign notes management |
| `useNPCsManagement.js` | NPC management state |
| `useQuestsManagement.js` | Quest tracking and management state |

#### Components (`src/components/`)

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `campaign-selection/` | `CampaignSelection` | Full-screen campaign list; list/create/rename/delete campaigns |
| `character-creation/` | `CharacterCreationWizard` (12 steps) | Step-by-step character creation/editing wizard with progress bar, sidebar, and footer |
| `char-sheet/` | `CharSheet` + 13 sub-components | Full character sheet display (abilities, actions, inventory, spells, feats, summary, combat, short/long rest support) |
| `initiative/` | `Initiative` | Initiative tracker, round counter, NPC management |
| `encounter/` | `EncounterBuilder` | Encounter builder for balancing encounters against party levels |
| `factions/` | `Factions` | Faction management for campaigns |
| `hex-map/` | `HexMap`, `HexGridLayer`, `TerrainLayer`, `POILayer`, `RiverLayer`, `PartyMarkerLayer`, `MarchingOrderPanel` | Hex-based outdoor map rendering with layered SVG components, POI markers, terrain painting, river drawing, and party positioning |
| `map/` | `Map` (30+ files) | Indoor map viewer with grid/wall rendering, placed items, players, furniture/monster SVGs (20+), toolbar, fog overlay, and context menus |
| `maps-manager/` | `MapsManager` | GM map management screen |
| `notes/` | `Notes` | Campaign notes viewer/editor |
| `npcs/` | `NPCs` | NPC management for campaigns |
| `quests/` | `Quests` | Quest tracking and management for campaigns |
| `sidebar/` | `Sidebar` | Sidebar navigation with view switching, theme toggle, character list |
| `common/` | `Popup`, `Subscriber`, `HiddenInput`, `WarningList`, `AvatarImage`, `MarkdownPreview`, `PreviewToggle` | Shared UI primitives including rich text preview and image avatars |

#### Character Creation Wizard (12 steps)

1. **Ruleset** — Select 5e or 2024
2. **Basic** — Name, level, alignment, background (2024)
3. **Race & Class** — Cascading race/subrace and class/subclass selection
4. **Feats** — Feat selection with validation
5. **Ability Scores** — Point-buy (8–15 base, 27 points)
6. **Skills** — Skill proficiencies and expertise
7. **Languages** — Languages and fighting styles
8. **Resistances** — Resistances and immunities
9. **Spells** — Spell selection with limits validation
10. **Magic Items** — Magic item selection with attunement warnings
11. **Inventory** — Gold, backpack, equipped items
12. **Special** — Custom special actions

Wizard infrastructure: `steps-config.js` (declarative step definitions), `constants.js`, `utils.js`, `CascadingSelect.jsx`, `EquipmentSearchModal.jsx`, `SelectableList.jsx`. Wizard UI shell: `CharacterCreationWizard.jsx` with `WizardHeader.jsx`, `WizardSidebar.jsx`, `WizardFooter.jsx`, `WizardProgressBar.jsx`.

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
- **Sidebar views** (mutually exclusive via `activeView`): `charSheet`, `encounter`, `factions`, `initiative`, `mapsManager`, `map`, `notes`, `npcs`, `quests` (9 total)
- **Overlay views** (independent boolean toggles): `campaignSelection`, `characterWizard`, `editCharacterWizard`
- The `map` view has a dual state: `'none'`, `'manager'`, or `'map'` (with optional `mapName`)

### 2.5 Services (`src/services/`) — Pure logic, one file per concern, each with paired `.test.js`

| Category | Files | Purpose |
|----------|-------|---------|
| **Core** | `dataLoader.js`, `storage.js`, `utils.js`, `rules.js`, `rulesFactory.js`, `campaignService.js`, `sanitize.js` | Data loading with caching, localStorage wrapper, unified rules dispatch, campaign API, DOMPurify wrapper |
| **Calculations (5e ↔ 2024 pairs)** | `abilityCalc.js` / `abilityCalc2024.js`, `attackCalc.js` / `attackCalc2024.js`, `spellCalc.js` / `spellCalc2024.js` | Ability modifiers, weapon/spell attacks, spell lists and slots |
| **Spell Management** | `spellLimits.js`, `spellValidation.js`, `shared/spell-utils.js` | Spell slot limits per class/level, spell selection validation, shared spell utilities |
| **Class & Race Rules** | `classFeatures.js`, `classRules.js`, `classRules2024.js`, `race-rules/5e.js`, `race-rules/2024.js`, `race-rules/index.js` | Class-specific features (Bard, Cleric, Druid, etc.), race traits (immunities, senses, bonuses) |
| **Proficiency & Features** | `proficiencyUtils.js`, `proficiencyUtils2024.js`, `featureCategories5e.js`, `featureCategories2024.js`, `featureCategorizationUtils.js` | Proficiency calculation, feature categorization (actions, bonusActions, reactions, characterAdvancement) |
| **Validation** | `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `languagesFightingstylesValidation.js` | Validates selections against ruleset constraints (prerequisites, level requirements, limits) |
| **Encounter & Dungeon** | `encountersService.js`, `dungeonGenerator.js`, `monsterUtils.js`, `encounterGenerator.js`, `outdoorEncounterGenerator.js` | Encounter building, dungeon generation, monster utilities, random encounter suggestions, outdoor encounter seeding |
| **Hex Map** | `hexMapUtils.js`, `hexTerrainGenerator.js` | Hex grid math (coord systems, adjacency), terrain rasterization via marching squares algorithm |
| **Dice Roller** | `diceRoller.js` | D20, single/multi-die rolls, advantage/disadvantage, formula parsing (e.g. "2d6+3") |
| **Campaign Tools** | `factionsService.js`, `mapsService.js`, `notesService.js`, `npcsService.js`, `questsService.js` | Faction management, map management, campaign notes, NPC management, quest tracking |

### 2.6 Static Data (`public/data/`)

JSON catalogs loaded at runtime by `dataLoader.js`:

| Data | 5e Path | 2024 Path |
|------|---------|-----------|
| Classes | `classes.json` | `2024/classes.json` |
| Races | `races.json` | `2024/races.json` |
| Spells | `spells.json` | `2024/spells.json` |
| Feats | `feats.json` | `2024/feats.json` |
| Magic Items | `magic-items.json` | `2024/magic-items.json` |
| Backgrounds | — | `2024/backgrounds.json` |
| Monsters | `monsters.json` | `2024/monsters.json` |
| Ability Scores | `ability-scores.json` | (shared) |
| Skills | `passive-skills.json` | (shared) |
| Actions | `actions.json` | (shared) |
| Alignment | `alignments.json` | (shared) |
| Languages | `languages.json` | (shared) |
| Fighting Styles | `fighting-styles.json` | (shared) |
| Equipment | `equipment.json` | (shared) |
| Rules | `rules-validation.json` | `2024/rules-validation.json` |
| Resistances | `resistances-immunities.json` | (shared) |

### 2.7 Character Storage (`public/campaigns/`)

- **Schema:** `character.schema.json` (JSON Schema draft-07)
- **Structure:** `public/campaigns/<campaign>/<name>.json`
- **Active campaigns:** "Campaign 1" (7 characters), "Campaign 2" (5 characters)
- **Test campaigns:** "2024 Testing", "5e Testing", "Campaign Testing"
- Each character file includes a `rules` field specifying 5e or 2024

### 2.8 Runtime State

- **`public/campaigns/:campaign/data/character-change-data.json`** — Per-campaign in-memory debounced state for tracked resources (HP, spell slots, rage, etc.). Persisted to disk on a 60-second debounce interval. Listed in `.gitignore`.
- **Indoor map state** — Map files stored as JSON under `public/campaigns/<campaign>/maps/` wall/grid/item/position data
- **Hex map files** — Outdoor hex grid data (terrain types per hex, POI positions, river segments) stored alongside indoor maps

---

## 3. Data Flow Summary

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Static JSON   │      │  Character     │      │  Runtime      │
│   (data/*.json)│      │   (.json)       │      │  State        │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                      │                      │
       ▼                      ▼                      ▼
   ┌──────────┐        ┌──────────┐          ┌──────────┐
   │ data-     │        │ Express   │          │ localStorage│
   │ loader    │        │ REST API │           │ /sessions  │
   └────┬─────┘        └────┬─────┘          └──────────┘
      │                      │
      ▼                      ▼
   ┌──────────┐        ┌──────────┐         ┌──────────────┐
   │ rules.js │        │ SSE      │         │ Hex Map       │
   │ + *-calc │        │ /subscribe│         │ Services       │
   └────┬─────┘        └────┬─────┘         │ (hexMapUtils,  │
      │                      │               │  hexTerrain)    │
      ▼                      ▼               └──────┬───────┘
┌──────────────────────────────────────┐             │
│ React Components (UI)               │             ▼
│                                    │   ┌──────────────────┐
│ CharSheet · Initiative · Encounter │   │ HexMap Layered    │
│ Maps (indoor + outdoor hex)       │   │ SVG Rendering     │
│ Quests · Notes · Factions · NPCs  │   └──────────────────┘
│ CharacterCreationWizard           │
└──────────────────────────────────────┘
```

1. **Initialization:** `dataLoader.js` loads all static JSON catalogs (cached per ruleset). `useAppData.js` exposes this to components.
2. **Character CRUD:** `useCharacterManagement.js` calls Express REST API (`/api/characters/*`) for list/create/update/delete. Characters are persisted as JSON files on disk.
3. **Real-time sync:** `Subscriber` component connects to SSE (`/subscribe`). When any client modifies a character, the server broadcasts the change to all connected SSE clients.
4. **Ephemeral state:** HP, spell slots, and tracked resources are stored in per-campaign `character-change-data.json` files under `public/campaigns/<campaign>/data/` (in-memory, debounced 60s save).
5. **Rules evaluation:** `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`. Calculation services compute modifiers, attacks, spells, and class features from the character data.
6. **Campaign tools:** Encounter, quest, faction, notes, NPC, and map data are stored as JSON files under `public/campaigns/<campaign>/` (e.g., `encounters/`, `maps/`, `data/notes.json`, `data/npcs.json`, `data/quests.json`).
7. **Hex maps:** Outdoor hex maps use seeded procedural terrain generation (`hexTerrainGenerator.js`) with biome-specific feature placement (`outdoorEncounterGenerator.js`). Server-side utility functions generate random outdoor encounters from dice rolls and hex coordinates.

---

## 4. Dependency Graph (Textual)

```
main.jsx
   └── App.jsx
        ├── CampaignSelection
        ├── CharSheet
        │     ├── CharSummary (→ CharHitPoints, CharGold, CharClassFeatures)
        │     ├── CharAbilities
        │     ├── CharActions
        │     ├── CharInventory
        │     ├── CharReactions
        │     ├── CharSpecialActions
        │     ├── CharCharacterAdvancement
        │     ├── CharFeats (→ char-feats/)
        │     └── CharSpells (→ CharSpellSlots, CharSpellSlotLevel)
        │           → LongRestButton, ShortRestButton, ShortRestModal
        ├── Initiative
        ├── EncounterBuilder
        ├── HexMap (6+ SVG layer components + toolbar + POI panel)
        ├── Map (30+ files: grid/walls, items, players, 20+ SVG furniture)
        ├── MapsManager
        ├── Factions
        ├── Notes
        ├── Quests
        ├── NPCs
        ├── CharacterCreationWizard → 11 step-specific components (+ footer/header/sidebar/progress)
        └── Sidebar (theme toggle, character list, view nav)

Hooks (used by components):
   useAppData → dataLoader.js → public/data/*.json
   useCampaignManagement → campaignService.js → Express API
   useCharacterManagement → Express API
   useCharacterWizard → Express API
   useTrackedResource → localStorage
   useWizardConfig → rules.js + validation services
   useEncounterManagement → encountersService.js
   useFactionsManagement → factionsService.js
   useMonstersData → public/data/monsters.json
   useNotesManagement → notesService.js
   useNPCsManagement → npcsService.js
   useQuestsManagement → questsService.js
   useDiceRoll → diceRoller.js (pure functions)
   useActionPopup → Popup component state
   useWizard* → Express API

Services (pure logic, no UI):
   rules.js → rulesFactory.js → abilityCalc.js/abilityCalc2024.js
                                      attackCalc.js/attackCalc2024.js
                                      spellCalc.js/spellCalc2024.js
   classFeatures.js → classRules.js/classRules2024.js
   race-rules/5e.js, 2024.js
   spellLimits.js, spellValidation.js, shared/spell-utils.js
   featValidation.js, skillValidation.js
   resistancesValidation.js, languagesFightingstylesValidation.js
   featureCategorizationUtils.js → featureCategories5e.js/featureCategories2024.js
   proficiencyUtils.js/proficiencyUtils2024.js
   sanitize.js (DOMPurify wrapper)
   encountersService.js, dungeonGenerator.js, monsterUtils.js
   encounterGenerator.js (random encounter suggestions from XP thresholds + CR)
   outdoorEncounterGenerator.js (seeded outdoor hex encounter generation)
   hexMapUtils.js (hex grid math: coordinate systems, adjacency)
   hexTerrainGenerator.js (terrain rasterization via marching squares)
   diceRoller.js (D20, multi-dice, formula parsing, advantage/disadvantage)
   factionsService.js, mapsService.js, notesService.js, npcsService.js, questsService.js

Server routes:
   sse.js (SSE /subscribe endpoint)
   campaigns-basic.js (campaign listing, character file listing)
   campaigns-character.js (character GET/PUT/DELETE/POST)
   campaigns-changedata.js (per-campaign change data persistence)
   campaigns-positioning.js (character positioning on maps)
   campaigns-admin.js (create/rename/delete campaign ops)
   encounters.js (campaign encounter CRUD)
   factions.js (campaign faction CRUD)
   maps.js (indoor map file management)
   notes.js (campaign notes CRUD)
   npcs.js (campaign NPC CRUD)
   quests.js (campaign quest CRUD)

Server utils:
   changeData.js (in-memory debounced state, SSE subscriber management, keep-alive health check)
   encounterUtils.js (server-side random encounter rolling for outdoor hexes)
   imageUtils.js (background image upload and management)
```

**Key dependency rules:**
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (`*-2024.js`) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic
- The hex map subsystem uses layered SVG rendering (each layer is a separate component)
- Campaign tool services (encounters, factions, notes, NPCs, quests, maps) follow the same pattern but operate on campaign-scoped JSON files rather than character files

---

## 5. Key Architectural Decisions

### ADR-1: Dual Ruleset Architecture (5e ↔ 2024)
**Decision:** Every service has paired 5e and 2024 versions. A factory (`rulesFactory.js`) dispatches to the correct implementation based on the character's `rules` field.

**Rationale:** 5e and 2024 Essentials have significant mechanical differences (feats at level 1 vs 4, class majors, lineage races, energy systems). Parallel files avoid conditional branching throughout the codebase.

**Trade-off:** ~2× the service files, but cleaner separation and easier maintenance.

### ADR-2: Server-Sent Events for Real-Time Sync
**Decision:** Use SSE (`/subscribe`) rather than WebSockets for multi-user sync.

**Rationale:** SSE is simpler (HTTP-based, auto-reconnect), sufficient for the push-only broadcast pattern needed. The server maintains an in-memory subscribers array and broadcasts character updates to all connected clients.

**Trade-off:** No client-to-client messaging; server is the sole broadcaster.

### ADR-3: Declarative Wizard Configuration
**Decision:** Character creation wizard steps are defined declaratively in `steps-config.js` (step number, title, component, props function).

**Rationale:** Adding or reordering steps requires only editing the config, not the wizard orchestrator. Per-step hooks (`src/hooks/use-wizard-skills.js`, etc.) compose `useWizardConfig` with step-specific validation.

**Trade-off:** Slight indirection; understanding a step requires reading both the config and its component.

### ADR-4: Non-Blocking Validation with Warnings
**Decision:** Validation services produce warnings, not errors. Required fields are the only hard constraints (steps 1–3).

**Rationale:** D&D character creation is creative; the app guides without blocking. Players can create "sub-optimal" characters and fix warnings later.

**Trade-off:** Risk of invalid characters being saved; mitigated by server-side schema validation.

### ADR-5: File-Based Character Storage
**Decision:** Characters are stored as JSON files on disk, served via Express, not a database.

**Rationale:** Simple, version-controllable, human-readable. JSON Schema (`character.schema.json`) provides structural validation.

**Trade-off:** No concurrent write protection; race conditions possible if two users edit the same character simultaneously (mitigated by SSE broadcast).

### ADR-6: Centralized View Configuration
**Decision:** All views (sidebar and overlay) are defined declaratively in `src/routes/config.js` with metadata about state variables, component names, and overlay status.

**Rationale:** Single source of truth for view behavior. Adding a new sidebar view requires only adding an entry to `VIEWS`, `SIDEBAR_BUTTONS`, and `SIDEBAR_VIEWS`.

**Trade-off:** Tight coupling between sidebar and view config; changes to one require awareness of the other.

### ADR-7: Per-Campaign Character Change Data Files
**Decision:** Tracked resource state (HP, spell slots, rage, etc.) is persisted to per-campaign files at `public/campaigns/<campaign>/data/character-change-data.json` rather than a single root-level file.

**Rationale:** Campaigns are independent contexts; keeping change data scoped to each campaign prevents cross-campaign state leakage and aligns with the existing per-campaign directory structure used for characters, encounters, NPCs, and notes.

**Trade-off:** Slightly more complex file path resolution when loading/saving change data, but cleaner campaign isolation.

### ADR-8: Layered Hex Map Rendering
**Decision:** The outdoor hex map (`hex-map/`) uses a layered SVG architecture where each visual element type (grid, terrain, POIs, rivers, party markers, marching order) is rendered by an independent React component that composes onto a shared viewport.

**Rationale:** Each map layer can be independently toggled or styled without affecting other layers. The hex grid math (`hexMapUtils.js`) and terrain generation (`hexTerrainGenerator.js`) are decoupled utilities that feed render state into their respective layers.

**Trade-off:** Multiple SVG layers add rendering overhead; the component must manage coordination between independent layer state updates (e.g., pan/zoom affects all layers).

### ADR-9: Deterministic Outdoor Encounter Seeding
**Decision:** Random outdoor encounters on hex maps use a deterministic hash-based seed (`hashSeed(q, r)`) combined with the Mulberry32 PRNG. Every hex at given coordinates produces the same encounter features every time.

**Rationale:** Players can return to a hex and find the same terrain features. Biome-type feature pools are selected from `BIOME_FEATURES` in `outdoorEncounterGenerator.js` based on the hex's terrain type. Min-distance constraints prevent feature overlap.

**Trade-off:** Fixed seed pool (features, boulders, bushes) is limited; the BIOME_FEATURES map must be extended as new terrain types or features are added.

### ADR-10: Pure Dice Roller Service
**Decision:** All dice rolling logic (D20, single/multi-dice, advantage/disadvantage, formula parsing via `2d6+3` syntax) lives in a single service (`diceRoller.js`) with no dependencies.

**Rationale:** Pure utility functions are trivially testable. The UI layer accesses them through `useDiceRoll.js`, which manages roll history state and integrates with character sheet actions (ability checks, attack rolls, saving throws).

**Trade-off:** No server-side authority for dice rolls; clients trust their own RNG.

### ADR-11: Theme Selection via localStorage
**Decision:** Dark/light theme is stored in `localStorage` as a simple preference string applied to `document.body`. The default is `'dark'`.

**Rationale:** Simple persistence without needing an API call or server configuration. Applied at the component level with minimal overhead.

**Trade-off:** Theme is client-local only; no cross-device sync or per-user profile.

---

## 6. Known Constraints & Assumptions

- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or a message broker.
- **No TypeScript:** The project uses vanilla JS/JSX. Type safety is not enforced at compile time.
- **No coverage thresholds:** Vitest coverage thresholds are all set to 0 — tests exist but coverage is not enforced.
- **Port 80 default:** The server defaults to port 80 (requires root privileges on Unix).
- **Static data is complete:** All D&D rule data (classes, races, spells, feats, etc.) is bundled as JSON — no external API calls for game data.
- **Browser support:** Assumes modern browsers with ES module support (Vite 8 target / `browserslist` defaults).
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).
- **No concurrent edit protection:** Multiple users editing the same character simultaneously may cause race conditions. Only SSE broadcast provides awareness of changes; no file locking is implemented.
- **Campaign tool data:** Encounter, NPC, notes, quest, and map data are stored as JSON files under campaign directories — no schema validation currently enforced for these files.
- **Hex rendering performance:** Layered SVG on large hex grids (30x30 = 900+ hexes) may impact frame rate; zoom/pan operations trigger full layer re-renders.
- **Dice RNG:** Client-side only using `Math.random()`; not suitable for high-stakes or audit scenarios.
- **Campaign selection as gate:** The application always starts at the campaign selection overlay unless no campaigns exist.

---

## 7. Recommended Future Improvements

1. **Coverage thresholds:** Set non-zero coverage thresholds in `vitest.config.js` to prevent test regressions from merging.
2. **Schema validation for campaign tools:** Add JSON Schema validation (via `character.schema.json` extension) for encounter, NPC, quest, notes, and map data files.
3. **PWA support:** Add service worker for offline character sheet access and cached static data.
4. **Server-side dice verification:** Implement optional server-side RNG signing for auditability in multiplayer sessions.
5. **Hex map virtualization:** For grids larger than 30x30, implement viewport-aware hex rendering to avoid drawing off-screen hexes.
6. **Dual-ruleset test parity:** Not all 2024-specific services have `*2024.test.js` counterparts; add missing coverage.
7. **Campaign tool data persistence strategy:** The debounce-then-disk pattern works for moderate traffic but should be evaluated under multi-user concurrent write load.

---

## 8. File Inventory Summary

| Category | Count |
|----------|-------|
| Source files (.js) | ~160+ (services ~82, hooks ~52, server routes/utils ~15, config ~4, main ~3) |
| React component files (.jsx) | ~130+ (character-creation ~22, char-sheet ~20, hex-map ~12, map ~30+) |
| Test files (.test.js / .test.jsx) | ~80+ (paired with nearly all source files) |
| CSS files (.css) | ~30+ (spread across component directories + shared sheets) |
| Static data JSON | ~25 (public/data/ + public/data/2024/) |
| Character JSON files | ~40+ (across active and test campaigns) |
| Image assets | ~10 (PNG icons, static examples, character images) |
| **Total (excl. node_modules)** | **~360+** |

---

*Document generated automatically. Last updated: 2026-05-24T00:00:00Z*
