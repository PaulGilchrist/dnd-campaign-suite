---
name: project-architecture
description: Project Architecture
---

## Project Overview

D&D character sheet SPA with real-time multiplayer sync. React 19 + Vite 8 frontend served by an Express 5 backend. Dual ruleset support: classic 5e and 2024 Essentials.

## Stack

React 19 + Vite 8 + Bootstrap 5, vanilla JS/JSX (no TypeScript). Tests use Vitest + jsdom + @testing-library.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Vite HMR + Express API via `concurrently`) |
| `npm run build` | Production build (`vite build`) |
| `npm run preview` | Preview production build (`vite preview --host`) |
| `npm run test` | Vitest interactive mode |
| `npm run test:run` | Vitest single run (CI) |
| `npm run test:coverage` | Vitest with v8 coverage |
| `npm run lint` | ESLint (react + react-hooks + react-refresh plugins) |
| `npm start` | First-time only: `install -> build -> start server` |

Do NOT use `npm start` during development — it rebuilds on every invocation. Use `npm run dev`.

## Architecture

```
src/
  main.jsx          → entrypoint (React StrictMode + App)
  App.jsx           → router and top-level layout
  components/
    campaign-selection/   → campaign CRUD (lists campaigns, add/delete/rename)
    character-creation/   → step-by-step wizard (10+ steps)
    char-sheet/           → main character sheet view (20+ sub-components)
    combat-tracking/      → initiative tracker, round counter, NPC management
    common/               → shared UI (popup, hidden-input, subscriber)
  services/             → pure logic, one file per concern, all .test.js paired
```

### Data Layer

- **Static rule data**: `public/data/*.json` (5e) and `public/data/2024/*.json` (2024 Essentials)
- **Character files**: `public/characters/<campaign>/<name>.json` — persisted to disk, served via Express API and SSE broadcast
- **Runtime state**: `characterChangeData.json` — in-memory cache of ephemeral change state (HP, spell slots, etc.), debounced save every 60s, **gitignored**
- **Schema**: `public/characters/character.schema.json` — JSON schema for the character object

### Server

`server.js` is a single Express file that serves the built SPA (`dist/`), static data (`public/`), and REST API (`/api/*`) for campaign/character CRUD. Real-time sync uses Server-Sent Events (`/subscribe` endpoint). Vite dev server proxies `/api` requests back to the Express instance.

Port is `$PORT` or defaults to `80`.

### Rulesets

Two parallel rulesets (5e and 2024). Services follow the `<feature>-2024.js` naming convention for 2024-specific logic. `rules-factory.js` selects the correct ruleset at runtime based on the character's `ruleset` field.

## Guidance

- Share as much code reuse as possible between 5e and 2024 components and services
- Never mix concerns across layers.
- If a file violates architecture, propose a fix before acting.