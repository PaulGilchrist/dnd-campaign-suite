# D&D Campaign Suite — Architecture Document

**Generated:** 2026-08-06

---

## 1. High-Level Overview

**D&D Campaign Suite** (codename "CharSheets") is a full-stack React 19 + Express 5 application for managing Dungeons & Dragons characters, campaigns, and combat. It functions as a digital character sheet, a real-time party-syncing tool, and a full GM toolkit — all served from a single Express process on port 80.

The application supports both D&D 5e and 2024 Essentials rulebooks simultaneously, with each character tagged to their preferred ruleset. No database is used; all persistence is JSON files on disk with an in-memory cache layer.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, JavaScript (JSX), CSS |
| Backend | Express 5, Node.js |
| Real-time | Server-Sent Events (SSE) |
| Testing | Vitest (jsdom), @testing-library/react, supertest |
| Linting | ESLint 9 (flat config) with custom plugins |
| Icons | Font Awesome Free (CSS) |
| Data | JSON files on disk (`public/data/`, `public/campaigns/`) |
| Build | Vite → `dist/` (static bundle served by Express) |

### Key Capabilities

- **Character management:** 7-step character creation wizard, live-updating digital sheets, import/export JSON
- **Real-time party sync:** Multiple players connect to one server and see the same data via SSE — no accounts or databases
- **Dual ruleset support:** 5e and 2024 Essentials coexist, even mixed within one campaign
- **Combat engine:** Initiative tracker, 200+ automation handlers, event-chain combat pipeline (20+ steps for attacks), multi-target spell targeting, 4-level cover system, metamagic engine, aura systems
- **Map tools:** Indoor grid maps with fog of war and spell overlays, outdoor hex maps with procedural terrain, dungeon generation (BSP algorithm), ruler tool
- **Campaign management:** Quest tracking, faction management (influence scale), NPC management with stat blocks, settlement generation, procedural encounter/loot builders, campaign notes with markdown, activity log

---

## 2. Directory Structure

```
dnd-campaign-suite/
├── server/                          # Express backend (17 route files + utils)
│   ├── routes/                      # API route handlers
│   │   ├── sse.js                   # SSE endpoint (/subscribe), health check, SPA fallback
│   │   ├── campaigns-admin.js       # Campaign CRUD (create, rename, delete, snapshots)
│   │   ├── campaigns-basic.js       # Campaign listing, character file listing
│   │   ├── campaigns-character.js   # Character CRUD, image upload/delete
│   │   ├── campaigns-changedata.js  # In-memory change data store (generic key-value)
│   │   ├── encounters.js            # Encounter CRUD
│   │   ├── factions.js              # Faction CRUD (via jsonEntityCrud factory)
│   │   ├── log.js                   # Campaign activity log
│   │   ├── maps.js                  # Battle map CRUD
│   │   ├── notes.js                 # Note CRUD (localhost-restricted)
│   │   ├── npcs.js                  # NPC CRUD with image support
│   │   ├── pipeline-events.js       # Pipeline milestone event broadcasting
│   │   ├── quests.js                # Quest CRUD (localhost-restricted)
│   │   ├── settlements.js           # Settlement CRUD
│   │   └── spell-overlay.js         # Transient spell effect overlays (in-memory)
│   └── utils/                       # Shared server utilities
│       ├── asyncHandler.js          # Async error wrapper for Express
│       ├── campaignPaths.js         # Path resolution helpers
│       ├── changeData.js            # In-memory persistence (change data, overlays, SSE)
│       ├── encounterUtils.js        # Encounter file I/O
│       ├── imageUtils.js            # Base64 image upload/delete
│       └── jsonEntityCrud.js        # Factory for standard CRUD routers
│
├── src/                             # React frontend (~450 files)
│   ├── main.jsx                     # React entry point (renders <App />)
│   ├── App.jsx                      # Central orchestrator (599 lines)
│   ├── index.css                    # Global stylesheet (CSS custom properties, themes)
│   │
│   ├── hooks/                       # Custom React hooks (95 files)
│   │   ├── runtime/                 # Core state management (useSyncedState, useRuntimeValue)
│   │   ├── management/              # Lifecycle hooks (campaign, character, encounter)
│   │   ├── wizard/                  # Character creation wizard (15 hooks)
│   │   ├── combat/                  # Combat-specific hooks (34 hooks)
│   │   └── ui/                      # Reusable UI utilities
│   │
│   ├── services/                    # Business logic (~350 files, 17 subdirectories)
│   │   ├── rules/                   # D&D rules engine (108 files)
│   │   ├── combat/                  # Combat pipeline, conditions, automation (160 files)
│   │   ├── automation/              # Handler registry (200+ handlers)
│   │   ├── character/               # Class/race rules per ruleset
│   │   ├── campaign/                # Campaign services (travel, events, weather)
│   │   ├── encounters/              # Encounter generation, initiative
│   │   ├── items/                   # Loot/treasure generation
│   │   ├── maps/                    # Dungeon/hex map generation, line of sight
│   │   ├── npcs/                    # NPC generation, combat integration
│   │   ├── shared/                  # Cross-cutting utilities (12 files)
│   │   └── ui/                      # Data loading, storage, logging (8 files)
│   │
│   ├── components/                  # React components (17 folders)
│   │   ├── campaign-selection/      # Campaign picker overlay
│   │   ├── char-sheet/              # Character sheet (100+ files, largest component)
│   │   ├── character-creation/      # Character creation wizard UI
│   │   ├── common/                  # Shared components (badges, modals, inputs)
│   │   ├── encounter/               # Encounter builder UI
│   │   ├── initiative/              # Initiative tracker
│   │   ├── map/                     # D&D battle map editor
│   │   ├── maps-manager/            # Map generation and management
│   │   ├── hex-map/                 # Hex-based world map with travel system
│   │   ├── log/                     # Campaign log viewer
│   │   ├── factions/                # Faction management
│   │   ├── quests/                  # Quest management
│   │   ├── notes/                   # Campaign notes
│   │   ├── npcs/                    # NPC management
│   │   ├── settlements/             # Settlement management
│   │   └── sidebar/                 # Navigation sidebar + dice tray
│   │
│   ├── routes/                      # Client-side view configuration
│   │   └── config.js               # VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS
│   │
│   └── test/                        # Test setup
│       ├── setup.js                 # Vitest globals, auto-Cleanup
│       ├── appTestState.js          # Shared test state
│       ├── mock-css.js              # CSS import mock
│       └── mockComponents.jsx       # Component mocks
│
├── public/                          # Static assets + runtime data
│   ├── data/                        # 5e rule data (24 JSON files)
│   ├── data/2024/                   # 2024 Essentials rule data (8 JSON files)
│   └── campaigns/                   # Runtime campaign data
│       ├── Frostfall/               # Test campaign (6 characters)
│       ├── Testing G1/              # Test campaign (4 characters, maps, data)
│       ├── Testing G2/              # Test campaign (4 characters, maps, data)
│       ├── Testing G3/              # Test campaign (4 characters, maps, data)
│       └── .snapshots/              # Campaign backup snapshots
│
├── eslint-plugin-custom/            # Custom ESLint rules (no-window-access, etc.)
├── server.js                        # Express entry point (123 lines)
├── index.html                       # Vite HTML entry
├── vite.config.js                   # Vite config + dev proxy
├── vitest.config.js                 # Vitest config (jsdom, v8 coverage)
├── eslint.config.js                 # ESLint flat config with custom plugins
├── package.json                     # Project manifest (ES modules)
└── docs/                            # Documentation
    ├── architecture.md              # This file
    ├── project-stats.md             # Repository statistics
    └── users-guide.md               # User guide
```

---

## 3. Module-by-Module Breakdown

### 3.1 Server (`server/`)

The Express server provides two concerns: **API endpoints** and **static file serving**.

**Route Architecture:** All routes are mounted under `/api/` (except `/subscribe` and `/spell-overlay`). Route mount order is critical — specific resource routes (maps, encounters, factions, etc.) are mounted before wildcard `:campaign` routes to prevent path collisions. The `campaigns-changedata` route must be mounted after `campaigns-character` so that `.json` character file routes are not captured by the `:key` wildcard.

**Change Data Store** (`server/utils/changeData.js`): The server maintains four in-memory Maps:
- `characterChangeData` — Per-campaign key-value pairs (HP, spell slots, conditions, etc.)
- `spellOverlayData` — Per-campaign transient spell effect data
- `activeMaps` — Per-campaign active map keys
- `subscribers` — SSE client connections

Changes are debounced (2 seconds) before disk persistence. On process exit, data is saved immediately. `keepAlive()` runs a 60-second health check.

**CRUD Factory** (`server/utils/jsonEntityCrud.js`): `createJsonEntityRouter(entityName, options)` generates standard CRUD routes for any entity stored in `public/campaigns/:campaign/data/:entityName.json`. Supports custom `idField`, `transformList` (filter), `authorizeRead` (access control), and `onDelete` (cleanup). Used by factions, notes, quests, and settlements.

**SSE** (`server/routes/sse.js`): The `/subscribe` endpoint manages SSE connections. Initial snapshot of change data and spell overlays is sent; all subsequent changes are broadcast to every connected client.

### 3.2 Core Rules Engine (`src/services/rules/`)

The rules engine is the **single source of truth** for all character computations. It implements both 5e and 2024 rulesets in parallel.

**`rulesFactory.js`**: Thin dispatch layer that selects race/class rules per ruleset, computes immunities/resistances (including passive automation resistances), and generates `_trackedResources` for runtime state seeding. Master method: `getPlayerStats()` — constructs the full computed stats object.

**`rules.js`** (~1200 lines): The master rules dispatcher. Determines which ruleset applies per character, delegates to ruleset-specific modules, and assembles the `PlayerStats` object. Key exports: `getAbilities()`, `getHitPoints()`, `getAttacks()`, `getSpellAbilities()`, `getArmorClass()`, `getLanguages()`, `getActions()`, `getPlayerStats()`.

**Core Calculations** (`src/services/rules/core/`):
- `abilityCalc.js` / `abilityCalc2024.js` — Ability scores, modifiers, save bonuses, skill bonuses (Expertise)
- `attackCalc.js` / `attackCalc2024.js` — Weapon attacks, spell attacks, monk unarmed strikes
- `spellCalc.js` / `spellCalc2024.js` — Spell abilities, to-hit, save DC, spells known/prepared
- `carryingCapacity.js`, `greatWeaponFighting.js`, `savageAttacker.js`, `starryFormDamage.js`

**Combat Rules** (`src/services/rules/combat/`):
- `applyDamage.js` (~606 lines) — Core damage pipeline: resistance/immunity, save-based reduction, temp HP absorption, death saves, concentration breaks, feature-based damage reduction (Warding Bond, Thought Shield, Heavy Armor Master, etc.)
- `applyHealing.js` — HP recovery with revival from 0 HP
- `coverService.js` — Map-based cover via Bresenham line-of-sight (full, 3/4, 1/2 cover)
- `aoeService.js` — Area of effect hit detection and NPC/Player save handling
- `rangeCheck.js` / `rangeValidation.js` — Grid distance computation, range tier effects (Distant metamagic, melee disadvantage)
- `damageUtils.js` — Damage type extraction, resistance notices, combat context lookups

**Effects System** (`src/services/rules/effects/`):
- `expirations.js` (~1000+ lines) — Master turn-start effects and expiration system. Processes Heroic Inspiration, condition removal, Superior Defense, Elder Champion regeneration, Wild Magic Surge expiration, Inner Radiance, and 30+ effect types.
- `restRules.js` (~1200 lines) — Short/long rest processing: HP restoration, resource resets, exhaustion reduction, class-specific resets (30+ short rest resources, 100+ long rest resources)
- `durationParser.js` — Duration string parsing (`"2_rounds"` → 2, `"1_minute_rounds"` → 0)
- `tranceRules.js` — Elf/Deep Gnome trance detection

**Per-Feature Services** (`src/services/rules/features/`): 56 service files, each implementing automation for a specific spell or class feature. Each exports `trigger<FeatureName>()` functions called from `spellCastService.js` and/or the automation handler registry.

**Spell Casting** (`src/services/rules/spells/`):
- `spellCastService.js` (~1200 lines) — Master spell casting orchestrator. Handles silence blocking, Arcane Ward triggers, Hunter's Mark, save-based damage, attack rolls, AoE modals, post-cast riders, Wild Magic Surge, Empowered Evocation, and 50+ spell-specific handlers.
- `metamagicRules.js` — 8 metamagic effects (Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, Twinned)
- `spellPreparationService.js` — Concentration management, spell slot consumption, free cast handling
- `spellValidation.js` — Character creation spell validation
- `spellLimits.js` — Spell limit computation and validation
- `postCastRiderService.js` — Post-cast riders (Beguiling Magic, Soulstitch, Spell Thief)
- `postCastHealService.js` — Post-cast self/ally heals
- `empoweredSpellService.js` — Empowered Spell metamagic dice reroll
- `materialComponents.js` — Consumed material component tracking (38 spells)

### 3.3 Combat Services (`src/services/combat/`)

**Action Pipeline** (`src/services/combat/actionPipeline.js`): An event-chain architecture where each step is `{ name, subscribe, emit, condition, handler }`. Steps subscribe to an event, run their handler, and emit a new event. The pipeline chains steps by matching `emit` → `subscribe`. Observers are decoupled handlers for logging and SSE broadcasting. The pipeline supports pausing via modals and resuming.

**Pipeline Types** (`src/services/combat/steps/index.js`):
- **Weapon attack pipeline** — 20+ steps: housekeeping → battle master maneuvers → cunning strike → bardic inspiration → roll base damage → build context → sneak attack → two-weapon fighting → target effects → superiority die bonuses → automation bonuses → weapon hit bonuses → natural 20 bonuses → celestial revelation → feature riders → damage type modifiers → overchannel → proceed to damage → stalkers' flurry → cleave → tactical mastery → topple → pipeline complete
- **Spell pipeline** — 6 steps: spell housekeeping → spell context → roll damage → feature riders → overchannel → proceed to damage
- **Generic damage pipeline** — 3 steps: housekeeping → roll damage → proceed

**Feature Modules** (`src/services/combat/steps/features/`): 20 feature modules (assassinate, charger, colossus slayer, crusher, eldritch strikes, hunter's mark, piercer, sacred weapon, savage attacker, shield bash, slasher, stalker's flurry, tavern brawler, etc.). Each follows: `condition(ctx)` → boolean, `handler(ctx)` → `{ data, modal?, sideEffects? }`.

**Automation System** (`src/services/combat/automation/`):
- `automationCollector.js` — Core collector. Iterates all features' automation entries, normalizes via `buildAttackInfo()`, categorizes into actions, bonusActions, reactions, specialActions, passives, autoEffects, saveModifiers. 100+ case branches.
- `automationInfoBuilder.js` + 27 sub-files — Dispatch table converting feature metadata into standardized automation info objects (80+ types)
- `automationPassives.js` — 15+ passive query functions (hasGreatWeaponFighting, hasTruesight, collectWeaponMastery, etc.)
- `automationModifiers.js` — Save modifier collection (conditional advantage, auto-reroll, bardic inspiration, potent cantrip, etc.)
- `automationExpressions.js` — Expression resolution engine for damage formulas
- `automationService.js` — Coordination between collector, modifiers, and immunities
- `automationImmunities.js` — Condition and damage immunity collection with runtime checks

**Condition System** (`src/services/combat/conditions/`):
- `conditionEffects.js` — Maps each D&D condition to attack/save/ability check modifiers. 14 standard conditions + additional effects.
- `targetEffectDefinitions.js` — Registry of ~70 target effects organized into groups (Attack, Defensive, Saves, Spells)
- `conditionSaveService.js` — Save resolution with aura bonuses and passive immunity
- `deathSaveRules.js` / `exhaustionRules.js` — Death saves and exhaustion tracking
- `savePromptService.js` — Save prompt management
- `concentration/` — Concentration save resolution (DC = 8 + half spell level + CON modifier)

**Auras** (`src/services/combat/auras/`): ~15 aura utility files: Aura of Protection, Aura of Courage, Bardic Inspiration state, Corona, Duplicity, Elder Champion, Lion, Wolf, Unbreakable Majesty.

**Summons** (`src/services/combat/summons/summonedCreatureService.js`): Spell-summoned creature lifecycle management.

### 3.4 Automation Handlers (`src/services/automation/`)

Master handler registry with 200+ individual handler functions. `executeHandler(action, playerStats, campaignName, mapName, characters)` dispatches to the correct handler by `action.automation.type`. Handlers are organized by category: buffs, class-*, combat, feats, healing, reactions, resources, spells.

### 3.5 Character Services (`src/services/character/`)

Parallel implementations for 5e and 2024 rulesets:
- `classRules.js` / `classRules2024.js` — Class-specific rules (Druid wild shape, Rogue sneak attack, subclass features)
- `classFeatures.js` — Ruleset-agnostic dispatcher
- `race-rules/5e.js` / `race-rules/2024.js` — Race abilities, immunities, resistances, senses, traits
- `featBuffService.js` — Feat buff computation and application
- `proficiencyUtils.js` / `proficiencyUtils2024.js` — Proficiency calculation
- `featureCategories.js` — Feature categorization definitions (5e: 14 features to ignore; 2024: 35 features to ignore)
- `featRangeService.js`, `featValidation.js`, `resistancesValidation.js`, etc.

### 3.6 Campaign Services (`src/services/campaign/`)

- `campaignService.js` — Campaign and character CRUD via API
- `travelService.js` — Hex-based travel with terrain move costs, three travel paces, exhaustion penalties, road bonuses, A* pathfinding
- `randomEventService.js` — Terrain-specific random event tables (combat, discovery, hazard, NPC, weather, navigation)
- `weatherService.js` — Biome-based weather generation with visibility/movement modifiers
- `settlementGenerator.js` — Randomized settlement generation (name, size, culture, description, features, NPCs, rumors)
- `factionsService.js` / `questsService.js` / `notesService.js` — Entity CRUD services

### 3.7 Encounter Services (`src/services/encounters/`)

- `combatData.js` — In-memory combat summary cache (Map-based, keyed by campaign)
- `encounterGenerator.js` — XP-based encounter balancing with difficulty classification (Easy/Medium/Hard/Deadly)
- `initiativeService.js` — Initiative management (creature setup, NPC add/remove, rolling, target setting)
- `encountersService.js` — Encounter CRUD via API
- `outdoorEncounterGenerator.js` — Hex-grid feature placement for outdoor exploration
- `npcStatBlockUtils.js` — NPC to monster format conversion
- `combatLoggingService.js` — Structured log entry creation for combat events

### 3.8 Map Services (`src/services/maps/`)

Two parallel systems:

**Dungeon (grid-based):**
- `dungeonGenerator.js` (~1060 lines) — Procedural dungeon: BSP rooms, MST corridors, dead-end caps, doors, furniture, traps, NPCs, stairs
- `bspTree.js` — Binary Space Partitioning for room placement
- `adjacentDungeonGenerator.js` — Alternative layout: balanced, linear, forking, winding
- `lineOfSight.js` — Bresenham-based visibility computation
- `dungeonNamegen.js` — Dungeon name generation

**Hex (outdoor):**
- `hexMapUtils.js` (~432 lines) — Pure hex math (axial coordinates): coordinate conversion, neighbor calculation, distance, SVG path generation, A* pathfinding
- `hexTerrainGenerator.js` — Fractal noise-based terrain generation (Perlin-like elevation/moisture, rivers)

**CRUD:** `mapsService.js` — Map creation, activation, data save/load, renaming

**Loot:** `lootGenerator.js` — Random loot generation based on monster CR (currency, gems, equipment, magic items across 8 tiers)

### 3.9 NPC Services (`src/services/npcs/`)

- `npcsService.js` — NPC CRUD via API
- `npcGenerator.js` — Random NPC generation (name, race, class role, attitude, appearance, personality, goals, secrets, optional stat block)
- `npcCombatService.js` — NPC combat integration (add to initiative)
- `monsterUtils.js` — Monster data lookup from campaign NPCs and global monsters cache
- `npcFormUtils.js` — NPC form utilities and defaults

### 3.10 Shared Services (`src/services/shared/`)

Cross-cutting utilities: `abilityLookup.js`, `buffApplier.js`, `computePassiveSkills.js`, `deduplicateAndSort.js`, `featFinder.js`, `getClassLevelData.js`, `hpModifier.js`, `injectSpecialActions.js`, `nameUtils.js`, `popupResponse.js`, `spell-utils.js`

### 3.11 UI Services (`src/services/ui/`)

- `dataLoader.js` (~540 lines) — Centralized JSON data loading. Dual cache: per-version (`5e`/`2024`) and shared. Loads classes, races, backgrounds, feats, spells, equipment, monsters, magic items, fighting styles, wild magic surges.
- `storage.js` — Server-backed key-value storage with sequential write queue for combatSummary
- `logService.js` — Campaign log operations
- `syncStoreValue.js` — In-memory store with server synchronization
- `sanitize.js` — HTML sanitization via DOMPurify + marked for markdown rendering
- `formatUtils.js` — Formatting utilities (sign, range, spell level)
- `spellSectionUtils.js` — Determines which spells appear in Actions/Bonus Actions/Reactions sections
- `utils.js` — Shared UI utilities (ability name conversion, GUID generation)

### 3.12 Dice Services (`src/services/dice/`)

Core dice rolling engine: d20, arbitrary dice, advantage/disadvantage, formula parsing (`2d6+3`), crit doubling, maximization, healing spell 1s reroll.

### 3.13 Hooks (`src/hooks/`)

**Runtime Layer** (most important):
- `useRuntimeState.js` — In-memory Map store, `setRuntimeValue`, `setRuntimeObject`, SSE sync, listener management
- `useSyncedState.js` — Server-first `useState` replacement. All game state uses this.
- `useRuntimeValue.js` — Read-only variant of useSyncedState
- `useAppData.js` — Loads all static rule data (5e + 2024)
- `useTrackedResource.js` — Spell slots, sorcery points, focus points
- `useSSEEqualityGuard.js` — Prevents SSE re-render loops via deep equality check

**Management Layer:**
- `useCampaignManagement.js` — Campaign lifecycle
- `useCharacterManagement.js` — Character CRUD
- `useEncounterManagement.js` — Encounter CRUD
- `useTravelManagement.js` — Hex-map travel state machine
- `useEntityManagement.js` — Generic entity CRUD factory
- `useCrudList.js` — Lightweight CRUD list with search

**Wizard Layer** (15 hooks):
- `useCharacterWizard.js` — Wizard orchestrator
- `useWizardConfig.js` — Generic wizard step config engine
- `useWizardForm.js`, `useWizardNavigation.js`, `useWizardAbilities.js`, `useWizardSkills.js`, `useWizardSpells.js`, `useWizardFeats.js`, `useWizardLanguages.js`, `useWizardResistances.js`, `useWizardTools.js`, `useWizardData.js`

**Combat Layer** (34 hooks):
- `useDiceRoll.js`, `useLoggedDiceRoll.js`, `useLoggedDiceRollAttack.js`, `useLoggedDiceRollDamage.js`, `useLoggedDiceRollSaves.js` — Combat dice rolling with logging
- `useSpellCastExecutor.js`, `useSpellMetamagicFlow.js`, `useSpellPositionResolver.js`, `useSpellUpcastFlow.js` — Spell casting flows
- `useMetamagic.js`, `useCombatSuperiorityModal.js`, `useActionPopup.js`, `usePopup.js`, `useSharedPopup.js` — Popup/modal management
- `useConfirmableFlow.js`, `useSimpleDamageRoll.js`

### 3.14 Components (`src/components/`)

17 component folders. Main views controlled by `src/routes/config.js`:

| View Key | Component | Description |
|----------|-----------|-------------|
| `CHAR_SHEET` | CharSheet | Main character sheet (100+ files) |
| `INITIATIVE` | Initiative | Initiative tracker |
| `MAPS_MANAGER` | MapsManager | GM map management |
| `MAP` | Map | Active battle map view |
| `ENCOUNTER` | EncounterBuilder | Encounter builder |
| `FACTIONS` | Factions | Faction management |
| `NOTES` | Notes | Campaign notes |
| `QUESTS` | Quests | Quest tracking |
| `NPCS` | NPCs | NPC management |
| `SETTLEMENTS` | Settlements | Settlement management |
| `CAMPAIGN_LOG` | Log | Activity log |
| `CAMPAIGN_REPAIR` | CampaignAdmin | GM admin tools |

Overlay views (boolean toggles): `CAMPAIGN_SELECTION`, `CHARACTER_WIZARD`, `EDIT_CHARACTER_WIZARD`.

---

## 4. Data Flow Summary

### 4.1 Application Startup

```
index.html → main.jsx → App.jsx
    │
    ├── useAppData() loads all static rule data (5e + 2024)
    ├── server.js starts Express on port 80
    ├── changeData.readFile() loads in-memory change data from disk
    ├── keepAlive() starts 60s health check interval
    └── Vite dev proxy: /api, /subscribe, /spell-overlay → http://localhost:80
```

### 4.2 Campaign Selection Flow

```
App.jsx ← useCampaignManagement()
    │
    ├── GET /api/campaigns → list campaigns
    ├── User selects campaign
    ├── GET /api/campaigns/:name → list character files
    ├── For each character: GET /api/campaigns/:name/:file → character JSON
    ├── rulesFactory.getPlayerStats() → PlayerStats for each character
    ├── seedTrackedResources() → populate runtime store
    ├── GET /api/campaigns/:name/:key → apply server overrides
    └── SSE: /subscribe → real-time updates
```

### 4.3 Character Stats Computation Flow

```
characters array changes (or game data changes)
    │
    ├── rulesFactory.getPlayerStats(character)
    │   ├── rules.js → getPlayerStats()
    │   │   ├── ruleset-specific abilityCalc / attackCalc / spellCalc
    │   │   ├── classRules / raceRules → features
    │   │   ├── automationCollector → collect passives, modifiers, effects
    │   │   ├── featBuffService → apply feat buffs
    │   │   └── computeTrackedResources() → _trackedResources
    │   └── rulesFactory → add immunities, resistances, _trackedResources
    │
    └── PlayerStats object ← single source of truth
        └── _trackedResources → seeds runtime store
```

### 4.4 Combat Action Flow

```
Player clicks action button
    │
    ├── App.jsx → view component
    │   ├── useSyncedState reads combat state
    │   └── Combat hook (e.g., useLoggedDiceRoll, useSpellCastExecutor)
    │
    ├── actionPipeline.run()
    │   ├── steps/index → buildPipelineForAction()
    │   │   ├── weapon_attack → buildAttackRollDamageSteps() (20+ steps)
    │   │   ├── spell → buildDirectSpellDamageSteps() (6 steps)
    │   │   └── generic → buildGenericSteps() (3 steps)
    │   │
    │   ├── Pipeline execution:
    │   │   ├── Each step: condition(ctx) → handler(ctx) → emit next event
    │   │   ├── Observers: log to campaign log, broadcast via SSE
    │   │   └── Modals: pause pipeline, resume on user action
    │   │
    │   └── Feature riders → 20 feature modules
    │
    ├── rules/combat/applyDamage.js (final damage application)
    │   ├── computeDamageAfterResistancesWithDetails()
    │   ├── temp HP absorption
    │   ├── resistance/immunity
    │   ├── death save prompts
    │   ├── concentration breaks
    │   └── feature-based damage reduction
    │
    └── storage.js → POST to server → SSE broadcast
```

### 4.5 Spell Casting Flow

```
Player casts spell
    │
    ├── spellCastService.executeSpellCast()
    │   ├── Silence blocking (verbal components)
    │   ├── Friends/Invisibility early-end checks
    │   ├── Arcane Ward triggers
    │   ├── Range computation (Distant metamagic)
    │   ├── Attack rolls or save-based damage
    │   ├── AoE modal popups
    │   ├── Post-cast rider saves
    │   ├── Spell Thief / Wild Magic Surge / Bewitching Magic
    │   └── Generic automation routing
    │
    ├── features/*Service.js → per-spell automation (56 services)
    ├── postCastRiderService.js → post-cast effects
    ├── postCastHealService.js → post-cast healing
    └── empoweredSpellService.js → Empowered Spell reroll
```

### 4.6 Real-Time Sync Flow (SSE)

```
Client A modifies state via useSyncedState()
    │
    ├── setRuntimeValue() → POST /api/campaigns/:name/:key
    │
    ├── changeData.js → markDirty() → debouncedSave() (2s)
    ├── changeData.js → publish() → SSE broadcast
    │
    └── SSE /subscribe → Client B receives event
        │
        ├── handleRuntimeEvent() in App.jsx
        ├── setRuntimeObject(..., skipSync=true) → prevents echo loop
        └── useSyncedState listeners → re-render
```

### 4.7 Persistence Flow

```
State change via useSyncedState()
    │
    ├── In-memory: runtime store (Map per character)
    ├── Server: changeData.js (Map per campaign)
    │
    ├── 2-second debounce → saveFile() → write to disk
    │
    └── On process exit → saveFile() → prevent data loss
```

---

## 5. Dependency Graph (Textual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          index.html / main.jsx                      │
│                              │                                      │
│                              ▼                                      │
│                          App.jsx (599 lines)                        │
│    ┌──────────────┬──────────────┬─────────────────┐                │
│    │ useAppData   │ useCampaign  │ useCharacter     │                │
│    │ (static data │ Management   │ Management       │                │
│    │  loading)    │ (campaign)   │ (characters)     │                │
│    └──────┬───────┴──────┬───────┴────────┬─────────┘                │
│           │              │                │                           │
│           ▼              ▼                ▼                           │
│    ┌────────────┐  ┌───────────┐  ┌──────────────┐                   │
│    │ dataLoader │  │ SSE       │  │ rulesFactory │                   │
│    │ (JSON data)│  │ /subscribe│  │ → rules.js   │                   │
│    └────────────┘  └───────────┘  └──────┬───────┘                   │
│                                           │                          │
│                                           ▼                          │
│                                    ┌──────────────┐                  │
│                                    │ PlayerStats   │                  │
│                                    │ (computed)    │                  │
│                                    └──────┬───────┘                  │
│                                           │                          │
│     ┌─────────────────────────────────────┼─────────────────────┐    │
│     │                                     │                     │    │
│     ▼                                     ▼                     ▼    │
│ ┌─────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │ rules/  │  │ combat/     │  │ automation/  │  │ character/   │   │
│ │ (core)  │  │ (pipeline)  │  │ (handlers)   │  │ (class/race) │   │
│ └────┬────┘  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘   │
│      │               │                │                 │            │
│      ▼               ▼                ▼                 ▼            │
│ ┌─────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │effects/ │  │conditions/  │  │ features/    │  │ campaign/    │   │
│ │(expire) │  │(save/effect)│  │(per-spell)   │  │ (travel,     │   │
│ └─────────┘  └─────────────┘  └──────────────┘  │  weather)     │   │
│                                                  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│ │encounters/   │  │maps/          │  │npcs/          │              │
│ │(init, gen)   │  │(dungeon,hex)  │  │(gen, combat)  │              │
│ └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                               │
│ │items/         │  │shared/ + ui/  │                               │
│ │(loot)         │  │(utilities)    │                               │
│ └──────────────┘  └──────────────┘                               │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │                    Runtime Store (useRuntimeState)              │  │
│ │  in-memory Map ← POST API ← SSE broadcast ← Server changeData │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │                         Express Server                          │  │
│ │  server.js → routes/* → utils/* → JSON files on disk           │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │                    Campaign Data (public/campaigns/)            │  │
│ │  characters/*.json, data/*.json, images/*.png, maps/*.json     │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │                    Static Rule Data (public/data/)              │  │
│ │  5e: 24 JSON files, 2024: 8 JSON files                         │  │
│ └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Architectural Decisions

### ADR-1: Dual Ruleset Architecture (5e + 2024)

**Decision:** Both D&D 5e and 2024 Essentials rulesets coexist in one codebase, selected per-character at runtime via `playerSummary.rules`.

**Rationale:** Players may use either ruleset; the application must support both without requiring separate instances.

**Consequences:** Every rules module has two implementations (e.g., `abilityCalc.js` / `abilityCalc2024.js`). The `rulesFactory` and `rules.js` dispatcher routes to the correct implementation. Data files are split (`public/data/` for 5e, `public/data/2024/` for 2024). Shared data (equipment, monsters) lives only in `public/data/`. This doubles the rules engine surface area but allows seamless coexistence.

### ADR-2: Server-First State Management

**Decision:** All game state flows through the runtime store (`useRuntimeState`) and server API. No localStorage for game data.

**Rationale:** Multiplayer synchronization — all players must see the same state. SSE broadcasts ensure real-time consistency.

**Consequences:** `useSyncedState` replaces `useState` for all shared state. SSE re-render loops are prevented via `skipSync=true` and equality guards. ESLint custom rules enforce this (`no-local-game-state` = ERROR, `require-synced-state` = WARN). localStorage is only used for ephemeral preferences (theme).

### ADR-3: In-Memory Persistence with Debounced Disk Write

**Decision:** No database. All data stored as JSON files on disk, with an in-memory cache layer that debounces writes (2 seconds).

**Rationale:** Simple deployment (single `server.js` process), no database infrastructure needed. The in-memory layer provides low-latency reads/writes.

**Consequences:** Risk of data loss on crash (mitigated by `process.on('exit')` save and 2-second debounce). No concurrent write conflicts (single-process server). Character change data is gitignored per-campaign.

### ADR-4: Event-Chain Combat Pipeline

**Decision:** Combat actions use an event-chain pipeline where steps subscribe to events and emit new events.

**Rationale:** Decouples action steps, enables modular feature riders, supports modal pausing/resumption, and makes the attack/damage flow explicit and testable.

**Consequences:** Each attack type (weapon, spell, generic) has its own pipeline configuration. 20+ steps for weapon attacks, 6 for spells. Feature modules (20) are pluggable riders. Observers handle logging and SSE broadcasting independently.

### ADR-5: Automation via Feature Metadata

**Decision:** Class/race features declare automation metadata (type, trigger, damage expressions) that is collected, categorized, and dispatched at runtime.

**Rationale:** Avoids hardcoding every class feature interaction. The automation collector scans all features, normalizes their automation entries, and routes them through a 200+ handler registry.

**Consequences:** New features can be added by declaring automation metadata in the feature definition. The `automationInfoBuilder` dispatches to 21 handler modules based on type (80+ automation types). Expression resolution replaces named variables (class levels, ability modifiers) with actual values.

### ADR-6: Per-Spell Feature Services

**Decision:** Each spell with special automation (sleep, invisibility, silence, etc.) has its own service file in `src/services/rules/features/`.

**Rationale:** Isolates complex spell-specific logic, making it testable and maintainable. The `spellCastService` delegates to the appropriate service.

**Consequences:** 56 feature service files, each following the `trigger<FeatureName>()` pattern. High file count but keeps each file focused and testable.

### ADR-7: Route Mount Order for Path Safety

**Decision:** Express routes are mounted in a specific order — specific resource routes before wildcard `:campaign/:file` routes.

**Rationale:** Prevents path collisions where a `.json` character file endpoint would be captured by the change-data `:key` wildcard.

**Consequences:** Route order is a deployment concern. The `campaigns-changedata` route must always be mounted after `campaigns-character`. Documented in AGENTS.md.

### ADR-8: Procedural Map Generation

**Decision:** Dungeon maps use BSP tree subdivision for room placement with MST corridor connection. Hex maps use axial coordinate math for outdoor travel.

**Rationale:** Provides GM tools for on-the-fly map generation. BSP produces natural-looking dungeon layouts. Hex math enables travel pathfinding.

**Consequences:** Two separate map systems (grid-based dungeon, axial hex). Dungeon generator is the largest service file (~1060 lines). Line-of-sight uses Bresenham's algorithm for both systems.

---

## 7. Known Constraints and Assumptions

1. **GM features are localhost-only:** Encounter builder, map editing, quest/faction/NPC management are enabled on localhost; network clients get read-only view.

2. **SSE re-render loop prevention:** Always use `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data. The server already has the data; re-POSTing causes loops.

3. **PlayerStats is the single source of truth:** Computed stats from `rulesFactory.getPlayerStats()` must not be bypassed. Don't derive character state from elsewhere.

4. **Route order matters:** Specific routes must be mounted before wildcard routes. Enforced by `server.js` mount order.

5. **Dual ruleset data paths:** 5e data from `/data/`, 2024 data from `/data/2024/`. Shared data (equipment, monsters) is only in `/data/`.

6. **Per-campaign change data is gitignored:** `character-change-data.json`, `campaign-log.json`, and campaign-specific data directories are gitignored.

7. **Combat summary is always present:** There is no "out of combat" state — combat summaries always exist with creature data. Use `getCombatSummary` as the primary source.

8. **Server-first pattern is mandatory:** All game state must go through the runtime store. ESLint rules enforce this.

9. **Single-process server:** No horizontal scaling. The in-memory store and debounced persistence assume a single Node.js process.

10. **5MB JSON body limit:** Image uploads are base64-encoded; Express JSON body parser is configured for 5MB.

11. **2-second debounce for persistence:** Changes are written to disk 2 seconds after the last modification. On process exit, data is saved immediately.

12. **No React Router:** All view switching is done via local `useState` (`activeView`). The `src/routes/config.js` defines all views.

13. **JavaScript, not TypeScript:** All source files are `.js` and `.jsx`. No type annotations.

14. **Font Awesome icons:** Imported globally in `main.jsx`; use `<i className="fa-solid fa-...">` in JSX.

---

## 8. Recommended Future Improvements

1. **Consolidate feature services:** 56 per-spell feature service files could be reduced through a rule-based system (e.g., defining condition effects and save behaviors declaratively rather than with individual service files).

2. **Reduce automation handler count:** 200+ handler functions in `automation/index.js` create a large dispatch table. A more structured registry (e.g., handler classes or modules) would improve maintainability.

3. **Hook consolidation:** 34 combat hooks and 15+ wizard hooks create a large hook surface. Consider grouping related hooks into composite hooks or a hook factory.

4. **Document automation metadata schema:** The feature automation metadata format (type, trigger, damageExpression, etc.) is not formally documented. Adding a schema definition would help developers add new features.

---

*This document was generated automatically from repository analysis on 2026-08-06.*
