---
name: architecture
description: >
  When exploring, explaining, or making structural changes to the project,
  to understand the tech stack, folder layout, data layer, server setup,
  and dual-ruleset architecture
---
## Project Overview
D&D character sheet SPA for creating, managing, and playing D&D character sheets. Supports dual rulesets: classic 5e and 2024 Essentials, with full parallel logic throughout.
**Stack:** React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome
**~235 files total** (~100 source, ~50 tests, ~20 CSS, ~25 static JSON, ~40 character JSON)

## Entry Points
| File | Role |
|------|------|
| `src/main.jsx` | React root mount with StrictMode; renders `<App />` |
| `src/App.jsx` | Top-level state-based router: renders views based on `activeView`, `showCampaignSelection`, `showCharacterWizard`, `showEditCharacterWizard` |
| `server.js` | Express server: serves `dist/`, `public/`, REST API (`/api/*`), SSE (`/subscribe`) |

## Module Structure
### Hooks (`src/hooks/`) — Centralized state, no class components
| Hook | Responsibility |
|------|----------------|
| `useAppData.js` | Loads all game data (classes, races, spells, equipment) with caching |
| `useCampaignManagement.js` | Campaign selection, rename, delete, session storage |
| `useCharacterManagement.js` | Character list, active character, save/delete via API |
| `useCharacterWizard.js` | Wizard show/hide, complete/cancel handlers |
| `useTrackedResource.js` | Generic tracked resource (HP, spell slots, rage) with localStorage persistence |
| **Wizard-specific hooks:** `useWizardConfig.js`, `useWizardAbilities.js`, `useWizardData.js`, `useWizardFeats.js`, `useWizardForm.js`, `useWizardLanguages.js`, `useWizardNavigation.js`, `useWizardResistances.js`, `useWizardSkills.js`, `useWizardArrayToggle.js`, `useEquipmentSearch.js` |
| **Campaign tool hooks:** `useEncounterManagement.js`, `useFactionsManagement.js`, `useMonstersData.js`, `useNotesManagement.js`, `useNPCsManagement.js` |

### Components (`src/components/`)
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

### Character Creation Wizard (12 steps)
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

### Config (`src/config/`)
| File | Purpose |
|------|---------|
| `constants.js` | Required fields, default form data for character creation |
| `steps-config.js` | Declarative wizard step definitions (step number, title, component, props function) |
| `utils.js` | Wizard utility functions (point buy costs, ability validation, step validation) |

### Routes (`src/routes/`)
| File | Purpose |
|------|---------|
| `config.js` | **Single source of truth** for all views — defines sidebar views, overlay views, sidebar buttons, and mutually exclusive view state |

**Views:** Sidebar views (mutually exclusive via `activeView`): `charSheet`, `initiative`, `mapsManager`, `encounter`, `factions`, `notes`, `npcs`. Overlay views (independent boolean toggles): `campaignSelection`, `characterWizard`, `editCharacterWizard`.

### Services (`src/services/`) — Pure logic, one file per concern, each with paired `.test.js`
- **Core:** `data-loader.js`, `storage.js`, `utils.js`, `rules.js`, `rules-factory.js`, `campaignService.js`, `sanitize.js`
- **Calculations (5e ↔ 2024 pairs):** `abilityCalc.js`/`abilityCalc2024.js`, `attackCalc.js`/`attackCalc2024.js`, `spellCalc.js`/`spellCalc2024.js`
- **Spell Management:** `spellLimits.js`, `spellValidation.js`, `shared/spell-utils.js`
- **Class & Race Rules:** `classFeatures.js`, `classRules.js`/`classRules2024.js`, `race-rules/5e.js`/`2024.js`
- **Proficiency & Features:** `proficiencyUtils.js`/`proficiencyUtils2024.js`, `featureCategories5e.js`/`featureCategories2024.js`, `featureCategorizationUtils.js`
- **Validation:** `featValidation.js`, `skillValidation.js`, `resistancesValidation.js`, `languagesFightingstylesValidation.js`
- **Encounter & Dungeon:** `encountersService.js`, `dungeonGenerator.js`, `monsterUtils.js`
- **Campaign Tools:** `factionsService.js`, `mapsService.js`, `notesService.js`, `npcsService.js`

## Data Layer
- **Static JSON:** `public/data/*.json` (5e) and `public/data/2024/*.json` (2024) — classes, races, spells, feats, magic items, backgrounds, monsters, ability scores, skills, alignments, languages, fighting style, equipment, rules-validation
- **Character files:** `public/campaigns/<campaign>/<name>.json` — JSON Schema draft-07 (`character.schema.json`)
- **Campaign tool data:** JSON files under `public/campaigns/<campaign>/` (encounters, maps, notes, NPCs) — no schema validation
- **Runtime state:** `characterChangeData.json` — in-memory, debounced 60s save (listed in `.gitignore`)

## Data Flow
```
Static JSON → data-loader → rules.js + *-calc → React Components
Character JSON → Express REST API → React Hooks
SSE /subscribe → Subscriber component (real-time broadcast)
Campaign tool JSON → Express REST API → Campaign tool hooks
```

1. `data-loader.js` loads all static JSON catalogs (cached per ruleset). Exposed via `useAppData.js`.
2. Character CRUD via Express REST API (`/api/characters/*`). Characters persisted as JSON files on disk.
3. SSE (`/subscribe`) broadcasts character updates to all connected clients.
4. `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`.
5. Campaign tool services operate on campaign-scoped JSON files (encounters, NPCs, notes, maps).

## Dependency Rules
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (`*-2024.js`) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic
- **DO NOT add react-router or any routing library** — navigation is state-based via `activeView` in `src/routes/config.js`

## Key Architectural Decisions
### ADR-1: Dual Ruleset (5e ↔ 2024)
Every service has paired 5e and 2024 versions. `rules-factory.js` dispatches based on character's `rules` field. Trade-off: ~2× service files, but cleaner separation.

### ADR-2: Server-Sent Events (SSE) for Real-Time Sync
SSE (`/subscribe`) used instead of WebSockets — simpler, HTTP-based, auto-reconnect, push-only broadcast pattern.

### ADR-3: Declarative Wizard Configuration
Steps defined in `steps-config.js` (step number, title, component, props function). Adding/reordering steps requires only editing the config.

### ADR-4: Non-Blocking Validation with Warnings
Validation services produce warnings, not errors. Required fields (steps 1–3) are the only hard constraints. Server-side schema validation catches invalid saves.

### ADR-5: File-Based Character Storage
Characters stored as JSON files on disk, served via Express. `character.schema.json` provides structural validation. No concurrent write protection (mitigated by SSE broadcast).

### ADR-6: Centralized View Configuration
All views defined declaratively in `src/routes/config.js` with `activeView` for sidebar views and boolean toggles for overlays. Single source of truth for view behavior.

## Constraints
- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or message broker.
- **No TypeScript:** Vanilla JS/JSX. No compile-time type safety.
- **No coverage thresholds:** Vitest coverage thresholds all set to 0.
- **Port 80 default:** Requires root privileges on Unix.
- **Static data is complete:** All D&D rule data bundled as JSON — no external API calls.
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).
- **No concurrent edit protection:** Multiple users editing the same character may cause race conditions.
- **No routing library:** Navigation is entirely state-based — do not add react-router.
