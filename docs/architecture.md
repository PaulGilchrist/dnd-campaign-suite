# D&D Character Sheet — Architecture Document

> Generated: 2026-05-29

## High-Level Overview

D&D Character Sheet is a single-page React application for managing Dungeons & Dragons campaigns, character sheets, tactical maps, combat encounters, and more. It supports both the **2014 (5e)** and **2024** editions of D&D 5th Edition through a dual-ruleset architecture.

The app consists of:
- A **React SPA** (client) built with Vite
- An **Express.js server** providing RESTful APIs, file-based persistence, and Server-Sent Events (SSE) for real-time sync
- A **static JSON data layer** for D&D rules reference data

There is no database. All persistent data is stored as JSON files on disk under `public/campaigns/<name>/`.

---

## Architectural Pattern

The project follows a **layered, feature-based architecture**:

```
┌─────────────────────────────────────────────┐
│              React SPA (Client)             │
├──────────┬──────────┬───────────┬───────────┤
│ App.jsx  │ Routes   │ Hooks     │ Components│
├──────────┼──────────┼───────────┼───────────┤
│ Services │ Models   │ Config    │ (CSS)     │
└────┬─────┴────┬─────┴─────┬─────┴─────┬─────┘
     │          │           │           │
     └──────────┴───────────┴───────────┘
                 HTTP / SSE
     ┌──────────────────────────────────┐
     │      Express Server (Node.js)    │
     ├──────────┬──────────┬───────────┤
     │ Routes   │ Utils    │ File I/O  │
     └──────────┴──────────┴───────────┘
                 JSON Files on Disk
```

---

## Module-by-Module Breakdown

### `src/main.jsx` — Entry Point

Bootstraps React 19 with `ReactDOM.createRoot`. Loads global CSS (`index.css`) and Font Awesome, then renders `<App />` inside `<React.StrictMode>`.

### `src/App.jsx` — Root Orchestrator (~300 lines)

The top-level component. Manages all global state: active view, characters, active character, maps navigation/history, theme (persisted to localStorage), and character wizard modals. Delegates domain concerns to custom hooks and renders either the campaign selection screen or the main sidebar + content layout.

### `src/routes/config.js` — View Router Configuration

Single source of truth for all view definitions, sidebar buttons, and active-view state keys. No routing library is used — navigation is entirely string-based React state (`activeView`).

### `src/components/` — Feature-Based UI Components

| Directory | Responsibility | Files (non-test) |
|---|---|---|
| `common/` | Shared reusable primitives: Subscriber (SSE), Popup, AvatarImage, MarkdownPreview, PreviewToggle, MonsterNameAutocomplete, WarningList, HiddenInput | 8 |
| `char-sheet/` | Character sheet view with sub-components for stats, abilities, actions, inventory, spells, class features, rest buttons | ~20 |
| `character-creation/` | Wizard-style character creation/editing. Config-driven step rendering via `steps-config.js`. Steps: Rules, Basic, RaceClass, Abilities, Skills, Feats, Spells, Inventory, MagicItems, Languages, Special | ~15 |
| `encounter/` | Encounter builder with monster filtering, XP calculation, difficulty ratings, and random encounter generation | 7 |
| `hex-map/` | Outdoor hex-grid SVG map. Terrain, rivers, roads, POIs, party markers, travel paths, weather. Procedural terrain generation | ~23 |
| `initiative/` | Combat tracker / initiative order manager | 1 |
| `map/` | Indoor tactical SVG grid map with fog-of-war, spell overlays, item placement, NPC placement, ruler tool | ~35 |
| `maps-manager/` | Maps CRUD list with create/rename/delete and procedural generation modals | 2 |
| `sidebar/` | Navigation sidebar with expandable character list and GM-gated view links | 1 |
| `campaign-selection/` | Campaign browser with create/delete functionality | 1 |
| `factions/`, `npcs/`, `quests/`, `notes/`, `log/` | Simple CRUD views, each single-file with modal-based forms | 5 |

**Patterns:** Compound components (root orchestrator + presentational children), default exports, PascalCase naming, domain-prefixed names (`Char*`, `Wizard*`, `Encounter*`, `HexMap*`), colocated CSS per component.

### `src/hooks/` — Custom Hooks Layer (22 non-test files)

Hooks bridge UI components with services and manage domain state:

| Hook | Responsibility |
|---|---|
| `useAppData` | Loads 5e + 2024 reference data via `dataLoader.js` |
| `useCampaignManagement` | Campaign CRUD (create/rename/delete/select) |
| `useCharacterManagement` | Character save/upload/delete/active selection |
| `useCharacterWizard` | Bridges wizard UI to `campaignService` for create/edit |
| `useLog` | Dual-path log: initial load + live SSE subscription, capped at 200 entries |
| `useTravelManagement` | Hex-map party movement: pathfinding, budget/exhaustion, random events, combat encounters |
| `useEncounterManagement`, `useFactionsManagement`, `useNPCsManagement`, `useNotesManagement`, `useQuestsManagement` | Domain-specific CRUD management |
| `useWizard*` (10 hooks) | Wizard step state: Form, Data, Navigation, Skills, Languages, Resistances, Feats, Abilities, ArrayToggle, Config |
| `useActionPopup`, `useDiceRoll`, `useLoggedDiceRoll` | Interaction utilities |
| `useEquipmentSearch`, `useMonstersData` | Search and data helpers |
| `usePopup`, `useTrackedResource` | UI state management |

### `src/services/` — Business Logic & Calculations (48 non-test files, 96 total)

Organized by feature domain with two subdirectories for ruleset-specific logic:

**Data Loading & Persistence:**
- `dataLoader.js` — Centralized JSON fetch/cache for reference data. Maintains separate caches for ruleset-specific (`5e`, `2024`) and version-agnostic data types. Loads from `/data/` or `/data/2024/`.
- `storage.js` — Thin localStorage abstraction with fire-and-forget sync to `/api/campaigns/{campaign}/{key}`. Used for character sheets.

**CRUD Services (RPC-style, no inter-dependencies):**
`campaignService`, `encountersService`, `factionsService`, `mapsService`, `notesService`, `npcsService`, `questsService`, `logService` — Each follows: `load*`, `save*`/`create*`, `update*`, `delete*`.

**Calculation Services:**
- `abilityCalc.js` / `abilityCalc2024.js` — Ability modifier and derived stat computation per ruleset
- `attackCalc.js` / `attackCalc2024.js` — Attack bonus and damage calculations
- `spellCalc.js` / `spellCalc2024.js` — Spell slot tables and spellcasting mechanics
- `classRules.js` / `classRules2024.js` — Class feature computation, Hit Dice, HP progression
- `proficiencyUtils.js` / `proficiencyUtils2024.js` — Proficiency bonus tracks
- `rule s.js` (20 KB) — Master rules module composing all sub-calculators

**Validation Services:** `featValidation`, `skillValidation`, `spellValidation`, `resistancesValidation`, `languagesFightingstylesValidation` — Pre-requisite and ruleset validation for character creation.

**Categorization:** `featureCategories5e.js`, `featureCategories2024.js`, `featureCategorizationUtils.js` — Maps class features to UI categories (traits, spell slots, actions, etc.).

**Generation Services:** `dungeonGenerator.js`, `hexTerrainGenerator.js`, `encounterGenerator.js`, `lootGenerator.js`, `randomEventService.js`, `weatherService.js` — Procedural content generation. Dungeon and terrain generators support seeded runs.

**Map Tools:** `hexMapUtils.js`, `lineOfSight.js` (Bresenham grid visibility), `damageUtils.js`, `conditionEffects.js`, `conditionUtils.js`, `monsterUtils.js`, `npcStatBlockUtils.js`, `travelService.js`, `encounterToInitiative.js`

**Dual-Ruleset Subdirectories:**
- `race-rules/` — `index.js` (entry), `5e.js`, `2024.js` — Race trait computation per edition
- `shared/` — `spell-utils.js` — Cross-ruleset spell utilities (level calculation)

**Factory Pattern — `rulesFactory.js`:**
Central strategy/factory that selects 5e or 2024 ruleset based on `playerSummary.rules`. Composes `rules`, `raceRules`, `classRules` sub-modules and delegates all player-state computation. Chain: `rulesFactory` → `rules` → per-ruleset calculators → `dataLoader`.

### `src/config/` — Configuration Constants (3 files)

- `constants.js` — Default character form shape, required fields
- `outdoorConfig.js` — Hex map rendering constants, terrain types/colors, POI types, tool modes, zoom limits
- `utils.js` — Async validation utilities (point-buy costs, ability score validation, step validation) using JSON rules files

### `src/models/` — Data Models (2 files non-test)

Minimal model layer. `SpellOverlay.js` defines geometry primitives for combat map targeting overlays (RADIUS / CONE / LINE), default dimensions, grid-to-screen conversion, and hit-testing logic. `config.js` contains build-time configuration.

### `public/data/` — Static Reference Data (15 JSON files)

Version-agnostic D&D data: ability-scores, actions, alignments, equipment, feats (5e), fighting-styles, languages, magic-items, monsters, passive-skills, resistances-immunities, rules-validation, spells (5e), classes (5e), races (5e). Mirrored under `public/data/2024/` for the 2024 edition (backgrounds, classes, feats, races, rules-validation, spells).

### Express Server (`server.js` + `server/routes/` + `server/utils/`)

**Server:** Port 80. Serves React SPA from `/dist` with catch-all fallback for client-side routing. Serves `public/campaigns/` with `no-store` headers to prevent caching of campaign data.

**Routes (13 modules):**
| Route Module | Responsibility |
|---|---|
| `campaigns-basic.js` | List campaigns and characters |
| `campaigns-character.js` | Read/write/delete character JSON |
| `campaigns-changedata.js` | Runtime change tracking (in-memory Map, 1-min debounced write-back) |
| `campaigns-admin.js` | Create/rename/delete campaigns |
| `campaigns-positioning.js` | Character ordering in campaigns |
| `maps.js` | MAP CRUD and wall placement |
| `encounters.js`, `factions.js`, `notes.js`, `npcs.js`, `quests.js` | Domain entity APIs |
| `log.js` | Campaign log entries |
| `sse.js` | Server-Sent Events: `/subscribe?campaign=<name>` pushes full snapshot then incremental updates via `changeData.publish()` |
| `spell-overlay.js` | Real-time spell overlay geometry for multi-client maps |

**Utils:** `changeData.js` (in-memory change-data Map with SSE publish), `encounterUtils.js`, `imageUtils.js`.

**Health:** `/health` endpoint with 60s keep-alive interval to prevent proxy timeouts.

### Build and Test Infrastructure

| Tool | Purpose | Key Config |
|---|---|---|
| **Vite 8** + `@vitejs/plugin-react` | Bundler, dev server, HMR | Output → `dist/`, assets with original filenames (no hash), `copyPublicDir: true` |
| **Vitest 4** | Test runner | jsdom env, globals, v8 coverage, setup via `src/test/setup.js`, matches `src/**/*.{test,spec}.{js,jsx}` |
| **ESLint 8** | Linting | React + React Hooks + React Refresh plugins |

Test coverage excluded for assets (images, fonts, audio/video). Output in text, json, html, lcov formats to `./coverage/`.

### Migration and CLI Tools

| File | Purpose |
|---|---|
| `migrate5eTo2024.mjs` | Converts 5e monsters to 2024 schema; parses attack descriptions, dice expressions, save DCs/types, reach/range; merges overlapping monsters |
| `dungeon-generator.mjs` | CLI wrapper for procedural dungeon generation with seed support |
| `hex-terrain-generator.mjs` | CLI wrapper for procedural hex terrain generation with seed support |

---

## Data Flow Summary

```
[User Action] → [Component] → [Custom Hook] → [Service / dataLoader]
                                                    ↓
                                           [/api/*  or /data/*.json]
                                                    ↓
                                         [Express Server ↔ File System]
                                                    ↑
                                    [SSE推送 update via changeData.publish()]
                                    [←───────────────────────────────┘]
```

1. **Static data** flows: Component → Hook → `dataLoader.js` → HTTP fetch from `/data/<type>.json` → Express serves file from `public/data/` or `public/data/2024/`.
2. **Campaign/persistent data** flows two ways depending on entity type:
   - **Characters**: Hook → `campaignService` / `storage.js` → localStorage (immediate) + fire-and-forget HTTP to `/api/campaigns/{campaign}/{key}`.
   - **All other entities** (NPCs, quests, maps, etc.): Hook → domain service → HTTP POST/PUT/DELETE to `/api/*/`. Data stored in `public/campaigns/<name>/` as JSON on disk.
3. **Real-time sync**: Client subscribes via SSE at `/subscribe?campaign=<name>`. Server pushes full snapshot on connect, then incremental updates via `changeData.publish()` with campaign-scoped filtering. Components render `<Subscriber>` to receive events.
4. **Player stats computation** (client-side only): Component → `rulesFactory.js` → selects 5e or 2024 ruleset → delegates to sub-calculators → pure functions compute derived state from `playerSummary`.

---

## Dependency Graph (Textual)

```
App.jsx
├── Sidebar.jsx, CampaignSelection.jsx
├── hooks: useAppData, useCampaignManagement, useCharacterManagement, useCharacterWizard
│   ├── services/campaignService.js → Express /api/
│   ├── services/storage.js → localStorage + Express /api/
│   └── services/dataLoader.js → /data/*.json (Express serves from disk)
├── Views (activeView state-driven):
│   ├── CharSheet.jsx → rulesFactory.js → {rules, raceRules, classRules} → dataLoader
│   │   └── char-sheet/* components
│   ├── CharacterCreationWizard.jsx → hooks/useWizard* → steps-config.js, services/* validation
│   │   └── character-creation/* components
│   ├── Map.jsx (grid) / HexMap.jsx (outdoor) → services/hexMapUtils, lineOfSight, travelService
│   ├── Initiative.jsx → services/encounterToInitiative
│   ├── Encounter Builder → services/encounterGenerator, lootGenerator
│   ├── NPCs, Factions, Quests, Notes → respective services + use*Management hooks
│   ├── MapsManager, CampaignLog
│   └── components/common/* (shared primitives for all views)
│
Express Server
├── routes/: 13 modules → utils/changeData.js (SSE), utils/imageUtils.js, utils/encounterUtils.js
└── File I/O: public/campaigns/<name>/ and public/data/*.json
```

---

## Key Architectural Decisions (ADR Summary)

| ADR | Decision | Rationale |
|---|---|---|
| **No routing library** | String-based `activeView` state drives navigation | Simpler; no URL-based routing needed for a single-campaign tool |
| **File-based persistence** | JSON files on disk, no database | Simple deployment, human-editable data, no DB infrastructure |
| **Dual-ruleset support** | Parallel modules (`*5e.js` / `*2024.js`) + factory selector | Full backward compatibility with 5e (2014); supports new 2024 edition |
| **SSE for real-time sync** | Server-Sent Events (one-way server→client), not WebSockets | Simpler protocol sufficient for append-only and polling-based updates; no bidirectional requirement |
| **Client-side stat computation** | `rulesFactory.js` computes derived player state in the browser | No server-round-trip needed; rules data already loaded client-side as JSON |
| **Colocated CSS** | Each component has its own CSS file, global `index.css` for variables and themes | Per-component ownership without CSS-in-JS overhead |
| **localStorage + server sync for characters** | Character sheets cached in localStorage with fire-and-forget HTTP sync | Immediate responsiveness; survives server restarts; eventual consistency is acceptable |
| **Default exports only** | All components use `export default` | Consistent convention across the codebase |

---

## Known Constraints and Assumptions

1. **No database** — Data files are on disk accessible to the Node.js process. Multi-instance deployment requires shared storage (NAS, network mount).
2. **Single-user primary** — SSE enables multi-client sync within a single server instance, but there is no distributed locking or conflict resolution beyond last-write-wins on file I/O.
3. **No URL routing** — Bookmarking or deep-linking into specific views is not possible; browser back/forward does not navigate between views.
4. **Rules computation is client-side only** — Server has no knowledge of D&D rules. All stat calculations happen in the browser via `rulesFactory.js`.
5. **No SSR** — Pure SPA; initial page load requires JavaScript execution.
6. **SSE keep-alive** required by reverse proxies (60s interval on `/health`) to prevent connection drops.

---

## Recommended Future Improvements

1. **URL-based routing** — Adopt React Router or similar for bookmarkable views, back/forward navigation, and shareable links.
2. **Database migration** — Replace file-based storage with SQLite or similar embedded database for concurrent access safety and query performance.
3. **Conflict resolution** — Add timestamp/version-based optimistic concurrency for server-side writes to prevent data loss in multi-client scenarios.
4. **Code splitting** — Vite config does not configure explicit lazy loading; route-level code splitting would reduce initial bundle size.
5. **TypeScript migration** — Current codebase is all JavaScript/JSX (per coding standards); adding TS would improve maintainability as the codebase grows (267 source files, 139 tests).
6. **i18n support** — Currently hardcoded English strings; could be extracted for multi-language support.

---

## File Statistics

| Category | Count |
|---|---|
| Source files (JS/JSX/CSS) | 267 |
| Test files | 139 |
| Hooks (non-test) | 22 |
| Service modules (non-test) | 48 |
| Server route modules | 13 |
| Server utility modules | 3 |
| Component directories | 12 |
