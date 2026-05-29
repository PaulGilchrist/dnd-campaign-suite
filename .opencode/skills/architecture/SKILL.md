---
name: architecture
description: >
  When exploring, explaining, or making structural changes to the project,
  to understand the tech stack, folder layout, data layer, server setup,
  and dual-ruleset architecture
---

## Stack
React 19 · Vite 8 · Express 5 · Vitest 4 · FontAwesome 7. ~267 source files. **No routing library** — navigation is state-based via `activeView`. **No TypeScript** — vanilla JS/JSX only.

## Entry Points
- `src/main.jsx` → React root → `<App />`
- `src/App.jsx` — Global state: `activeView`, `mapsView`, wizard overlays, theme, activeCharacter
- `server.js` — Express on port 80: serves `dist/`, REST `/api/*`, SSE `/subscribe`, `/health`

## Directory Guide
| Path | Purpose |
|------|---------|
| `src/components/` | 16 feature dirs. Colocated CSS. Default exports only. PascalCase, domain-prefixed (`Char*`, `Wizard*`). |
| `src/hooks/` | ~22 non-test hooks. Bridges UI ↔ services, manages domain state. Each has `.test.js`. |
| `src/routes/config.js` | **Single source of truth** for views and sidebar buttons. Never add react-router. |
| `src/services/` | ~48 pure logic modules. Every 5e rules file has a `*2024.js` pair. Each has `.test.js`. |
| `src/config/` | Wizard constants, declarative `steps-config.js`, `outdoorConfig.js` |
| `public/data/` + `public/data/2024/` | Static JSON catalogs (classes, races, spells, monsters, etc.) |
| `public/campaigns/<name>/` | Character JSON + campaign tool data. Only `character.schema.json` enforced at runtime. |

## Data Flow
**Components → Hooks → Services → Static JSON** (one-way). Services have no UI dependencies.

- **Characters**: `storage.js` → localStorage (immediate) + fire-and-forget HTTP sync
- **All other entities**: domain service → HTTP to `/api/*` → saved as JSON on disk
- **Real-time sync**: SSE at `/subscribe?campaign=<name>`; `<Subscriber>` component receives updates

## Dual-Ruleset Architecture
`rulesFactory.js` selects 5e or 2024 rules based on `playerSummary.rules`. Every calculation service has a pair:
- `abilityCalc` / `abilityCalc2024`
- `attackCalc` / `attackCalc2024`
- `spellCalc` / `spellCalc2024`
- `proficiencyUtils` / `proficiencyUtils2024`
- `classRules` / `classRules2024`
- `race-rules/5e.js` / `race-rules/2024.js`

## Navigation (State-Based)
- **Sidebar views** — mutually exclusive via `activeView` string. Toggle: `setActiveView(prev => prev === 'x' ? null : 'x')`. Render: `{activeView === 'x' && <Cmp />}`
- **Overlay wizards** — boolean flags (`showCharacterWizard`, `showEditCharacterWizard`). Do not affect `activeView`.
- **Maps** — `mapsView` object: `{ type: 'none'|'manager'|'map', mapName?: string }`. Separate from `activeView`.
- Campaign change resets `mapsView` to `{ type: 'none' }` and `activeView` to `null`.

## Adding a New View
1. Add entry to `VIEWS` and `SIDEBAR_BUTTONS`/`SIDEBAR_VIEWS` in `src/routes/config.js`
2. Toggle handler: `setActiveView(prev => prev === 'viewName' ? null : 'viewName')`
3. Conditional render: `{activeView === 'viewName' && <Component />}`

## Server Routes (`server/routes/`)
<sse>, <campaigns-basic>, <campaigns-character>, <campaigns-changedata>, <campaigns-positioning>, <campaigns-admin>, <maps>, <encounters>, <notes>, <npcs>, <quests>, <factions>, <log> — 13 modules. In-memory `changeData.js` drives SSE publish with campaign-scoped filtering.

## Critical Constraints
- **DO NOT add react-router** — state-based navigation only
- **No TypeScript** — vanilla JS/JSX
- **Default exports only** — all components use `export default`
- **All character JSON must conform to `character.schema.json`** (draft-07)
- **Campaign tool schemas exist but are not validated at runtime**
- **Port 80 default** (requires root on Unix)
- **No database** — file-based persistence; multi-instance needs shared storage
- **Client-side stat computation** — server has no D&D rules knowledge
