# D&D Campaign Suite — Architecture

> **Generated:** 2026-11-25 · Full regeneration from a sequential 5-segment repository survey (root/tooling, server internals, app shell/hooks, services layer, components), plus measured repository statistics. This document supersedes all prior architecture docs (previous version dated 2026-10-01).

---

## 1. High-Level Overview

D&D Campaign Suite is a full-stack, browser-based virtual tabletop: character sheets for two coexisting rulesets (5e and 2024 Essentials), encounter building, initiative-tracked combat with an event-chain rules pipeline, tactical indoor grids (2D SVG + 3D Three.js) and outdoor hex-travel maps with fog of war, campaign world management (NPCs, quests, factions, settlements, sessions, inventory, notes), a shared campaign log, server-authoritative dice, a spell-overlay broadcast lane, and a locally-hosted AI referee/designer integration.

The defining architectural idea is **server-first state**. All game state (HP, conditions, combat, map positions, buffs, prompts) lives in an Express-hosted in-memory store that is the single coordination point for every client. The React client is optimistic: writes POST to the server, the server fans out over **one shared SSE connection per campaign**, and echo adoption is memory-only (`skipSync`) to prevent re-POST loops. Disk persistence is eventual (debounced write-behind); clients are immediate.

Deliberate omissions: **no routing library** (a single `activeView` string in `App.jsx`), **no React Context/Redux** (a module-level pub/sub store), **no database** (flat JSON files), **no TypeScript** (JS/JSX only), and **no game timers** (strictly turn-based; timers exist only for benign UI concerns).

### Repository shape (top level)

| Path | Role |
|---|---|
| `server.js` | Single Express 5 entry point: middleware chain, route mounting, static serving, SSE + SPA fallback |
| `server/` | Express layer: routes, shared utils (change-data store, CRUD factory, locks, guards), AI services, validators |
| `src/` | React 19 app: `App.jsx` shell, `components/` (31 feature folders), `hooks/` (incl. the runtime store), `services/` (rules engine, combat pipeline, automation), `routes/config.js` (view registry) |
| `public/data/` | Read-only 5e rules JSON (24 files); `public/data/2024/` adds 8 2024-Essentials files |
| `public/campaigns/:name/` | Runtime campaign data: character JSONs, `data/*.json` entity + store files, `maps/`, `images/` |
| `tests/e2e/` | Playwright smoke tests (intentionally minimal; unit/integration weight lives in co-located Vitest files) |
| `config/`, `scripts/` | Generated ESLint complexity baseline; codegen/dev scripts (audio cues, monster manifest, complexity ratchet) |
| Root `*.mjs`/`*.cjs` | Dev/authoring tools only: dungeon + hex-terrain generators (thin CLI wrappers over `src/services/maps`), JSON compressor, coverage analyzer |

**Scale (measured 2026-11-25):** ~273K lines of non-test source across 1,010 `src` JS + 437 JSX + 63 server JS files; **3,575 co-located test files** (test-to-source file ratio ≈ 2.4:1 — the suite is the primary behavioral spec); 3,053 commits in the trailing 90 days.

### Runtime topology

- **Dev:** `npm run dev` runs Express (:80) + Vite (:5173) concurrently. Vite proxies `/api`, `/subscribe`, `/spell-overlay` with `changeOrigin: false` — critical because server GM-guards read `req.hostname` from the real Host header (a LAN-origin tab must honestly present as a visitor). `/subscribe` proxy has `timeout: 0` for SSE.
- **Prod:** `npm start` → install + Vite build to `dist/` + `node server.js`. Express serves `public/` **before** `dist/` so live rule/campaign files are never shadowed by stale Vite-copied builds; hashed `dist` assets are immutable-cached, everything else no-store.
- Server listens on `PORT || 80`; `keepAliveTimeout 15s` / `headersTimeout 120s` tuned to kill Safari stale-idle POST failures (SSE is immune via its own 15s pings).

---

## 2. Module-by-Module Breakdown

### 2.1 Server (`server/`)

**Composition (`server.js`).** Middleware order: CAMPAIGN_LOCK phase-1 path guard → `express.json({limit:'5mb'})` (base64 image uploads) → lock phase-2 body guards (create/rename read body fields) → CORS `*` → no-store headers on campaign GETs → missing-campaign 404 guard → static `public/` → static `dist/` → SSE routes. API routers are `app.use`'d **after `app.listen()`** — legal in Express but makes the file read out of order.

**Route mounting is a wildcard-capture discipline.** Specific campaign-scoped routers (server-config, maps, encounters, notes, npcs, quests, factions, settlements, sessions, inventory, basic, character, roll, ai, starter-seed, meta, token-image) mount **before** the generic `campaigns-changedata.js` `:campaign/:key` wildcard. The log route mounts **after** and depends on the wildcard's explicit `next()` fallthrough when `key === 'log'` or `key.endsWith('.json')`. The PUT wildcard handles only the `spell-overlay` sentinel and defers everything else — overlay data can flow only through its dedicated route.

**Route domains:**
- *Runtime store:* `campaigns-changedata.js` (GET/POST/PATCH/PUT/DELETE over the in-memory `characterChangeData` map; positioning, music, active-map lanes).
- *Characters/admin:* `campaigns-character.js` (per-character JSON CRUD), `campaigns-basic.js` (campaign list), `campaigns-admin.js` (campaign create/rename/delete, change-data census, clear-log, full-reset, snapshot/rollback — GM-only).
- *Maps:* `maps.js` (CRUD/activate/rename/description, GM-gated; a narrow non-GM all-tab PUT lane for outdoor party-travel fields only), `token-image.js`.
- *Entity CRUD:* `encounters/factions/notes/npcs/quests/sessions/settlements/inventory.js` — most built from the shared factory.
- *AI:* `campaigns-ai.js` (referee/director — **proposals only**, fail-closed to `needs_human`), `ai-designer.js` (draft-generating designer), `ai-key.js`/`ai-models.js`.
- *Infrastructure:* `campaigns-roll.js` (server crypto dice, gated by `enforcement.serverDice`), `sse.js` (`/subscribe` registry + boot snapshot replay + SPA fallback regex `^(?!/(api|spell-overlay)).*`), `spell-overlay.js`, `server-config.js`, `log.js`.

**`server/utils/` (the server's heart):**
- `changeData.js` — module-owned singletons (`characterChangeData` Map, `spellOverlayData` Map, `activeMaps`, `subscribers`); boot hydration via `readFile()`; `markDirty()` → 2s debounced `saveFile()` (writes only when serialized content differs, plain `writeFileSync` — not atomic); `publish(key, data, campaign)` fans out to SSE subscribers filtered by campaign. Also character-purge on delete/rename and a warn-only phantom-bucket observer.
- `jsonEntityCrud.js` — `createJsonEntityRouter(entityName, options)` factory writing `public/campaigns/:c/data/<entity>.json`. Concurrency model: `updatedAt` epoch stamps; stale echo, missing-disk-row, and deleted-row resurrection each return 409; discriminators are shared with per-entity PUT lanes so both write paths cannot drift. `hideDraftsFromPlayers` filters draft rows. The **bestiary-name guard** (in `routes/npcs.js`, not the factory) rejects any NPC named after a `monsters.json` creature — enforcing the owner invariant that pre-made monsters never live in `npcs.json`.
- `campaignLock.js` — env `CAMPAIGN_LOCK` restricts all writes to one campaign (path middleware + create/rename body guards).
- `gmGuard.js` — canonical `isLocalhost(req)` (Host-header based, follows hostname not socket IP, includes `::1`). Legacy per-route copies remain in maps/quests/notes (drift, §6).
- Others: `imageUtils.js` (base64 → decoded bytes on disk; base64 never persisted), `campaignPaths.js`, `campaignSnapshots.js`, `characterName.js`, `changeDataKeys.js`, `noStoreApi.js`, `asyncHandler.js`, `nameUniqueness.js`.

**`server/services/ai/`** — provider abstraction (local OpenAI-compatible endpoint; key + config in gitignored `server/config/ai-local.json`, writable only from localhost, never returned unmasked, bypasses change-data/SSE entirely). Designer/apply/schemaValidator/storyBible; proposals are schema-validated and executed only through the existing gated lanes.

**`server/validation/keyValidators.js`** — per-key schema validators for change-data writes (turnState shapes, authority keys, sanity caps).

### 2.2 App shell (`src/main.jsx`, `src/App.jsx`, `src/routes/`)

- `main.jsx` renders `<App/>` with **no StrictMode** (double-mount would double-fire server-first write lanes) and imports global CSS + Font Awesome.
- `App.jsx` (~1,309 lines, at the ESLint max-statements ceiling — hence module-scope helper hooks): single `activeView` string; `routes/config.js` `VIEWS` registry maps view names → components (17 sidebar views + overlays); `CharSheet` is keyed by character name to force clean remounts.
- **Campaign enter seam:** `useCampaignEnterGate` gates all rendering on ONE bounded 10s change-data GET (`services/campaign/changeDataSnapshot.js` — the "single-GET law": hydrate + seed + combatSummary preload share one request). Failure shows a retry face.
- **Campaign-switch rescope:** `useCampaignScopeRescope` evicts bare-name-keyed character stores and adopt-and-replaces the shared `'campaign'` store from the new snapshot — memory-only, never re-POSTed; a null snapshot never evicts.
- **SSE consumption:** one `<Subscriber>` at the shell; `handleRuntimeEvent` strips the `change-<campaign>-` prefix and routes echoes into `applyStoreUpdate` (null echo = key REMOVE) + combat-summary cache sync; map-activate events arm the map ("never hijack"); save-prompt echoes re-dispatch as window events.
- Persistent shell mounts outside the view outlet: MusicPlayer, wizard overlays, SavePrompt/DeathSave/Concentration modals, HelpDrawer, LevelUpCelebration, CombatCues, CampaignReloadNotice, MapContextSync.

### 2.3 Hooks (`src/hooks/`)

- **`runtime/` — the client store.** `useRuntimeState.js` owns `Map<characterKey, Map<prop,value>>` + per-key listener sets. `setRuntimeValue` = optimistic local set + notify, then fire-and-forget whole-bucket POST; `skipSync` variants (`setRuntimeObject`, `replaceRuntimeObject`) adopt SSE echoes memory-only; `deleteRuntimeKey` drains-to-evict. `useSyncedState` exposes `useState`-shaped access to that store; `useRuntimeValue` is the read-only subscription with a ref-equality guard. `useAppData` loads both rulesets' JSON; `useLog` fetches + SSE-subscribes the log; `useSSEEqualityGuard` wraps any setState fed by SSE handlers; `useTrackedResource` syncs spell slots/pools with read-clamp to derived max.
- **`management/`** — campaign/character/encounter/travel/gm-copilot/map-history/reload-guard managers.
- **`wizard/`** — character-creation wizard session + ~15 step hooks.
- **`combat/`** — mostly logic services co-located with hooks: d20 computation, hit/save/target resolution, initiative processing, spell gates/metamagic/upcast flows, dice-roll logging hooks.
- **`ui/`** — small-screen, modal-dismiss, focus, roving-menu, TV-mode, data-index helpers.
- **root** — `useCrudList`/`useEntityManagement` (generic client CRUD-list factory shared by all entity screens), `useAsyncData`, `useAllySelection`.

### 2.4 Services (`src/services/`) — the domain brain

- **`rules/rulesFactory.js`** — dual-ruleset switch: reads `character.rules` (`'5e'`/`'2024'`) and selects paired core modules (`abilityCalc.js` ↔ `abilityCalc2024.js`, etc.). `getPlayerStats()` builds the canonical **PlayerStats** object (class/race/equipment/spells + ruleset folds + `automation.passives`) consumed everywhere downstream. Core modules in `rules/core/` cover abilities, attacks, spells, AC, initiative, senses, proficiencies, maneuvers, carrying capacity, tracked resources.
- **`rules/features/` (~91 non-test services)** — one file per spell/feature exporting a `triggerX(...)`; **static discovery** via `spellCastService/execution/triggerSpells.js` name→function map.
- **`combat/actionPipeline.js`** — event-chain runner: steps declare `{subscribe, emit, condition(ctx), handler(ctx)}`; `run()` advances `result.nextEvent || step.emit`, merges handler data into ctx, notifies observers (`'*'` for logging/SSE); `null` aborts. **Modal pause/resume** snapshots ctx into a resume ref and re-enters at the paused step's emit. Concrete chains live in `combat/steps/` (attack lane ~20 steps; spell lane ~6).
- **`combat/conditions/`** — the **targetEffects system**: `targetEffectDefinitions.js` is the single registry of every `te.effect` (label, description, icon, badge class, group, defaults); the GM picker reads only this file. Siblings compute/apply condition effects, save prompts (indefinite waits), death saves, exhaustion, token status. `getCombatSummary` (in `encounters/combatData.js`) caches the server combat context (initiative order, active creature, round).
- **`automation/`** — two halves: *collection* (`combat/automation/automationCollector` + `automationRouter` bucket JSON-declared `automation` metadata from rules data into passives/actions/bonusActions/reactions/specialActions on PlayerStats) and *dispatch* (`automation/index.js` `HANDLER_MAP`: ~200 literal type→handler entries; `executeHandler` awaits the resolved handler and returns popup/modal results). `automation/common/` holds shared infra (damage/healing rolls, rollback, save prompts, once-per-turn latches, target resolution); `handlers/` holds ~170 domain-grouped handler files. **Every triggered automation logs to the campaign log.**
- **`maps/`** — view-agnostic generators (dungeon, adjacent-dungeon, room, hex-terrain, settlement; seeded `rng.js`), placement, and lighting/line-of-sight math that feeds fog; fog *state* lives in map hooks.
- **`ui/`** — `sseClient.js` (**the ONE EventSource per campaign**: module-level source map, handler fan-out, last-unsubscriber closes; reconnect-error log hygiene), `logService.js` (`addEntry` shared logging helper), `dataLoader.js` (`getDataPath()` 5e vs 2024), `storage.js`, audio/music.
- Others: `dice/` (single roller + forced rolls), `items/` (loot generation/auto-reward), `character/` (class/race rules both rulesets, level progression, ruleset-switch preview), `encounters/` (combat context, initiative service, encounter→initiative seam, monster AI family), `npcs/` (custom-NPC helpers, GM monster execution, client-side bestiary guard mirror), `campaign/` (campaign CRUD, travel/weather services, seed, snapshot), `ai/` (client + proposal-application validators), `shared/` (hpModifier, buffApplier, popupResponse, etc.).

### 2.5 Components (`src/components/`, 31 folders)

- **Campaign lifecycle:** `campaign-selection`, `campaign-builder` (AI-assisted design), `campaign-starter`, `campaign-empty-state`, `campaign-enter-failed`.
- **Character:** `char-sheet` (the largest surface: root sections + `char-summary/`, `char-spells/`, `char-feats/`, `modals/` (~120 feature modals, arcane/divine/racial/shared), `popups/`, ~15 co-located hooks; handlers factored to `CharSheet.handlers.js`; pipeline-pausing modals orchestrated by `CharActionModals.jsx`), `character-creation` (wizard + choice modals), `level-up` (thin celebration delegating to the wizard).
- **Maps:** `map` (2D is **SVG**, not canvas: `Map.jsx` + ~30 one-file-per-prop `*SVG.jsx` layers, ~22 hooks incl. `useMapLoader`, `useFogOfWar`, `usePlayerDragging` with movement budget, `useRuler` (purely local), `useSpellOverlay`; `Map3D/` wraps an imperative Three.js scene with `map3dVisibility.js` sharing visibility predicates with the 2D layers — "never a second source of truth"), `hex-map` (outdoor travel, own 3D + weather layers), `maps-manager` (GM CRUD + generation/dress modals).
- **Combat:** `initiative` (board + TV presentation; handler factories turn clicks into pipeline/runtime writes), `encounter` (Encounter Builder + GM monster lane: avatar → `MonsterCardModal` (3,342 lines, largest component) → dice chips roll through `handleAttack`), `gm-screen` (explicitly read-only presentation over one SSE lane).
- **Entity CRUD screens:** `npcs`, `quests`/`quest-board`, `factions`, `settlements`, `sessions`, `notes`, `party-inventory` — same screen pattern per domain via the client CRUD-list factory. `log` renders ~25 entry-type components via a dispatcher.
- **GM/AI tools:** `campaign-admin` (referee config, backups, census, lockdown), `GMCopilot`, `HelpDrawer`.
- **Shared:** `common` (CreatureBadge — the unified button/span badge used by every badge surface; Subscriber; SavePromptModal (1,254 lines); avatars; popups; delete/discard dialogs), `sidebar` (NAV_ITEMS with `localhostOnly` gating), `error-boundary`.

### 2.6 Data layer

- **Static rules data:** `public/data/` (24 files: classes, races, feats, spells, monsters, equipment, magic-items, conditions, etc.) + `public/data/2024/` (8 files). Shared data (equipment, monsters) exists only under `/data/`. Immutable-cached in prod.
- **Campaign runtime:** `public/campaigns/:name/` — character JSONs (`:PlayerName.json`), `images/`, `maps/`, and `data/`: `character-change-data.json` (whole runtime store), `campaign-log.json`, `spell-overlays.json` (deleted when empty to prevent resurrection), `campaign-meta.json`, and one file per entity lane (`npcs/quests/factions/settlements/sessions/notes/encounters/inventory/design-notes.json`).

---

## 3. Data Flow Summary

**Read path (client boot):** `main.jsx` → `App.jsx` → campaign selection → `useCampaignEnterGate` single GET (change-data snapshot + rules preload) → stores seeded → `<Subscriber>` opens the one EventSource → server `/subscribe` replays a per-key boot snapshot from the same in-memory Maps → late joiners converge without a second fetch.

**Write path (game state):** component calls `useSyncedState` setter / service calls `setRuntimeValue` → optimistic local store set + listener notify (instant UI) → fire-and-forget POST `/api/campaigns/:campaign/:key` → server key validators → Map mutation → `publish()` SSE fan-out to all same-campaign clients (immediate) + `markDirty()` 2s debounced disk write (eventual) → originating client adopts its own echo with `skipSync` (memory-only; re-POSTing would loop).

**Combat flow:** UI action → combat hooks build context (`contextBuilder`) from PlayerStats + runtime buckets → `actionPipeline.run()` steps through rolls/riders/damage, pausing on modal results and resuming from user answers → handlers write HP/conditions/targetEffects via the store and `addEntry()` to the log → log + change-data SSE broadcasts update every client's initiative board and sheet. TargetEffects render through the registry → CreatureBadge on sheet and cards.

**Server dice / AI lanes:** roll endpoint computes with crypto RNG, logs + broadcasts (gated by enforcement flag). AI referee produces schema-validated *proposals* only; application re-enters through the same gated write lanes; AI never writes directly.

**Overlay lane (deliberate exception):** `/spell-overlay` is visitor-writable shared-table authoring (anyone at the table may place zones; Clear-All clears everyone's) — gated only by CAMPAIGN_LOCK, stored off the runtime store in its own Map/file, replayed on SSE connect as `spell-overlay-<campaign>`.

---

## 4. Dependency Graph (textual)

```
main.jsx
 └─ App.jsx ──────────────┬─ routes/config.js (VIEWS registry)
     │                    ├─ hooks/management/* (campaign, characters)
     │                    ├─ hooks/runtime/*   ◄── the client store (all game state)
     │                    ├─ services/ui/sseClient (1 EventSource/campaign)
     │                    └─ components/* (views; PascalCase folders)
     │
components/* ─────────────► hooks/runtime (useSyncedState/useRuntimeValue)
 │                        ► services/rules/rulesFactory → PlayerStats (canonical)
 │                        ► services/combat/* (pipeline, steps, conditions)
 │                        ► services/automation (HANDLER_MAP dispatch)
 │                        ► services/ui/logService.addEntry → POST /log
 └───────────────────────► services/maps/* (generators, LOS/lighting)

services/* ───────────────► hooks/runtime (getRuntimeValue/setRuntimeValue)   [449 files]
 └─ combat/automation ─────► rules/features/triggerX + conditions/targetEffects

server.js ────────────────► server/routes/* ──► server/utils/changeData (Maps)
 entity routes ────────────► utils/jsonEntityCrud ──► public/campaigns/:c/data/*.json
 changeData.publish ───────► routes/sse (/subscribe fan-out + boot replay)
 routes/ai* ───────────────► services/ai/{providers,authoring} ─► local LLM endpoint
 client ⇄ server: fetch (REST) + EventSource (SSE) only — Vite proxy preserves Host header
```

Layering rule: components → hooks/services → store/fetch; services never import components; the store module is the sole client-side state owner. Server utils are shared by routes; routes never import each other (the changedata→log fallthrough is middleware `next()`, not an import).

---

## 5. Key Architectural Decisions (ADR-style)

1. **Server-first runtime store** — All game state flows through the Express in-memory store; localStorage for game data is forbidden (custom ESLint rules `no-window-access`, `no-local-game-state` enforce). *Consequence:* multiple tabs/clients converge by construction; complexity moves into echo/skipSync discipline.
2. **One shared SSE connection per campaign** — `sseClient.js` multiplexes handlers on a single EventSource; direct `new EventSource` is banned. *Rationale:* browsers cap ~6 connections per host; duplicate sources starve fetches (observed as endless-spinner bugs). *Tradeoff:* fan-out bookkeeping in one module.
3. **Flat-file JSON persistence with write-behind** — no database; 2s debounce + content-diff writes; log has its own 1s debounce. *Consequence:* trivially inspectable state, snapshots/rollback for free; not atomic — crash between dirty and flush loses ≤2s.
4. **Optimistic writes + skipSync echo adoption** — instant UI, SSE echoes applied memory-only (`replaceRuntimeObject`), null echo = key removal. *Rejected:* request/response-only rendering (too slow for a shared table).
5. **Dual-ruleset via paired modules + factory switch** — every core rules module has a `*2024.js` twin selected per character by `rulesFactory`. *Consequence:* two implementations to maintain per rule; rulesets coexist in one campaign.
6. **Event-chain combat pipeline with modal pause/resume** — snapshot-and-resume context instead of async/await linear scripts. *Rationale:* 20+ attack steps, any of which can pause indefinitely for a user modal; no timers may auto-resolve prompts.
7. **Metadata-driven automation** — rules JSON declares `automation` blocks; a collector/router buckets them onto PlayerStats; a ~200-entry `HANDLER_MAP` dispatches. *Consequence:* adding a feature = data + one handler + registry entry, no framework change; the map is static (no dynamic import magic).
8. **Strictly turn-based: no game timers (owner policy)** — game state never advances on wall-clock time; durations ≥1 minute are combat-scoped; adjudication prompts wait forever. Enforced by `npm run guard:no-timers` allowlist.
9. **GM authority = Host-header localhost** — `isLocalhost(req)` follows the Host header (Vite proxy preserves it), so LAN tabs are honestly visitors; only `/spell-overlay` is intentionally visitor-writable (shared-table authoring, owner-ratified 2026-11-08).
10. **No backward compatibility (owner policy)** — never released ⇒ no legacy-format fallbacks; one canonical shape per concept; stored campaign JSON migrated once, in the same change, on cold disk.
11. **Bestiary-name invariant enforced at the server** — pre-made monsters never live in `npcs.json`; a plain-English 400 guard prevents placeholder shadowing of real `monsters.json` stat blocks.
12. **AI is proposal-only and fail-closed** — referee/director output is schema-validated and executed only through existing gated lanes; designer output is `draft:true` and hidden from non-GMs; keys never leave the server.
13. **No router, no Context** — a `VIEWS` string registry and a module-level pub/sub store replace both. *Rationale:* smaller surface, easier SSE-driven rescope; ESLint max-statements pushes App.jsx logic into module-scope hooks.
14. **Test-heavy co-location** — 3,575 `*.test.{js,jsx}` files sit beside source with feature-ID-named cases; global test setup fakes fetch/EventSource/Audio/localStorage. Unit/integration carry the load; Playwright is a deliberate smoke minimum.

---

## 6. Known Constraints & Assumptions

- **Single-process server; in-memory authority.** Horizontal scale-out is impossible without replacing `changeData.js` singletons; disk writes are `writeFileSync` (no atomic tmp+rename) — a hard crash can lose the last debounce window.
- **Route mount order is load-bearing** (before/after the `:campaign/:key` wildcard; the log fallthrough depends on changedata's `key === 'log'` guards). Reordering routes can silently break lanes.
- **GM gating trusts the Host header**, correct under the shipped Vite proxy and direct hosting, but any fronting reverse proxy that rewrites Host would misclassify visitors as GMs — deployment behind a proxy must set/forward Host deliberately.
- **CAMPAIGN_LOCK allows exactly one campaign name** (env, in-memory); dev workflows that need multiple unlocked campaigns must run without it. `test-campaign` is the only agent-permitted campaign.
- **Character stores are bare-name-keyed** across campaigns; correctness depends on the rescope eviction seam (`useCampaignScopeRescope`) — any new store-owning view must participate.
- **SSE keepalive is Safari-sensitive** (15s pings, `timeout: 0` proxy lane); bfcache is disqualified while an EventSource is open.
- **Shared rule data exists only in `/data/`** (equipment, monsters) — the 2024 lane cannot diverge there.
- **5MB JSON body limit** bounds base64 image payloads; images are decoded to disk immediately (base64 never persisted).
- **No auth beyond origin gating** — LAN trust model: localhost = GM, others = visitors; there are no accounts or per-player characters.
- **App.jsx sits at the lint statement ceiling**; new shell behavior must land in module-scope hooks, not the component body.
- **AI requires a local OpenAI-compatible endpoint** configured out-of-band (`server/config/ai-local.json`); modes off/suggest/autopilot with fail-closed behavior.

### Architectural drift observed (2026-11-25)

- **GM-guard duplication:** canonical `utils/gmGuard.js` coexists with legacy per-route `isLocalhost`/`refuseUnlessGm` copies in maps/quests/notes.
- **Monolith components:** `MonsterCardModal` 3,342 · `SaveAttackAoeModal` 2,222 · `PartyInventory` 1,431 · `Initiative` 1,316 · `App` 1,309 · `maps.js` 1,302 · `SavePromptModal` 1,254 · `CampaignAdmin` 1,204 · `Map` 1,045 · `HexMap` 1,015 lines.
- **Inconsistent factoring between families:** char-sheet/initiative extract handler hooks into sibling files; CRUD screens (npcs/settlements/sessions/notes) keep logic inline in the screen component.
- **Folder-name drift:** `GMCopilot/`, `HelpDrawer/` PascalCase among otherwise kebab/camel folders (both are single-component folders).
- **Parallel map lanes:** `map/` and `hex-map/` keep separate toolbars, hooks, and 3D sub-lanes with conceptually shared behavior; avatar resolution is duplicated (acknowledged in a Map3D comment).
- **Complexity grandfathering:** `config/complexity-baseline.js` ratchets lint suppressions — a growing debt ledger rather than a fixed one.
- **Server.js reads out of order** (routers mounted after `listen()`) — correct but surprising for maintenance.
- **`src/models/` is vestigial** (one file); domain types effectively live in services — the project has no type system to compensate (JS-only by policy).

---

## 7. Recommended Future Improvements

1. **Consolidate GM guards:** migrate every route copy to `utils/gmGuard.js` (`isLocalhost` + a single `refuseUnlessGm` middleware), delete local copies, and pin behavior with shared supertest helper (`server/test-utils/localhostSupertest.js`).
2. **Atomic persistence:** tmp-file + rename in `changeData.js`/`jsonEntityCrud.js` writes; closes the crash-window hole and removes the only non-atomic disk path.
3. **Decompose hotspots:** apply the proven char-sheet pattern (handlers → co-located hooks/factory files) to `MonsterCardModal`, `SaveAttackAoeModal`, `PartyInventory`, and the inline-logic CRUD screens; fold `map/` and `hex-map/` shared behavior (toolbars, visibility predicates, avatar resolution) into common modules.
4. **Ratchet the complexity baseline down:** with each hotspot decomposition, regenerate `config/complexity-baseline.js` with fewer entries (`lint:complexity-ratchet`) so grandfathered debt only shrinks.
5. **Route-table refactor in `server.js`:** group mounts into an ordered array with comments stating each before/after wildcard dependency, keeping routers mounted after `listen()` if desired but making the capture-order contract mechanical rather than line-order.
6. **Multi-campaign lock:** allow `CAMPAIGN_LOCK` to take a list (already the de-facto dev pattern via inline env) so QA campaigns (`qa-arena`, `qa-starter`) are first-class without ad-hoc strings.
7. **Lightweight domain types:** since no TypeScript is permitted, consider JSDoc typedefs (or generated checklists from `keyValidators.js`) for `PlayerStats`, combat-summary, and targetEffect shapes, validated in dev mode — compensating for the missing type system where drift is costliest.
8. **Key-registry parity:** share `server/validation/keyValidators.js` schemas with the client (single source for change-data key shapes) so client writes fail fast locally rather than 400ing server-side.
9. **Expand the e2e floor minimally:** the smoke suite is intentionally thin, but the campaign-enter seam and the SSE echo/skipSync loop guard are the two system-level invariants no unit test fully covers — one Playwright two-tab test per invariant would lock them.
10. **Document the overlay lane in code:** the visitor-writability of `/spell-overlay` is intentional but surprising; the route file itself should carry the owner-ratification comment pointer (currently the matrix lives only in AGENTS.md).

---

*End of document. Generated 2026-11-25 by sequential subagent survey; re-run the `architecture-docs` command to regenerate in full.*
