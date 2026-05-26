---
name: architecture
description: >
  When exploring, explaining, or making structural changes to the project,
  to understand the tech stack, folder layout, data layer, server setup,
  and dual-ruleset architecture
---

## Stack
React 19.2 · Vite 8 · Express 5 · Vitest 4 · FontAwesome 7. ~360+ source files (services ~82, hooks ~46, components ~100, tests ~62). **No routing library** — all navigation is state-based via `activeView` in `src/routes/config.js`. **No TypeScript** — vanilla JS/JSX only.

## Entry Points
- `src/main.jsx` → React root → `<App />`
- `src/App.jsx` — State router: `activeView`, `mapsView`, `showCampaignSelection`, `showCharacterWizard`, `showEditCharacterWizard`
- `server.js` — Express: serves `dist/`, `public/`, REST `/api/*`, SSE `/subscribe`, `/health`

## Directory Guide
| Path | Contents |
|------|----------|
| `src/components/` | 16 dirs: `character-creation/`, `char-sheet/`, `hex-map/`, `map/`, `initiative/`, `encounter/`, `sidebar/`, `campaign-selection/`, `factions/`, `notes/`, `npcs/`, `quests/`, `log/`, `maps-manager/`, `common/` |
| `src/hooks/` | 46 custom hooks — state management only, no class components. Each has a `.test.js`. |
| `src/routes/config.js` | **Single source of truth** for all views and sidebar buttons. Never add react-router. |
| `src/services/` | ~82 pure logic services. Every 5e file has a `*2024.js` pair where rules differ. Each has a `.test.js`. |
| `src/config/` | Wizard constants, declarative `steps-config.js`, utils, `outdoorConfig.js` |
| `public/data/` + `public/data/2024/` | Static JSON catalogs (classes, races, spells, feats, monsters, etc.) |
| `public/campaigns/<campaign>/` | Character JSON files + campaign tool data (encounters, NPCs, notes, maps). 8 JSON Schema files (draft-07) exist but only `character.schema.json` is enforced. |

## Key Patterns
- **Data flow:** Components → Hooks → Services → Static JSON (one-way). Services have no UI deps.
- **Rules dispatch:** `rules.js` → `rules-factory.js` → 5e or 2024 specific calc files based on `playerStats.rules`. Pairs: `abilityCalc/abilityCalc2024`, `attackCalc/attackCalc2024`, `spellCalc/spellCalc2024`, `proficiencyUtils/proficiencyUtils2024`.
- **Wizard:** 12 declarative steps in `steps-config.js`. Steps 1–3 required (ruleset, basic info, race & class); rest produce warnings (non-blocking). Per-step hooks compose `useWizardConfig`.
- **Views:** Sidebar views are mutually exclusive via `activeView` string. Overlay views use booleans (`showCampaignSelection`, `showCharacterWizard`, `showEditCharacterWizard`). `mapsView` is `{ type: 'none'|'manager'|'map', mapName?: string }`.
- **SSE sync:** `/subscribe?campaign=<name>` broadcasts char updates to all clients. In-memory subscriber list (no horizontal scaling without sticky sessions).
- **Runtime state:** `public/campaigns/<campaign>/data/character-change-data.json` — per-campaign HP/spell slots/etc., in-memory with 60s debounce. Also in-memory: `activeMaps`, `subscribers`, `logCache`.
- **GM vs Player:** `isLocalhost` flag controls whether Maps shows manager (GM) or active map (player). No authentication.
- **Hex maps:** Layered SVG architecture (grid, terrain, POIs, rivers, roads, party markers, travel paths, weather). Deterministic terrain via seeded hash + Mulberry32 PRNG.

## Adding a New View
1. Add entry to `VIEWS` and `SIDEBAR_BUTTONS`/`SIDEBAR_VIEWS` in `src/routes/config.js`
2. Add toggle: `setActiveView(prev => prev === 'viewName' ? null : 'viewName')`
3. Render conditionally: `{activeView === 'viewName' && <Component />}`

## Service Patterns by Category
- **Core:** `dataLoader.js` (per-ruleset caching), `storage.js` (localStorage + server sync), `rules.js`/`rulesFactory.js`
- **Calculations:** `abilityCalc`, `attackCalc`, `spellCalc`, `proficiencyUtils` (each ↔ 2024 pair)
- **Spell:** `spellLimits.js`, `spellValidation.js`, `shared/spell-utils.js`
- **Class/Race:** `classFeatures.js`, `classRules.js`/`classRules2024.js`, `race-rules/{5e,2024}.js`
- **Features:** `featureCategories{5e,2024}.js`, `featureCategorizationUtils.js`
- **Validation:** `featValidation`, `skillValidation`, `resistancesValidation`, `languagesFightingstylesValidation`
- **Encounter/Dungeon:** `encountersService`, `dungeonGenerator`, `monsterUtils`, `encounterGenerator`, `outdoorEncounterGenerator`, `randomEventService`
- **Hex Map:** `hexMapUtils` (coord math), `hexTerrainGenerator` (marching squares)
- **Campaign:** `factionsService`, `mapsService`, `notesService`, `npcsService`, `questsService`, `logService`, `travelService`, `weatherService`
- **Dice:** `diceRoller.js` (pure, client-side RNG)

## Server Routes (`server/routes/`)
`sse.js`, `campaigns-basic.js`, `campaigns-character.js`, `campaigns-changedata.js`, `campaigns-positioning.js`, `campaigns-admin.js`, `maps.js`, `encounters.js`, `notes.js`, `npcs.js`, `quests.js`, `factions.js`, `log.js`

## Critical Constraints
- **DO NOT add react-router** — state-based navigation only
- **No TypeScript** — vanilla JS/JSX
- **All character JSON must conform to `character.schema.json`** (draft-07)
- **Campaign tool schemas exist but are not validated at runtime** (TODO)
- **Port 80 default** (requires root on Unix)
- **Vitest coverage thresholds = 0** (no enforced coverage)
- **Wizards are overlays** — they don't affect `activeView`
- **Campaign changes reset** `mapsView` to `{ type: 'none' }` and `activeView` to `null`
