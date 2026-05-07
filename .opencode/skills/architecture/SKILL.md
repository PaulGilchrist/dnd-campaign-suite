---
name: architecture
description: Project Architecture
---
## Project Overview
D&D character sheet SPA for creating, managing, and playing D&D character sheets. Supports dual rulesets: classic 5e and 2024 Essentials, with full parallel logic throughout.
**Stack:** React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome
## Entry Points
| File | Role |
|------|------|
| `src/main.jsx` | React root mount with StrictMode; renders `<App />` |
| `src/App.jsx` | Top-level router: renders CampaignSelection, CharSheet, CombatTracking, or CharacterCreationWizard |
| `server.js` | Express server: serves `dist/`, `public/`, REST API (`/api/*`), SSE (`/subscribe`) |
## Module Structure
### Hooks (`src/hooks/`) — Centralized state, no class components
| Hook | Responsibility |
|------|----------------|
| `use-app-data.js` | Loads all game data (classes, races, spells, equipment) with caching |
| `use-campaign-management.js` | Campaign selection, rename, delete, session storage |
| `use-character-management.js` | Character list, active character, save/delete via API |
| `use-tracked-resource.js` | Generic tracked resource (HP, spell slots, rage) with localStorage persistence |
| `useWizardConfig.js` | Central wizard config: validation, slot fetching, pre-selection, warnings |
### Components (`src/components/`)
| Module | Key Components | Purpose |
|--------|---------------|---------|
| `campaign-selection/` | `CampaignSelection` | List/create/rename/delete campaigns |
| `character-creation/` | `CharacterCreationWizard` (12 steps) | Step-by-step character creation/editing wizard |
| `char-sheet/` | `CharSheet` + 15+ sub-components | Full character sheet display |
| `combat-tracking/` | `CombatTracking` | Initiative tracker, round counter, NPC management |
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
### Services (`src/services/`) — Pure logic, one file per concern, each with paired `.test.js`
- **Core:** `data-loader.js`, `storage.js`, `utils.js`, `rules.js`, `rules-factory.js`, `campaignService.js`, `sanitize.js`, `player-utils.js`
- **Calculations (5e ↔ 2024 pairs):** `ability-calc.js`/`-2024.js`, `attack-calc.js`/`-2024.js`, `spell-calc.js`/`-2024.js`
- **Spell Management:** `spell-limits.js`, `spell-validation.js`, `shared/spell-utils.js`
- **Class & Race Rules:** `class-features.js`, `class-rules.js`/`-2024.js`, `race-rules/5e.js`/`2024.js`
- **Proficiency & Features:** `proficiency-utils.js`/`-2024.js`, `feature-categories-5e.js`/`-2024.js`, `feature-categorization-utils.js`
- **Validation:** `feat-validation.js`, `skill-validation.js`, `resistances-validation.js`, `languages-fightingstyles-validation.js`
## Data Layer
- **Static JSON:** `public/data/*.json` (5e) and `public/data/2024/*.json` (2024) — classes, races, spells, feats, magic items, backgrounds, ability scores, skills, alignments, languages, fighting styles, equipment, rules-validation
- **Character files:** `public/characters/<campaign>/<name>.json` — JSON Schema draft-07 (`character.schema.json`)
- **Runtime state:** `characterChangeData.json` — in-memory, debounced 60s save
## Data Flow
Static JSON → data-loader → rules.js + *-calc → React Components
Character JSON → Express REST API → React Hooks
SSE /subscribe → Subscriber component (real-time broadcast)
1. `data-loader.js` loads all static JSON catalogs (cached per ruleset). Exposed via `use-app-data.js`.
2. Character CRUD via Express REST API (`/api/characters/*`). Characters persisted as JSON files on disk.
3. SSE (`/subscribe`) broadcasts character updates to all connected clients.
4. `rules.js` dispatches to 5e or 2024 logic based on `playerStats.rules`.
## Dependency Rules
- Components → Hooks → Services → Static JSON (one-way data flow)
- Services have no UI dependencies
- Services are version-paired (`<feature>-2024.js`) where rules differ
- `rules.js` is the central dispatch point for all ruleset logic
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
## Constraints
- **Single server instance:** SSE subscribers are in-memory; horizontal scaling requires sticky sessions or message broker.
- **No TypeScript:** Vanilla JS/JSX. No compile-time type safety.
- **No coverage thresholds:** Vitest coverage thresholds all set to 0.
- **Port 80 default:** Requires root privileges on Unix.
- **Static data is complete:** All D&D rule data bundled as JSON — no external API calls.
- **Character schema:** All character JSON files must conform to `character.schema.json` (draft-07).
This skill is ~130 lines (vs the old ~65 lines) and is derived exclusively from docs/architecture.md. It captures:
- Stack and entry points — what runs and how
- Module structure — hooks, components, services with their responsibilities
- 12-step wizard — the full step list and infrastructure
- Data layer and flow — how data moves through the app
- Dependency rules — the one-way flow and pairing conventions
- 5 ADRs — the critical decisions with rationale and trade-offs
- Constraints — known limitations to be aware of during development