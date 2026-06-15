# Architecture Document — D&D Character Sheet (CharSheets)

**Generated:** 2026-06-06

## High-Level Overview

CharSheets is a full-stack React 19 + Express application for managing Dungeons & Dragons 5th Edition character sheets, combat encounters, and campaign data. It supports both the 5e and 2024 rulesets simultaneously within a single campaign. The app uses file-based persistence (no database) and Server-Sent Events (SSE) for real-time multi-client synchronization.

**Key characteristics:**
- **No database** — all data stored as JSON files under `public/campaigns/`
- **Dual ruleset** — 5e and 2024 rules coexist; each character declares its ruleset
- **Real-time sync** — SSE broadcasts changes to all connected clients
- **GM/Player duality** — `isLocalhost` flag controls access to GM-only features
- **Offline-capable** — runtime state persisted to `localStorage` with server reconciliation

---

## Technology Layer

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, JSX (no TypeScript) |
| Backend | Express.js (port 80) |
| Styling | CSS co-located per component, CSS custom properties for theming |
| Icons | Font Awesome 6 (global CSS import) |
| Utilities | Lodash (`cloneDeep`, `merge`, `uniqBy`) |
| Markdown | `marked` + `DOMPurify` for safe rendering |
| Maps | SVG-based rendering (indoor grid + outdoor hex) |
| Testing | Vitest + jsdom + @testing-library/react |
| Linting | ESLint (zero warnings enforced) |
| Build | Vite production build to `dist/`, served by Express |

---

## Module-by-Module Breakdown

### 1. Entry Points

| File | Role |
|---|---|
| `index.html` | SPA shell; mounts React at `#root`, title "CharSheets" |
| `src/main.jsx` | DOM mount; imports global CSS + Font Awesome |
| `src/App.jsx` | Root orchestrator: campaign selection, view routing, SSE handling, computed stats, runtime state seeding |
| `server.js` | Express bootstrap: CORS, JSON parsing, static file serving, route mounting, change-data loading, keep-alive |

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

Sidebar buttons defined in `SIDEBAR_BUTTONS` provide navigation. GM-only buttons (Encounters, Factions, NPCs, Settlements, Quests) are hidden for non-localhost clients.

### 3. Routing — Server

All API routes are mounted under `/api/campaigns/:campaign`. Route order matters: specific resource routes must be mounted before wildcard routes.

| Route File | Endpoints | Purpose |
|---|---|---|
| `campaigns-basic.js` | `GET /`, `GET /:campaign` | List campaigns, list character files |
| `campaigns-admin.js| `POST /`, `PUT /:campaign`, `DELETE /:campaign` | Create, rename, delete campaigns |
| `campaigns-character.js` | `GET/POST/PUT/DELETE /:campaign/:file` | Character CRUD + image upload |
| `campaigns-changedata.js` | `GET/POST/DELETE /:campaign/:key` | Runtime state key-value store |
| `campaigns-positioning.js` | `GET/POST /:campaign/positioning` | Map positioning data |
| `maps.js` | `GET/POST /maps`, `GET/PUT/DELETE /maps/:name`, `PUT /maps/:name/rename|activate|description` | Map CRUD + activation |
| `encounters.js` | `GET/POST /encounters`, `GET/PUT/DELETE /encounters/:name`, `PUT ../rename` | Encounter CRUD |
| `notes.js` | `GET/POST /notes`, `GET/DELETE /notes/:id` | Notes CRUD (private notes filtered by localhost) |
| `npcs.js` | `GET/POST /npcs`, `GET/PUT/DELETE /npcs/:name` | NPC CRUD + images |
| `quests.js` | `GET/POST /quests`, `GET/DELETE /quests/:id` | Quest CRUD (GM-only) |
| `factions.js` | `GET/POST /factions`, `GET/DELETE /factions/:id` | Faction CRUD |
| `settlements.js` | `GET/POST /settlements`, `GET/PUT/DELETE /settlements/:name` | Settlement CRUD |
| `log.js` | `GET/POST /log` | Campaign log (last 500 entries) |
| `spell-overlay.js` | `POST /spell-overlay` | Transient spell overlay broadcast |
| `sse.js` | `GET /subscribe?campaign=<name>` | SSE connection + snapshot + health check |

### 4. Dual-Ruleset Architecture

Each character has a `rules` field (`'5e'` or `'2024'`). This is the single dispatch point for all ruleset branching.

**Factory:** `src/services/rulesFactory.js` — facade that selects the correct rule modules per character. `getPlayerStats()` is the master entry point that builds the full `PlayerStats` object.

**Core engine:** `src/services/rules.js` — shared logic with `is2024()` branching. Orchestrates ability, HP, AC, attack, spell, proficiency, and action calculations.

**Computation modules** (each has 5e + 2024 variant):

| Module | 5e | 2024 |
|---|---|---|
| Ability/HP | `abilityCalc.js` | `abilityCalc2024.js` |
| Attacks | `attackCalc.js` | `attackCalc2024.js` |
| Spells | `spellCalc.js` | `spellCalc2024.js` |
| Class rules | `classRules.js` | `classRules2024.js` |
| Race rules | `race-rules/5e.js` | `race-rules/2024.js` |
| Proficiencies | `proficiencyUtils.js` | `proficiencyUtils2024.js` |
| Feature categories | `featureCategories.js` (unified) | `featureCategories.js` (unified) |

**Key differences in 2024:** No racial ASI, no fighting style bonuses to attack rolls, all spells always-prepared, `major` instead of `subclass`, `hit_point_die` field, `saving_throw_proficiencies` array, weapon mastery, focus points (ki), energy dice.

**Data paths:** 5e data in `public/data/` (22 JSON files), 2024 data in `public/data/2024/` (7 JSON files). Shared data (equipment, monsters, magic items, etc.) only in `public/data/`. `dataLoader.js` `getDataPath()` handles routing.

### 5. Runtime State Management

`src/hooks/useRuntimeState.js` provides an in-memory Map synced to `localStorage` for mutable character state (HP, spell slots, conditions, inspiration, etc.).

**Key functions:**
- `getRuntimeValue(characterKey, propertyName)` — synchronous read
- `setRuntimeValue(characterKey, propertyName, value, campaignName)` — set + POST to server
- `setRuntimeObject(characterKey, fullObject, campaignName, skipSync)` — merge full object; `skipSync=true` prevents re-POST (critical for SSE echoes)
- `seedTrackedResources(characterKey, trackedEntries)` — initial seeding from computed stats (no server POST)
- `useRuntimeValue(characterKey, propertyName, campaignName)` — React hook for reactive subscriptions

**Persistence:** Every mutation writes to both in-memory Map and `localStorage`. Server change data is fetched on campaign load and merged on top via `applyServerOverride`. The server-side store (`server/utils/changeData.js`) holds data in memory with 1-minute debounced disk writes to `character-change-data.json`.

### 6. SSE (Server-Sent Events)

- **Subscribe:** `GET /subscribe?campaign=<name>` — establishes SSE connection, sends snapshot of existing change data
- **Broadcast:** Every server mutation calls `publish(key, data)` which filters subscribers by campaign name extracted from the key prefix
- **Event key format:** `<type>-<campaign>-<resource>` (e.g., `change-campaignName-characterName-hp`, `map-data-campaignName-mapName`, `character-create-campaignName-filename`)
- **Anti-loop pattern:** Client uses `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data to avoid re-POSTing

### 7. Component Architecture

~80+ React components organized by feature domain:

| Directory | Components | Purpose |
|---|---|---|
| `char-sheet/` | 20+ | Character sheet: abilities, actions, spells, inventory, summary, feats, conditions, hit points, rest buttons, metamagic |
| `character-creation/` | 18 | Multi-step wizard: ruleset, basic info, race/class, abilities, skills, languages, feats, spells, magic items, inventory, special |
| `map/` | 30+ | Indoor tactical map: SVG rendering, wall/room painting, item placement, fog of war, spell overlays, ruler, 20+ SVG furniture/object definitions |
| `hex-map/` | 18 | Outdoor hex map: terrain painting, rivers, roads, POIs, party travel, weather, marching order, 10 SVG POI definitions |
| `encounter/` | 8 | Encounter builder: monster table, filters, XP budget, difficulty, loot generation |
| `initiative/` | 1 | Combat tracker: creature carousel, HP, conditions, concentration, dice rolling |
| `sidebar/` | 2 | Navigation sidebar + dice tray |
| `campaign-selection/` | 1 | Campaign picker |
| `maps-manager/` | 4 | Map listing, dungeon/terrain generation modals |
| `notes/` | 1 | Campaign notes with markdown |
| `quests/` | 1 | Quest tracker |
| `npcs/` | 1 | NPC management |
| `settlements/` | 1 | Settlement management |
| `factions/` | 1 | Faction tracker |
| `log/` | 1 | Campaign log viewer |
| `common/` | 12 | Shared: popup, avatar, markdown preview, save/death/concentration prompts, monster autocomplete, hidden input, preview toggle, warning list |

### 8. Service Layer

~70+ service modules organized by responsibility:

| Category | Services |
|---|---|
| **Rules engine** | `rules.js`, `rulesFactory.js`, `classRules.js`, `classRules2024.js`, `race-rules/{5e,2024,index}.js` |
| **Calculations** | `abilityCalc.js`, `abilityCalc2024.js`, `attackCalc.js`, `attackCalc2024.js`, `spellCalc.js`, `spellCalc2024.js` |
| **Automation** | `automation/index.js` (dispatcher), `automation/handlers/` (13 handlers), `automation/common/` (6 shared utilities), `automationService.js`, `buffService.js`, `featBuffService.js` |
| **Combat** | `baseCombatActions.js`, `combatData.js`, `applyDamage.js`, `applyHealing.js`, `damageUtils.js`, `deathSaveRules.js`, `exhaustionRules.js`, `restRules.js`, `concentrationRules.js`, `conditionEffects.js`, `conditionUtils.js`, `coverService.js`, `lineOfSight.js`, `aoeService.js` |
| **Data** | `dataLoader.js`, `storage.js`, `sanitize.js`, `syncStoreValue.js` |
| **Campaign** | `campaignService.js`, `mapsService.js`, `encountersService.js`, `encounterGenerator.js`, `encounterToInitiative.js`, `factionsService.js`, `notesService.js`, `npcsService.js`, `questsService.js`, `settlementsService.js`, `logService.js`, `travelService.js` |
| **Generation** | `dungeonGenerator.js`, `hexTerrainGenerator.js`, `lootGenerator.js`, `npcGenerator.js`, `outdoorEncounterGenerator.js`, `settlementGenerator.js`, `randomEventService.js`, `weatherService.js` |
| **Resources** | `trackedResources.js`, `spellCastService.js`, `spellLimits.js`, `spellValidation.js`, `savePromptService.js`, `expirations.js` |
| **Validation** | `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `rangeValidation.js`, `languagesFightingstylesValidation.js` |
| **Shared** | `shared/abilityLookup.js`, `shared/buffApplier.js`, `shared/featFinder.js`, `shared/hpModifier.js`, `shared/logPoster.js`, `shared/nameUtils.js`, `shared/popupResponse.js`, `shared/saveDc.js`, `shared/spell-utils.js` |
| **Other** | `diceRoller.js`, `proficiencyUtils.js`, `proficiencyUtils2024.js`, `fightingStyles.js`, `classFeatures.js`, `featureCategorizationUtils.js`, `featRangeService.js`, `metamagicRules.js`, `auraOfProtection.js`, `auraComboEffects.js`, `monsterUtils.js`, `npcStatBlockUtils.js`, `hexMapUtils.js`, `utils.js` |

### 9. Hooks Layer

~30 custom hooks for state management and logic separation:

| Hook | Purpose |
|---|---|
| `useRuntimeState.js` | In-memory + localStorage runtime state store |
| `useAppData.js` | Fetches all reference data at startup (both rulesets) |
| `useCharacterManagement.js` | Character CRUD operations |
| `useCampaignManagement.js` | Campaign CRUD operations |
| `useCharacterWizard.js` | Character wizard state orchestration |
| `useEncounterManagement.js` | Encounter save/load modal state |
| `useMonstersData.js` | Monster data loading |
| `useDiceRoll.js` | Dice rolling UI state |
| `useLoggedDiceRoll.js` | Dice rolling + log integration |
| `useTrackedResource.js` | Single tracked resource binding |
| `useSSEEqualityGuard.js` | SSE re-render loop prevention |
| `usePopup.js` / `useActionPopup.js` | Popup management |
| `useLog.js` | Campaign log access |
| `useNotesManagement.js` | Notes state |
| `useNPCsManagement.js` | NPCs state |
| `useQuestsManagement.js` | Quests state |
| `useFactionsManagement.js` | Factions state |
| `useSettlementsManagement.js` | Settlements state |
| `useEquipmentSearch.js` | Equipment search/filter |
| `useMetamagic.js` | Metamagic state |
| `useSpellMetamagicFlow.js` | Spell + metamagic flow |
| `useSpellUpcastFlow.js` | Spell upcast flow |
| `useTravelManagement.js` | Hex map travel mechanics |
| Wizard hooks (12) | `useWizardForm`, `useWizardData`, `useWizardNavigation`, `useWizardSkills`, `useWizardLanguages`, `useWizardResistances`, `useWizardFeats`, `useWizardFeatBuffs`, `useWizardSpells`, `useWizardAbilities`, `useWizardArrayToggle`, `useWizardConfig`, `useWizardRaceBuffs` |

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

---

## Data Flow Summary

```
[JSON Data Files] → dataLoader.js → useAppData.js → App.jsx
                                                        ↓
[Character JSON]  → campaignService.js → App.jsx → rulesFactory.getPlayerStats()
                                                        ↓
                                              PlayerStats (computedStats)
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
                                        changeData.js       Client receives
                                        (debounced save)    skipSync=true
```

1. **Startup:** `useAppData` fetches all reference JSON data (classes, races, spells, equipment) for both rulesets in parallel via `dataLoader.js`
2. **Character load:** `App.jsx` calls `rulesFactory.getPlayerStats()` for each character, which delegates to `rules.js` — the core engine that orchestrates class rules, race rules, ability/attack/spell calculations
3. **Runtime state:** `PlayerStats._trackedResources` seeds the runtime state store via `seedTrackedResources()`. Server change data is fetched and merged on top
4. **Mutations:** Components call `setRuntimeValue`/`setRuntimeObject` → writes to in-memory store + localStorage + POSTs to server → server broadcasts via SSE → other clients apply with `skipSync=true`
5. **Persistence:** Server holds change data in memory, debounce-saves to disk every 1 minute. Character files, maps, encounters, notes, etc. are written directly to disk

---

## Dependency Graph (Textual)

```
main.jsx
  └─ App.jsx
       ├─ useAppData → dataLoader
       ├─ useCharacterManagement → campaignService
       ├─ useCampaignManagement → campaignService
       ├─ useCharacterWizard → [12 wizard hooks]
       ├─ rulesFactory → rules + classRules + classRules2024 + race-rules
       │    └─ rules → abilityCalc + abilityCalc2024 + attackCalc + attackCalc2024
       │              + spellCalc + spellCalc2024 + proficiencyUtils + proficiencyUtils2024
       │              + classRules + classRules2024 + race-rules + featBuffService
       │              + automationService + dataLoader
       ├─ useRuntimeState (standalone, browser APIs only)
       ├─ setRuntimeObject / seedTrackedResources
       └─ [View Components]
            ├─ CharSheet → rulesFactory + useRuntimeState + [8 sub-components]
            ├─ Initiative → useSSEEqualityGuard + MonsterCardModal + DiceRollResult
            ├─ Map → useSSESync + useFogOfWar + usePlacedItems + useSpellOverlay + [20+ SVGs]
            ├─ HexMap → useHexMapSSESync + useTravelManagement + [10 SVGs]
            ├─ EncounterBuilder → useEncounterManagement + useMonstersData
            ├─ MapsManager → mapsService
            ├─ CharacterCreationWizard → [12 wizard hooks] + [11 step components]
            └─ [Other views] → respective service modules

server.js
  ├─ server/utils/changeData.js (in-memory store, debounced save, SSE publish)
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
| 1 | **File-based persistence** | No database to manage; simple deployment; data is human-readable JSON |
| 2 | **Dual ruleset via runtime dispatch** | Both 5e and 2024 characters coexist in one campaign; `rules` field on character selects modules at call time |
| 3 | **SSE over WebSockets** | Simpler unidirectional broadcast model; server pushes changes, client doesn't need to send over same channel |
| 4 | **`skipSync` anti-loop pattern** | SSE echoes would cause infinite re-POST loops without a guard; `skipSync=true` marks data already known to server |
| 5 | **`isLocalhost` for GM authorization** | Simple IP-based check avoids auth complexity; app is designed for local/trusted network use |
| 6 | **No React Router** | Simple `activeView` string state is sufficient for the app's view count; avoids router dependency |
| 7 | **CSS co-location** | Each component has a sibling CSS file; theming via CSS custom properties on `data-theme` attribute |
| 8 | **Custom hook decomposition** | Complex components delegate to many small hooks (e.g., 12+ wizard hooks) for separation of concerns |
| 9 | **SVG-based maps** | Both indoor (grid) and outdoor (hex) maps use SVG with viewBox zoom/pan for resolution-independent rendering |
| 10 | **Computed stats as single source of truth** | `rulesFactory.getPlayerStats()` produces `PlayerStats` attached as `computedStats`; components never derive character state independently |
| 11 | **Debounced server persistence** | Change data saved every 1 minute (not per-keystroke) to reduce disk I/O during active play |
| 12 | **JavaScript, not TypeScript** | Project convention; faster iteration; no type system overhead |

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
