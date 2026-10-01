# D&D Campaign Suite — Architecture

> **Generated:** 2026-10-01 · Regenerated in full from a sequential 8-segment repository survey (server, services, rules/combat, automation, hooks, components, data, test infra). This document supersedes all prior architecture docs.
>
> **Stack:** React 19 (JSX, no TypeScript) · Express 5 · Vite 8 · Vitest 4 · Playwright · Three.js (3D map viewer) · JSON flat-file persistence · SSE real-time sync.

---

## 1. High-Level Overview

D&D Campaign Suite is a full-stack, browser-based virtual tabletop for hosting D&D campaigns: character sheets (5e and 2024 Essentials rulesets in one app), encounter building, initiative tracking, tactical grid + hex maps with fog of war and a 3D viewer, campaign world management (NPCs, quests, factions, settlements, travel, weather), a shared campaign log, dice rolling, and a spell-overlay broadcast.

The defining architectural idea is **server-first state**: all game state (HP, conditions, combat, map positions, buffs) lives in an Express-hosted in-memory store that is the coordination point for all clients. The React client is optimistic: writes POST to the server and broadcast to every other client over **one shared SSE connection per campaign**. The heaviest client-side logic is the rules engine and the event-chain combat pipeline, both living in `src/services/`.

There is **no routing library** — `src/App.jsx` switches views manually via an `activeView` string — and **no React Context** — state flows through a module-level runtime store with its own pub/sub.

### Repository shape (top level)

| Path | Role |
|---|---|
| `server.js` | Express entry point: middleware stack, static serving, route mounting, startup |
| `server/` | Route files (46), utils (14), test-utils |
| `src/` | React frontend (~3,580 files: 1,510 components, 1,735 services, 310 hooks) |
| `public/data/` | Static 5e + shared rules JSON (~10 MB, 25 files) |
| `public/data/2024/` | 2024 Essentials rules JSON (8 files) |
| `public/campaigns/<name>/` | Runtime campaign data (character sheets, entities, maps, images, change-data) |
| `docs/` | Architecture, user guide, exploration map, test registries/manifests |
| `config/` | ESLint complexity ratchet baseline |
| `scripts/`, root `*.mjs`/`*.cjs` | One-off generators and analysis CLIs |
| `demos/3d-map/` | Standalone prototype for the 3D map feature |

**Commands:** `npm run dev` (Vite :5173 + Express :80 concurrently; Vite proxies `/api`, `/subscribe`, `/spell-overlay`), `npm run api`, `npm run build`, `npm start` (install → build → serve), `npm run lint` (zero-warning flat ESLint), `npm run test:run` (Vitest), `npm run test:e2e` (Playwright — currently orphaned, see §9).

---

## 2. Directory-Level Responsibilities

### 2.1 Server (`server.js` + `server/`)

- **`server.js`** — Express 5, port `PORT || 80`. Middleware order: optional `CAMPAIGN_LOCK` guard (rejects mutating `/api/campaigns/*` for non-locked campaigns; agent/CI safety) → `express.json({limit:'5mb'})` (base64 image uploads) → wildcard CORS → static `public/` **before** `dist/` (so live campaign data is never shadowed by stale build copies; `/data/*` immutable cache, rest `no-store`) → static `dist/` (hashed assets immutable) → SSE routes → API routes (all self-pathed under `/api/...`). Route mount order is load-bearing: `campaigns-character.js` before `campaigns-changedata.js` so character `.json` files aren't captured by the `:key` wildcard; the SSE SPA catch-all excludes `/api` and `/spell-overlay`. Starts disk-cache load, keep-alive pings, `saveFile()` on exit; `keepAliveTimeout=15s`, `headersTimeout=120s` (Safari fix).
- **`server/utils/changeData.js`** — the server-side runtime store: `characterChangeData` (Map campaign→object), `spellOverlayData`, `activeMaps`, `subscribers` (array of `{id,res,campaignName}`). Persists `public/campaigns/<c>/data/character-change-data.json` on a **2-second debounce** (AGENTS.md's "10s" is stale — see §9); writes only if serialized content changed; drops memory entries whose campaign dir vanished. `publish(key,data,campaign)` fans out SSE `data:{key,data}` frames filtered by client campaign.
- **`server/utils/jsonEntityCrud.js`** — CRUD factory (`createJsonEntityRouter`) generating GET list / GET id / POST whole-array overwrite / DELETE id over `public/campaigns/<c>/data/<entity>.json`, with `idField`, `transformList`, `authorizeRead`, `onDelete`, `extraRoutes` options. Generates **no PUT** — npcs/settlements hand-roll upsert PUTs.
- **`server/utils/campaignPaths.js`** — canonical path helpers (`campaignDir`, `campaignDataDir`, `campaignMapsDir`, `campaignImagesDir`, `.snapshots/`). Not yet used everywhere (several utils still compose `process.cwd()` paths).
- **`server/utils/imageUtils.js`** — base64 data-URL uploads → `public/campaigns/<c>/images/`, mutating the character JSON (`imagePath` set, inline `image` removed).
- **`server/test-utils/localhostSupertest.js`** — IPv4-forcing supertest wrapper (GM features gate on `req.hostname` being localhost/127.0.0.1).

**Route file map** (`server/routes/`, each with co-located tests):

| Route file | Owns | Storage / behavior |
|---|---|---|
| `sse.js` | `/subscribe` SSE, `/health`, SPA catch-all | Guid-per-client registration, snapshot on connect, 15s comment pings |
| `campaigns-basic.js` | Campaign + file listing | `public/campaigns/` directories |
| `campaigns-character.js` | Character sheets | `public/campaigns/<c>/<Name>.json`; GET/PUT/PATCH(deep-merge)/DELETE; image sync; publishes `character-*` events |
| `campaigns-changedata.js` | Runtime change-data keys | In-memory store → disk; generic GET/POST/DELETE `:key`, `/change-data`, `/positioning`; guards `key==='log'`; publishes `change-<c>-<key>` |
| `campaigns-admin.js` | Campaign lifecycle | Create/rename(migrates memory+imagePaths)/delete; `admin/*` localhost-gated: clear-change-data, clear-log, full-reset, snapshot/rollback/zip download/upload (multer 100 MB) |
| `maps.js` | Tactical maps | `public/campaigns/<c>/maps/<kebab>.json`; CRUD + rename/activate; `activeMaps` memory; publishes `maps-list-*`, `map-data-*`, `map-activate-*` |
| `encounters.js` | Saved encounters | `data/encounters.json`; CRUD + rename |
| `log.js` | Campaign log | `data/campaign-log.json`; own 1s debounce, 500-entry cap; publishes `log-<c>` per entry |
| `spell-overlay.js` | Spell AoE overlays | **Memory-only**; non-`/api` path `/spell-overlay?campaign=`; publishes `spell-overlay-<c>` |
| `pipeline-events.js` | Combat pipeline milestones | Stored inside `characterChangeData` under `pipeline-<c>-<key>`; re-published over SSE |
| `npcs.js`, `settlements.js` | NPCs / settlements | Factory CRUD + hand-rolled PUT upsert (near-copies of each other) |
| `notes.js`, `quests.js` | Notes / quests | Factory + localhost/privacy filtering |
| `factions.js` | Factions | Factory only — **no localhost gate** despite being a GM feature |

### 2.2 App shell (`src/` root)

- **`src/main.jsx`** — `createRoot(<App/>)`; global CSS + Font Awesome imports. (No `React.StrictMode`, contrary to AGENTS.md — see §9.)
- **`src/App.jsx`** (~650 lines) — the composition root. No router, no Context. Manual view switching via `activeView` string + boolean overlays (`campaignSelection`, wizard). Composes four app-level hooks — `useAppData` (loads all rules JSON for both rulesets), `useCampaignManagement`, `useCharacterManagement`, `useCharacterWizard` — wired together with **ref mirrors + registered callbacks** (`setCampaignSelectCallback` etc.) so stable callbacks reach latest setters without stale closures. Gates startup behind campaign selection and rules loading; computes `computedCharacters` via `rulesFactory.getPlayerStats`; seeds the client runtime store from `/change-data`; hosts the root `<Subscriber>` SSE dispatcher (`handleRuntimeEvent` → store keys with `skipSync=true`), root modals (SavePrompt, DeathSave, Concentration, BardicInspiration, ConditionChoice), `MapContextSync`, and theme (`data-theme` attribute). GM-only views gated by `isLocalhost`.
- **`src/routes/config.js`** — declarative `VIEWS`/`SIDEBAR_BUTTONS` config for the 11 sidebar views + overlays (App.jsx hardcodes its JSX branches rather than importing VIEWS — the config drives the sidebar only).
- **`src/config/`** — wizard constants, encounter XP/difficulty tuning, map/hex config, declarative wizard step definitions (`steps-config.js`), point-buy validation utils.

### 2.3 Hooks (`src/hooks/`, ~150 non-test)

| Folder | Focus |
|---|---|
| `runtime/` | **Server-first primitives** (below) + `useLog`, `useTrackedResource` |
| `management/` | App-level orchestration: campaigns, characters, wizard, encounters, travel |
| `combat/` (37) | Dice-roll/logging hooks, attack/spell resolution helpers, metamagic flows, damage-dispatch `handlers/` |
| `wizard/` (16) | Character-creation wizard step hooks |
| `ui/` | Static-data memo helpers (equipment search, monsters data, spell name index) |
| root | Generic `useAsyncData`, `useCrudList`, `useEntityManagement`, `useAllySelection` |

**Core runtime primitives (`src/hooks/runtime/`):**
- `useRuntimeState.js` — module-level store: `stores: Map<characterKey, Map>` + `listeners` pub/sub. `getRuntimeValue` / `useRuntimeValue` (per-key subscription with deep-equality re-render guard). `setRuntimeValue` — optimistic POST `/api/campaigns/:campaign/:key` (campaign-level keys POST per-property) then local `notify`; equality-guarded. `setRuntimeObject(key, obj, campaign, skipSync)` — merged object write; **`skipSync=true` skips the POST** (the SSE-echo contract). `setRuntimeBatch` — multi-key diff, one POST of the store snapshot. `seedTrackedResources` seeds HP/resources + `pendingExpirations` on load.
- `useSyncedState.js` — `useState`-shaped `[value, setValueSynced]` wrapper over the store (supports functional updaters); the preferred component API.
- `useSSEEqualityGuard.js` — deep-equality wrapper for `setState` calls inside SSE handlers (loop prevention layer 2; `skipSync` is layer 1).

**SSE contract:** exactly one `new EventSource` exists in the client — inside `src/services/ui/sseClient.js` `subscribeToSSE(campaignName, handler)`: singleton `Map<campaign,{eventSource,handlers}>`, fan-out to handler set, auto-close when the last handler unsubscribes. Consumers: `common/Subscriber.jsx` and `hooks/runtime/useLog.js`.

### 2.4 Services (`src/services/`, ~1,735 files incl. tests)

- **`rules/`** — the rules engine (§4). `rulesFactory.js` dual-ruleset dispatch; `core/` twin calculators; `combat/` damage/healing/cover; `features/` (~87 per-spell/class-feature services); `spells/spellCastService/` cast execution; `effects/` expiration queues, rest/trance.
- **`combat/`** — event-chain `actionPipeline.js`, `steps/` (attack/spell step builders + feature riders + SSE/log observers), `conditions/targetEffectDefinitions.js` (canonical target-effect registry), `automation/` (pipeline-side automation collector/router).
- **`automation/`** — 300-handler feature-activation library + `HANDLER_MAP` dispatcher + `contextBuilder` (§5).
- **`character/`** — character build/validation: class/race rules (dual), feat/skill/tool/resistance validation, buff computation services, feature categorization.
- **`campaign/`** — campaign CRUD client (`campaignService.js`), world domains (quests, factions, settlements + generator, travel, weather, random events, notes).
- **`maps/`** — maps HTTP service, hex math (`hexMapUtils.js`), procedural generators (dungeon BSP pipeline, hex terrain + rivers), LOS (`lineOfSight.js`, `effectiveWalls.js`), reachability, spell-overlay client (`spellOverlayService.js`).
- **`encounters/`** — encounter CRUD client, `combatData.js` (module-level cached `combatSummary` per campaign, SSE-seeded), `initiativeService.js` (combatSummary mutators), `encounterToInitiative.js` (expands encounter → initiative roster), random encounter generators, ~20 `monster*.js` behavior services (legendary actions, lair actions, auras, summons…), `npcStatBlockUtils.js`.
- **`npcs/`** — NPC CRUD client, generators, monster↔NPC conversion, NPC combat integration.
- **`dice/`** — `diceRoller.js`: single RNG source for the whole app — d20/advantage/disadvantage, expression parser (`rollExpression`, crit doubling/maximizing), damage formula formatting.
- **`ui/`** — `dataLoader.js` (`getDataPath()` dual-ruleset path selection + cached fetches), `sseClient.js`, log client, storage, formatting, markdown sanitization (DOMPurify), modal dismissal.
- **`items/`** — `lootGenerator.js` (loot from combat summaries).
- **`shared/`** — cross-cutting micro-utils: `popupResponse.js` (automation info popups), `buffApplier.js`, `hpModifier.js`, `featFinder.js`, casting-time utils.

Other `src/` folders: `models/` (`SpellOverlay.js`), `encounters/combatData.js` (legacy shaping duplicate of services-side concept), `assets/3d-map/` (20 GLB props + textures feeding the 3D viewer), `test/setup.js` (Vitest setup with an **inert global fetch mock** so unit tests can never hit the live API).

### 2.5 Components (`src/components/`, ~1,510 files)

| Folder | Size | Responsibility |
|---|---|---|
| `char-sheet/` | 739 | Character sheet view: action panels (actions/bonus/reactions/special), summary, abilities, inventory, spells, rests; `modals/` (345: `shared/` AoE-save-target bases, `divine/`, `arcane/`, ~50 flat feature modals), `char-summary/`, `char-spells/`, `popups/` |
| `encounter/` | 374 | GM encounter builder, `MonsterCardModal.jsx` (2,635 lines), ~200 per-monster-action tests |
| `map/` | 107 | Tactical map: SVG grid/walls/tokens/fog/placed-items/ruler layers, toolbar, context menus, 26 prop SVGs, `Map3D/` (Three.js scene, lazy-imported), 28 hooks (fog of war, dragging, walls, ruler, zoom/pan, SSE sync, spell overlays) |
| `character-creation/` | 83 | Wizard: 17 `WizardStep*` panels driven by `src/config/steps-config.js` |
| `initiative/` | 74 | Initiative tracker: creature cards, HP editing, condition/effect badges, handler factories, round/turn latching |
| `common/` | 70 | Shared UI kit: `CreatureBadge` (unified badge for all views), save/death-save/concentration prompt modals, `popup.jsx`, `Subscriber` (SSE), ally selection, avatars, markdown preview, autocomplete |
| `hex-map/` | 62 | Overworld hex travel map: terrain/roads/rivers/weather, travel panel |
| `log/` | 37 | Campaign log + ~20 typed entry renderers |
| `settlements/` `npcs/` `maps-manager/` `campaign-admin/` | ~10 each | Single-domain GM management views |
| `sidebar/` | 6 | Nav + `DiceTray` dice roller |
| `quests/` `notes/` `factions/` `campaign-selection/` | 3 each | Simple CRUD screens / full-screen campaign gate |

View→component mapping: `activeView` in `App.jsx` selects `CharSheet`, `EncounterBuilder`, `Factions`, `Initiative`, `MapsManager`→`Map`, `Notes`, `Quests`, `Npcs`, `Settlements`, `Log`, `CampaignAdmin`; overlays render `CampaignSelection` and `CharacterCreationWizard`. The **spell overlay is server-rendered** (`server/routes/spell-overlay.js` serves its own page; no React folder) — consumed in-app by `map/SpellOverlayRenderer.jsx`.

---

## 3. Data Flow Summary

### 3.1 Startup
1. Browser loads `index.html` → `main.jsx` → `App.jsx`.
2. `useAppData` fetches all rule JSON for both rulesets (`dataLoader`, dual paths via `getDataPath()`); loading gate shown.
3. Campaign selection gate → campaign chosen → character list + `/api/campaigns/:c/change-data` fetched; runtime store seeded (HP, tracked resources, `pendingExpirations`); `combatSummary` cache seeded; `<Subscriber>` opens the single SSE connection; first character auto-selected (or wizard opens if empty).

### 3.2 Server-first write/read loop
```
Component setValueSynced(v) ──► useSyncedState ──► setRuntimeValue
   │ optimistic local update + notify                        │
   │                                                    POST /api/campaigns/:campaign/:key
   │                                                              │
   │                                              server changeData.js: memory write,
   │                                              2s debounce disk write,
   │                                              publish(key,data,campaign)
   │                                                        │ SSE data:{key,data}
   ▼                                                        ▼
local re-render  ◄──  other clients: Subscriber.handleRuntimeEvent
                        → setRuntimeObject(..., skipSync=true)   (no re-POST → no loop)
```

### 3.3 Combat attack (representative flow)
1. UI click → `hooks/combat/useCharActionModals` → `useAttackDamageResolution.resolveAttackDamage` builds a pipeline context and `buildPipelineForAction` (steps + log/SSE observers).
2. `pipeline.run('housekeeping:do', ctx, resumeRef)` walks the event chain (`housekeeping:do → maneuvers:check → … → damage:rolled → sneak/twf/riders applied → damage:ready → damage:applied → … → pipeline:complete`); steps may return `{modal}` to **pause** the pipeline (`_pausedStep` stashed in `resumeRef`) until the user confirms, then `resume()` re-enters.
3. Rolls come from `dice/diceRoller.js`; feature riders add damage dice; automation passives route through `combat/automation/automationService` (`automationCollector → automationRouter.routeAutomation`).
4. Damage applies in `rules/combat/applyDamage.js`: resistance/temp-HP/ward, concentration and death-save prompts, `setRuntimeValue(creature,'currentHitPoints',…)`, `campaign.lastAttack` stamp.
5. Persistence/sync per §3.2; every pipeline event also POSTs to `/api/campaigns/:c/pipeline-event` (`steps/sseObservers.js`) so all clients render live combat milestones.

### 3.4 Spell casting
`rules/spells/spellCastService/execution/` splits save / no-save / modal / trigger paths; trigger spells dispatch to per-spell services in `rules/features/` (e.g. `blessService.applyBlessEffect` writes `{target, effect, source, duration}` rows into `campaign.targetEffects`); AoE casts publish overlays to the memory-only `/spell-overlay` endpoint, rendered on every client's map.

### 3.5 Persistence
Everything is flat JSON on disk under `public/campaigns/<name>/` (character sheets at root; entities, runtime store, log in `data/`; maps in `maps/`; uploads in `images/`), plus a zip snapshot system in `.snapshots/`. The server's in-memory change-data store is the authority between writes; startup `readFile()` and exit `saveFile()` bracket it.

---

## 4. Rules Engine (`src/services/rules/`) — dual rulesets

`rulesFactory.getRules(playerSummary)` selects `rules`/`rules2024` + `classRules`/`classRules2024` based on the character's `rules` field. `getPlayerStats` is the canonical character derivation: base stats → class/race re-resolution → automation passives merged into defenses (resistances, immunities, land resistance; 2024-only chosen resistances and epic boons) → senses (truesight/blindsight passive injection) → `_trackedResources` stamped. `PlayerStats` (in `rules/rules.js`) is the **single source of truth** for a character at runtime.

Core calculators exist as twins dispatched in `rules-core.js`: `abilityCalc`/`abilityCalc2024`, `attackCalc`/`attackCalc2024`, `spellCalc`/`spellCalc2024`. Modules **without** a 2024 twin (shared, may embed 5e assumptions): `maneuvers.js`, `greatWeaponFighting.js`, `magicSpells.js`, `raceTraits.js`, `spellDamageUtils.js`, `attackWeaponUtils.js`.

`targetEffectDefinitions.js` (~1,470 lines) is the canonical registry of every `targetEffects.effect` — label, icon, CSS class, group, fields, defaults — consumed by the UI (incl. GM EffectAdder) and by handler code via `getEffectDefinition()`; new effects must register here first.

---

## 5. Automation Dispatch (`src/services/automation/`)

Feature **metadata** (`automation: {type, trigger, casting_time, damage expressions, resourceCost…}`) ships inside the static rules JSON (`public/data/[2024/]classes|spells|feats|races|backgrounds.json`) and is copied onto character-sheet feature rows. At activation:

```
sheet row click (useCharActionsAutomation.js)
  → executeHandler (automation/index.js:693)      # handles automation arrays on one feature,
      → resolveHandler (index.js:666)              #   ordering rules (replacesWarMagic, etc.)
          ├─ PASSIVE_RULE_EFFECTS map (6)          # type:'passive_rule' by auto.effect
          ├─ special-case / fingerprint routing    # auto_effect + data-shape detection
          └─ HANDLER_MAP (index.js:296, ~314)      # automation.type → handler fn
              → handlers/<category>/<feature>Handler.js   # 300 files, 17 category folders
                  → runtime store writes + SSE + campaign log
```

There is **no auto-discovery** — every handler is manually imported in `automation/index.js`. Handler signature: `(action, playerStats, campaignName, mapName, characters)`. `contextBuilder-sync.js` (784 lines) builds the shared attack/skill context (advantage sources, passives, active target effects). This UI-triggered subsystem is *parallel* to the pipeline-side `combat/automation/` collector/router (§3.3), and `rules/features/` services sometimes call back into `executeHandler` with synthesized actions — a known circular adapter (§9).

---

## 6. Dependency Graph (textual)

```
                      index.html
                          │
                      main.jsx ── global CSS, Font Awesome
                          │
                       App.jsx ◄── src/routes/config.js (sidebar view config)
        ┌──────────┬───────┼─────────────┬──────────────┐
        │          │       │             │              │
 useAppData  campaign/  character/  wizard hooks   Subscriber (SSE)
 (dataLoader) mgmt hooks  mgmt     (steps-config)     │
        │          │       │             │          sseClient.js (singleton)
        ▼          ▼       ▼             ▼              │
  public/data  campaignService     rulesFactory    rules JSON+change-data
  public/data/2024   (HTTP)      (PlayerStats)     snapshot on connect
                          │             │
                          ▼             ▼
   views/components ──► hooks/combat ──► combat/actionPipeline ─► steps/* ─► riders
   (char-sheet, map,       │    │              │  (dice/diceRoller)    │
    initiative, …)         │    │              ▼                         ▼
                           │    │    combat/automation/*        rules/features/*Service
                           │    │         │  (collector/router)   ▲  │
                           ▼    ▼         ▼                      │  │
                     rules/rules + core twins            automation/index.js executeHandler
                           │                                     │  (circular adapter)
                           ▼                                     ▼
                   rules/combat/applyDamage ────────────► runtime store (hooks/runtime)
                                                             │ setRuntimeValue (POST)
                                                             ▼
                                             server: routes → changeData memory (2s debounce
                                                   │ disk) ─ publish() ─► SSE ─► all clients
   maps/* ─► mapsService (HTTP) ─► server/routes/maps.js; LOS/fog: maps/lineOfSight
   encounters/* ─► encountersService + combatData cache (SSE-seeded) ─► initiative/
   spells AoE ─► maps/spellOverlayService ─► server /spell-overlay (memory) ─► SSE
```

Layer direction: **components → hooks → services → HTTP/SSE → server routes → utils → disk.** Services never import components (except `Subscriber`-style glue living in `common/`); the runtime store is the only cross-view channel besides props.

---

## 7. Key Architectural Decisions (ADR-style)

| # | Decision | Rationale | Consequences / trade-offs |
|---|---|---|---|
| ADR-1 | **Server-first state** (`useSyncedState`/`useRuntimeState` → POST → SSE fan-out) | Multi-client tabletop: every player/GM must see identical, authoritative game state | Network chatter on every small write; optimistic UI needs two loop-guard layers (`skipSync` + equality guards); no offline mode |
| ADR-2 | **One shared SSE connection per campaign** (`sseClient.js` singleton) | Browser ~6-connections-per-host limit; multiple EventSources starve fetches | All views funnel through one dispatcher keyed by prefix; central point of failure; hardcoded `http://` URL breaks TLS (§9) |
| ADR-3 | **Flat JSON files as the database** (per-campaign folders, `jsonEntityCrud` factory, 2s debounced whole-store writes) | Zero-infra, human-inspectable, git-friendly campaign data | Whole-store rewrite per change; no transactions; concurrent writes last-writer-wins; 5 MB body cap for base64 uploads |
| ADR-4 | **Event-chain combat pipeline** (`actionPipeline` with named events, pausable via modals) | D&D combat is a long rule-driven chain (20+ steps, 19 feature riders) needing ordered, pluggable extension | Registration order is semantic (two steps subscribe `cleave:check`); chains hard to trace; observers re-POST every event |
| ADR-5 | **Automation via feature metadata + static HANDLER_MAP** (~314 handlers, 17 categories) | Rules JSON stays declarative; new feats/spells = new handler + one map entry | Manual registration at scale; ~50 same-named pairs across `automation/handlers/spells/` and `rules/features/` with overlapping buff logic; circular adapter between feature services and `executeHandler` |
| ADR-6 | **Dual rulesets (5e + 2024) in one app** (`rulesFactory` dispatch, twin calculators, dual data dirs) | Same table can run mixed-rule characters | Twin-file duplication; six shared modules lack 2024 twins; dataLoader must track which files are versioned vs shared |
| ADR-7 | **No router / no Context; manual view switching + module-store pub/sub** | Single-page VTT with heavy global state; Context would re-render the whole sheet | App.jsx is a 650-line composition root with ref-mirroring; view state not URL-addressable |
| ADR-8 | **Express serves both API and SPA** (`public/` before `dist/`, SSE catch-all regex excluding `/api`) | One process deploys the whole suite | Mount order is load-bearing and only partly commented; a mis-ordered mount shadows live data |
| ADR-9 | **Route mount order for path safety** (`campaigns-character` before `campaigns-changedata` `:key` wildcard) | Character filenames must not be eaten by runtime-key routes | Fragile: documented in two places, one of them a stale comment |
| ADR-10 | **GM features localhost-gated, client-side hostname check** (`isLocalhost` / `req.hostname`) | Simple trust model for a home/LAN tool | Server-side gating is partial only — LAN clients can mutate most entities directly (§9) |
| ADR-11 | **Procedural generation** (BSP dungeon pipeline, hex terrain + rivers, settlement/name/event/weather generators) | Reduces GM prep, showcases map tools | Generators live in `src/services/maps/` with root CLI wrappers; demo prototype kept in `demos/` |
| ADR-12 | **Custom ESLint `server-first` plugin** (`no-window-access`, `no-local-game-state` = error; `require-synced-state` = warn) + complexity ratchet | Enforces the architecture mechanically rather than by review | 4 component-side exemptions carry local game state by `eslint-disable`; baseline currently empty |

---

## 8. Static Rules Data (`public/data/`)

- **`/data/` (25 files, ~10 MB):** character core (`classes` 614K, `races`, `ability-scores`, `feats`, `fighting-styles`), combat/spells (`spells` 526K, `monsters` 2.5M, `equipment`, `magic-items` 601K, `conditions`, `actions`, `passive-skills`, `resistances-immunities`, `alignments`, `languages`), GM world-gen tables (guild/npc/settlement/shop names, npc traits, rumors, wild-magic-surge), `rules-validation.json`.
- **`/data/2024/` (8 files, ~1.4 MB):** versioned copies of `classes`, `races`, `feats`, `spells`, `rules-validation`; 2024-only `backgrounds`, `maneuvers`, `weapon-mastery`.
- **Shared (never versioned):** `monsters`, `equipment`, `magic-items`, `conditions`, all world-gen tables — loaded always from `/data/` by `dataLoader.getDataPath()`.

Runtime campaign content lives separately in `public/campaigns/` (5 campaigns present: `Frostfall`, `test-campaign`, `Testing G1/G2/G3`): character JSON at campaign root, `data/` entities + change-data + log, `maps/`, `images/`.

---

## 9. Known Constraints, Assumptions & Architectural Drift

**Constraints / assumptions**
- Express on port 80 (dev proxy target hardcoded); Vite proxies `/api`, `/subscribe`, `/spell-overlay` with SSE timeouts disabled.
- 5 MB JSON body limit; images travel as base64.
- CORS wildcard; the only trust boundary for GM power is the localhost hostname check.
- Campaign = directory name; renaming requires coordinated migration of memory maps + image paths (implemented in `campaigns-admin.js`).
- Combat summary is cached client-side (`encounters/combatData.js`) and seeded by SSE — a stale cache reads stale initiative until reseeded.
- Safari keep-alive workarounds (15 s `keepAliveTimeout`, 120 s `headersTimeout`, 15 s SSE pings, 60 s `/health` self-HGET) are load-bearing.

**Drift found during survey (verified against code)**
1. *Debounce contradiction:* code = 2 s (`changeData.js`), 1 s (`log.js`); AGENTS.md says 10 s; a `server.js` comment says 1 min.
2. *`React.StrictMode`:* absent from `main.jsx`; AGENTS.md claims it present.
3. *Playwright orphan:* `testDir: './tests'` — the folder doesn't exist; E2E config stale.
4. *Legacy `.eslintrc.cjs`* still on disk alongside flat `eslint.config.js` (ignored but confusing).
5. *Security gaps:* campaign create/rename/delete, character CRUD, map/encounter writes, change-data POST, `/migrate-image-paths`, and factions CRUD are **not** localhost-gated; `imageUtils.deleteCharacterImage` joins caller-supplied paths under `public/` unchecked (traversal risk).
6. *Dual automation stacks:* `automation/handlers/spells/` (73) vs `rules/features/` (82) with ~50 same-name pairs and a circular `executeHandler` adapter (e.g. `blessService.js` importing back from `automation/index.js`).
7. *Pipeline ambiguity:* two steps subscribe `cleave:check`; runner takes first match — Topple mastery reachable only via registration order.
8. *Probable bugs:* dead ternaries in `rules.js:377-385` (identical branches, incl. `getCarryingCapacity` calling `getHitPoints` on both branches).
9. *Hardcoded rules in code* that belong in data files: Hunter's Mark dice + Foe Slayer level check (`steps/features/huntersMarkDamage.js`), level-19 ability bumps in `abilityCalc*`, crit cap, default truesight/blindsight ranges in `rulesFactory.js`.
10. *Path-building duplication:* `campaignPaths.js` exists but `changeData.js`, `imageUtils.js`, `encounterUtils.js`, admin migrate still compose `process.cwd()` paths; name-formatting helpers triplicated (`formatMapName`/`formatEncounterName`/`ui/formatUtils`).
11. *Upsert-PUT logic* duplicated verbatim between `npcs.js` and `settlements.js` routes (missing factory option).
12. *SSE URL* hardcoded `http://${hostname}` (`sseClient.js:21`) — breaks HTTPS/reverse-proxy TLS deployments.
13. *Two `valuesEqual` implementations* (store vs SSE guard, latter adds `Set`); `useSyncedState` subscribes with `===` while `useRuntimeValue` deep-compares.
14. *AGENTS.md doc drift:* CreatureBadge consumer list references `CharConditions.jsx`/`CharSummary.jsx` paths that have moved into `char-sheet/` subfolders; log-route mount comment in `server.js` is wrong.
15. *Naming-convention violations:* `shared/spell-utils.js`, `common/popup.jsx`, lowercase test-utils files (`charInventory.test-utils.jsx`, `log-test-utils.jsx`), irregular indentation in `routes/config.js` and `HANDLER_MAP` (merge friction), `complexity-baseline.js` empty despite ratchet thresholds active.
16. *Stray artifacts:* `.DS_Store` files, `Frostfall/nemeria.json` lowercase filename, `src/encounters/combatData.js` shadowing `src/services/encounters/combatData.js`, `publish()` key-prefix fallback regex that fails for most real key prefixes (latent trap).

---

## 10. Testing & Verification Infrastructure

- **Unit/integration:** Vitest, jsdom, **2,422 co-located test files** (2,383 src / 39 server). `src/test/setup.js` installs an inert global fetch mock + localStorage mock and auto-cleans DOM/modal singletons, so unit tests can never mutate real campaign data.
- **Server tests:** supertest via `localhostSupertest.js` (IPv4 binding so hostname-based GM gates evaluate as localhost).
- **E2E:** Playwright configured but orphaned (§9.3).
- **Verification registries (`docs/`):** `test-character-registry.json` (one rig character per class/subclass/race in `test-campaign`), `test-monster-registry.json` (live initiative rigs per monster action row `MA-nnnn`), `automations-manifest.json` (618 combat automations ↔ source locations), `monster-actions-manifest.json` (1,838 actions across 608 monsters), and the append-only `test-setup-playbook.md` (house rules, endpoints, per-action recipes/pitfalls). These encode the project's manual-verification workflow around the locked `test-campaign`.

---

## 11. Recommended Future Improvements

1. **Close the server-side authorization gap** — enforce localhost (or token-based GM auth) middleware on all mutating routes; sanitize/contain `deleteCharacterImage` paths. Highest priority.
2. **Unify the two automation stacks** — make `rules/features/` and `automation/handlers/spells/` one layer with one buff-application path; delete the `executeHandler` circular adapter; generate `HANDLER_MAP` from `import.meta.glob` conventions to end manual registration drift.
3. **Adopt `campaignPaths.js` everywhere** and add a `PUT upsert` option to `jsonEntityCrud` (retire the npcs/settlements copies); single `valuesEqual` + single name-formatting util.
4. **Fix HTTPS:** protocol-relative SSE URL in `sseClient.js` and Vite proxy config.
5. **Resolve documented contradictions in one pass** — debounce intervals, StrictMode, AGENTS.md mount-order comment, eslint severity comments; regenerate the complexity baseline.
6. **Split the giant components** (`MonsterCardModal` 2,635 L; `SaveAttackAoeModal` 1,799 L; `App.jsx` 652 L) into composable units, continuing the existing `modals/shared/` pattern.
7. **Externalize hardcoded rules** (Hunter's Mark dice, leveling bumps, sight ranges, crit cap) into the data JSON so both rulesets stay data-driven.
8. **De-duplicate 2024 twins** — extract shared cores from `spellCalc2024.js` / `attackCalc2024.js` and add explicit 2024 counterparts (or explicit "shared, verified" markers) for the six shared modules.
9. **Repair or remove Playwright config/e2e suite**; fix the dual-step `cleave:check` subscribe ambiguity; fix dead ternaries in `rules.js`.
10. **Targeted change-data persistence** — dirty-key writes instead of whole-store serialization per change (and per-campaign `saveLogFile` scoping).

---

*End of document — generated 2026-10-01 by sequential subagent survey; verify against source before large refactors, and regenerate rather than hand-patch.*
