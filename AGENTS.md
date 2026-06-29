# AGENTS.md — D&D Character Sheet

## Architecture

**Full-stack React + Express app.** Vite dev server (React) proxies `/api` and `/subscribe` to Express on port 80. Production: `npm start` installs deps, builds React to `dist/`, then Express serves the bundle + API.

- `src/` — React frontend (JSX, no TypeScript)
  - `src/components/` — React component folders (PascalCase) with co-located CSS
  - `src/hooks/` — Custom hooks (`useRuntimeState.js`, `useAppData.js`, management hooks, etc.)
  - `src/services/` — Business logic (rules engine, combat automation, map utilities, UI helpers)
  - `src/routes/` — Client-side route config
  - `src/models/` — Data models
- `server/` — Express API
  - `server/routes/` — One route file per domain (campaigns, maps, NPCs, encounters, etc.)
  - `server/utils/` — `changeData.js` (in-memory cache → disk persistence, 1-min debounce), `encounterUtils.js`, `imageUtils.js`
- `public/data/` — 5e JSON rule data files
- `public/data/2024/` — 2024 Essentials JSON rule data files
- `public/campaigns/:name/` — Runtime campaign data (character JSON, change data, maps)

## Git Permissions

Read-only inspection only: `git log`, `git show`, `git diff`, `git status`, `git blame`, `git grep`, `git ls-files`, `git stash list`, `git stash show`, `git remote -v`, `git branch`.

**Strictly forbidden:** `commit`, `checkout`, `switch`, `restore`, `push`, `pull`, `fetch`, `merge`, `rebase`, `cherry-pick`, `reset`, `revert`, `clean`, `stash push/pop/drop`, `branch -d/-D`, `tag -d`, `rm`, `mv`.

- mv is ONLY permitted when refactoring a folder into multiple subfolders.

**Dual ruleset architecture:** `src/services/rules/rulesFactory.js` selects between 5e and 2024 rule modules at runtime. Each character has a `rules` field (`'5e'` or `'2024'`). Both rulesets coexist in one campaign. Key rule modules:
- `src/services/rules/rules.js` — Core rules engine (shared logic)
- `src/services/rules/rulesFactory.js` — Factory that picks the right race/class rules per ruleset
- `src/services/character/classRules.js` / `classRules2024.js` — Class-specific rules
- `src/services/character/race-rules/5e.js` / `race-rules/2024.js` — Race-specific rules
- `src/services/rules/core/abilityCalc.js` / `abilityCalc2024.js` — Ability calculations
- `src/services/rules/core/attackCalc.js` / `attackCalc2024.js` — Attack calculations
- `src/services/rules/core/spellCalc.js` / `spellCalc2024.js` — Spell calculations
- `src/services/rules/spells/` — Metamagic, spell limits, post-cast riders, spell validation
- `src/services/rules/combat/` — Cover, damage, AoE, range validation, healing
- `src/services/rules/effects/` — Expiration system, rest rules, turn-start effects
- `src/services/rules/features/` — Per-spell feature services (sleep, invisibility, wild surge, etc.)

**Data flow:** `rulesFactory.getPlayerStats()` → `PlayerStats` (computed stats object) is the single source of truth for character data. Recomputed when characters array changes. `_trackedResources` on PlayerStats seeds the runtime state store.

**Runtime state:** `src/hooks/runtime/useRuntimeState.js` holds an in-memory Map synced to server API (server first - Do not use localStorage). Server overrides (from `/api/campaigns/:name/change-data`) are applied on top. SSE broadcasts changes to all connected clients.

**Persistence:** No database. Characters saved as JSON under `public/campaigns/:name/`. Runtime changes (HP, spell slots, etc.) saved to `character-change-data.json` with 1-minute debounce. Maps saved as JSON under `public/campaigns/:name/maps/`. Campaign log saved to `campaign-log.json`.

**SSE (Server-Sent Events):** `server/routes/sse.js` provides the SSE endpoint. All map state, character changes, spell overlays, and combat automation prompts broadcast via SSE to every connected client.

## Commands

```bash
npm install && npm run build && node server.js   # Production (full start — installs, builds, runs)
npm run dev                                       # Dev mode (Vite + Express concurrently)
npm run api                                       # API server only (port 80)
npm run dev:react                                 # Vite dev server only
npm run build                                     # Production build to dist/
npm run prod                                      # Production server only (no build)
npm run lint                                      # ESLint (zero warnings enforced, flat config)
npm test                                          # Vitest (watch mode)
npm run test:run                                  # Vitest single run
npm run test:coverage                             # Vitest with coverage (v8, outputs to ./coverage)
```

**Always run `npm run lint` and `npm run test:run` after changes.** Lint enforces zero warnings.

## Repo Tooling

- `.opencode/agents/` and `.opencode/commands/` — custom OpenCode agents and slash commands (e.g. `dnd-create-campaign`, `dnd-create-one-shot`, `dnd-update-campaign`)
- `eslint.config.js` — flat config (ESM), not `.eslintrc.cjs`
- `vitest.config.js` — jsdom environment, globals enabled, setup in `src/test/setup.js`

## Code Conventions

- **JavaScript, not TypeScript** — `.js` and `.jsx` only
- **ES modules** — `import`/`export`, `"type": "module"` in package.json
- **React 19** — functional components, hooks, `React.StrictMode` in `main.jsx`
- **No inline styles** — use CSS files; component-specific styles must be scoped to that component
- **Font Awesome** — `@fortawesome/fontawesome-free` imported globally in `main.jsx`; use `<i className="fa-solid fa-...">`
- **Lodash** — available (`cloneDeep`, `merge`, etc.)
- **DOMPurify + marked** — for rendering user-facing markdown safely
- **File naming** — services use camelCase, components use PascalCase folders, hooks start with `use`
- **Test files** — co-located with source, matching `*.test.{js,jsx}` pattern

## Testing

- Vitest with jsdom environment, globals enabled
- `@testing-library/react` for component tests
- Test files: `src/**/*.{test,spec}.{js,jsx}`
- Setup: `src/test/setup.js` mocks server API and auto-cleans DOM after each test
- `vi` is an ESLint global (no import needed)
- Run a single test: `npx vitest run path/to/test.js`
- Coverage: `npm run test:coverage` uses v8 provider, outputs text/json/html/lcov to `./coverage`

## Key Gotchas

- **Application is server first:** All Players see the same data through SSE.  Do not use localStorage.
- **SSE re-render loop:** Always use `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data. The server already has the data; re-POSTing causes loops.
- **PlayerStats computed stats** is the single source of truth. Don't derive character state from elsewhere.
- **Null safety:** Don't assume a variable is allowed to be null or undefined. Ask the user if unsure.
- **Error handling:** Don't swallow errors. Always log or surface them.
- **Route order matters in Express:** `campaigns-changedata.js` must be mounted after `campaigns-character.js` so `.json` file routes aren't captured by the `:key` wildcard. (Verified in `server.js`.)
- **Dual ruleset data paths:** 5e data lives in `/data/`, 2024 data in `/data/2024/`. Shared data (equipment, monsters, etc.) is only in `/data/`. See `src/services/ui/dataLoader.js` `getDataPath()`.
- **GM features are localhost-only:** Encounter builder, map editing, quest/faction/NPC management are automatically enabled when the app runs on localhost — players connecting over the network get a read-only view.
- **Vite proxy config:** In dev, Vite proxies `/api`, `/subscribe`, and `/spell-overlay` to `http://localhost:80` (the Express server). The `/subscribe` proxy has `ws: false` and infinite timeout for SSE.
- **Per-campaign change data is gitignored:** `public/campaigns/*/data/character-change-data.json`, `public/campaigns/*/data/campaign-log.json`, `logs/`, `coverage/`.
- **React 19 settings:** ESLint config sets `settings: { react: { version: '19' } }` for the plugin.

## Code Simplicity

- **Single source of truth:** One variable, one concept. If `isCritical` determines whether dice are doubled, use that same variable everywhere that logic is needed — never introduce `isAutoCrit`, `showCrit`, `isCritDamage` as separate flags for the same concept. Consolidate into one derived variable at the top of the function.
- **No duplication:** If the same check or computation appears in multiple places, extract it. If a new feature requires duplicating logic, that's a signal to refactor the shared logic first.
- **Simplify, don't accumulate:** Don't add new variables, branches, or display paths for edge cases that don't change the user-facing outcome. "AUTO-CRIT" vs "Critical Hit" are the same event — one label is enough.
- **Prefer derived state over parallel state:** Compute `isCritDamage = isDamageType && (isCrit || isAutoCrit)` once, use it everywhere. Don't re-check `isCrit || isAutoCrit` scattered across the component.
- **Remove dead code:** When refactoring, delete the old variables and branches that are no longer used. Don't leave orphaned code "just in case."
- **Test-driven simplification:** When a test fails after simplification, fix the test or the logic — don't add complexity to make the test pass. The test should reflect the simplified design.

# Core Rules
- Never leave dead code.  It just confuses people later.
- Look for and re-use existing code and avoid duplicating code.
- If a map is active, use position on map, but if no map is active, assume all creatures are within range.