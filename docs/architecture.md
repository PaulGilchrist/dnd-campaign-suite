# Architecture — dnd-char-sheet

> **Generated:** 2026-05-20T17:45:00Z
> **Repository:** https://github.com/PaulGilchrist/dnd-char-sheet.git
> **Stack:** React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome

---

## 1. High-Level Overview

`dnd-char-sheet` is a single-page web application for creating, managing, and playing Dungeons & Dragons character sheets. It supports both the classic 5th Edition (5e) and the 2024 Essentials rulesets, with full dual-ruleset logic throughout the codebase.

The application consists of:

- A **React SPA** (Vite 8) providing the UI for character creation, sheet viewing, initiative tracking, encounter building, faction management, map viewing, campaign notes, NPC management, and sidebar navigation.
- An **Express 5 server** providing REST API endpoints for character/campaign CRUD, static file serving, and real-time multi-user sync via Server-Sent Events (SSE).

The app is private (not published to npm), licensed under MIT, and authored by Paul Gilchrist.

---

## 2. Module-by-Module Breakdown

### 2.1 Entry Points

| File | Role |
|------|------|
| `src/main.jsx` | React root mount with `StrictMode`; renders `<App />` |
| `src/App.jsx` | Top-level router: renders `CampaignSelection`, `CharSheet`, `Initiative`, or `CharacterCreationWizard` based on app state |
| `server.js` | Express server: serves `dist/` (production SPA), `public/` (static data), REST API (`/api/*`), and SSE (`/subscribe`) |

### 2.2 Frontend Layers

#### Hooks (`src/hooks/`)

Centralized state management via custom hooks — no class components exist.

| Hook | Responsibility |
|------|----------------|
| `useAppData.js` | Loads all game data (classes, races, spells, equipment) with caching |
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
| `useEncounterManagement.js` | Encounter builder state management |
| `useFactionsManagement.js` | Faction management state |
| `useMonstersData.js` | Monster data loading for encounters |
| `useNotesManagement.js` | Campaign notes management |
| `useNPCsManagement.js` | NPC management state |

#### Components (`src/components/`)

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `campaign-selection/` | `CampaignSelection` | List/create/rename/delete campaigns |
| `character-creation/` | `CharacterCreationWizard` (12 steps) | Step-by-step character creation/editing wizard |
| `char-sheet/` | `CharSheet` + 15+ sub-components | Full character sheet display (abilities, actions, inventory, spells, feats, summary, combat) |
| `initiative/` | `Initiative` | Initiative tracker, round counter, NPC management |
| `encounter/` | `EncounterBuilder` | Encounter builder for balancing encounters |
| `factions/` | `Factions` | Faction management for campaigns |
| `map/` | `Map` | Active map viewer |
| `maps-manager/` | `MapsManager` | GM map management screen |
| `notes/` | `Notes` | Campaign notes viewer/editor |
| `npcs/` | `NPCs` | NPC management for campaigns |
| `sidebar/` | Sidebar navigation | Sidebar with view switching buttons |
| `common/` | `Popup`, `Subscriber`, `HiddenInput`, `WarningList` | Shared UI primitives |

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

Wizard infrastructure: `steps-config.js` (declarative step definitions), `constants.js`, `utils.js`, `CascadingSelect.jsx`, `EquipmentSearchModal.jsx`, `selectable-list.jsx`.

### 2.3 Services Layer (`src/services/`)

Pure logic modules — one file per concern, each with a paired `.test.js`.

| Category | Files | Purpose |
|----------|-------|---------|
| **Core** | `data-loader.js`, `storage.js`, `utils.js`, `rules.js`, `rules-factory.js`, `campaignService.js`, `sanitize.js` | Data loading with caching, localStorage wrapper, unified rules dispatch, campaign API, DOMPurify wrapper |
| **Calculations (5e ↔ 2024 pairs)** | `abilityCalc.js` / `abilityCalc2024.js`, `attackCalc.js` / `attackCalc2024.js`, `spellCalc.js` / `spellCalc2024.js` | Ability modifiers, weapon/spell attacks, spell lists and slots |
| **Spell Management** | `spellLimits.js`, `spellValidation.js`, `shared/spell-utils.js` | Spell slot limits per class/level, spell selection validation |
| **Class & Race Rules** | `classFeatures.js`, `classRules.js`, `classRules2024.js`, `race-rules/5e.js`, `race-rules/2024.js`, `race-rules/index.js` | Class-specific features (Bard, Cleric, Druid, etc.), race traits (immunities, senses, bonuses) |
| **Proficiency & Features** | `proficiencyUtils.js`, `proficiencyUtils2024.js`, `featureCategories5e.js`, `featureCategories2024.js`, `featureCategorizationUtils.js` | Proficiency calculation, feature categorization (actions, bonusActions, reactions, characterAdvancement) |
| **Validation** | `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `languagesFightingstylesValidation.js` | Validates selections against ruleset constraints (prerequisites, level requirements, limits) |
| **Encounter & Dungeon** | `encountersService.js`, `dungeonGenerator.js`, `monsterUtils.js` | Encounter building, dungeon generation, monster utility functions |
| **Campaign Tools** | `factionsService.js`, `mapsService.js`, `notesService.js`, `npcsService.js` | Faction management, map management, campaign notes, NPC management |

### 2.4 Configuration (`src/config/`)

| File | Purpose |
|------|---------|
| `constants.js` | Required fields, default form data for character creation |
| `steps-config.js` | Declarative wizard step definitions (step number, title, component, props function) |
| `utils.js` | Wizard utility functions (point buy costs, ability validation, step validation) |

### 2.5 Routing (`src/routes/`)

| File | Purpose |
|------|---------|
| `config.js` | Central view configuration — defines all sidebar views, overlay views, sidebar buttons, and mutually exclusive view state |

Views defined in `config.js`:
- **Sidebar views** (mutually exclusive via `activeView`): `charSheet`, `initiative`, `mapsManager`, `encounter`, `factions`, `notes`, `npcs`
- **Overlay views** (independent boolean toggles): `campaignSelection`, `characterWizard`, `editCharacterWizard`

### 2.6 Static Data (`public/data/`)

JSON catalogs loaded at runtime by `data-loader.js`:

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
| Alignment | `alignments.json` | (shared) |
| Languages | `languages.json` | (shared) |
| Fighting Styles | `fighting-styles.json` | (shared) |
| Equipment | `equipment.json` | (shared) |
| Rules | `rules-validation.json` | `2024/rules-validation.json` |

### 2.7 Character Storage (`public/campaigns/`)

- **Schema:** `character.schema.json` (JSON Schema draft-07)
- **Structure:** `public/campaigns/<campaign>/<name>.json`
- **Active campaigns:** "Campaign 1" (7 characters), "Campaign 2" (5 characters)
- **Test campaigns:** "2024 Testing", "5e Testing", "Campaign Testing"
- Each character file includes a `rules` field specifying 5e or 2024

### 2.8 Runtime State

- **`public/campaigns/:campaign/data/character-change-data.json`** — Per-campaign in-memory debounced state for tracked resources (HP, spell slots, rage, etc.). Persisted to disk on a 60-second debounce interval. Listed in `.gitignore`.

---

## 3. Data Flow Summary

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Static JSON  │     │  Character    │     │  Runtime     │
│  (data/*.json)│     │  (.json)      │     │  State       │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       ▼                     ▼                     ▼
   ┌──────────┐       ┌──────────┐         ┌──────────┐
   │ data-    │       │ Express  │         │ localStorage│
   │ loader   │       │ REST API │         │ /session  │
   └────┬─────┘       └────┬─────┘         └──────────┘
        │                   │
        ▼                   ▼
   ┌──────────┐       ┌──────────┐
   │ rules.js │       │ SSE      │
   │ + *-calc │       │ /subscribe│
   └────┬─────┘       └────┬─────┘
        │                   │
        ▼                   ▼
   ┌──────────────────────────────┐
   │  React Components (UI)       │
   │  CharSheet · Initiative ·    │
   │  Encounter · Factions ·      │
   │  Maps · Notes · NPCs ·       │
   │  CharacterCreationWizard     │
   └──────────────────────────────┘
```

1. **Initialization:** `data-loader.js` loads all static JSON catalogs (cached per ruleset). `useAppData.js` exposes this to components.
2. **Character CRUD:** `useCharacterManagement.js` calls Express REST API (`/api/characters/*`) for list/create/update/delete. Characters are persisted as JSON files on disk.
3. **Real-time sync:** `Subscriber` component connects to SSE (`/subscribe`). When any client modifies a character, the server broadcasts the change to all connected SSE clients.
4. **Ephemeral state:** HP, spell slots, and tracked resources are stored in per-campaign `character-change-data.json` files under `public/campaigns/<campaign>/data/` (in-memory, debounced 60s save).
5. **Rules evaluation:** `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`. Calculation services compute modifiers, attacks, spells, and class features from the character data.
6. **Campaign tools:** Encounter, faction, notes, NPC, and map data are stored as JSON files under `public/campaigns/<campaign>/` (e.g., `encounters/`, `maps/`, `data/notes.json`, `data/npcs.json`).

---

## 4. Dependency Graph (Textual)

```
main.jsx
  └── App.jsx
       ├── CampaignSelection
       ├── CharSheet
       │    ├── CharSummary (→ CharHitPoints, CharGold, CharClassFeatures)
       │    ├── CharAbilities
       │    ├── CharActions
       │    ├── CharInventory
       │    ├── CharReactions
       │    ├── CharSpecialActions
       │    ├── CharCharacterAdvancement
       │    ├── CharFeats
       │    └── CharSpells (→ CharSpellSlots, CharSpellSlotLevel)
       ├── Initiative
       ├── EncounterBuilder
       ├── Factions
       ├── Map
       ├── MapsManager
       ├── Notes
       ├── NPCs
       └── CharacterCreationWizard (→ 12 wizard steps)

Hooks (used by components):
  useAppData → data-loader.js → public/data/*.json
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

Services (pure logic, no UI):
  rules.js → rules-factory.js → abilityCalc.js/abilityCalc2024.js
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
  factionsService.js, mapsService.js, notesService.js, npcsService.js
```

**Key dependency rules:**
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (`*-2024.js`) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic
- Campaign tool services (encounters, factions, notes, NPCs, maps) follow the same pattern but operate on campaign-scoped JSON files rather than character files

---

## 5. Key Architectural Decisions

### ADR-1: Dual Ruleset Architecture (5e ↔ 2024)
**Decision:** Every service has paired 5e and 2024 versions. A factory (`rules-factory.js`) dispatches to the correct implementation based on the character's `rules` field.

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
**Decision:** All views (sidebar and overlay) are defined declaratively in `src/routes/config.js` with a single `activeView` state variable for sidebar views and boolean toggles for overlays.

**Rationale:** Single source of truth for view behavior. Adding a new sidebar view requires only adding an entry to `VIEWS` and `SIDEBAR_BUTTONS`.

**Trade-off:** Tight coupling between sidebar and view config; changes to one require awareness of the other.

### ADR-7: Per-Campaign Character Change Data Files
**Decision:** Tracked resource state (HP, spell slots, rage, etc.) is persisted to per-campaign files at `public/campaigns/<campaign>/data/character-change-data.json` rather than a single root-level file.

**Rationale:** Campaigns are independent contexts; keeping change data scoped to each campaign prevents cross-campaign state leakage and aligns with the existing per-campaign directory structure used for characters, encounters, NPCs, and notes.

**Trade-off:** Slightly more complex file path resolution when loading/saving change data, but cleaner campaign isolation.

---

## 6. Known Constraints & Assumptions

- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or a message broker.
- **No TypeScript:** The project uses vanilla JS/JSX. Type safety is not enforced at compile time.
- **No coverage thresholds:** Vitest coverage thresholds are all set to 0 — tests exist but coverage is not enforced.
- **Port 80 default:** The server defaults to port 80 (requires root privileges on Unix).
- **Static data is complete:** All D&D rule data (classes, races, spells, feats, etc.) is bundled as JSON — no external API calls for game data.
- **Browser support:** Assumes modern browsers with ES module support (Vite 8 target).
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).
- **No concurrent edit protection:** Multiple users editing the same character simultaneously may cause race conditions.
- **Campaign tool data:** Encounter, NPC, notes, and map data are stored as JSON files under campaign directories — no schema validation currently enforced for these files.

---

## 7. Recommended Future Improvements

1. **Coverage thresholds:** Set non-zero coverage thresholds in `vite.config.js` to prevent test regressions.
5. **Data validation pipeline:** Add a CI step that validates all JSON data files against their schemas and cross-references (e.g., spell levels match class spell lists).
6. **PWA support:** Add service worker for offline character sheet access.
7. **Schema validation for campaign tools:** Add JSON Schema validation for encounter, NPC, notes, and map data files.
10. **Dungeon generator testing:** The `dungeonGenerator.js` service lacks a paired test file — add comprehensive tests.

---

## 8. File Inventory Summary

| Category | Count |
|----------|-------|
| Source files (.js/.jsx) | ~100 |
| Test files (.test.js/.test.jsx) | ~50 |
| CSS files | ~20 |
| Static data (JSON) | ~25 |
| Character JSON files | ~40 |
| **Total (excl. node_modules)** | **~235** |

---

*Document generated automatically. Last updated: 2026-05-20T17:45:00Z*
