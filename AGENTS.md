# AGENTS.md — D&D Character Sheet

## Architecture

**Full-stack React + Express app.** Vite dev server (React) proxies API calls to Express on port 80. Production: `npm start` builds the React bundle and serves it via Express.

- `src/` — React frontend (JSX, no TypeScript)
- `server/` — Express API (routes, SSE, file-based persistence)
- `public/data/` — 5e JSON data files
- `public/data/2024/` — 2024 Essentials JSON data files
- `public/campaigns/` — Runtime campaign data (character JSON, change data, maps)

**Dual ruleset architecture:** `rulesFactory.js` selects between 5e and 2024 rule modules at runtime. Each character has a `rules` field (`'5e'` or `'2024'`). Both rulesets can coexist in one campaign. Key rule modules:
- `src/services/rules.js` — Core rules engine (shared logic)
- `src/services/classRules.js` / `classRules2024.js` — Class-specific rules
- `src/services/race-rules/5e.js` / `race-rules/2024.js` — Race-specific rules
- `src/services/abilityCalc.js` / `abilityCalc2024.js` — Ability calculations
- `src/services/attackCalc.js` / `attackCalc2024.js` — Attack calculations
- `src/services/spellCalc.js` / `spellCalc2024.js` — Spell calculations

**Data flow:** `rulesFactory.getPlayerStats()` → `PlayerStats` (computed stats object) is the single source of truth for character data. It is recomputed when characters array changes. `_trackedResources` on PlayerStats seeds the runtime state store.

**Runtime state:** `useRuntimeState.js` holds an in-memory Map synced to `localStorage`. Server overrides (from `/api/campaigns/:name/change-data`) are applied on top. SSE broadcasts changes to all connected clients. `setRuntimeObject` uses `skipSync=true` for SSE echoes to avoid re-POSTing.

**Persistence:** No database. Characters saved as JSON files under `public/campaigns/:name/`. Runtime changes (HP, spell slots, etc.) saved to `character-change-data.json` with 1-minute debounce. Maps saved as JSON under `public/campaigns/:name/maps/`.

## Commands

```bash
npm install && npm run build && node server.js   # Production (full start)
npm run dev                                       # Dev mode (Vite + Express concurrently)
npm run api                                       # API server only (port 80)
npm run dev:react                                 # Vite dev server only
npm run build                                     # Production build to dist/
npm run lint                                      # ESLint (zero warnings enforced)
npm test                                          # Vitest (watch mode)
npm run test:run                                  # Vitest single run
npm run test:coverage                             # Vitest with coverage
```

**Always run `npm run lint` and `npm run test:run` after changes.** Lint enforces zero warnings.

## Code Conventions

- **JavaScript, not TypeScript** — `.js` and `.jsx` only
- **ES modules** — `import`/`export`, `"type": "module"` in package.json
- **React 19** — functional components, hooks
- **No inline styles** — use CSS files (e.g., `App.css`, co-located CSS files)
- **Font Awesome** — `@fortawesome/fontawesome-free` is available globally via CSS import in `main.jsx`
- **Lodash** — available (`cloneDeep`, `merge`, etc.)
- **DOMPurify + marked** — for rendering user-facing markdown safely
- **File naming** — services use camelCase (`abilityCalc.js`), components use PascalCase folders (`CharSheet.jsx`)

## Testing

- Vitest with jsdom environment
- `@testing-library/react` for component tests
- Test files: `src/**/*.{test,spec}.{js,jsx}`
- Setup: `src/test/setup.js` mocks `localStorage` and auto-cleans DOM
- `vi` is an ESLint global (no import needed)
- Run a single test: `npx vitest run path/to/test.js`

## Key Gotchas

- **SSE re-render loop:** Always use `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data. The server already has the data; re-POSTing causes loops.
- **PlayerStats computed stats** is the single source of truth. Don't derive character state from elsewhere.
- **Null safety:** Don't assume a variable is allowed to be null or undefined. Ask the user if unsure.
- **Error handling:** Don't swallow errors. Always log or surface them.
- **Route order matters in Express:** `campaigns-changedata.js` must be mounted after `campaigns-character.js` so `.json` file routes aren't captured by the `:key` wildcard.
- **Dual ruleset data paths:** 5e data lives in `/data/`, 2024 data in `/data/2024/`. Shared data (equipment, monsters, etc.) is only in `/data/`. See `dataLoader.js` `getDataPath()`.
