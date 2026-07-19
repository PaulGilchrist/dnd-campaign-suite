# AGENTS.md — D&D Character Sheet

## Architecture

**Full-stack React 19 + Express 5 app.** Vite dev server proxies `/api`, `/subscribe`, `/spell-overlay` to Express on port 80. Production: `npm start` installs deps, builds React to `dist/`, then Express serves the bundle + API.

- `src/` — React frontend (JSX, no TypeScript)
  - `src/components/` — React component folders (PascalCase) with co-located CSS
  - `src/hooks/` — Custom hooks (`runtime/`, `management/`, `wizard/`, `combat/`)
  - `src/services/` — Business logic (rules engine, combat pipeline, automation handlers, map utilities)
  - `src/routes/config.js` — Client-side view config
- `server/` — Express API
  - `server/routes/` — One route file per domain (campaigns, maps, NPCs, encounters, log, SSE, etc.)
  - `server/utils/` — `changeData.js` (in-memory cache → disk, 10s debounce), `jsonEntityCrud.js` (CRUD factory), `imageUtils.js`
- `public/data/` — 5e JSON rule data (24 files)
- `public/data/2024/` — 2024 Essentials JSON rule data (8 files)
- `public/campaigns/:name/` — Runtime campaign data (character JSON, maps, logs, encounter/faction/quest data)

## Commands

```bash
npm install && npm run build && node server.js   # Production (full start)
npm run dev                                       # Dev mode (Vite + Express concurrently)
npm run api                                       # API server only (port 80)
npm run dev:react                                 # Vite dev server only
npm run build                                     # Production build to dist/
npm run lint                                      # ESLint (zero warnings, flat config)
npm test                                          # Vitest (watch mode)
npm run test:run                                  # Vitest single run
npm run test:coverage                             # Vitest with coverage (v8 → ./coverage)
```

**Always run `npm run lint` and `npm run test:run` after changes.** Lint enforces zero warnings.

## Git Permissions

Read-only inspection only: `git log`, `git show`, `git diff`, `git status`, `git blame`, `git grep`, `git ls-files`, `git stash list`, `git stash show`, `git remote -v`, `git branch`.

**Strictly forbidden:** `commit`, `checkout`, `switch`, `restore`, `push`, `pull`, `fetch`, `merge`, `rebase`, `cherry-pick`, `reset`, `revert`, `clean`, `stash push/pop/drop`, `branch -d/-D`, `tag -d`, `rm`, `mv`.

- mv is ONLY permitted when refactoring a folder into multiple subfolders.

## Repo Tooling

- `eslint.config.js` — Flat config (ESM) with custom `server-first` plugin enforcing no localStorage game state, no `window.__state`, and requiring `useSyncedState` for game data
- `vitest.config.js` — jsdom environment, globals enabled, setup in `src/test/setup.js` (mocks localStorage, auto-cleans DOM)
- `src/test/setup.js` — Auto-cleans DOM and area effect modal instances after each test
- `.opencode/agents/` and `.opencode/commands/` — Custom OpenCode agents and slash commands

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

## Key Gotchas

- **Server-first state:** All game state flows through the runtime store (`useRuntimeState` / `useSyncedState`). Never use localStorage for game data. ESLint rules enforce this (`no-window-access`, `no-local-game-state` = ERROR; `require-synced-state` = WARN).
- **SSE re-render loop:** Always use `skipSync=true` in `setRuntimeObject` when applying SSE-echoed data. The server already has the data; re-POSTing causes loops.
- **PlayerStats is single source of truth:** `rulesFactory.getPlayerStats()` → `PlayerStats` is the canonical character data. Don't derive state from elsewhere.
- **Route order matters in Express:** `campaigns-changedata.js` must be mounted after `campaigns-character.js` in `server.js` so `.json` character file routes aren't captured by the `:key` wildcard.
- **Dual ruleset data paths:** 5e data lives in `/data/`, 2024 data in `/data/2024/`. Shared data (equipment, monsters) is only in `/data/`. See `src/services/ui/dataLoader.js` `getDataPath()`.
- **GM features are localhost-only:** Encounter builder, map editing, quest/faction/NPC management are enabled on localhost; network clients get read-only view.
- **10-second debounce:** Change data persists to disk 10 seconds after last modification (not 1 minute). On process exit, data is saved immediately.
- **5MB JSON body limit:** Image uploads are base64-encoded; Express JSON body parser is configured for 5MB.
- **Per-campaign change data is gitignored:** `public/campaigns/*/data/character-change-data.json`, `public/campaigns/*/data/campaign-log.json`, `logs/`, `coverage/`.

## Server-First Pattern

**Every piece of game state MUST go through the runtime store.** This is the core architecture that makes all players see the same data.

```js
// READ — preferred
const [value, setValue] = useSyncedState(campaignName, 'myKey', defaultValue);

// Existing code not yet migrated
const value = getRuntimeValue(characterKey, 'myKey');
await setRuntimeValue(characterKey, 'myKey', newValue, campaignName);
```

**Goes in runtime store:** HP, SP, conditions, buffs, pipeline state, save prompts, travel state, combat UI state.
**Stays local (per-client):** Ephemeral UI flags (`isLoading`, `showModal`), DOM refs (`useRef`), display formatting (`theme`, `expandedSections`).

## Combat & Rules

- **No "out of combat" state** — there are always creatures; always a `combatSummary`. Use `getCombatSummary` as the primary source.
- **If a map is active**, use position on map; if no map is active, assume all creatures are within range.
- **Every automation must log** to the campaign log when triggered with event details. Check for logging in any automation you modify.
- **Dual ruleset architecture:** `src/services/rules/rulesFactory.js` selects between 5e and 2024 rule modules at runtime. Each character has a `rules` field (`'5e'` or `'2024'`). Both rulesets coexist in one campaign. Every core rules module has two implementations (`abilityCalc.js` / `abilityCalc2024.js`, etc.).
- **Combat pipeline:** Event-chain architecture (`actionPipeline`). Weapon attacks have 20+ steps, spells have 6 steps. Steps subscribe to events and emit new events. Feature riders (19 modules) are pluggable. Modals can pause/resume the pipeline.
- **Automation registry:** 200+ handler functions in `src/services/automation/`. Features declare automation metadata (type, trigger, damage expressions) that is collected, categorized, and dispatched at runtime.
- **Per-spell feature services:** ~47 service files in `src/services/rules/features/`, each implementing automation for a specific spell or class feature.

## Code Simplicity

- **Single source of truth:** One variable, one concept. Derive state once at the top of the function.
- **No duplication:** If the same check appears in multiple places, extract it.
- **Remove dead code:** When refactoring, delete unused variables and branches. Don't leave orphaned code "just in case."
- **No fallbacks:** Use `console.error` for error logging instead of silent fallbacks. Only use defaults for known values defined in the rules.

## Core Rules
- Never leave dead code.  It just confuses people later.
- Look for and re-use existing code and avoid duplicating code.
- If a map is active, use position on map, but if no map is active, assume all creatures are within range.
- There's no "out of combat" — there are always creatures.  There is always a combatSummary
- use getCombatSummary as the primary source of all creatures
- EVERY automation needs to log to the cmapaign log when trigged with details of the event.  If you are working on any automation, check to ensure it is logging, and add logging if it is not.
- Do not use fallbacks. use console.error messages instead so we do not swallow errors.  fallbacks are only where we have a new variable being populated with a known default value, defined in the rules.
