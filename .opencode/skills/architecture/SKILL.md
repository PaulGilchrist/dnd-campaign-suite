---
name: architecture
description: >
  When exploring, explaining, or making structural changes to the project,
  to understand the tech stack, folder layout, data layer, server setup,
  and dual-ruleset architecture
---

## Stack & Structure
React 19.2 · Vite 8 · Express 5 · Vitest · FontAwesome. ~235 source files (services ~82, hooks ~52, components ~100). **No routing library** — all navigation is state-based via `activeView` in `src/routes/config.js`.

## Entry Points
- `src/main.jsx` → `<App />`
- `src/App.jsx` — State router. Controls `activeView`, `showCampaignSelection`, `showCharacterWizard`, `showEditCharacterWizard`, `mapsView`.
- `server.js` — Express: serves `dist/`, `public/`, REST `/api/*`, SSE `/subscribe`

## Directory Guide
| Path | Contents |
|------|----------|
| `src/components/` | React UI — `character-creation/`, `char-sheet/`, `hex-map/`, `map/`, `initative/`, `encounter/`, `sidebar/`, `common/`, etc. |
| `src/hooks/` | Custom hooks — state management only, no class components. Wizard-specific in `use-wizard-*`. Campaign tool hooks for encounters/NPCs/notes/factions. |
| `src/routes/config.js` | **Single source of truth** for all views and sidebar buttons. Never add react-router. |
| `src/services/` | Pure logic services. Every 5e file has a `*2024.js` pair where rules differ. Each service has a `.test.js`. |
| `src/config/` | Wizard constants, declarative `steps-config.js`, utils |
| `public/data/` + `public/data/2024/` | Static JSON catalogs (classes, races, spells, feats, monsters, etc.) |
| `public/campaigns/<campaign>/` | Character JSON files + campaign tool data (encounters, NPCs, notes, maps) — schema for characters only (`character.schema.json`) |

## Key Patterns
- **Data flow:** Components → Hooks → Services → Static JSON (one-way). Services have no UI deps.
- **Rules dispatch:** `rules.js` → `rules-factory.js` → 5e or 2024 specific calc files based on `playerStats.rules`.
- **Wizard:** 12 declarative steps in `steps-config.js`. Steps 1–3 are required; rest produce warnings (non-blocking). Per-step hooks (`useWizardSkills`, etc.) compose `useWizardConfig` with validation.
- **Views:** Sidebar views are mutually exclusive via `activeView` string. Overlay views use booleans (`showCampaignSelection`, `showCharacterWizard`, `showEditCharacterWizard`). `mapsView` is `{ type: 'none'|'manager'|'map', mapName?: string }`.
- **SSE sync:** `/subscribe` endpoint broadcasts char updates to all clients. In-memory subscriber list (no horizontal scaling without sticky sessions).
- **Runtime state:** `public/campaigns/<campaign>/data/character-change-data.json` — per-campaign HP/spell slots/etc., in-memory with 60s debounce.

## Adding a New View
1. Add entry to `VIEWS` and `SIDEBAR_BUTTONS`/`SIDEBAR_VIEWS` in `src/routes/config.js`
2. Add toggle: `setActiveView(prev => prev === 'viewName' ? null : 'viewName')`
3. Render conditionally: `{activeView === 'viewName' && <Component />}`

## Critical Constraints
- **DO NOT add react-router** — state-based navigation only
- **No TypeScript** — vanilla JS/JSX
- **All character JSON must conform to `character.schema.json`** (draft-07)
- **Campaign tool data has no schema validation** (TODO)
- **Port 80 default** (requires root on Unix)
- **Vitest coverage thresholds = 0** (no enforced coverage)
