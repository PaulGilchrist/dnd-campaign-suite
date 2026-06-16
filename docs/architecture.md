# Architecture Document — D&D Character Sheet (CharSheets)

**Generated:** 2026-06-16

## High-Level Overview

CharSheets is a full-stack React 19 + Express application for managing Dungeons & Dragons character sheets, combat encounters, hex maps, and campaign data. It supports both the 5e and 2024 (Essentials) rulesets simultaneously within a single campaign. The app uses file-based persistence (no database) and Server-Sent Events (SSE) for real-time multi-client synchronization.

**Key characteristics:**
- **No database** — all data stored as JSON files under `public/campaigns/`
- **Dual ruleset** — 5e and 2024 rules coexist; each character declares its ruleset (`'5e'` or `'2024'`)
- **Real-time sync** — SSE broadcasts changes to all connected clients
- **GM/Player duality** — `isLocalhost` flag controls access to GM-only features (encounter builder, map editing, quest/faction/NPC management)
- **Offline-capable** — runtime state persisted to `localStorage` with server reconciliation
- **Automation-driven combat** — features declare structured automation data; the engine collects and dispatches handlers at runtime rather than using hardcoded rule logic

---

## Technology Layer

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, JSX (no TypeScript) |
| Backend | Express 5 (port 80, configurable via `PORT` env var) |
| Styling | CSS co-located per component, CSS custom properties for dark/light theming |
| Icons | Font Awesome 7 (global CSS import in `main.jsx`) |
| Utilities | Lodash (`cloneDeep`, `merge`, `uniqBy`) |
| Markdown | `marked` + `DOMPurify` for safe rendering |
| Maps | SVG-based rendering (indoor grid + outdoor hex) |
| Testing | Vitest 4 + jsdom + @testing-library/react |
| Linting | ESLint (zero warnings enforced; `vi` is a global) |
| Build | Vite production build to `dist/`, served by Express |

---

## Module-by-Module Breakdown

### 1. Entry Points

| File | Role |
|---|---|
| `index.html` | SPA shell; mounts React at `#root`, supports PWA |
| `src/main.jsx` | DOM mount via `ReactDOM.createRoot`; imports global CSS + Font Awesome |
| `src/App.jsx` | Root orchestrator: campaign selection, view routing, SSE handling, computed stats, runtime state seeding |
| `server.js` | Express bootstrap: CORS, JSON parsing, static file serving, route mounting, change-data loading, keep-alive |
| `vite.config.js` | Vite config: proxies `/api`, `/subscribe`, `/spell-overlay` to Express:80; custom asset naming (no hash on images) |

### 2. Routing — Client

Defined in `src/routes/config.js`. Uses a simple `activeView` string state variable (no React Router). 13 views total:

| View | Type | Description |
|---|---|---|
| `charSheet` | string | Main character sheet |
| `initiative` | string | Combat initiative tracker |
| `mapsManager` | string | Map listing/management |
| `map` | string | Indoor or outdoor map (dispatched by map type) |
| `encounter` | string | Encounter builder |
| `notes` | string | Campaign notes |
| `quests` | string | Quest tracker (GM-only) |
| `npcs` | string | NPC management (GM-only) |
| `settlements` | string | Settlement management (GM-only) |
| `factions` | string | Faction tracker (GM-only) |
| `campaignLog` | string | Campaign log |
| `campaignSelection` | boolean overlay | Campaign picker |
| `characterWizard` | boolean overlay | Character creation/edit wizard |

Sidebar buttons defined in `SIDEBAR_BUTTONS` provide navigation. GM-only buttons are hidden for non-localhost clients.

### 3. Routing — Server

All API routes are mounted under `/api/campaigns/:campaign`. Route order matters: specific resource routes must be mounted before wildcard routes.

| Route File | Endpoints | Purpose |
|---|---|---|
| `sse.js` | `GET /subscribe`, `GET /health`, `GET /*` | SSE connections, health check, SPA fallback |
| `maps.js` | `GET/POST /maps`, `GET/PUT/DELETE /maps/:name`, `PUT /maps/:name/rename|activate|description` | Map CRUD + activation |
| `encounters.js` | `GET/POST /encounters`, `GET/PUT/DELETE /encounters/:name`, `PUT ../rename` | Encounter CRUD |
| `notes.js` | `GET/POST /notes`, `GET/DELETE /notes/:id` | Notes CRUD (private notes filtered by localhost) |
| `npcs.js` | `GET/POST /npcs`, `GET/PUT/DELETE /npcs/:name` | NPC CRUD + images |
| `quests.js` | `GET/POST /quests`, `GET/DELETE /quests/:id` | Quest CRUD (GM-only, 403 for remote) |
| `factions.js` | `GET/POST /factions`, `GET/DELETE /factions/:id` | Faction CRUD |
| `settlements.js` | `GET/POST /settlements`, `GET/PUT/DELETE /settlements/:name` | Settlement CRUD |
| `campaigns-basic.js` | `GET /`, `GET /:campaign` | List campaigns, list character files |
| `campaigns-character.js` | `GET/POST/PUT/DELETE /:campaign/:file` | Character CRUD + image upload |
| `campaigns-changedata.js` | `GET/POST/DELETE /:campaign/:key` | Runtime state key-value store (**must be after character route**) |
| `campaigns-admin.js` | `POST /`, `PUT /:campaign`, `DELETE /:campaign` | Create, rename, delete campaigns |
| `campaigns-positioning.js` | `GET/POST /:campaign/positioning` | Map positioning data |
| `log.js` | `GET/POST /log` | Campaign log (last 500 entries) |
| `spell-overlay.js` | `POST /spell-overlay` | Transient spell overlay broadcast (no disk persistence) |

**Critical route ordering:** `campaigns-changedata.js` must be mounted after `campaigns-character.js` because the wildcard `/:file` route would otherwise capture `.json` change-data paths. Similarly, `logRoutes` must be before the SSE wildcard catch-all.

### 4. Dual-Ruleset Architecture

Each character has a `rules` field (`'5e'` or `'2024'`). This is the single dispatch point for all ruleset branching. A single campaign can contain characters from both rulesets.

**Factory:** `src/services/rules/rulesFactory.js` — selects the correct race/class rules modules per character. `getPlayerStats()` is the master entry point that builds the full `PlayerStats` object (the single source of truth for character state).

**Core engine:** `src/services/rules/rules.js` — shared logic with `is2024()` branching. Orchestrates ability, HP, AC, attack, spell, proficiency, and action calculations.

**Computation modules** (each has 5e + 2024 variant):

| Module | 5e | 2024 |
|---|---|---|
| Ability/HP | `core/abilityCalc.js` | `core/abilityCalc2024.js` |
| Attacks | `core/attackCalc.js` | `core/attackCalc2024.js` |
| Spells | `core/spellCalc.js` | `core/spellCalc2024.js` |
| Class rules | `classRules.js` | `classRules2024.js` |
| Race rules | `race-rules/5e.js` | `race-rules/2024.js` |
| Proficiencies | `proficiencyUtils.js` | `proficiencyUtils2024.js` |

**Key differences in 2024:** No racial ASI, no fighting style bonuses to attack rolls, all spells always-prepared, `major` instead of `subclass`, `hit_point_die` field, `saving_throw_proficiencies` array, weapon mastery, focus points (ki), energy dice.

**Data paths:** 5e data in `public/data/` (22 JSON files), 2024 data in `public/data/2024/` (7 JSON files). Shared data (equipment, monsters, magic items, conditions, etc.) only in `public/data/`. `src/services/ui/dataLoader.js` `getDataPath()` handles routing.

### 5. Runtime State Management

`src/hooks/runtime/useRuntimeState.js` provides an in-memory Map synced to `localStorage` for mutable character state (HP, spell slots, conditions, inspiration, etc.).

**Key functions:**
- `getRuntimeValue(characterKey, propertyName)` — synchronous read
- `setRuntimeValue(characterKey, propertyName, value, campaignName)` — set + POST to server
- `setRuntimeObject(characterKey, fullObject, campaignName, skipSync)` — merge full object; `skipSync=true` prevents re-POST (critical for SSE echoes)
- `seedTrackedResources(characterKey, trackedEntries)` — initial seeding from computed stats (no server POST)
- `useRuntimeValue(characterKey, propertyName, campaignName)` — React hook for reactive subscriptions

**Persistence:** Every mutation writes to both in-memory Map and `localStorage`. Server change data is fetched on campaign load and merged on top via `applyServerOverride()`. The server-side store (`server/utils/changeData.js`) holds data in memory with 1-minute debounced disk writes to `character-change-data.json`.

**TrackedResources:** `src/services/rules/trackedResources.js` defines all runtime-trackable resources (HP, spell slots levels 1-9, sorcery points, ki/focus points, channel divinity charges, bardic inspiration uses, wild shape uses, action surge uses, rage points, lay on hands, superiority dice, psionic energy, arcane recovery, warlock pact magic, and more). `computeTrackedResources()` derives max values from `PlayerStats`, while the runtime store holds current values.

### 6. SSE (Server-Sent Events)

- **Subscribe:** `GET /subscribe?campaign=<name>` — establishes SSE connection, sends snapshot of existing change data
- **Broadcast:** Every server mutation calls `publish(key, data)` via `changeData.js`, which filters subscribers by campaign name extracted from the key prefix
- **Event key format:** `<type>-<campaign>-<resource>` (e.g., `change-campaignName-characterName-hp`, `map-data-campaignName-mapName`, `character-create-campaignName-filename`)
- **Anti-loop pattern:** Client uses `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data to avoid re-POSTing
- **SSE equality guard:** `useSSEEqualityGuard` wraps setState setters with deep equality checks to prevent unnecessary re-renders

### 7. Component Architecture

~80+ React components organized by feature domain, each with co-located CSS:

| Directory | Components | Purpose |
|---|---|---|
| `char-sheet/` | 20+ | Character sheet: abilities, actions, spells, inventory, summary, feats, conditions, hit points, rest buttons, metamagic, dice roll results |
| `character-creation/` | 18 | Multi-step wizard: ruleset, basic info, race/class, abilities, skills, languages, feats, spells, magic items, inventory, special traits |
| `map/` | 30+ | Indoor tactical map: SVG rendering, wall/room painting, item placement (20+ SVG furniture), fog of war, spell overlays, ruler, player tokens, context menus |
| `hex-map/` | 18 | Outdoor hex map: terrain painting, rivers, roads, POIs (10 SVG), party travel, weather, marching order, random events |
| `encounter/` | 8 | Encounter builder: monster table, filters, XP budget, difficulty, loot generation, monster stat cards |
| `initiative/` | 8 | Combat tracker: creature carousel, HP bars, conditions, concentration, NPC avatars, condition/effect badges |
| `sidebar/` | 2 | Navigation sidebar + dice roller tray |
| `campaign-selection/` | 1 | Campaign picker |
| `maps-manager/` | 3 | Map listing, dungeon/terrain generation modals |
| `notes/` | 1 | Campaign notes with markdown preview |
| `quests/` | 1 | Quest tracker |
| `npcs/` | 4 | NPC management: list, form, stat block, roleplay details |
| `settlements/` | 1 | Settlement management |
| `factions/` | 1 | Faction tracker |
| `log/` | 1 | Campaign log viewer |
| `common/` | 12 | Shared: popup, subscriber, avatar, markdown preview, save/death/concentration prompts, monster autocomplete, hidden input, preview toggle, warning list |

**Largest components:** `Map.jsx` (639 lines), `HexMap.jsx` (571 lines), `CharSheet.jsx` (504 lines), `CharacterCreationWizard.jsx`, `EncounterBuilder.jsx`.

### 8. Service Layer

~70+ service modules organized by responsibility:

| Category | Key Services |
|---|---|
| **Rules engine** | `rules.js` (core dispatcher), `rulesFactory.js` (per-character dispatch), `classRules.js`, `classRules2024.js`, `race-rules/{5e,2024}.js` |
| **Calculations** | `core/abilityCalc.js`, `core/attackCalc.js`, `core/spellCalc.js` (each with 2024 variant), `greatWeaponFighting.js`, `savageAttacker.js` |
| **Automation** | `automation/index.js` (243-entry handler registry), `automation/handlers/` (organized by domain: buffs, spells, reactions, healing, resources, class-specific), `automation/contextBuilder.js` (attack context with map integration), `automation/automationService.js`, `buffService.js`, `featBuffService.js` |
| **Combat** | `combat/automationService.js`, `combat/conditions/conditionEffects.js` (755 lines, ~80 effect fields), `combat/concentration/`, `combat/auras/` (aura of protection, combo effects, wolf/lion/duplicity/corona auras), `combat/buffs/`, `baseCombatActions.js`, `deathSaveRules.js`, `exhaustionRules.js`, `coverService.js`, `aoeService.js`, `rangeValidation.js` |
| **Effects** | `effects/expirations.js` (938 lines, combat-round-aware expiration), `effects/restRules.js`, `effects/tranceRules.js` |
| **Features** | 74 per-feature services in `features/` (sleep, invisibility, wild surge, prayer of healing, etc.) |
| **Spells** | `spells/spellValidation.js`, `spells/spellLimits.js`, `spells/metamagicRules.js`, `spells/spellCastService.js`, `spells/postCastRiderService.js` |
| **Data** | `ui/dataLoader.js` (dual cache: per-ruleset + shared), `ui/storage.js` (API-first, localStorage fallback), `ui/sanitize.js` (DOMPurify + marked), `ui/logService.js` |
| **Campaign** | `campaign/campaignService.js`, `campaign/mapsService.js`, `campaign/encountersService.js`, `campaign/factionsService.js`, `campaign/notesService.js`, `campaign/questsService.js`, `campaign/settlementsService.js`, `campaign/travelService.js`, `campaign/randomEventService.js`, `campaign/weatherService.js` |
| **Maps** | `maps/mapsService.js`, `maps/dungeonGenerator.js` (BSP tree + MST corridors), `maps/hexMapUtils.js` (axial hex math + A*), `maps/hexTerrainGenerator.js` (fractal noise), `maps/lineOfSight.js` (Bresenham), `maps/mapRoomUtils.js` |
| **NPCs** | `npcs/npcsService.js`, `npcs/npcGenerator.js` (procedural stat block generation by CR), `npcs/npcCombatService.js`, `npcs/npcFormUtils.js`, `npcs/monsterUtils.js` |
| **Encounters** | `encounters/encounterGenerator.js` (XP thresholds, difficulty), `encounters/encounterToInitiative.js`, `encounters/combatData.js`, `encounters/initiativeService.js`, `encounters/npcStatBlockUtils.js`, `encounters/combatLoggingService.js`, `encounters/outdoorEncounterGenerator.js` |
| **Generation** | `dungeonGenerator.js`, `hexTerrainGenerator.js`, `lootGenerator.js` (treasure tiers), `npcGenerator.js`, `settlementGenerator.js`, `randomEventService.js`, `weatherService.js` |
| **Resources** | `trackedResources.js`, `spellCastService.js`, `spellLimits.js`, `savePromptService.js` |
| **Validation** | `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `rangeValidation.js`, `languagesFightingstylesValidation.js` |
| **Shared** | `shared/abilityLookup.js`, `shared/buffApplier.js`, `shared/featFinder.js`, `shared/hpModifier.js`, `shared/logPoster.js`, `shared/nameUtils.js`, `shared/popupResponse.js`, `shared/saveDc.js`, `shared/spell-utils.js` |
| **Dice** | `dice/diceRoller.js` (d20, NdS, expressions, advantage/disadvantage, doubled, maximized) |

### 9. Hooks Layer

~30+ custom hooks for state management and logic separation:

| Category | Hooks |
|---|---|
| **Runtime** | `useRuntimeState.js` (in-memory + localStorage store), `useTrackedResource.js` (single resource binding), `useAppData.js` (reference data loading), `useLog.js` (campaign log + SSE), `useSSEEqualityGuard.js` (re-render prevention) |
| **Management** | `useCampaignManagement.js`, `useCharacterManagement.js`, `useNPCsManagement.js`, `useQuestsManagement.js`, `useEncounterManagement.js`, `useFactionsManagement.js`, `useSettlementsManagement.js`, `useNotesManagement.js`, `useTravelManagement.js` |
| **Combat** | `useDiceRoll.js`, `usePopup.js`, `useActionPopup.js`, `useMetamagic.js`, `useSpellUpcastFlow.js`, `useSpellMetamagicFlow.js`, `useLoggedDiceRoll.js` (2054 lines, full dice roll pipeline), `useActionSpellMetamagic.js` |
| **Wizard** | `useCharacterWizard.js`, `useWizardForm.js`, `useWizardData.js`, `useWizardAbilities.js`, `useWizardConfig.js`, `useWizardNavigation.js`, `useWizardSkills.js`, `useWizardFeats.js`, `useWizardLanguages.js`, `useWizardSpells.js`, `useWizardResistances.js`, `useWizardRaceBuffs.js`, `useWizardFeatBuffs.js`, `useWizardBackgroundAbility.js`, `useWizardArrayToggle.js` |
| **UI** | `useEquipmentSearch.js`, `useMonstersData.js` |
| **Map** | 18 hooks in `src/components/map/hooks/` (SSE sync, drawing, dragging, zoom/pan, fog of war, spell overlays, NPC image cache) |

### 10. Configuration

| File | Purpose |
|---|---|
| `src/config/constants.js` | Required fields, default form data, ability score costs |
| `src/config/steps-config.js` | Wizard step definitions |
| `src/config/ui-config.js` | UI configuration |
| `src/config/encounterConfig.js` | Encounter difficulty thresholds |
| `src/config/outdoorConfig.js` | Outdoor encounter/terrain config |
| `src/config/utils.js` | Config utility functions |
| `src/routes/config.js` | View and sidebar button definitions |

### 11. Models

| Model | Purpose |
|---|---|
| `src/models/SpellOverlay.js` | Spell overlay geometry (sphere, cylinder, cube, cone, line) with SVG origin calculation and hit testing |

### 12. Schema Validation

All schemas are JSON Schema Draft-07, stored in `public/campaigns/`:

| Schema | Validates |
|---|---|
| `character.schema.json` | Character data (name, level, alignment, race, class, abilities, inventory, skills, languages, spells, resistances, feats, special actions, rules, positioning, xp) |
| `encounters.schema.json` | Saved encounters (monsters, quantities, difficulty, rules version) |
| `npcs.schema.json` | NPC entries (stat blocks, appearance, personality, actions, traits) |
| `quests.schema.json` | Quest entries (id, name, status, description, rewards) |
| `factions.schema.json` | Faction entries (id, name, description, goals, influence) |
| `notes.schema.json` | Campaign notes (id, description, isPrivate, timestamps) |
| `settlements.schema.json` | Settlement entries (name, size, description, government, services, rumors) |
| `maps-indoor.schema.json` | Indoor grid maps (walls, placed items, players, fog, rooms) |
| `maps-outdoor.schema.json` | Outdoor hex maps (terrain, rivers, POIs, weather, party position) |

---

## Data Flow Summary

```
[JSON Data Files] → dataLoader.js (dual cache) → useAppData.js → App.jsx
                                                         ↓
[Character JSON]  → campaignService.js → App.jsx → rulesFactory.getPlayerStats()
                                                         ↓
                                               PlayerStats (computedStats)
                                                         ↓
                                               computeTrackedResources()
                                                         ↓
                                               seedTrackedResources()
                                                         ↓
                                               useRuntimeState (in-memory + localStorage)
                                                         ↓
                                               ┌─────────┴──────────┐
                                               ↓                    ↓
                                         POST to server      SSE broadcast
                                         /api/campaigns/     /subscribe
                                         :campaign/:key      ?campaign=name
                                               ↓                    ↓
                                         changeData.js         Client receives
                                         (debounced save)      skipSync=true
```

1. **Startup:** `useAppData` fetches all reference JSON data (classes, races, spells, equipment, magic items, monsters) for both rulesets in parallel via `dataLoader.js`
2. **Character load:** `App.jsx` calls `rulesFactory.getPlayerStats()` for each character, which delegates to `rules.js` — the core engine that orchestrates class rules, race rules, ability/attack/spell calculations, feat buffs, and automation collection
3. **Runtime state:** `PlayerStats._trackedResources` seeds the runtime state store via `seedTrackedResources()`. Server change data is fetched and merged on top via `applyServerOverride()`
4. **Mutations:** Components call `setRuntimeValue`/`setRuntimeObject` → writes to in-memory store + localStorage + POSTs to server → server broadcasts via SSE → other clients apply with `skipSync=true`
5. **Persistence:** Server holds change data in memory, debounce-saves to disk every 1 minute. Character files, maps, encounters, notes, etc. are written directly to disk. Spell overlays are in-memory only (transient broadcast)

---

## Dependency Graph (Textual)

```
main.jsx
  └─ App.jsx
       ├─ useAppData → dataLoader (dual cache: 5e/2024 + shared)
       ├─ useCharacterManagement → campaignService
       ├─ useCampaignManagement → campaignService
       ├─ useCharacterWizard → [15 wizard hooks]
       ├─ rulesFactory → rules + classRules/classRules2024 + race-rules
       │    └─ rules → abilityCalc/2024 + attackCalc/2024 + spellCalc/2024
       │              + proficiencyUtils/2024 + classRules/2024 + race-rules
       │              + featBuffService + automationService + dataLoader
       │              + collectAutomationFromFeatures (feature categories)
       ├─ useRuntimeState (standalone, browser APIs only)
       ├─ setRuntimeObject / seedTrackedResources
       └─ [View Components]
            ├─ CharSheet → rulesFactory + useRuntimeState + [8 sub-components]
            ├─ Initiative → useSSEEqualityGuard + CreatureCard + ConditionPicker
            ├─ Map → useSSESync + useFogOfWar + usePlacedItems + useSpellOverlay + [20+ SVGs]
            ├─ HexMap → useHexMapSSESync + useTravelManagement + [10 SVGs]
            ├─ EncounterBuilder → useEncounterManagement + useMonstersData
            ├─ MapsManager → mapsService
            ├─ CharacterCreationWizard → [15 wizard hooks] + [13 step components]
            └─ [Other views] → respective service modules

server.js
  ├─ server/utils/changeData.js (in-memory store, debounced save, SSE publish)
  ├─ server/utils/encounterUtils.js (encounter file I/O)
  ├─ server/utils/imageUtils.js (base64 upload, image cleanup)
  └─ server/routes/
       ├─ sse.js (SSE connections, health check, SPA fallback)
       ├─ campaigns-basic.js (filesystem reads)
       ├─ campaigns-admin.js (filesystem writes)
       ├─ campaigns-character.js (character CRUD + imageUtils)
       ├─ campaigns-changedata.js (key-value store + changeData)
       ├─ campaigns-positioning.js (positioning + changeData)
       ├─ maps.js (map CRUD + changeData)
       ├─ encounters.js (encounter CRUD)
       ├─ notes.js (notes CRUD)
       ├─ npcs.js (NPC CRUD + imageUtils)
       ├─ quests.js (quest CRUD)
       ├─ factions.js (faction CRUD)
       ├─ settlements.js (settlement CRUD)
       ├─ log.js (log CRUD)
       └─ spell-overlay.js (transient broadcast)
```

---

## Key Architectural Decisions (ADR-Style)

| # | Decision | Rationale |
|---|---|---|
| 1 | **File-based persistence** | No database to manage; simple deployment; data is human-readable JSON; easy version control |
| 2 | **Dual ruleset via runtime dispatch** | Both 5e and 2024 characters coexist in one campaign; `rules` field on character selects modules at call time |
| 3 | **SSE over WebSockets** | Simpler unidirectional broadcast model; server pushes changes, client doesn't need to send over same channel |
| 4 | **`skipSync` anti-loop pattern** | SSE echoes would cause infinite re-POST loops without a guard; `skipSync=true` marks data already known to server |
| 5 | **`isLocalhost` for GM authorization** | Simple hostname check avoids auth complexity; app is designed for local/trusted network use |
| 6 | **No React Router** | Simple `activeView` string state is sufficient for the app's ~13 views; avoids router dependency |
| 7 | **CSS co-location** | Each component has a sibling CSS file; theming via CSS custom properties on `data-theme` attribute; zero inline styles |
| 8 | **Custom hook decomposition** | Complex components delegate to many small hooks (e.g., 15 wizard hooks) for separation of concerns |
| 9 | **SVG-based maps** | Both indoor (grid) and outdoor (hex) maps use SVG with viewBox zoom/pan for resolution-independent rendering |
| 10 | **Computed stats as single source of truth** | `rulesFactory.getPlayerStats()` produces `PlayerStats`; components never derive character state independently |
| 11 | **Debounced server persistence** | Change data saved every 1 minute (not per-keystroke) to reduce disk I/O during active play |
| 12 | **JavaScript, not TypeScript** | Project convention; faster iteration; no type system overhead |
| 13 | **Automation handler registry** | ~243 handlers mapped by action type replace hardcoded rule logic; new features only need to declare automation metadata in data |
| 14 | **API-first with localStorage fallback** | Every service tries REST API first, falls back to localStorage; supports multi-client sync while allowing offline/local development |
| 15 | **Per-feature service extraction** | 74 files in `features/` extract complex named feature behavior into isolated modules (Sleep, Invisibility, Wild Magic Surge, etc.) |

---

## Known Constraints and Assumptions

- **No authentication** — GM features gated by `localhost` check only; not suitable for untrusted networks
- **Single-server** — no horizontal scaling; in-memory change data and SSE subscribers are per-process
- **File system as database** — concurrent writes from multiple server instances would cause data loss
- **No offline mode** — requires server connection for campaign data; `localStorage` only caches runtime state
- **Route mount order matters** — `campaigns-changedata.js` must be mounted after `campaigns-character.js` to prevent `.json` file routes from being captured by the `:key` wildcard
- **ESLint zero warnings** — build fails on any ESLint warning; `vi` is a global (Vitest)
- **React 19** — uses `jsx-runtime` (no `React` import needed in JSX files)
- **5MB JSON body limit** — for base64 image upload support in character creation
- **No incremental builds** — Vite always does full production build to `dist/`
- **Name-based identity** — characters and NPCs use names as unique identifiers throughout; GUIDs are reserved only for sub-objects (conditions, concentration, log entries)
- **GM features are localhost-only** — encounter builder, map editing, quest/faction/NPC management are automatically enabled when the app runs on localhost; players connecting over the network get a read-only view
- **Dual ruleset data coexistence** — 5e and 2024 JSON rule data files are stored separately; shared data (equipment, monsters, magic items, conditions) is only in the shared `/data/` directory
- **CORS wide open** — `Access-Control-Allow-Origin: *`; the API is designed to be consumed from any origin

---

## Recommended Future Improvements

1. **Component size reduction** — Split monolithic files (`useLoggedDiceRoll.js` at 2054 lines, `conditionEffects.js` at 755 lines, `expirations.js` at 938 lines) into smaller, more testable units
