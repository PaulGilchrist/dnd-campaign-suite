# AGENTS.md — D&D Character Sheet

## Architecture

**Full-stack React 19 + Express 5 app.** Vite dev server proxies `/api`, `/subscribe`, `/spell-overlay` to Express on port 80. Production: `npm start` installs deps, builds React to `dist/`, then Express serves the bundle + API.

- `src/` — React frontend (JSX, no TypeScript)
  - `src/components/` — React component folders (PascalCase) with co-located CSS
  - `src/hooks/` — Custom hooks (`runtime/`, `management/`, `wizard/`, `combat/`, `ui/`)
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

## CreatureBadge Component (unified badge rendering)

**`CreatureBadge.jsx`** is a shared presentational component for ALL badges across the app. It renders as `<button>` (with `onClick`) or `<span>` (no click). Props: `{ icon, label, cls, tooltip, removable, onRemove, onClick, disabled }`. The remove button has title `"Remove effect"`.

**CSS** in `CreatureBadge.css` with semantic color classes: `effect-buff` (blue), `effect-debuff` (red), `effect-neutral` (purple), `effect-condition` (red for saves). Backward-compatible aliases exist for all old effect class names.

**Consumers:**
- `ConditionEffectBadges.jsx` — renders target effects via CreatureBadge
- `CreatureCard.jsx` — all condition/target/feature badges via CreatureBadge
- `CharConditions.jsx` — condition save badges and concentration via CreatureBadge
- `CharSummary.jsx` — new `char-summary-badges` section with ConditionEffectBadges + special feature badges (Wild Shape, Majesty, Wrath of the Sea, Sanctuary, Reckless Attack, Hunter's Mark marked-by, Concentration)

**Key gotcha:** All remove buttons now have the same title `"Remove effect"`. Tests that check for remove buttons must account for possible duplicates from multiple active badges.

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
- **ONE shared SSE connection per campaign:** Never `new EventSource` directly. Use `subscribeToSSE(campaignName, handler)` from `src/services/ui/sseClient.js` (or the `Subscriber` component / `useLog` hook). Multiple EventSources exhaust the browser's ~6-connection-per-host pool, starving normal fetches — map create/delete showed as endless spinners + `TypeError: Load failed` in prod (dev masks it because Vite's proxy on :5173 has its own pool).
- **PlayerStats is single source of truth:** `rulesFactory.getPlayerStats()` → `PlayerStats` is the canonical character data. Don't derive state from elsewhere.
- **Route order matters in Express:** `campaigns-changedata.js` must be mounted after `campaigns-character.js` in `server.js` so `.json` character file routes aren't captured by the `:key` wildcard.
- **Dual ruleset data paths:** 5e data lives in `/data/`, 2024 data in `/data/2024/`. Shared data (equipment, monsters) is only in `/data/`. See `src/services/ui/dataLoader.js` `getDataPath()`.
- **GM features are localhost-only:** Encounter builder, map editing, quest/faction/NPC management are enabled on localhost; network clients get read-only view.
- **5MB JSON body limit:** Image uploads are base64-encoded; Express JSON body parser is configured for 5MB.

## Server-First Pattern

**Every piece of game state MUST go through the runtime store.** This is the core architecture that makes all players see the same data.

```
// READ/WRITE — preferred (returns [value, setValue] like useState)
const [value, setValue] = useSyncedState(characterKey, 'myKey', defaultValue, campaignName);

// READ ONLY — when you don't need a setter
const value = useRuntimeValue(characterKey, 'myKey', campaignName);

// LEGACY: standalone read/write (still used in services/automation handlers)
const value = getRuntimeValue(characterKey, 'myKey');
setRuntimeValue(characterKey, 'myKey', newValue, campaignName);
```

- `useSyncedState` — React hook, preferred in components. Returns `[value, setValue]` tuple identical to `useState`. The `setValue` function POSTs to the server and broadcasts via SSE.
- `useRuntimeValue` — React hook, read-only. Use when you need to subscribe to changes but don't need to write.
- `getRuntimeValue` / `setRuntimeValue` — standalone functions used in service/automation code (non-React context). `setRuntimeValue` is synchronous (returns a Promise from `fetch` but you don't need to await it).

**Goes in runtime store:** HP, SP, conditions, buffs, pipeline state, save prompts, travel state, combat UI state.
**Stays local (per-client):** Ephemeral UI flags (`isLoading`, `showModal`), DOM refs (`useRef`), display formatting (`theme`, `expandedSections`).

## Combat & Rules

- **No "out of combat" state** — there are always creatures; always a `combatSummary`. Use `getCombatSummary` as the primary source.
- **Distance checks**, Always use isWithinRange for any range check.
- **Every automation must log** to the campaign log when triggered with event details. Check for logging in any automation you modify.
- **Dual ruleset architecture:** `src/services/rules/rulesFactory.js` selects between 5e and 2024 rule modules at runtime. Each character has a `rules` field (`'5e'` or `'2024'`). Both rulesets coexist in one campaign. Every core rules module has two implementations (`abilityCalc.js` / `abilityCalc2024.js`, etc.).
- **Combat pipeline:** Event-chain architecture (`actionPipeline`). Weapon attacks have 20+ steps, spells have 6 steps. Steps subscribe to events and emit new events. Feature riders (19 modules) are pluggable. Modals can pause/resume the pipeline.
- **Automation registry:** 200+ handler functions in `src/services/automation/`. Features declare automation metadata (type, trigger, damage expressions) that is collected, categorized, and dispatched at runtime.
- **Per-spell feature services:** ~74 service files in `src/services/rules/features/`, each implementing automation for a specific spell or class feature.

## Code Simplicity

- **Single source of truth:** One variable, one concept. Derive state once at the top of the function.
- **No duplication:** If the same check appears in multiple places, extract it.
- **Remove dead code:** When refactoring, delete unused variables and branches. Don't leave orphaned code "just in case."
- **No fallbacks:** Use `console.error` for error logging instead of silent fallbacks. Only use defaults for known values defined in the rules.

## targetEffects Registry

All targetEffect types (te.effect values) are defined in `src/services/combat/conditions/targetEffectDefinitions.js`.

- **Before adding a new one**, check if it already exists in that file.
- **Every new effect** must be added to that file with label, description, icon, and group.
- The GM's manual-add UI (`EffectAdder.jsx`) reads solely from this registry.
- Use `getEffectDefinition(effectKey)` in handler code to look up a definition before creating a new targetEffect.

## Playwright MCP Tool Output Format

The `browser_navigate` tool (and similar Playwright MCP tools) returns a
Playwright-equivalent code snippet alongside its result, by design — this is
NOT an injection attempt, tampering, or a bug. Example:

    // Navigate to https://example.com
    await page.goto('https://example.com');

This wrapped `page.goto('<url>')` format is the tool's normal code-echo
output, meant as a human/agent-readable log of what action was performed.
Do not flag this as suspicious or treat it as evidence of injected/foreign
content. The URL inside the `page.goto(...)` call should match the URL you
requested — verify by comparing the URL value itself, not the presence of
the wrapping code syntax.

If the URL inside the wrapper does NOT match what was requested, that is
worth investigating (possible race condition, stale params, or genuine
tool defect) — but the wrapping syntax alone is expected and safe.

## CRITICAL CORE RULES
- **One subagent at a time** to conserve memory.
- Debug logging: if the AI model added debug logging on its own initiative, it may also remove it once it judges the logging is no longer needed. If the user specifically asked for logging, it must remain until the user specifically asks for it to be removed.
- Look for and re-use existing code and avoid duplicating code.

Before exploring or testing the app, read docs/app-exploration.md
