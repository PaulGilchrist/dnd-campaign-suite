# Architecture — dnd-char-sheet

> **Generated:** 2026-05-07T00:00:00Z
> **Repository:** https://github.com/PaulGilchrist/dnd-char-sheet.git
> **Stack:** React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome

---

## 1. High-Level Overview

`dnd-char-sheet` is a single-page web application for creating, managing, and playing Dungeons & Dragons character sheets. It supports both the classic 5th Edition (5e) and the 2024 Essentials rulesets, with full dual-ruleset logic throughout the codebase.

The application consists of:

- A **React SPA** (Vite 8) providing the UI for character creation, sheet viewing, and combat tracking.
- An **Express 5 server** providing REST API endpoints for character/campaign CRUD, static file serving, and real-time multi-user sync via Server-Sent Events (SSE).

The app is private (not published to npm), licensed under MIT, and authored by Paul Gilchrist.

---

## 2. Module-by-Module Breakdown

### 2.1 Entry Points

| File | Role |
|------|------|
| `src/main.jsx` | React root mount with `StrictMode`; renders `<App />` |
| `src/App.jsx` | Top-level router: renders `CampaignSelection`, `CharSheet`, `CombatTracking`, or `CharacterCreationWizard` based on app state |
| `server.js` | Express server: serves `dist/` (production SPA), `public/` (static data), REST API (`/api/*`), and SSE (`/subscribe`) |

### 2.2 Frontend Layers

#### Hooks (`src/hooks/`)

Centralized state management via custom hooks — no class components exist.

| Hook | Responsibility |
|------|----------------|
| `use-app-data.js` | Loads all game data (classes, races, spells, equipment) with caching |
| `use-campaign-management.js` | Campaign selection, rename, delete, session storage |
| `use-character-management.js` | Character list, active character, save/delete via API |
| `use-character-wizard.js` | Wizard show/hide, complete/cancel handlers |
| `use-tracked-resource.js` | Generic tracked resource (HP, spell slots, rage) with localStorage persistence |
| `use-wizard-array-toggle.js` | Generic array toggle for wizard form fields |
| `useEquipmentSearch.js` | Equipment search with filtering and custom item addition |
| `useWizardConfig.js` | Central wizard config: validation, slot fetching, pre-selection, warnings |

#### Components (`src/components/`)

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `campaign-selection/` | `CampaignSelection` | List/create/rename/delete campaigns |
| `character-creation/` | `CharacterCreationWizard` (12 steps) | Step-by-step character creation/editing wizard |
| `char-sheet/` | `CharSheet` + 15+ sub-components | Full character sheet display (abilities, actions, inventory, spells, feats, summary, combat) |
| `combat-tracking/` | `CombatTracking` | Initiative tracker, round counter, NPC management |
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
| **Core** | `data-loader.js`, `storage.js`, `utils.js`, `rules.js`, `rules-factory.js`, `campaignService.js`, `sanitize.js`, `player-utils.js` | Data loading with caching, localStorage wrapper, unified rules dispatch, campaign API, DOMPurify wrapper |
| **Calculations (5e ↔ 2024 pairs)** | `ability-calc.js` / `ability-calc-2024.js`, `attack-calc.js` / `attack-calc-2024.js`, `spell-calc.js` / `spell-calc-2024.js` | Ability modifiers, weapon/spell attacks, spell lists and slots |
| **Spell Management** | `spell-limits.js`, `spell-validation.js`, `shared/spell-utils.js` | Spell slot limits per class/level, spell selection validation |
| **Class & Race Rules** | `class-features.js`, `class-rules.js`, `class-rules-2024.js`, `race-rules/5e.js`, `race-rules/2024.js`, `race-rules/index.js` | Class-specific features (Bard, Cleric, Druid, etc.), race traits (immunities, senses, bonuses) |
| **Proficiency & Features** | `proficiency-utils.js`, `proficiency-utils-2024.js`, `feature-categories-5e.js`, `feature-categories-2024.js`, `feature-categorization-utils.js` | Proficiency calculation, feature categorization (actions, bonusActions, reactions, characterAdvancement) |
| **Validation** | `feat-validation.js`, `skill-validation.js`, `resistances-validation.js`, `languages-fightingstyles-validation.js` | Validates selections against ruleset constraints (prerequisites, level requirements, limits) |

### 2.4 Static Data (`public/data/`)

JSON catalogs loaded at runtime by `data-loader.js`:

| Data | 5e Path | 2024 Path |
|------|---------|-----------|
| Classes | `classes.json` | `2024/classes.json` |
| Races | `races.json` | `2024/races.json` |
| Spells | `spells.json` | `2024/spells.json` |
| Feats | `feats.json` | `2024/feats.json` |
| Magic Items | `magic-items.json` | `2024/magic-items.json` |
| Backgrounds | — | `2024/backgrounds.json` |
| Ability Scores | `ability-scores.json` | (shared) |
| Skills | `passive-skills.json` | (shared) |
| Alignment | `alignments.json` | (shared) |
| Languages | `languages.json` | (shared) |
| Fighting Styles | `fighting-styles.json` | (shared) |
| Equipment | `equipment.json` | (shared) |
| Rules | `rules-validation.json` | `2024/rules-validation.json` |

### 2.5 Character Storage (`public/campaigns/`)

- **Schema:** `character.schema.json` (JSON Schema draft-07)
- **Structure:** `public/campaigns/<campaign>/<name>.json`
- **Active campaigns:** "Campaign 1" (7 characters), "Campaign 2" (5 characters)
- **Test campaigns:** "2024 Testing", "5e Testing", "Campaign Testing"
- Each character file includes a `rules` field specifying 5e or 2024

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
  └──────────────────────────────┘
```

1. **Initialization:** `data-loader.js` loads all static JSON catalogs (cached per ruleset). `use-app-data.js` exposes this to components.
2. **Character CRUD:** `use-character-management.js` calls Express REST API (`/api/characters/*`) for list/create/update/delete. Characters are persisted as JSON files on disk.
3. **Real-time sync:** `Subscriber` component connects to SSE (`/subscribe`). When any client modifies a character, the server broadcasts the change to all connected SSE clients.
4. **Ephemeral state:** HP, spell slots, and tracked resources are stored in `characterChangeData.json` (in-memory, debounced 60s save).
5. **Rules evaluation:** `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`. Calculation services compute modifiers, attacks, spells, and class features from the character data.

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
       ├── CombatTracking
       └── CharacterCreationWizard (→ 12 wizard steps)

Hooks (used by components):
  use-app-data → data-loader.js → public/data/*.json
  use-campaign-management → campaignService.js → Express API
  use-character-management → Express API
  use-character-wizard → Express API
  use-tracked-resource → localStorage
  useWizardConfig → rules.js + validation services

Services (pure logic, no UI):
  rules.js → rules-factory.js → ability-calc.js/-2024.js
                                      attack-calc.js/-2024.js
                                      spell-calc.js/-2024.js
  class-features.js → class-rules.js/-2024.js
  race-rules/5e.js, 2024.js
  spell-limits.js, spell-validation.js
  feat-validation.js, skill-validation.js
  resistances-validation.js, languages-fightingstyles-validation.js
  feature-categorization-utils.js → feature-categories-5e.js/-2024.js
  proficiency-utils.js/-2024.js
  sanitize.js (DOMPurify wrapper)
```

**Key dependency rules:**
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (5e ↔ 2024) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic

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

---

## 6. Known Constraints & Assumptions

- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or a message broker.
- **No TypeScript:** The project uses vanilla JS/JSX. Type safety is not enforced at compile time.
- **No coverage thresholds:** Vitest coverage thresholds are all set to 0 — tests exist but coverage is not enforced.
- **Port 80 default:** The server defaults to port 80 (requires root privileges on Unix).
- **Static data is complete:** All D&D rule data (classes, races, spells, feats, etc.) is bundled as JSON — no external API calls for game data.
- **Browser support:** Assumes modern browsers with ES module support (Vite 8 target).
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).

---

## 7. Recommended Future Improvements

1. **TypeScript migration:** Add type safety to services and hooks to catch ruleset mismatches at compile time.
2. **Horizontal scaling:** Replace in-memory SSE subscribers with a pub/sub system (Redis, etc.) for multi-server deployments.
3. **Concurrent edit protection:** Implement optimistic locking or operational transforms for simultaneous character edits.
4. **Coverage thresholds:** Set non-zero coverage thresholds in `vite.config.js` to prevent test regressions.
5. **Data validation pipeline:** Add a CI step that validates all JSON data files against their schemas and cross-references (e.g., spell levels match class spell lists).
6. **PWA support:** Add service worker for offline character sheet access.
7. **Export formats:** Add PDF export and D&D Beyond import.
8. **Server hardening:** Add rate limiting and input validation to all API endpoints.

---

## 8. File Inventory Summary

| Category | Count |
|----------|-------|
| Source files (.js/.jsx) | ~95 |
| Test files (.test.js/.test.jsx) | ~95 |
| CSS files | ~20 |
| Static data (JSON) | ~20 |
| Character JSON files | ~40 |
| **Total (excl. node_modules)** | **~270** |

---

*Document generated automatically. Last updated: 2026-05-07T00:00:00Z*
