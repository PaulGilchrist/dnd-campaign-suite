# D&D Character Sheet — Architecture Document

**Generated:** 2026-07-18

---

## 1. High-Level Overview

**D&D Character Sheet** is a full-stack React + Express application for managing Dungeons & Dragons characters, campaigns, and combat. It supports both the 5e and 2024 Essentials rulebooks simultaneously, with each character tagged to their preferred ruleset.

The application follows a **server-first, SSE-broadcast** architecture: all game state flows through an in-memory store backed by Express API endpoints and Server-Sent Events (SSE) for real-time synchronization across connected clients. There is no database — all persistence is JSON files on disk.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, JavaScript (JSX), CSS |
| Backend | Express 5, Node.js |
| Real-time | Server-Sent Events (SSE) |
| Testing | Vitest (jsdom), @testing-library/react, supertest |
| Linting | ESLint 9 (flat config) |
| Icons | Font Awesome Free (CSS) |
| Data | JSON files on disk (`public/data/`, `public/campaigns/`) |
| Build | Vite → `dist/` (static bundle) |

---

## 2. Directory Structure

```
dnd-char-sheet/
├── server/                          # Express backend
│   ├── routes/                      # API route handlers (17 route files + tests)
│   │   ├── sse.js                   # SSE endpoint (/subscribe), health check, SPA fallback
│   │   ├── campaigns-admin.js       # Campaign CRUD (create, rename, delete)
│   │   ├── campaigns-basic.js       # Campaign listing, character file listing
│   │   ├── campaigns-character.js   # Character CRUD, image upload/delete
│   │   ├── campaigns-changedata.js  # In-memory change data store (generic GET/POST/DELETE by key)
│   │   ├── encounters.js            # Encounter CRUD
│   │   ├── factions.js              # Faction CRUD
│   │   ├── log.js                   # Campaign activity log
│   │   ├── maps.js                  # Battle map CRUD
│   │   ├── notes.js                 # Note CRUD
│   │   ├── npcs.js                  # NPC CRUD with image support
│   │   ├── pipeline-events.js       # Milestone event broadcasting
│   │   ├── quests.js                # Quest CRUD (GM-only)
│   │   ├── settlements.js           # Settlement CRUD
│   │   └── spell-overlay.js         # Transient spell effect overlays (in-memory only)
│   └── utils/                       # Shared server utilities
│       ├── asyncHandler.js          # Async error wrapper for Express
│       ├── campaignPaths.js         # Path resolution helpers
│       ├── changeData.js            # In-memory persistence layer (change data, spell overlays, SSE subscribers)
│       ├── encounterUtils.js        # Encounter file I/O
│       ├── imageUtils.js            # Base64 image upload/delete
│       └── jsonEntityCrud.js        # Factory for standard CRUD routers
│
├── src/                             # React frontend
│   ├── main.jsx                     # React entry point (renders <App />)
│   ├── App.jsx                      # Central orchestrator (563 lines)
│   ├── App.css                      # App shell styles + campaign tool shared styles
│   ├── index.css                    # Global stylesheet (CSS custom properties, dark/light themes)
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── runtime/                 # Core state management
│   │   │   ├── useRuntimeState.js   # In-memory Map store + SSE sync (single most important hook)
│   │   │   ├── useSyncedState.js    # Server-first useState replacement
│   │   │   ├── useAppData.js        # Static rule data loading (5e + 2024)
│   │   │   ├── useTrackedResource.js # Spell slots, sorcery points, focus points
│   │   │   └── useSSEEqualityGuard.js # SSE re-render loop prevention
│   │   ├── management/              # Lifecycle hooks
│   │   │   ├── useCampaignManagement.js   # Campaign select/rename/delete
│   │   │   └── useCharacterManagement.js  # Character CRUD, upload/download
│   │   ├── wizard/                  # Character creation wizard
│   │   │   ├── useCharacterWizard.js      # Wizard orchestrator
│   │   │   ├── useWizardConfig.js         # Generic wizard step config engine
│   │   │   ├── useWizardForm.js           # Form state management
│   │   │   ├── useWizardNavigation.js     # Step navigation with validation
│   │   │   ├── useWizardAbilities.js      # Point-buy validation
│   │   │   ├── useWizardSkills.js         # Skill limits
│   │   │   ├── useWizardSpells.js         # Pre-selected spells
│   │   │   ├── useWizardFeats.js          # Pre-selected feats
│   │   │   ├── useWizardLanguages.js      # Language limits
│   │   │   ├── useWizardResistances.js    # Pre-selected resistances
│   │   │   └── (more wizard hooks)
│   │   ├── combat/                  # Combat-specific hooks (34 files)
│   │   │   └── useDiceRoll.js, useSpellCastExecutor.js, useMetamagic.js, etc.
│   │   └── (misc: useEntityManagement, useCrudList, useAsyncData, etc.)
│   │
│   ├── services/                    # Business logic (10 subdirectories)
│   │   ├── rules/                   # D&D rules engine (108 files)
│   │   ├── character/               # Class/race rules per ruleset
│   │   ├── combat/                  # Combat pipeline, conditions, automation
│   │   ├── automation/              # Handler registry (200+ handlers)
│   │   ├── campaign/                # Campaign services (travel, random events, weather)
│   │   ├── encounters/              # Encounter generation, initiative
│   │   ├── items/                   # Loot/treasure generation
│   │   ├── maps/                    # Dungeon/hex map generation, line of sight
│   │   ├── npcs/                    # NPC generation, combat integration
│   │   ├── shared/                  # Cross-cutting utilities
│   │   └── ui/                      # Data loading, storage, logging
│   │
│   ├── components/                  # React components (348 files, 16 folders)
│   │   ├── campaign-selection/      # Campaign picker overlay
│   │   ├── char-sheet/              # Character sheet (main component, 100+ files)
│   │   │   ├── char-feats/
│   │   │   ├── char-spells/         # Spell display, casting, metamagic
│   │   │   ├── char-summary/        # HP, conditions, gold, death saves
│   │   │   ├── modals/              # Class/race choice modals
│   │   │   └── popups/              # Action popups
│   │   ├── character-creation/      # Character creation wizard UI
│   │   ├── common/                  # Shared components (18 files: DiceRoller, Modal, etc.)
│   │   ├── encounter/               # Encounter builder UI
│   │   ├── initiative/              # Initiative tracker
│   │   ├── map/                     # Map rendering (dungeon, hex, tokens, layers)
│   │   ├── maps-manager/            # Map management UI
│   │   ├── hex-map/                 # Hex map UI (hooks + SVG)
│   │   ├── log/                     # Campaign log display
│   │   ├── factions/, quests/, notes/, npcs/, settlements/ # Campaign tools
│   │   └── sidebar/                 # Navigation sidebar
│   │
│   ├── routes/                      # View configuration
│   │   └── config.js               # VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS
│   │
│   └── test/                        # Test setup
│       ├── setup.js                 # Vitest globals, auto-Cleanup
│       ├── mock-css.js
│       └── mockComponents.jsx
│
├── public/                          # Static assets + runtime data
│   ├── data/                        # Shared/5e rule data (24 JSON files)
│   ├── data/2024/                   # 2024 Essentials rule data (8 JSON files)
│   └── campaigns/                   # Runtime campaign data (characters, maps, logs)
│
├── server.js                        # Express entry point (123 lines)
├── index.html                       # Vite HTML entry
├── vite.config.js                   # Vite config + dev proxy
├── vitest.config.js                 # Vitest config (jsdom, globals)
├── eslint.config.js                 # ESLint flat config
└── package.json                     # Project manifest (ES modules)
```

---

## 3. Module-by-Module Breakdown

### 3.1 Server (`server/`)

The Express server provides two concerns: **API endpoints** and **static file serving**.

**API Architecture:** All routes are mounted under `/api/`. Route mount order is critical — specific resource routes (maps, encounters, factions, etc.) are mounted before wildcard `:campaign` routes to prevent path collisions. The `campaigns-changedata` route must be mounted after `campaigns-character` so that `.json` character file routes are not captured by the `:key` wildcard.

**Change Data Store** (`server/utils/changeData.js`): The server maintains an in-memory Map-based store for:
- `characterChangeData`: Per-campaign key-value pairs (HP, spell slots, conditions, etc.)
- `spellOverlayData`: Per-campaign transient spell effect data
- `activeMaps`: Per-campaign active map keys
- `subscribers`: SSE client connections

Changes are debounced (10 seconds) before disk persistence. On process exit, data is saved immediately.

**SSE** (`server/routes/sse.js`): The `/subscribe` endpoint manages SSE connections. All map state, character changes, spell overlays, and combat events are broadcast via SSE to every connected client.

**CRUD Factory** (`server/utils/jsonEntityCrud.js`): A factory function `createJsonEntityRouter(entityName, options)` generates standard CRUD routes for any entity stored in `public/campaigns/:campaign/data/:entityName.json`. Used by factions, notes, and quests. Supports custom `idField`, `transformList` (filtering), `authorizeRead` (access control), and `onDelete` (cleanup hooks).

### 3.2 Core Rules Engine (`src/services/rules/`)

The rules engine is the **single source of truth** for all character computations. It implements both 5e and 2024 rulesets in parallel.

**`rules.js` (1598 lines):** The master rules dispatcher. Determines which ruleset applies per character, delegates to ruleset-specific modules, and assembles the `PlayerStats` object. Key method: `getPlayerStats()` — constructs the full computed stats object including abilities, HP, AC, attacks, spells, proficiencies, actions, and tracked resources.

**`rulesFactory.js` (245 lines):** Thin wrapper that selects race/class rules per ruleset, computes immunities/resistances (including passive automation resistances), and generates `_trackedResources` for runtime state seeding.

**Core Calculations** (`src/services/rules/core/`):
- `abilityCalc.js` / `abilityCalc2024.js` — Ability scores, bonuses, save modifiers, hit points
- `attackCalc.js` / `attackCalc2024.js` — Weapon attacks, spell attacks, monk unarmed strikes
- `spellCalc.js` / `spellCalc2024.js` — Spell abilities, to-hit, save DC, spells known/prepared

**Combat Rules** (`src/services/rules/combat/`):
- `applyDamage.js` (550 lines) — Core damage application: resistance/immunity, save-based reduction, temp HP absorption, death saves, concentration breaks, feature-based damage reduction (Warding Bond, Thought Shield, etc.)
- `coverService.js` — Map-based cover via Bresenham line-of-sight
- `aoeService.js` — Area of effect hit detection and NPC/Player save handling
- `rangeCheck.js` / `rangeValidation.js` — Grid distance computation, range tier effects

**Effects System** (`src/services/rules/effects/`):
- `expirations.js` (1075+ lines) — Master turn-start effects and expiration system. Processes Heroic Inspiration, condition removal, Superior Defense, Elder Champion regeneration, Wild Magic Surge expiration, and 30+ effect types.
- `restRules.js` (729 lines) — Short/long rest processing: HP restoration, resource resets, exhaustion reduction, class-specific resets
- `durationParser.js` — Duration string parsing (`"2_rounds"` → 2, `"1_minute_rounds"` → 0)

**Per-Feature Services** (`src/services/rules/features/`): ~47 service files, each implementing automation for a specific spell or class feature (sleep, invisibility, silence, slow, fear, healing spells, warding bond, relentless rage, etc.). Each exports `trigger<FeatureName>()` functions that build action objects and call the automation engine.

**Spell Casting** (`src/services/rules/spells/`):
- `spellCastService.js` (1007+ lines) — Master spell casting orchestrator. Handles silence blocking, Arcane Ward triggers, Hunter's Mark, Magic Missile, save-based damage, attack rolls, AoE modals, post-cast riders, Wild Magic Surge, Empowered Evocation, and more.
- `metamagicRules.js` — 8 metamagic effects (Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, Twinned)
- `spellValidation.js` — Character creation spell validation
- `spellLimits.js` — Spell limit computation and validation
- `postCastRiderService.js` — Post-cast rider saves and features (Beguiling Magic, Soulstitch, Spell Thief)

### 3.3 Combat Services (`src/services/combat/`)

**Action Pipeline** (`src/services/combat/actionPipeline.js`): An event-chain architecture where each step is `{ name, subscribe, emit, condition, handler }`. Steps subscribe to an event, run their handler, and emit a new event. The pipeline chains steps by matching `emit` → `subscribe`. Observers are decoupled handlers for logging and SSE broadcasting. The pipeline supports pausing via modals and resuming.

**Pipeline Types** (`src/services/combat/steps/index.js`):
- **Weapon attack pipeline** — 20+ steps: housekeeping → battle master maneuvers → cunning strike → bardic inspiration → roll base damage → build context → sneak attack → two-weapon fighting → target effects → superiority die bonuses → automation bonuses → weapon hit bonuses → natural 20 bonuses → celestial revelation → feature riders → damage type modifiers → overchannel → proceed to damage → stalkers' flurry → cleave → tactical mastery → topple
- **Spell pipeline** — 6 steps: spell housekeeping → spell context → roll damage → feature riders → overchannel → proceed to damage
- **Generic damage pipeline** — For non-weapon, non-spell damage

**Feature Modules** (`src/services/combat/steps/features/`): 19 feature modules (assassinate, charger, colossus slayer, crusher, eldritch strikes, hunter's mark, piercer, sacred weapon, savage attacker, shield bash, slasher, stalker's flurry, tavern brawler, etc.). Each follows the contract: `condition(ctx)` → boolean, `handler(ctx)` → `{ data, modal?, sideEffects? }`.

**Automation System** (`src/services/combat/automation/`):
- `automationCollector.js` (986 lines) — Core collector. Iterates all features' automation entries, normalizes via `buildAttackInfo()`, and categorizes into actions, bonusActions, reactions, specialActions, passives, autoEffects, saveModifiers, primalKnowledge, ritualSpells. 100+ case branches in the switch statement.
- `automationInfoBuilder.js` — Dispatch table with 21 handler modules for different automation types
- `automationPassives.js` — 15+ passive query functions (hasGreatWeaponFighting, hasTruesight, collectWeaponMastery, etc.)
- `automationModifiers.js` — Save modifier collection (conditional advantage, auto-reroll, bardic inspiration, potent cantrip, etc.)
- `automationExpressions.js` — Expression resolution engine for damage formulas (replaces named variables with actual values, evaluates as JS)

**Condition System** (`src/services/combat/conditions/`):
- `conditionEffects.js` (874 lines) — Maps each D&D condition to attack/save/ability check modifiers. 14 standard conditions (blinded, charmed, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, slow)
- `conditionSaveService.js` — Save resolution with aura bonuses and passive immunity
- `deathSaveRules.js` / `exhaustionRules.js` — Death saving throws and exhaustion tracking

**Concentration** (`src/services/combat/concentration/`): Concentration save resolution (DC = 8 + half spell level + CON modifier), break/clear/add concentration management.

**Auras** (`src/services/combat/auras/`): Aura of Protection, Aura of Courage, Aura of Alacrity, Aura of Warding, Bardic Inspiration state, Corona, Duplicity, Elder Champion, Lion, Wolf, Unbreakable Majesty.

### 3.4 Automation Handlers (`src/services/automation/`)

Master handler registry with 200+ individual handler functions. `executeHandler(action, playerStats, campaignName, mapName, characters)` dispatches to the correct handler by `action.automation.type`. Key handlers include:
- `shieldHandler.js` — Shield spell as reaction: toggles buff, adds expiration, retroactively checks if attack would have missed with +5 AC
- `superiorDefenseHandler.js` — Monk Superior Defense: toggles damage resistance to all except Force for 1 minute, costs 3 Focus Points

### 3.5 Character Services (`src/services/character/`)

Parallel implementations for 5e and 2024 rulesets:
- `classRules.js` / `classRules2024.js` — Class-specific rules (Druid wild shape, Rogue sneak attack, subclass features)
- `classFeatures.js` — Ruleset-agnostic dispatcher
- `race-rules/5e.js` / `race-rules/2024.js` — Race abilities, immunities, resistances, senses, traits
- `featBuffService.js` — Feat buff computation and application (regex-based parsing for 5e, structured benefits for 2024)
- `proficiencyUtils.js` / `proficiencyUtils2024.js` — Proficiency calculation
- `featureCategories.js` — Feature categorization definitions (5e: 14 features to ignore; 2024: 35 features to ignore)
- `featureCategorizationUtils.js` — Shared categorization utilities

### 3.6 Campaign Services (`src/services/campaign/`)

- `campaignService.js` — Campaign CRUD via API
- `travelService.js` — Hex-based travel with terrain move costs, three travel paces, exhaustion penalties, road bonuses, A* pathfinding
- `randomEventService.js` — Terrain-specific random event tables (combat, discovery, hazard, NPC, weather, navigation)
- `weatherService.js` — Weather tracking
- `settlementGenerator.js` / `settlementsService.js` — Settlement generation and management
- `factionsService.js` / `questsService.js` / `notesService.js` — Entity services

### 3.7 Encounter Services (`src/services/encounters/`)

- `combatData.js` — In-memory combat summary cache (Map-based, keyed by campaign)
- `encounterGenerator.js` — Encounter difficulty suggestions based on party level and monster pool
- `initiativeService.js` — Initiative management (creature setup, NPC add/remove, rolling, target setting)
- `encountersService.js` — Encounter CRUD via API
- `outdoorEncounterGenerator.js` — Outdoor encounter generation
- `npcStatBlockUtils.js` — NPC to monster format conversion

### 3.8 Map Services (`src/services/maps/`)

Two parallel systems:

**Dungeon (grid-based):**
- `dungeonGenerator.js` (1060 lines) — Procedural dungeon generation: BSP room placement, MST corridor connection, dead-end caps, doors, furniture, traps, NPCs, stairs
- `bspTree.js` — Binary Space Partitioning for room placement
- `lineOfSight.js` — Bresenham-based visibility computation
- `mapRoomUtils.js` — Room utility functions
- `adjacentDungeonGenerator.js` — Adjacent dungeon generation
- `dungeonNamegen.js` — Dungeon name generation

**Hex (outdoor):**
- `hexMapUtils.js` (432 lines) — Pure hex math (axial coordinates): coordinate conversion, neighbor calculation, distance, SVG path generation, A* pathfinding, winding path generation
- `hexTerrainGenerator.js` — Hex terrain generation
- `rng.js` — Seeded PRNG (Mulberry32)

**CRUD:** `mapsService.js` — Map creation, activation, data save/load, renaming

**Loot:** `lootGenerator.js` — Random loot generation based on monster CR (currency, gems, equipment, magic items)

### 3.9 NPC Services (`src/services/npcs/`)

- `npcsService.js` — NPC CRUD via API
- `npcGenerator.js` — Random NPC generation (name, race, class role, attitude, appearance, personality, goals, secrets, stat block)
- `npcCombatService.js` — NPC combat integration (add to initiative)
- `monsterUtils.js` — Monster data lookup from campaign NPCs and global monsters cache
- `npcFormUtils.js` — NPC form utilities

### 3.10 Shared Services (`src/services/shared/`)

Cross-cutting utilities: `buffApplier.js`, `featFinder.js`, `spell-utils.js`, `computePassiveSkills.js`, `deduplicateAndSort.js`, `hpModifier.js`, `injectSpecialActions.js`, `nameUtils.js`, `popupResponse.js`, `saveDc.js`, `abilityLookup.js`, `getClassLevelData.js`

### 3.11 UI Services (`src/services/ui/`)

- `dataLoader.js` (539 lines) — Centralized JSON data loading. Dual cache: per-version (`5e`/`2024`) and shared. Loads classes, races, backgrounds, feats, spells, equipment, monsters, magic items, fighting styles, wild magic surges.
- `storage.js` — Server-backed key-value storage abstraction with sequential write queue for combatSummary
- `logService.js` — Campaign log operations
- `syncStoreValue.js` — In-memory store with server synchronization (older mechanism)
- `utils.js` — Shared UI utilities (ability name conversion, name extraction, GUID generation)
- `sanitize.js` — HTML sanitization
- `formatUtils.js` — Formatting utilities
- `spellSectionUtils.js` — Spell section utilities

### 3.12 Hooks (`src/hooks/`)

**Runtime Layer** (most important):
- `useRuntimeState.js` — In-memory Map store, `setRuntimeValue`, `setRuntimeObject`, SSE sync, listener management
- `useSyncedState.js` — Server-first `useState` replacement. All game state uses this instead of `useState`.
- `useAppData.js` — Loads all static rule data (5e + 2024)
- `useTrackedResource.js` — Spell slots, sorcery points, focus points
- `useSSEEqualityGuard.js` — Prevents SSE re-render loops

**Management Layer:**
- `useCampaignManagement.js` — Campaign lifecycle
- `useCharacterManagement.js` — Character CRUD
- `useEntityManagement.js` — Generic entity CRUD

**Wizard Layer:**
- `useCharacterWizard.js` — Wizard orchestrator
- `useWizardConfig.js` — Generic wizard step config engine
- `useWizardForm.js`, `useWizardNavigation.js`, `useWizardAbilities.js`, `useWizardSkills.js`, `useWizardSpells.js`, `useWizardFeats.js`, `useWizardLanguages.js`, `useWizardResistances.js`

**Combat Layer:** 34 combat-specific hooks (dice rolling, spell casting, metamagic, popups)

### 3.13 Components (`src/components/`)

16 component folders, 348 total files (65 source, 248 tests, 35 CSS).

**Main views** (controlled by `src/routes/config.js`):
- `char-sheet/` — Character sheet (100+ files, the largest component)
- `initiative/` — Initiative tracker
- `map/` + `hex-map/` — Map rendering (dungeon and hex)
- `maps-manager/` — Map management
- `encounter/` — Encounter builder
- `log/` — Campaign log
- `factions/`, `quests/`, `notes/`, `npcs/`, `settlements/` — Campaign tools

**Shared components** (`common/`): DiceRoller, Modal, ActionButton, ActionSelector, ConditionChoiceModal, ConcentrationPicker, FeatureList, InlineChoice, TargetSelector, ThemeToggle, Tooltip, Subscriber (SSE connection)

### 3.14 Static Data (`public/`)

**Rule data:** 32 JSON files total
- `public/data/` (24 files): 5e classes, races, backgrounds, feats, spells, equipment, monsters, magic items, conditions, resistances, languages, ability scores, etc.
- `public/data/2024/` (8 files): 2024 Essentials classes, races, backgrounds, feats, spells, maneuvers, weapon mastery

**Campaign data:** Per-campaign JSON files at `public/campaigns/:name/`
- Character files (`*.json`)
- `data/` subdirectory: campaign-log.json, character-change-data.json, encounters.json, factions.json, notes.json, npcs.json, quests.json, settlements.json
- `images/` subdirectory: character portraits
- `maps/` subdirectory: map definitions

---

## 4. Data Flow Summary

### 4.1 Application Startup

```
index.html → main.jsx → App.jsx
    │
    ├── useAppData() loads all static rule data (5e + 2024)
    ├── server.js starts Express on port 80
    ├── changeData.readFile() loads in-memory change data from disk
    ├── keepAlive() starts 60s health check
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
    │   └── Combat hook (e.g., useDiceRoll, useSpellCastExecutor)
    │
    ├── actionPipeline.run()
    │   ├── steps/index → buildPipelineForAction()
    │   │   ├── weapon_attack → buildAttackRollDamageSteps() (20+ steps)
    │   │   ├── spell → buildDirectSpellDamageSteps() (6 steps)
    │   │   └── generic → buildGenericSteps()
    │   │
    │   ├── Pipeline execution:
    │   │   ├── Each step: condition(ctx) → handler(ctx) → emit next event
    │   │   ├── Observers: log to campaign log, broadcast via SSE
    │   │   └── Modals: pause pipeline, resume on user action
    │   │
    │   └── Feature riders → 19 feature modules
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
    ├── features/*Service.js → per-spell automation
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
    ├── changeData.js → markDirty() → debouncedSave() (10s)
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
    ├── 10-second debounce → saveFile() → write to disk
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
│                          App.jsx (563 lines)                        │
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
│ └─────────┘  └─────────────┘  └──────────────┘  └──────────────┘   │
│     │             │                     │                           │
│     ▼             ▼                     ▼                           │
│ ┌─────────┐  ┌─────────────┐  ┌──────────────┐                     │
│ │effects/ │  │conditions/  │  │ features/    │                     │
│ │(expire) │  │(save/effect)│  │(per-spell)   │                     │
│ └─────────┘  └─────────────┘  └──────────────┘                     │
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

**Decision:** Both D&D 5e and 2024 Essentials rulesets coexist in one codebase, selected per-character at runtime.

**Rationale:** Players may use either ruleset; the application must support both without requiring separate instances.

**Consequences:** Every rules module has two implementations (e.g., `abilityCalc.js` / `abilityCalc2024.js`). The `rulesFactory` and `rules.js` dispatcher routes to the correct implementation. Data files are split (`public/data/` for 5e, `public/data/2024/` for 2024). This doubles the rules engine surface area but allows seamless coexistence.

### ADR-2: Server-First State Management

**Decision:** All game state flows through the runtime store (`useRuntimeState`) and server API. No localStorage for game data.

**Rationale:** Multiplayer synchronization — all players must see the same state. SSE broadcasts ensure real-time consistency.

**Consequences:** `useSyncedState` replaces `useState` for all shared state. SSE re-render loops are prevented via `skipSync=true` and equality guards. localStorage is only used for ephemeral preferences (theme). This is the core architectural pattern; violations are flagged by ESLint conventions.

### ADR-3: In-Memory Persistence with Debounced Disk Write

**Decision:** No database. All data stored as JSON files on disk, with an in-memory cache layer that debounces writes (10 seconds).

**Rationale:** Simple deployment (single `server.js` process), no database infrastructure needed. The in-memory layer provides low-latency reads/writes.

**Consequences:** Risk of data loss on crash (mitigated by `process.on('exit')` save and 10-second debounce). No concurrent write conflicts (single-process server). Character change data is gitignored per-campaign.

### ADR-4: Event-Chain Combat Pipeline

**Decision:** Combat actions use an event-chain pipeline where steps subscribe to events and emit new events.

**Rationale:** Decouples action steps, enables modular feature riders, supports modal pausing/resumption, and makes the attack/damage flow explicit and testable.

**Consequences:** Each attack type (weapon, spell, generic) has its own pipeline configuration. 20+ steps for weapon attacks, 6 for spells. Feature modules (19) are pluggable riders. Observers handle logging and SSE broadcasting independently.

### ADR-5: Automation via Feature Metadata

**Decision:** Class/race features declare automation metadata (type, trigger, damage expressions) that is collected, categorized, and dispatched at runtime.

**Rationale:** Avoids hardcoding every class feature interaction. The automation collector scans all features, normalizes their automation entries, and routes them through a 200+ handler registry.

**Consequences:** New features can be added by declaring automation metadata in the feature definition. The `automationInfoBuilder` dispatches to 21 handler modules based on type. Expression resolution replaces named variables (class levels, ability modifiers) with actual values.

### ADR-6: Per-Spell Feature Services

**Decision:** Each spell with special automation (sleep, invisibility, silence, etc.) has its own service file in `src/services/rules/features/`.

**Rationale:** Isolates complex spell-specific logic, making it testable and maintainable. The `spellCastService` delegates to the appropriate service.

**Consequences:** ~47 feature service files, each following the `trigger<FeatureName>()` pattern. This is a high file count but keeps each file focused and testable.

### ADR-7: Route Mount Order for Path Safety

**Decision:** Express routes are mounted in a specific order — specific resource routes before wildcard `:campaign/:file` routes.

**Rationale:** Prevents path collisions where a `.json` character file endpoint would be captured by the change-data `:key` wildcard.

**Consequences:** Route order is a deployment concern. The `campaigns-changedata` route must always be mounted after `campaigns-character`. This is documented in AGENTS.md.

### ADR-8: Procedural Map Generation

**Decision:** Dungeon maps use BSP tree subdivision for room placement with MST corridor connection. Hex maps use axial coordinate math for outdoor travel.

**Rationale:** Provides GM tools for on-the-fly map generation. BSP produces natural-looking dungeon layouts. Hex math enables travel pathfinding.

**Consequences:** Two separate map systems (grid-based dungeon, axial hex). Dungeon generator is the largest service file (1060 lines). Line-of-sight uses Bresenham's algorithm for both systems.

---

## 7. Known Constraints and Assumptions

1. **GM features are localhost-only:** Encounter builder, map editing, quest/faction/NPC management are automatically enabled on localhost. Network clients get a read-only view.

2. **SSE re-render loop prevention:** Always use `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data. The server already has the data; re-POSTing causes loops.

3. **PlayerStats is the single source of truth:** Computed stats from `rulesFactory.getPlayerStats()` must not be bypassed. Don't derive character state from elsewhere.

4. **Null safety:** Variables are not assumed to be null or undefined unless explicitly documented.

5. **Route order matters:** Specific routes must be mounted before wildcard routes. This is enforced by the server.js mount order.

6. **Dual ruleset data paths:** 5e data from `/data/`, 2024 data from `/data/2024/`. Shared data (equipment, monsters) is only in `/data/`.

7. **Per-campaign change data is gitignored:** `character-change-data.json`, `campaign-log.json`, and campaign-specific data directories are gitignored.

8. **Combat summary is always present:** There is no "out of combat" state — combat summaries always exist with creature data.

9. **Server-first pattern is mandatory:** All game state must go through the runtime store. `window.__someState` and `useState` with `pending`/`active`/`current` names should use `useSyncedState` instead.

10. **Single-process server:** No horizontal scaling. The in-memory store and debounced persistence assume a single Node.js process.

11. **5MB JSON body limit:** Image uploads are base64-encoded; the Express JSON body parser is configured for 5MB.

12. **10-second debounce for persistence:** Changes are written to disk 10 seconds after the last modification. On process exit, data is saved immediately.

---

## 8. Recommended Future Improvements

1. **Reduce ruleset duplication:** Many rules modules have near-identical 5e/2024 implementations (abilityCalc, attackCalc, spellCalc). Consider a unified rules engine with ruleset-specific configuration objects instead of parallel files.

2. **Consolidate feature services:** 47 per-spell feature service files could be reduced through a rule-based system (e.g., defining condition effects and save behaviors declaratively rather than with individual service files).

3. **Add integration tests for combat pipeline:** The event-chain pipeline is complex (20+ steps) but lacks comprehensive integration tests covering the full attack flow.

4. **Reduce automation handler count:** 200+ handler functions in `automation/index.js` create a large dispatch table. A more structured registry (e.g., handler classes or modules) would improve maintainability.

5. **Map generation type safety:** The dungeon generator and hex map utilities use plain objects for map data. Adding JSDoc type annotations or a lightweight type system would improve developer experience.

6. **Hook consolidation:** 34 combat hooks and 15+ wizard hooks create a large hook surface. Consider grouping related hooks into composite hooks or a hook factory.

7. **Automated ruleset parity testing:** With 5e and 2024 rulesets in parallel, automated tests should verify that key calculations produce equivalent results across rulesets for comparable character builds.

8. **Document automation metadata schema:** The feature automation metadata format (type, trigger, damageExpression, etc.) is not formally documented. Adding a schema definition would help developers add new features.

---

*This document was generated automatically from repository analysis on 2026-07-18.*
