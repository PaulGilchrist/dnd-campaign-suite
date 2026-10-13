# Level 5 Architecture — GM-Optional Campaign Suite

| | |
|---|---|
| **Status** | v2.1 — **Phase 0 implemented** (2026-10-13); L1–4 regression gate green (full suite + zero lint warnings) |
| **Type** | Long-term architecture / roadmap |
| **Date** | 2026-10-13 (v2; v1 was 2026-09-25) |
| **Scope** | Add a Level 5 "GM-optional" mode to the existing D&D Campaign Suite without regressing Levels 1–4 |
| **Related** | `docs/app-exploration.md`, `AGENTS.md` (Server-First Pattern, combat pipeline), `docs/monster-actions-manifest.json` (GM-enforced catalog source) |

**v2 changelog:** re-verified every claim against the current code. Corrections: the gate has ~30 call sites (not 3–4); the automation router *infers* economy buckets (no explicit field); there are ~1,015 `GM-enforced` markers in 166 files (not 189); player token drags go through `usePlayerDragging.js` + full-map autosave, not the runtime store; 52 round-latch keys (not 30+). **Decision D2 is flipped** to client-gate-for-UX + server-validation-at-the-existing-change-data-chokepoint, and referee client-identity moves forward into Phase 0. See Appendix B.

---

## Table of Contents

1. [Vision & Level Definitions](#1-vision--level-definitions)
2. [Investigation Findings (existing architecture)](#2-investigation-findings)
3. [Decisions (locked)](#3-decisions-locked)
4. [Guiding Principles](#4-guiding-principles)
5. [State & Data Model](#5-state--data-model)
6. [Phase 0 — Enforcement Foundation](#6-phase-0--enforcement-foundation)
7. [Phase 1 — Rules Enforcement](#7-phase-1--rules-enforcement)
8. [Phase 2 — Spatial & Zone Enforcement](#8-phase-2--spatial--zone-enforcement)
9. [Phase 3 — Runtime AI (local model)](#9-phase-3--runtime-ai)
10. [Phase 4 — Session Orchestration & Referee Console](#10-phase-4--session-orchestration)
11. [GM Task Catalog (enforce / AI / roleplay)](#11-gm-task-catalog)
12. [Authority & Permission Model](#12-authority--permission-model)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Test Strategy](#14-test-strategy)
15. [Implementation Order](#15-implementation-order)
16. [Open Questions & Future Considerations](#16-open-questions)

---

## 1. Vision & Level Definitions

The app is intended to be used **as much or as little as** the GM and players want. Five capability levels are defined; Levels 1–4 are fully functional today. This plan adds **Level 5**, in which the application can **replace or reduce the need for a GM**.

| Level | Name | Use | Status |
|---|---|---|---|
| **1** | Pre-game only | GM prepares maps/encounters/quests/NPCs/settlements + prints; players create/level-up/print characters. Paper + dice on game day. | ✅ Functional |
| **2** | Minimal game use | + Initiative tool shown on a TV/monitor (whose turn, who's injured/defeated/buffed). | ✅ Functional |
| **3** | Maps | + Tactical maps for turn-based movement, positioning, cover, AoE overlay placement (vs theater of the mind). | ✅ Functional |
| **4** | Combat | + Dice rolls, rule application (to-hit, saves, durations, conditions), full PvE **and** PvP/NPC-vs-NPC/ally/arena (1v1, 2v2, 3v3). | ✅ Functional |
| **5** | GM-optional | + Enforced turn/action-economy/movement, automated spatial rules, runtime AI for NPC behavior, narrative adjudication, and world continuity. GM is optional, not required. | 🆕 This plan |

**Core constraint:** Level 5 must be *additive and optional*. With every L5 feature off, the app must be behaviorally identical to today (L1–4 preserved).

---

## 2. Investigation Findings

The codebase is further along toward Level 5 than it appears. Much of the enforcement machinery **already exists as primitives** that L5 can reuse rather than rebuild. All findings below were re-verified against the code on 2026-10-13.

### 2.1 Reusable primitives (do not rebuild)

| Primitive | Location | How L5 reuses it |
|---|---|---|
| Condition action-gate `cannotAct` / `cannotActActions` / `cannotActReason` | `src/services/combat/conditions/conditionEffects.js` | Base "can this creature act at all?" layer (incapacitated/paralyzed/petrified/stunned/unconscious/restrained; `cannotActActions` for action/bonus-action-only blocks like Stinking Cloud) |
| `cannotAct` guard **call sites** (~30, verified) | `useCharActionsAutomation.js:404`, `useCharActionsAttackHandlers.js:45`, `useCharActionsBaseActions.js` (Hide/Dodge/Grapple), `CharBonusActions.jsx` (9 sites), `CharReactions.jsx` (3), `CharSpecialActions.jsx` (5), `useActionSpellMetamagic.js:317`, `CharSpells.jsx`, `CharActions.jsx` | The exact consolidation list for `assertCanAct()` (§6.3) — every site is a mechanical one-line swap |
| Action-economy routing | `src/services/combat/automation/automationRouter.js` (`routeAutomation`) | **Inferred** buckets (`actions`/`bonusActions`/`reactions`/`passives`/`specialActions`) from `info.type`, normalized `casting_time`, `info.action === 'bonus_action'`, triggers, and special fields — no explicit `bucket` field exists. L5 adds `classifyBucket(info)` (§7.2) to make the taxonomy a queryable contract |
| Combat state `{ round, creatures[], activeCreatureName, lastAttack, lastAppliedTurnStartCreature }` | `src/services/encounters/combatData.js` (`getCombatSummary`, `getActiveCreatureName`, `loadCombatSummary`), `getCombatContext()` | Turn-order + round source of truth, already cached + SSE-synced |
| Turn-transition engine (turn-start / turn-end / round-wrap) | `src/components/initiative/navigationHandlers.js` (`createNextCreatureHandler`, `runRoundWrapHousekeeping`, `applyTurnStartGate`, `applyOutgoingTurnEndPasses`) | Existing seams where per-turn state is reset — L5 resets action economy + movement here |
| Once-per-round latch pattern | `PLAYER_ROUND_LATCH_KEYS` in `navigationHandlers.js` (**52 keys**, verified) | Existing "budget" idiom (round-keyed self-re-arming latch); L5 adds a *generic* economy orthogonal to these |
| Movement flag `steadyAimMovedThisTurn` | `src/components/map/hooks/useSelectMove.js` (`applySelectionMove:149-172`) | Seed for a real movement budget (currently a boolean; it is the *only* runtime-store write on the move path) |
| **Player token drag path** | `src/components/map/hooks/usePlayerDragging.js:116-121, 171-186` | The path players actually use to move their own tokens (GM select-drag in `useSelectMove` is already `isLocalhost`-gated at `:82, :123`). The movement clamp must be applied **here first** (§7.3) |
| Map persistence + broadcast | `useMapLoader.js` (1s-debounce autosave) → `mapsService.saveMapData` PUT `/api/campaigns/:c/maps/:map` → server writes file + SSE `map-data-<c>-<map>` | Token positions persist as **full-map JSON**, not per-token runtime keys. One write per drag-drop, already debounced (§7.3) |
| Range + spatial services | `src/services/rules/combat/rangeCheck.js` (`isWithinRange`), `src/services/maps/lineOfSight.js`, `reachability.js`, `effectiveWalls.js`, `rangeValidation.js` (`getDistanceFeet`) | Spatial enforcement (range, LoS, reachability) already computed; L5 wires them into gating |
| **"GM-enforced" advisory catalog** (**~1,015 markers in 166 files**, verified: src 645 / docs 179 / public 177 / .opencode 14) | monster/lair/zone automation (e.g. `monsterLegendaryUses.js`, lair services), `docs/monster-actions-manifest.json` (2,080 monster action entries) | **The app's own explicit list of what the GM adjudicates by hand today** — L5's conversion backlog, triaged by script (§8.0) |
| Server-first runtime store + SSE | `src/hooks/runtime/useRuntimeState.js` (`getRuntimeValue`/`setRuntimeValue`), `useSyncedState.js`, `src/services/ui/sseClient.js` | All L5 state flows through this (single source of truth, broadcast to all clients) |
| **Server write chokepoint** | `server/routes/campaigns-changedata.js:104-142` — every runtime key write is a `POST /api/campaigns/:campaign/:key` with `{ value }`; today it performs **no semantic validation** (only campaign-name + deprecated-key guards) | **The enforcement point for D2**: a per-key validator registry added here covers every L5 write with a few dozen lines (§6.7) |
| Procedural generators | `src/services/encounters/encounterGenerator.js`, `campaign/settlementGenerator.js`, `maps/dungeonGenerator.js`, `items/lootGenerator.js`, `maps/dungeonNamegen.js` | World content; L5 Phase 3 upgrades these with AI |
| Combat automation engine | `src/services/automation/` (200+ handlers), `src/services/combat/actionPipeline.js` (event chain), `src/services/combat/automation/automationCollector.js` | The execution substrate L5 gates sit in front of; AI executes *through* these |
| Campaign-level key pattern | `src/services/automation/common/campaignKeys.js` (activeCreatureName, targetEffects, pipeline-pause, travel-*, music…) | The established home for campaign-scoped runtime keys — L5's `enforcement`/`referee`/`aiConfig`/`sessionState`/`turnState` keys join this registry (there is no separate settings.json, and we do not add one) |
| GM/authority marker | `isLocalhost` (`useCampaignManagement.js`, server-side localhost guards in `campaigns-admin.js`, `quests.js`, `notes.js`) | Today's GM=authority signal; L5 generalizes into a `referee` role with durable client identity (§12) |

### 2.2 What does NOT exist (the L5 gap)

- **Unified per-creature action economy** — no `actionsUsed` / `bonusActionsUsed` / `reactionsUsed` / `movementUsed`. (Only scattered per-feature round latches — 52 keys.)
- **Turn-lock / whose-turn enforcement** — `activeCreatureName` is **display-only**. All the `cannotAct` guards are condition-based; nothing reads whose turn it is before acting.
- **Queryable economy buckets** — `routeAutomation` *infers* the slot at collection time; there is no `bucket` field a gate can charge against.
- **Movement budget** — only the boolean `steadyAimMovedThisTurn`; no feet-consumed counter, no speed clamp on either drag path.
- **Token-moving teleport** — teleport automations exist (e.g. `psychic_teleportation`, `teleportModal`) but only move *role-play*; `gridX/gridY` changes only via direct drag.
- **Runtime LLM** — zero AI calls anywhere. All "Generate …" buttons (NPC/Settlement/Encounter/Dungeon/Loot) are procedural.
- **Durable client identity** — writes are anonymous; CORS `*`; SSE assigns throwaway random `clientId`s (`server/routes/sse.js:18-24`) used only for connection bookkeeping. **An assignable referee (D4) is unimplementable without fixing this** — hence Phase 0 includes a minimal client-token mechanism (§6.8).
- **Server-side rules validation** — the change-data chokepoint accepts any key/value blindly. All dice rolls are client-side `Math.random()` (`src/services/dice/diceRoller.js`).

---

## 3. Decisions (locked)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| **D1** | L5 priority | **Enforcement-first** | Phases 0–2 (deterministic rules engine) are the core deliverable. AI (Phase 3) is designed to *plug into* the enforcement engine, not precede it. Lower risk, no LLM dependency, yields a solid "rules referee" even before AI exists. |
| **D2** *(flipped in v2)* | Enforcement location | **Client gate for UX + server validation for truth** | The client-side `canTakeAction()` gate gives instant feedback (disabled buttons, deny popups). **Additionally**, the *existing* write chokepoint (`server/routes/campaigns-changedata.js`) gains a per-key validator registry: L5 keys (`turnState`, `enforcement`, `referee`, `combatSummary`) are validated server-side; illegal writes get 400 + a SSE `denied` event. This replaces v1's "trusted-client, bypass accepted" with genuine enforcement at near-zero cost, because the funnel already exists and today has zero validation. Non-L5 keys pass through untouched → zero impact on L1–4. |
| **D3** | AI source | **Bundled / self-hosted local model** | Phase 3 `ai/` service is a thin, keyless HTTP client to a local LLM (e.g. Ollama `localhost:11434`, or any OpenAI-compatible local endpoint). Free, private, offline. Provider-agnostic adapter; first concrete provider = local endpoint. Config per campaign (endpoint URL + model + temperature). Runs server-side so every client uses it. |
| **D4** | L5 authority | **Optional human referee, with durable client identity** | A `referee` runtime role (default = the `isLocalhost` client, reusing today's authority idea) controls the Referee console: enforcement toggles, End Turn, confirm/override AI rulings, session state. Referee disabled = full autopilot. **v2 addition:** referee assignment requires a *durable client token* (localStorage UUID sent as a request header), built in Phase 0 — there is no client identity today (§2.2). |

---

## 4. Guiding Principles

1. **Optional, default OFF.** Every L5 feature is a feature flag. With all flags off, the app is behaviorally identical to today (L1–4 preserved). Enforcement is an *additive gate in front of* existing automation, never a rewrite.
2. **Server is the source of truth — and now the referee's whistle.** All L5 state lives in the runtime store and is SSE-broadcast. Per D2, enforcement is *evaluated* client-side for UX and *validated* server-side at the change-data chokepoint for truth.
3. **AI is a proposer/referee, never a state-writer.** The AI emits validated structured JSON (NPC intents, rulings, narrative) that flows through the **same** automation + enforcement gates as a human click. This preserves determinism, L1–4, and testability.
4. **Triage before you convert.** The ~1,015 `GM-enforced` markers are the explicit backlog of hand-adjudication, but converting them one-by-one is a thousand-tasks trap. A triage script ranks them by rule category and table-frequency; Phases 1–2 target the **top ~50** engine-enforceable markers; AI (Phase 3) handles the narrative ones.
5. **Reuse, don't duplicate.** L5 builds on `conditionEffects`, `automationRouter`, `combatData`, `navigationHandlers`, `rangeCheck`, `campaignKeys.js`, and the runtime store — not parallel systems. No new settings.json; L5 config keys join the existing campaign-keys registry.
6. **No big-bang refactor of existing latches.** The new generic `turnState` economy is *orthogonal* to the existing 52 per-feature round latches and is added alongside them.
7. **Consolidate the gate, sprinkle the call sites.** One `assertCanAct()` function holds all decision logic; the ~30 existing `if (cannotAct) return;` sites become mechanical one-line swaps to it. Decision logic is written once and tested once.

---

## 5. State & Data Model

### 5.1 Where L5 state lives

- **Combat turn state** → a **dedicated `turnState` runtime key** (v2 change from nesting inside `combatSummary`). Resets are written **atomically with** the existing `combatSummary` write in `navigationHandlers.js` (the seams already stamp + persist the summary at exactly the right moments), but *charges* (movement on drop, reaction spent) update `turnState` alone — smaller payloads, less SSE churn, smaller serialization blast radius.
- **Enforcement feature flags + referee role + AI config** → campaign-level runtime keys via `useSyncedState('campaign', …, …, campaignName)`, registered in `campaignKeys.js` alongside `'activeCreatureName'`, `'targetEffects'`, etc.
- **Token positions** → unchanged: full-map JSON autosave path (`useMapLoader` → PUT → SSE `map-data-*`). L5 does **not** move token state into the runtime store; it clamps on this path instead (§7.3).

### 5.2 `turnState` runtime key

```js
// Runtime key 'turnState' (campaign-scoped):
turnState = {
  [creatureName]: {
    actionsUsed: 0,        // generic Action budget (1/turn)
    bonusActionsUsed: 0,   // Bonus Action budget (1/turn)
    reactionsUsed: 0,      // Reaction budget (1/round, re-arms at round wrap)
    movementUsedFeet: 0,   // feet consumed this turn (clamped to speed)
    hasMoved: false,       // bool convenience (supersedes steadyAimMovedThisTurn semantics)
    turnActive: true,      // this creature's turn is currently open
  },
}
```

Rationale:
- **Orthogonal** to the existing per-feature round latches (`_FastHands_usedRound`, etc.) — those stay as-is (Principle 6).
- **Per-creature** so multi-actor (summons, allies, PvP) each have their own economy.
- **Reset** at the existing turn/round-wrap seams in `navigationHandlers.js` (Principle: reuse seams).
- **Ruleset-agnostic**: charges economy *slots*, never class resources (ki/Focus Points stay in their own latches).

### 5.3 Campaign-level L5 config (runtime keys, added to `campaignKeys.js`)

```js
// useSyncedState('campaign', 'enforcement', {
//   mode: 'off',            // 'off' | 'on'   (master switch)
//   turnLock: false,        // Phase 1
//   actionEconomy: false,   // Phase 1
//   movementBudget: false,  // Phase 1
//   lineOfSight: false,     // Phase 2
//   zones: false,           // Phase 2
//   opportunityAttacks: false, // Phase 2
//   serverDice: false,      // Phase 1 optional (§7.4)
// }, campaignName)

// useSyncedState('campaign', 'referee', null, campaignName)
//   → { name, clientToken } or null. null ⇒ default to the isLocalhost client (D4).

// useSyncedState('campaign', 'aiConfig', {
//   endpoint: 'http://localhost:11434', // Ollama (D3)
//   model: 'llama3.1:8b',
//   temperature: 0.7,
//   mode: 'suggest',        // 'suggest' (human confirms) | 'autopilot'
// }, campaignName)

// useSyncedState('campaign', 'sessionState', { phase: 'exploration' }, campaignName)
//   → 'exploration' | 'encounter' | 'travel' | 'roleplay'  (Phase 4)
```

**Default (mode:'off') ⇒ every gate resolves "allowed" and every validator passes through ⇒ today's behavior.** This is the L1–4 safety guarantee.

---

## 6. Phase 0 — Enforcement Foundation

The backbone. Nothing in Phases 1–4 works without this. **All off-by-default.**

### 6.1 New module: `src/services/combat/turnState.js`

Pure functions over the `turnState` key + `combatSummary` (testable without React):

```js
// Read a creature's economy (defaults to a fresh/empty state when absent).
export function getTurnState(turnState, creatureName) →
  { actionsUsed, bonusActionsUsed, reactionsUsed, movementUsedFeet, hasMoved, turnActive }

// Charge a budget; returns the new turnState entry. Caller persists.
export function spend(turnState, creatureName, bucket /* 'action'|'bonusAction'|'reaction' */)
export function spendMovement(turnState, creatureName, feet)   // clamped ≥0

// Reset one creature's economy (called from turn-transition seams).
export function resetForTurn(turnState, creatureName)
// Re-arm reaction economy for everyone (called from round-wrap seam).
export function rearmReactions(turnState)
```

Persistence: `storage.set('turnState', …, campaignName)` next to the existing `storage.set('combatSummary', …)` calls in `navigationHandlers` (SSE broadcasts, exactly as combat summary does today).

### 6.2 New module: `src/services/combat/canTakeAction.js` (the gate)

```js
// The single L5 enforcement decision — pure, synchronous, unit-testable.
export function canTakeAction({ enforcement, combatSummary, turnState, conditionEffects,
                                creatureName, bucket }) →
  { allowed: boolean, reason: string | null }
```

Decision logic (short-circuit, in order):
1. `enforcement.mode === 'off'` → `{ allowed: true }` (**today's behavior**).
2. Condition gate (existing): reuse `computeConditionEffects` → `cannotAct` / `cannotActActions` / `cannotActReason`.
3. Turn-lock (if `enforcement.turnLock`): is this creature `activeCreatureName`? Reactions may be allowed off-turn (per rules); actions/bonus only on own turn.
4. Action economy (if `enforcement.actionEconomy`): does `getTurnState` have budget in `bucket`?
5. Spatial (Phase 2, if relevant flags): range / LoS via `isWithinRange` / `lineOfSight`.

**Off → step 1 returns immediately ⇒ zero behavior change.**

### 6.3 New hook: `useActionGate()` + the ~30-site swap

v1 proposed wiring "3–4 entry points"; verification shows the check lives in **~30 scattered sites**. Wiring a gate 30 times invites 30 divergences. Instead:

- New `src/hooks/combat/useActionGate.js` (hook) + exported plain `assertCanAct(ctx)` (for non-React call sites) — wraps `canTakeAction()` (§6.2) plus the runtime reads and the deny UX (`setPopupHtml(reason)` + campaign-log entry).
- Every existing `if (cannotAct) return;` becomes `const gate = assertCanAct(ctx); if (!gate.allowed) return;` — a **mechanical, grep-verified swap** at each of the ~30 sites (list in §2.1). `cannotAct` continues to drive the visual disabled state unchanged.
- The 30 sites are enumerated in a coverage test (`actionGateSites.test.js`) so a future new action button that skips the gate fails CI.

### 6.4 Reset wiring

- In `navigationHandlers.js`:
  - On **turn transition** (`createNextCreatureHandler`): `resetForTurn(newActiveName)` + mark outgoing `turnActive=false`, written in the same `storage.set('combatSummary', …)` tick.
  - On **round wrap** (`runRoundWrapHousekeeping`): `rearmReactions(all)`; movement/`hasMoved` reset per-turn instead (reactions are per-round, movement is per-turn).
- Mirrors the existing `lastAppliedTurnStartCreature` round-scoped gate pattern (`applyTurnStartGate`, `navigationHandlers.js:21-23, 134-142`).

### 6.5 UI (Phase 0)

- **End Turn button** in the initiative control row (today only `← Prev` / `Next →`). End Turn = advance + reset, distinct from manual Prev/Next.
- **Action-economy readout** on the char sheet + creature card: `1 Action · 1 Bonus · 1 Reaction · Movement 30/30 ft`. Reuse `CreatureBadge` for spent/remaining states.
- **Enforcement settings surface**: new **Referee** panel (or an Admin subsection) with the `enforcement` toggles + referee assignment. Referee-only visibility (see §12).
- All UI off-by-default; hidden/disabled when `mode:'off'`.

### 6.6 Server validator registry (D2, new in v2)

`server/routes/validation/keyValidators.js`:

```js
// validators[key] = (value, ctx) => { ok, reason }
// ctx = { campaign, enforcement flags, current turnState/combatSummary }
export default {
  turnState:   validateTurnState,    // shape + budget sanity (no negative used, used ≤ cap)
  enforcement: validateEnforcement,  // known flags only, referee-signed writes when assigned
  referee:     validateReferee,      // referee changes must come from referee or localhost
  // combatSummary: relaxed initially (existing writers), tightened after Phase 1
}
```

- Mounted inside `campaigns-changedata.js`: if `validators[key]` exists → run; fail → `400 {reason}` + SSE `denied-<campaign>-<key>` event so all clients show the rejection. **No validator ⇒ pass through exactly as today.**
- The referee's client token (§6.8) is how "referee-only writes" (flag changes, overrides) are distinguished from player writes.

### 6.7 Optional server dice is *designed in here*, delivered in Phase 1

See §7.4 — the validator registry is the natural neighbor; the endpoint lands once enforcement flags exist.

### 6.8 Durable client identity + referee claim (moved forward from Phase 4, new in v2)

There is **no client identity today** (anonymous writes, CORS `*`, throwaway SSE ids). D4's assignable referee needs one:

- On first load, generate a UUID → `localStorage` (`clientId`) → sent as `X-Client-Id` header on every write + on the SSE connect query.
- `referee` runtime key stores `{ name, clientId }`. **Claim**: the localhost client sees a "claim referee" button; claiming writes the key with its clientId (localhost-guarded, like today's admin routes). Reassign/force-release stays a localhost capability.
- Server validator: referee-scoped writes (enforcement flags, overrides, End Turn in enforced mode) must carry the referee `clientId` or `isLocalhost`; else 400 + SSE `denied`.
- Unassigned ⇒ default to `isLocalhost` ⇒ today's behavior preserved.
- Honest limitation, documented: a client can spoof a UUID. This raises the bar (no *accidental* or *casual* bypass) without pretending to be auth. Full auth (pairing codes/login) is listed in §16.

### 6.9 Exit criteria (Phase 0)

- With `mode:'off'`: `npm run test:run` + `npm run lint` green; L1–4 behavior unchanged (regression gate). Validator registry transparent to all non-L5 keys (existing suites exercise them).
- With `mode:'on'` + `turnLock` only: a non-active creature's action click is denied with a reason; the active creature proceeds. A forged `turnState` POST directly to the API is rejected by the server validator.
- Co-located `turnState.test.js` + `canTakeAction.test.js` + `keyValidators.test.js` + `actionGateSites.test.js` pass; existing suites green.

---

## 7. Phase 1 — Rules Enforcement

The owner's explicit asks (turn enforcement, action economy, movement limit).

### 7.1 Turn-lock (whose turn)
- Gate (Phase 0) denies non-active creatures' **actions/bonus actions** when `turnLock` is on.
- **Reactions** remain allowed off-turn (rules-correct) but are charged to the reaction budget.
- Auto-advance option: after the active creature's economy is spent or End Turn is pressed, advance `activeCreatureName` through `getNextCreatureName` (`initiativeService.js`).

### 7.2 Action economy + `classifyBucket`
- v2 correction: `routeAutomation` **infers** buckets; there is no explicit field to charge against. Add `src/services/combat/automation/classifyBucket.js`: `classifyBucket(info) → 'action'|'bonusAction'|'reaction'|'free'|'special'`, built by extracting the same `info.type`/`casting_time`/`action`/`trigger` logic `routeAutomation` already uses (single shared helper, both consumers call it — no duplicated taxonomy).
- `spend()` charges the classified bucket; deny + reason when exhausted ("No actions left this turn").
- Multi-attack features (Extra Attack, etc.) still consume **one** action — the economy charges the *slot*, not the number of attacks. (Verify against existing `extra_action` routing; focused test.)

### 7.3 Movement budget
- Replace the boolean `steadyAimMovedThisTurn` semantics with `turnState.movementUsedFeet` (kept in sync where `steadyAimMovedThisTurn` is read, e.g. Steady Aim).
- **Clamp points (both, verified distinct paths):**
  - `usePlayerDragging.js` (the **player** path, the common L5 case): on drag-*drop*, compute drag distance in feet via `getDistanceFeet` (`rangeValidation.js`); if `movementUsedFeet + cost > speed`, clamp/snap the token to remaining movement + "out of movement" affordance (reuse the existing `drag-invalid` class in `Players.jsx`).
  - `useSelectMove.js` (GM multi-select path, localhost-only): same clamp for GM-driven enforcement demos.
- **Charge once, on drop** — never per-pointermove. The existing 1s-debounced full-map autosave + one `turnState` write per drop keeps SSE load flat (closes v1's open question on SSE load).
- **Difficult terrain** cost (2×/4× per current rules text) wired in where movement cost is computed — converts a current `GM-enforced` residual into engine behavior.
- **Graceful degradation**: if no active map / no positioned tokens, mirror `isWithinRange`'s fallback (allow / skip clamp) so non-map play is unchanged.

### 7.4 Optional server dice (`enforcement.serverDice`)
- New `POST /api/campaigns/:name/roll { expression, reason }` → server-rolled result, logged, broadcast via SSE. Lives beside the validator registry (§6.6).
- When the flag is on, contested rolls (attack/h/save) route through it; when off, client `diceRoller.js` runs untouched.
- In enforced mode this also gives Phase 3's AI-director an honest oracle (AI selects, server rolls, engine applies).

### 7.5 Turn timer (optional) — **ABANDONED (no-timers plan T1)**
- ~~Per-turn countdown in the Referee/Initiative panel; auto-advance on expiry (toggle).~~ Removed 2026-10-13: a real-time countdown violates the turn-based principle (AGENTS.md "No Game Timers") — the initiative advances only on player/GM action. Component, runtime key and server validator all deleted.

### 7.6 Exit criteria
- A creature cannot exceed 1 action / 1 bonus / 1 reaction per turn, or its movement budget, when the flags are on; can do all of it freely when off.
- Player map drag is clamped to remaining movement; difficult-terrain costs multiply; both drag paths covered.
- `serverDice` on → attacks roll server-side; off → identical client rolling as today.
- Co-located tests for each; full suite green.

---

## 8. Phase 2 — Spatial & Zone Enforcement

Convert the high-value **"GM-enforced"** markers into optionally-enforced engine features.

### 8.0 Catalog triage (first task of Phase 2, new in v2)
- v1 counted 189 markers; the real number is **~1,015 in 166 files** (manifest tracks 2,080 monster action entries). Converting serially is a thousand-tasks trap.
- Extend `.opencode/plans/mark-row.mjs` (exists) into a triage script: parse `docs/monster-actions-manifest.json` + grep the markers → classify (`economy | movement | spatial | zone | duration | narrative`) → rank by table-frequency (monster appearances × action usage) → emit `docs/gm-enforced-triage.csv`.
- **Commitment: engine-enforce the top ~50 deterministic categories; explicitly park the rest.** Prevents Phase-2 scope explosion (Risk §13).

### 8.1 Token-moving teleport
- Add/extend a `teleport` automation type that **writes `gridX/gridY`** for the token via the map save path (`mapsService.saveMapData` / the active-map token list), instead of only logging RP text.
- Existing teleport features (`psychic_teleportation`, Blink/Misty Step handlers, `teleportModal`) route through it.
- Teleport is **exempt from the movement budget** (it's not movement per rules), but still respects range/LoS flags and turn economy (it's a bonus action, e.g.).
- *Delivered 2026-10-13 (first slice):* `src/services/combat/teleportService.js` — pure `resolveTeleportCell` (BFS snap to nearest in-bounds/unoccupied/unblocked cell near the anchor, capped by rolled distance via `getDistanceFeet`) + persisted `applyTeleportTokenMove` (reuses the `saveMapData → publish('map-data-*') → useSSESync` loop — live-animates every open map). New `tokenMoving` enforcement flag (client `ENFORCEMENT_DEFAULTS` + server `ENFORCEMENT_FLAGS`, admin toggle). `psychic_teleportation` wired first (blade thrown at the **selected combat target** = honest destination anchor; no invented direction). Every degrade branch (off / gridless / no-target / unplaced / out-of-range / save-fail) returns `{moved:false}` and the caller's prose stays byte-identical. **Refinement (parked §16):** destination *cell picker* for free-direction teleports.
- *Wiring completed same day:* `tempTeleportHandler.confirmTeleport` (the teleportModal's confirm seam — Misty Step / Blink `bonus_teleport` / Shadow-Step / Moonlight-Step family; anchor = `resolveTarget`, distance via `rangeToFeet`; a dedicated `teleport_token_move` log entry fires on real moves) and `reactionDebuffHandler` Branches-of-the-Tree (mover = active creature, anchor = player — the RAW "within X feet of you" reads directly onto the seam). `transposition_swap_with_illusion` stays advisory by design — the illusion has no token entity. Live on :80 (test-campaign): modal confirm moved the token `(15,9) → (10,8)` beside the anchored FeyRanger within the 30-ft cap, persisted + logged; enforcement OFF re-click produced the legacy prose with the token frozen. Full suite 39,771 green.

### 8.2 Line of sight → targeting
- Wire `src/services/maps/lineOfSight.js` into the gate when `lineOfSight` is on: a target behind a wall (via `effectiveWalls.js`) is out of range for ranged attacks/casts and triggers the deny/reason path.
- Melee + 5-ft adjacency unaffected.

### 8.3 Cover, difficult terrain, zones
- **Cover** (half/three-quarters) → AC bonus applied in `targetAcComputation.js` when the `zones` flag is on and the target is behind terrain.
- **Zone/area persistence**: fog-of-war, lair/regional actions, and area effects with **initiative-count-20 cadence** and **duration clocks** — promote from `GM-enforced advisory` prose to enforced state (armed targetEffect + round/cadence expiry consumer), reusing the existing `pendingExpirations` + `clearExpirationEffects` machinery.
- This is the largest Phase 2 slice; tackle one zone category at a time per the triage ranking, converting its markers to an engine consumer and flipping `verified` status via the triage script.
- *Category #1 duration/expiry-clock delivered 2026-10-13 (triage rank 1, 352 table bites):* the CONSUMER was already done (every turn boundary drains `pendingExpirations` via `expireStaleEffects`); the gap was producer-side — monster lanes wrote duration PROSE but never a clock. New `src/services/rules/effects/zoneDurationClock.js` (`armDurationClockIfEnforced`: zones-flag live AND parseable authored duration ⇒ ONE merged `addExpiration` on the CLA-334 minutes×10 / hours×600 recipe; enforcement off ⇒ ZERO writes; indefinite "concentration"/"until dismissed" ⇒ NO fabricated clock, MA-1215 discipline). Wired: `monsterSummon` (authored `duration_minutes` ⇒ despawn clock through the existing `remove_summoned_creatures` handler; log/popup prose flips from the §70 advisory to "expiry clock armed" only when armed), `monsterSelfAura` (parseable `action.duration` ⇒ `remove_target_effect` clock on the self te), `SaveAttackAoeModal.armZoneTargets` (authored `zoneTe.duration` ⇒ one clock stripping every armed zone te + the caster tracking key via `clear_runtime_value`). Live :80: armed clock on the runtime store fired at the round-2 boundary and stripped the zone te via the tick consumer; campaign restored (te/clock/Summary/flags).
- *Category #3 initiative-count-20 cadence delivered same day (triage ranks 3/4 zone persistence, 193+120 table bites):* the missing seam built as `drainRoundWrapClocks` (zoneDurationClock.js) riding `runRoundWrapHousekeeping` — at the round wrap (top of initiative = RAW count 20) it drains every round-matured clock across ALL stores independent of owner/target activity (the normal consumers only drain when owner/target is active, so lair zones lingered mid-round), one store rewrite per dirty store + an `enforcement_clock_expired` audit log; `expireOnCreatureName` anchors untouched at the wrap. Parser gained the initiative-20 clause (`until initiative count 20 …` ⇒ rounds:1) with a bounded-by-guard: rows bounded by re-crest/dismiss/die that merely MENTION initiative (grasping mud) are never clocked to the cadence. Dream-plane producer upgraded: zones live ⇒ rounds:1 matured exactly at the wrap (was rounds:2 nearest-seam); off ⇒ legacy verbatim. Registry descs flipped (fog cloud, slimy ground, spectral eyes, volcanic gas, dream plane, mud, spike growth). Live :80: armed `lair_fog_cloud` te + owner clock expired at the round-2 wrap (te stripped, store drained, audit log "Initiative-20 cadence: 1 zone/effect clock expired"); restored. Remaining §8.3 categories: cover → `targetAcComputation.js`, concentration clocks (rank 10), NPC turn-end zone-save auto-repeat (§16-parked here).
- *Cover delivered same day (last §8.3 category):* new `coverService.js`. Honesty ladder: walls are TOTAL cover (the §8.2 gate already denies through them — a wall is never "half"); three-quarters −5 needs 75% body obscuration, not computable from a token grid, so never fabricated. What landed is the RAW gap the engine genuinely had: an **intervening creature** on the Bresenham ray grants the target half cover −2 (creatures are not obstacles, so shots previously sailed through bodies at full AC). Channel: the zones flag routes ranged attack/cast clicks through the SAME gate pass (`isCoverEnforced` sync pre-check widens both §8.2 seams); on the allowed path `adjudicateCoverShot` stamps `campaign/_cover_shot` {attacker, target, ac −2, blocker, cell, round} — a CLEAR shot writes null, wiping stale stamps — plus one `enforcement_cover` audit log. `computeTargetAc` reads the stamp back sync (attacker+target+round matched; stacks AFTER the Barkskin floor — the floor is a base-AC rule). Off ⇒ no stamp, no map consult, AC math byte-identical. Live :80 three-state proof (test-campaign): zones ON + EvasiveFighter interposed at (12,8) between HexWarlock and AberrantSorcerer ⇒ Eldritch Blast adjudicated at AC 7 (base 9−2) + stamp + audit log; clear line ⇒ stamp wiped to null, no new log; enforcement OFF with interposer in place ⇒ base AC 9, zero writes. Campaign restored (tokens home, HexWarlock temp token removed, anchor/cover/flags cleared). En route: 5 `useLoggedDiceRollAttack` suites' partial combatData mocks gained `getCurrentCombatRound`; `checkLineOfSight` split (loadActiveMap/denyBlockedShot helpers) under the lint complexity cap. +13 cover tests; lint clean; suite 39,836 green. Live lessons: map tokens are the gate's ground truth (attacker without a placed token honestly degrades to ALLOW-before-stamp); combatSummary anchors are PER-CREATURE (`creatures[].targetName`); the Admin panel exposes master/turnLock/actionEconomy/movementBudget/tokenMoving checkboxes only — zones/LoS/OA flags ride the store, UI checkboxes are a noted follow-up.

### 8.4 Opportunity attacks
- Auto-trigger an OA when a creature within an enemy's reach (5 ft) moves away, charging the defender's **reaction** budget (Phase 1) and running the existing OA automation (Speedy opportunity-attack passives already exist in `initiative.jsx` / `ConditionEffectBadges`).
- Respect `Sentinel`, `opportunity_attacks_disadvantage`, and the reaction budget.
- *Delivered 2026-10-13:* `src/services/combat/opportunityTrigger.js` — `findOpportunityDefenders` (pure Chebyshev reach test: defender within 5 ft of the START cell and outside 5 ft at the END cell; players-vs-NPCs by origin array since the map has no faction truth) + `onTokenMoveLanded` wired at all three drop seams — player drag (`finalizePlayerMove`), GM select-move (`applySelectionMove`, per moved token), GM item/NPC drag (`useItemDragging`, start cell captured at pointerdown). Blocked by `no_opportunity_attacks` te or a spent reaction ⇒ `enforcement_denied` audit with reason; a live trigger charges the reaction via `chargeSlot` (actionEconomy OFF ⇒ advisory only — `chargeSlot` gates on that flag by design) and posts `enforcement_triggered` + popup. **§16 refinement parked:** full cross-view auto-ROLL (the trigger consumes the budget here; the attack itself resolves on the defender's existing sheet OA lane, which degrades gracefully when already spent), Sentinel extended reach on the map, NPC-vs-NPC faction hostility. Live :80 (test-campaign): dragged AberrantSorcerer (15,9)→(18,9) past an adjacent Goblin — `Goblin 1 reacts… Reaction spent`, `turnState` `reactionsUsed:1`; approach-then-withdraw ⇒ `Goblin 1's reaction is already used`; enforcement OFF ⇒ zero OA log lines (parity).

### 8.5 Exit criteria
- Each converted marker category has an engine consumer + a test; triage CSV rows flip to `verified`.
- With Phase 2 flags off, all prior behavior is unchanged.

---

## 9. Phase 3 — Runtime AI (local model)

Per D1, this **comes after** enforcement is solid; the AI executes *through* the existing enforcement + automation, never around it. In v2 the AI stands on a *server-validated* foundation (D2), so "AI never writes state directly" is enforced at the chokepoint, not just by convention.

### 9.1 New service: `server/services/ai/`

Provider-agnostic, keyless, local (D3):

```
server/services/ai/
  index.js            // chat({ messages, schema }) → validated structured result
  providers/
    localProvider.js  // Ollama / OpenAI-compatible local endpoint (fetch to endpoint URL)
    (future: openai.js, anthropic.js)  // adapters behind the same interface
  schemas.js          // JSON schemas per AI task + validators
  promptBuilder.js    // system prompts for each role (referee, npc-director, world)
```

- **Local endpoint** (default Ollama `http://localhost:11434/api/chat` or `/v1/chat/completions`). Config from `aiConfig` runtime key (endpoint + model + temp).
- **Structured outputs**: request JSON matching a schema; validate with `schemas.js` (fail → retry once → fall back to "needs human").
- **Runs server-side** so all clients share it and no key/endpoint leaks to the client.
- **Streaming** for narrative text; non-streaming for structured decisions.

### 9.2 AI referee (narrative adjudication) — the heart of "replace the GM"
- A natural-language **"describe what you do"** endpoint (`/api/campaigns/:name/ai/referee`).
- Input: freeform player action + current world/combat context (assembled from `combatSummary`, `turnState`, quest/faction/NPC state, active map).
- Output (validated): a structured ruling = `{ type: 'dice'|'automation'|'narrative'|'target_effect'|'hp_change', … }` that maps onto the **existing** automation (rolls via `serverDice` when on, `targetEffectDefinitions`, HP writes) **or** a logged narrative outcome.
- The ruling passes through the **same** `canTakeAction` gate + server validator + runtime store as a human action (Principle 3).
- `aiConfig.mode:'suggest'` → presents the ruling for the referee/human to confirm before applying (confirm requires referee `clientId`, §6.8). `autopilot` → applies + logs.

### 9.3 AI NPC director
- On an NPC's turn (enforcement mode, Phase 1 turn-lock on), the AI decides the NPC's actions (attack / cast / move / legendary action / legendary resistance / dialogue) and **issues them through the same automation handlers** the GM would click, charged against the same `turnState` economy.
- Reuses NPC stat-blocks (`npcsService`, `npcStatBlockUtils`) + the monster action data (`docs/monster-actions-manifest.json`) as the decision context.
- **Arena / PvP / NPC-vs-NPC** works for free: the director is per-creature and faction-aware (uses the existing faction data).
- Dialogue: a chat endpoint bound to an NPC (personality/goals/secrets from the NPC record) — the L5 replacement for "GM voices the NPC."

### 9.4 AI world continuity
- Upgrade the procedural generators (settlement/encounter/quest/rumor) with AI: richer, campaign-consistent content that evolves (consequences of quest outcomes, NPC attitude shifts, random downtime events).
- Still writes through the normal CRUD/runtime-store paths; AI only *generates* the payload.

### 9.5 Safety (non-negotiable)
- **AI never writes state directly.** Only validated structured output → automation/gate/server-validator/store.
- **Full audit log** of every AI ruling (reuse the campaign log: `type:'ai_ruling'`), so the referee can review/undo.
- **Referee override** always available (D4): the referee can veto/redo any AI action (integrate with the existing Admin "Rollback to Snapshot").
- **Deterministic core stays deterministic**: dice rolls, to-hit, damage, saves are the engine's (client dice, or server dice in enforced mode — §7.4); the AI *narrates* and *selects*, it does not roll.

### 9.6 Exit criteria
- `aiConfig.mode:'suggest'`: NPC turn produces a sensible proposed action; referee confirms → executes via automation.
- Referee endpoint maps a freeform action to a correct ruling in a set of scripted cases.
- Every AI path is logged; with AI disabled, L1–4 unchanged.

---

## 10. Phase 4 — Session Orchestration

The glue that makes L5 run end-to-end without a GM. (v2 note: client identity + referee claim moved *out* of this phase into Phase 0 §6.8; what remains here is orchestration polish.)

### 10.1 Session state machine
- `sessionState.phase` ∈ `exploration | encounter | travel | roleplay`.
- Transitions driven by AI + automation + the referee: e.g. `useTravelManagement.js` (travel) can auto-trigger `encounter` (reuse `encounterGenerator.js` + the encounter builder); combat end → `exploration`.
- The active phase gates which features are active (e.g. turn-lock only meaningful in `encounter`).

### 10.2 Auto-encounter
- AI or rules triggers encounters by location / quest / time / random chance; populates the encounter builder (party auto-populated from characters, difficulty selector) and starts the initiative tracker.

### 10.3 Loot / XP / downtime automation
- Reuse `lootGenerator.js` + AI (Phase 3.4) for post-encounter loot, XP, and downtime progression; writes through normal character management.

### 10.4 Referee console (full build)
- The human-oversight surface (D4): enforcement toggles, referee assignment/reassignment (client-token based, §6.8), session phase, End Turn, AI mode (suggest/autopilot), AI ruling review/override/undo, audit-log viewer (incl. server-validator `denied` events), and "take over the GM" (drop back to manual L1–4).
- This is what makes L5 *safe*: even in autopilot, a person can intervene.

---

## 11. GM Task Catalog

The ~1,015 `GM-enforced` markers + manual activities, classified by how L5 handles them (triaged per §8.0 — engine work targets the top ~50 categories, not every marker).

### 11.1 Deterministic → rules engine (Phases 0–2)
Enforce optionally via `canTakeAction` + `turnState` + spatial services:
- Turn order / initiative, **action economy (1 action + 1 bonus + 1 reaction)**, **movement budget** (speed, difficult terrain)
- Range, **line of sight**, **cover** (half/three-quarters), **opportunity attacks**
- **Teleport** (token-moving), zone areas, **lair/regional actions** + initiative-count-20 cadence, **fog of war**
- Death saves, exhaustion, concentration, spell slots / resource pools, condition durations + expiry, legendary/lair action timing

### 11.2 Fuzzy → AI-assisted (Phase 3)
Die rolls stay deterministic; the AI narrates/selects:
- **NPC decisions + dialogue** (the director)
- **Freeform player-action outcomes** (the referee)
- **Edge-case rulings** (ambiguous rules → AI proposes, referee confirms)
- **World consequences** (quest outcomes, NPC attitude, settlement change)
- **Narration / description** of results
- Random events, skill-check *story* outcomes

### 11.3 Keep as roleplay / GM (NOT engine-enforced in L5)
These keep it a *game*; AI assists, never owns:
- **Pacing**, **surprise/ambush** (table discretion), **social/roleplay moments**
- **Table adjudication** (human judgment calls), **moral/narrative choices**
- Tone and storytelling

> Rule of thumb: if it has a numeric/rule answer → engine. If it has a story answer → AI (validated, logged, overridable). If it's a table-feel decision → human/roleplay.

---

## 12. Authority & Permission Model

Today: **GM = `isLocalhost`** (hostname-derived); network clients are read-only for management; **all runtime writes are anonymous** with no server-side semantic validation.

L5 generalizes this into an assignable **referee** role (D4), backed by durable client identity (§6.8):

- `referee` runtime key: `{ name, clientId }`, or `null` ⇒ default to the `isLocalhost` client (preserves today's behavior when unassigned).
- **Client identity:** localStorage UUID sent as `X-Client-Id` on writes + SSE connect; localhost client can claim/reassign the referee (admin-route-style guard).
- **Referee capabilities** (Referee console, Phase 4): set enforcement flags, assign/strip referee, End Turn, advance phase, confirm/override/undo AI, take over manual control. Enforced-mode referee writes are server-validated against the referee `clientId` (§6.6).
- **Players** (non-referee): act through the enforced gates; can see shared state (init, HP, conditions) as today.
- **Referee disabled (autopilot):** no human authority; AI + engine run the session; audit log + server validators remain the safety net.
- **Backward compat:** a campaign with no L5 features and `referee:null` behaves exactly like today (GM=localhost, players read-only).

> Honest limitation: client UUIDs can be spoofed — this stops accidental/casual bypass, not a determined attacker. Full pairing-code/login auth is a §16 future consideration. Combined with client-side UX gating, it makes the audit log trustworthy for realistic tables.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Large existing test surface regresses** | Every L5 feature off-by-default; Phase 0's exit gate requires `npm run test:run` + `npm run lint` green with `mode:'off'` before proceeding. Validators only fire on L5 keys. Add co-located tests per gate. |
| **~30 gate call sites drift apart** | One `assertCanAct()` holds all logic; sites are mechanical swaps; `actionGateSites.test.js` enforces coverage so new action buttons can't skip the gate (§6.3). |
| **Refactoring the 52 round latches** | Do **not** refactor them. The new `turnState` economy is orthogonal and additive (Principle 6). |
| **Movement clamp breaks non-map play** | Mirror `isWithinRange`'s fallback: no active map / no positioned tokens ⇒ skip clamp. Clamp on drop only; full-map autosave semantics untouched. |
| **Action economy mis-charges (inferred buckets)** | Single `classifyBucket()` shared by router and gate (no duplicated taxonomy); charge the *slot*, not attack count; focused tests incl. `extra_action` routing (§7.2). |
| **`turnState` desyncs with `combatSummary`** | Resets written in the same persistence tick as the existing summary stamps (§6.4); server validator rejects nonsensical budgets (§6.6). |
| **AI writes state directly / hallucinates rules** | AI = proposer only (Principle 3); validated structured output checked again by the server validator; engine (or server dice) rolls; full audit log; referee override + snapshot rollback. |
| **Local model unavailable/slow** | `aiConfig` endpoint configurable; degrade gracefully to "AI unavailable → manual". `suggest` mode never blocks the game. |
| **Zones/lair actions are the fuzziest engine work** | Triage script ranks the ~1,015 markers; commit to top ~50 categories; flip triage rows to `verified` per category (§8.0). |
| **Scope creep in L5** | Enforcement-first (D1); each phase has exit criteria; AI is last and pluggable; catalog explicitly parks what it won't convert. |
| **Spoofed client identity** | Documented limitation (§12); raises bar vs. casual bypass; real auth is a §16 consideration; audit log records anomalies (`denied` events) either way. |

---

## 14. Test Strategy

- **Unit** (co-located `*.test.js`): `turnState.test.js`, `canTakeAction.test.js` (matrix: flag on/off × bucket × whose-turn × condition), `classifyBucket.test.js`, `movementBudget.test.js`, `keyValidators.test.js` (server), `localProvider.test.js` (mock endpoint), AI schema validators.
- **Coverage guard**: `actionGateSites.test.js` — asserts every registered action entry point calls `assertCanAct` (prevents silent new un-gated buttons).
- **Integration**: gate wired into `useCharActionsAutomation` + a bonus-action + a reaction site (mock `combatSummary`/`turnState` + enforcement on/off); map-drag clamp in `usePlayerDragging` **and** `useSelectMove` (mock map data); round-wrap resets in `navigationHandlers`; illegal runtime POST → 400 + SSE `denied` (supertest against the change-data route).
- **Regression gate**: Phase 0 ships only when `mode:'off'` yields a green full suite + lint (zero warnings). This is the L1–4 safety proof, run after every phase.
- **AI**: scripted cases for referee rulings + NPC director decisions; assert the *engine* rolled the dice (not the AI); assert audit-log entries.
- **Playwright** (manual verification on `test-campaign` only): turn-lock denial, End Turn advance, player-drag movement clamp, referee claim/override, referee console, suggest→confirm AI flow.

---

## 15. Implementation Order

Ordered by dependency and risk (enforcement-first, D1):

1. **Phase 0** — `turnState.js` + `canTakeAction.js` + `useActionGate`/`assertCanAct` swap at the ~30 sites + campaign flags (in `campaignKeys.js`) + End Turn button + economy readout + **server validator registry** + **client identity + referee claim**. **Off-by-default. Tests first.** ← *first increment*
2. **Phase 1** — turn-lock, `classifyBucket` + economy charging, movement budget + drop-clamp in `usePlayerDragging`/`useSelectMove`, difficult terrain, **optional server dice**, turn timer. ← *delivered 2026-10-13 (server-dice roll path consumed by client pipeline deferred to §16)*
3. **Phase 2** — **§8.0 triage script first** → token-moving teleport → line-of-sight → cover → zones/lair (one category at a time, per triage rank) → opportunity attacks. ← *delivered 2026-10-13 — all five sections landed and live-verified (§8.0 triage `d7ac8599b`; §8.1 teleport `3f9f6b3a3`+`b7025cf81`; §8.2 LoS `a0fd7863b`; §8.4 OA `aca7951fc`; §8.3 clocks `bdb10f050`, initiative-20 cadence `b8f745848`, cover `cf5091c45`). Triage CSV now carries 10 `verified` rows (flips live inside the script so re-scans preserve them). Remaining minors: concentration clocks (rank 10), legendary-cap/recharge rows (pre-existing engines, L5-flip pending audit), NPC turn-end zone-save auto-repeat + OA cross-view auto-ROLL (§16).*
4. **Phase 3** — `server/services/ai/` (local provider + schemas + prompts) → AI referee → AI NPC director → AI world continuity.
5. **Phase 4** — session state machine → auto-encounter → loot/XP/downtime → full Referee console.

Each phase: implement → co-located tests → `npm run lint` + `npm run test:run` green → (Playwright on `test-campaign`) → update this doc's status + the manifest/triage CSV where relevant.

---

## 16. Open Questions & Future Considerations

- **Reaction timing granularity:** enforce "once per round" vs allow multiple reactions if the feature grants them (e.g. multiple reaction features) — needs a per-creature reaction-cap model in `turnState`.
- **Shared/borrowed actions:** features that let another creature act (e.g. command companions, Help action) — how the economy charges a *different* creature's budget.
- **2024 vs 5e differences:** action economy is largely the same, but resource pools (e.g. 2024 Focus Points vs ki) differ — `turnState` stays ruleset-agnostic by charging slots, not class resources; audit both routers when `classifyBucket` lands.
- **Real authentication:** client UUIDs (§6.8) are an honor system. If L5 ever runs beyond a trusted LAN table: pairing codes or login, plus per-key write authorization.
- **Local model capability:** which local model size yields reliable structured output for the referee/director; whether a larger model is needed for freeform adjudication.
- **Persistence of AI context:** how much world/quest/NPC state to include in each AI prompt (token budget) without leaking secrets across clients.
- **Undo/rollback:** integrate AI-override undo with the existing Admin "Rollback to Snapshot".
- **Multi-campaign AI:** whether `aiConfig` is per-campaign (current design) or global.
- **Server-dice coverage:** which rolls go server-side in enforced mode (contested attack/save only, or all) and how client animation stays snappy.
- **Server rolls vs existing client pipeline:** today ALL damage flows client-computed → the runtime store (the validator chokepoint validates *enforcement* keys, not damage numbers). `serverDice` (§7.4) needs the damage/attack pipeline to accept a server-supplied roll rather than only emitting one — the to-hit flow (`useLoggedDiceRollAttack`), the combat pipeline events, and the `damage:rolled` store keys all assume a client roller. This is real plumbing, deliberately deferred: the enforcement gates + validated state land first, server dice follows when the pipeline can consume a server oracle without forking two roll paths.

**Closed since v1:** ~~SSE load from turnState churn~~ — movement charges are written once per drag-drop (existing 1s-debounced map autosave carries the position); `turnState` writes are one small key per turn event, well within the existing single-connection pattern.

---

## Appendix A — Key file references

| Concern | File(s) |
|---|---|
| Condition gate | `src/services/combat/conditions/conditionEffects.js` |
| Gate call sites (~30) | `useCharActionsAutomation.js:404`, `useCharActionsAttackHandlers.js:45`, `useCharActionsBaseActions.js`, `CharBonusActions.jsx`, `CharReactions.jsx`, `CharSpecialActions.jsx`, `useActionSpellMetamagic.js:317`, `CharSpells.jsx`, `CharActions.jsx` |
| Economy routing (inferred buckets) | `src/services/combat/automation/automationRouter.js` (`routeAutomation:305-309`, `routeBonusByCt`, `pushTo`/`pushToBoth`) |
| Combat summary / active creature | `src/services/encounters/combatData.js`, `getCombatContext()` |
| Turn-transition seams | `src/components/initiative/navigationHandlers.js` (`createNextCreatureHandler:215-273`, `runRoundWrapHousekeeping:117-129`, `applyTurnStartGate:134-142`, `PLAYER_ROUND_LATCH_KEYS:26-106`), `Initiative.jsx` |
| Movement — player drag | `src/components/map/hooks/usePlayerDragging.js:116-121, 171-186` |
| Movement — GM select drag (localhost-gated) | `src/components/map/hooks/useSelectMove.js:82, 123, 149-172`, `src/components/map/Players.jsx` |
| Map persistence/broadcast | `src/components/map/hooks/useMapLoader.js:78-91`, `src/services/maps/mapsService.js:104-111`, `server/routes/maps.js:151-170` |
| Distance | `src/services/rules/combat/rangeValidation.js` (`getDistanceFeet`) |
| Range / LoS / walls | `src/services/rules/combat/rangeCheck.js`, `src/services/maps/lineOfSight.js`, `effectiveWalls.js`, `reachability.js` |
| Runtime store | `src/hooks/runtime/useRuntimeState.js:78-133`, `useSyncedState.js`, `src/services/ui/sseClient.js` |
| **Server write chokepoint** | `server/routes/campaigns-changedata.js:104-142` (validator registry mounts here) |
| SSE server | `server/routes/sse.js` (anonymous clientId at `:18-24`) |
| Campaign keys registry | `src/services/automation/common/campaignKeys.js` |
| Authority marker | `useCampaignManagement.js` (`isLocalhost`), server localhost guards (`campaigns-admin.js`, `quests.js`, `notes.js`) |
| Dice | `src/services/dice/diceRoller.js` (client `Math.random()` today) |
| Generators | `encounters/encounterGenerator.js`, `campaign/settlementGenerator.js`, `maps/dungeonGenerator.js`, `items/lootGenerator.js` |
| Travel | `src/hooks/management/useTravelManagement.js` |
| GM-enforced catalog | `docs/monster-actions-manifest.json` (~1,015 in-code markers in 166 files); flip via `.opencode/plans/mark-row.mjs` (+ triage script, §8.0) |

## Appendix B — Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-25 | D1 Enforcement-first | Lower risk, no LLM dependency, solid "rules referee" before AI. |
| 2026-09-25 | D2 (v1) Client gate only | Fits current arch, minimal change; trusted-client model accepted. |
| 2026-09-25 | D3 Local model | Free, private, offline; provider-agnostic adapter keeps options open. |
| 2026-09-25 | D4 Optional human referee | Reuses `isLocalhost` authority; preserves a human safety valve; can be disabled for autopilot. |
| 2026-10-13 | **D2 flipped: client gate + server validation** | Code verification showed every runtime write already funnels through one unvalidated route (`campaigns-changedata.js`). A per-key validator registry there costs dozens of lines and turns "bypass accepted" into actual enforcement; it also makes the Phase 3 AI audit trustworthy. |
| 2026-10-13 | Client identity moved into Phase 0 | Referee assignment (D4) is unimplementable without it — verified there is no durable client identity today. Minimal UUID + claim keeps it proportionate; real auth parked in §16. |
| 2026-10-13 | Gate consolidation via `assertCanAct` | ~30 verified call sites; one shared decision function + mechanical swaps + a coverage test beats 30 bespoke wirings. |
| 2026-10-13 | `turnState` as dedicated runtime key | Charges (movement on drop, reactions) update one small key without rewriting `combatSummary`; resets stay atomic with the existing summary stamps. |
| 2026-10-13 | Catalog triage before conversion | Verified ~1,015 markers (10× the v1 estimate); top-~50 ranking keeps Phase 2 finite. |
| 2026-10-13 | Optional server dice (flag-gated) | All rolls are client `Math.random()` today; enforced mode needs a tamper-resistant oracle for contested rolls and a fair one for the AI director. |
| 2026-10-13 | **Phase 0 delivered** | Landed: `turnState.js` (+tests), `canTakeAction.js` (+matrix tests), `assertCanAct.js` + `bucketForAction` + `useActionGate`, gate wired at 18 command entry points across the char sheet + spell-cast chokepoint (sites delegating to gated executors intentionally not double-gated), turn/round-wrap seams in `navigationHandlers.js`, server validator registry mounted on the change-data chokepoint (+13 supertest cases incl. non-localhost referee 400 + SSE `denied`), client UUID on all writes, Admin Enforcement/Referee section, End Turn button, `TurnEconomyStrip` readouts (initiative + char summary + creature card), `actionGateSites.test.js` coverage guard. **Refinement:** `assertCanAct` carries the *legacy silent cannotAct semantics* (denies even with enforcement off, no popup/log) — a test caught that a mode-off fast-path-allow would regress the pre-existing condition gate. |
| 2026-10-13 | **Phase 1 delivered** | Landed: `classifyBucket.js` (+tests, single taxonomy — table-driven ROW→action→casting-time, compound forms by leading form), `movementBudget.js` (+tests — 4-dir weighted Dijkstra `computePathCost`/`snapToBudget`/`clampMovementDrop`/`clampSelectionOffset`, difficult ×2 / greater ×4), `chargeEconomy.js` (+tests — `chargeSlot`/`refundSlot`/`chargeMovement` bridging pure turnState to the runtime store, off ⇒ zero-write), `turnState.refund()` (+tests). Gate `assertCanAct` gained `charge:true` (charge-on-allow, race backstop denies). Charging wired at the **execute-on-allow** seams only (attack/cast/base-action/reaction rolls + automation `roll`/`attack_roll` descriptors + metamagic confirm + Hide/Dodge-after-guard + Horde-Breaker-target-selected + Stand-PWH); modal-opening sites defer to their apply/latch seams so cancels never overspend (matches existing charge-on-resolve latch semantics). Damage-only cells charge:false (billed at to-hit). Movement clamp on both drag paths (player drop via `resolveMovementBudgetDrop`, GM rigid multi-select via `clampSelectionOffset` min-budget); GM Shift unconstrained ⇒ fiat passthrough. Server dice oracle `campaigns-roll.js` (+supertest: crypto rolls, adv/dis keep, 403 off / 400 bad expr, logs + SSE `server-roll-*`), mounted **before** `campaignsChangedata` so POST `:campaign/roll` isn't swallowed by `:key`. Turn timer (`TurnTimer.jsx`+CSS, `turnTimer` key + validator; GM-only transport/auto controls, expiry transitions localhost-only). Two live-caught fixes this round: ① `assertCanAct` still denied the active creature because it preferred the stale `activeCreatureName` campaign-key copy (scalar SSE change events are ignored by the client) — now prefers the live `combatSummary` store mirror while enforcement is on, campaign-key fallback outside combat; ② `POST /roll` returned "Data saved" because the running prod server predated the route mount — rebuilt+restarted, and removed the polluting `roll` change-data key it had written. Live on :80 (test-campaign): economy charge `actionsUsed 0→1` then deny "No action left this turn."; End Turn advances + reopens fresh economy (spent creature keeps its 1, no refund); movement **snapped a 8-cell/40ft drag to 5ft** (`gridX 9→10`, logged) with only 5ft left, **passthrough when off** (`gridX 10→18`, turnState untouched); server oracle adv `[13,5]→13→18` + `2d6+3→8` + 400 junk; timer Start/pause/preset/auto render only when on. All affected suites green (lint clean; targeted combat/initiative/map/hooks/char 501 files). **Refinement:** roll-path *consumption* of a server oracle by the client damage/attack pipeline stays deferred (§16) — the oracle + gates land now so Phase 3's AI has an honest source, without forking two roll paths today. test-campaign restored (enforcement off, tokens home, turnState `{}`, turnTimer null, no `roll` leak). |
| 2026-10-13 | **Playwright live verification (test-campaign)** | Production bundle served on :80, verified end-to-end: enforcement flags + referee claim persist through the validated chokepoint; forged writes rejected live (non-localhost anonymous → 400, unknown flag → 400, negative budget → 400, `turnState:null` → 400 shape guard; referee client-id → 200); turn-lock denial live (deny popup + `enforcement_denied` audit entry with bucket); positive path live (active creature's attack rolls unimpeded); ability checks correctly *not* action-gated; End Turn advances `activeCreatureName` and reopens fresh economy in `turnState`; **off ⇒ byte-parity confirmed** (0 economy strips, 0 End Turn buttons, silent rolls). Two live-caught fixes: ① `assertCanAct` denial said "another creature" instead of the active name — added `readActiveCreatureName()` falling back to the `combatSummary` store mirror (campaign-key copy lags SSE after `storage.set`); ② End Turn button rendered unconditionally, violating off-mode parity — now gated on `enforcement.mode === 'on'` in `Initiative.jsx` (verified: off 0 → on 1 → off 0). All test-campaign state restored post-test (enforcement off/default flags, referee released, `turnState {}`, `activeCreatureName` null). |
| 2026-10-13 | **§8.0 + §8.1 delivered (Phase 2 first slices)** | §8.0: `triage-gm-enforced.mjs` greps 631 `GM-enforced` markers (158 files) → 15 mechanics classified × joined to the 2,080-entry monster manifest for table-frequency → ranked `docs/gm-enforced-triage.csv` (13 enforceable / 2 parked; 429/631 markers are generic advisory ⇒ parked — the "thousand-tasks trap" is really ~13 mechanics). §8.1: new `tokenMoving` flag + `teleportService.js`; psychic_teleportation wired first — live on :80 (test-campaign): server accepted `tokenMoving` (200), rejected non-boolean (400, prior value preserved); UI click moved the token `(15,9) → (10,8)` next to (never on) the anchored FeyRanger within the rolled 80 ft, persisted via map PUT and logged; enforcement OFF re-click produced identical legacy prose with the token frozen. Two live-caught fixes pre-verification: `findNearestValid` returns `{x,y}` but `getDistanceFeet` reads `{gridX,gridY}` ⇒ NaN silently defeated the range cap (now mapped + `isFinite` guard); gate/context/persist decomposition dropped cyclomatic complexity under the lint cap. test-campaign restored from byte-snapshots (chardef, runtime energy, combatSummary anchor, token positions, flags off). |
| 2026-10-13 | **§8.2 delivered + assertCanAct live-mirror bug fixed** | New `lineOfSightGate.js`: `isLineOfSightEnforced` (sync — OFF keeps the click path *fully synchronous*, zero map traffic) + `checkLineOfSight` (Bresenham interior-cell test vs `computeMovementObstacles` = walls + hidden secrets + closed doors; melee ≤ touch-range and unparseable ranges never adjudicate; gridless/fetch-fail degrade to ALLOW). Wired at both execute seams — attack rows (`useCharActionsAttackHandlers`) and the spell-cast chokepoint (`useSpellCastExecutor.castAction`) — **before** `assertCanAct` so a blocked shot never charges its slot; denial = popup + `enforcement_denied` bucket `lineOfSight`. Live :80: Fire Bolt denied "FeyRanger is behind a wall at (12,9) — no line of sight." with audit entry; wall cleared ⇒ same cast resolves HIT 15+5 vs AC 12; enforcement off ⇒ legacy roll through the same wall (parity). Separately caught a genuine Phase 1 defect: `assertCanAct` called `readActiveCreatureName()` WITHOUT its `enforcementOn` argument — the live combatSummary-mirror precedence had never actually engaged; fixed + regression tests (mirror outranks stale campaign-key copy). 10 test mocks patched for the new imports; suite 39,785 green; test-campaign restored (wall removed, anchor cleared, flags off). |
| 2026-10-13 | **§8.4 delivered — opportunity attacks on leaving reach** | New `opportunityTrigger.js`: pure Chebyshev reach test (in-reach at START, out-of-reach at END ⇒ adjacent→adjacent never provokes, matching 5-ft grid RAW) + trigger legs per defender (te-blocked / spent-reaction ⇒ `enforcement_denied`; live ⇒ `chargeSlot` reaction + `enforcement_triggered` + popup). Wired at every drop seam: player drag, GM select-move (per token), GM NPC/item drag (start cell captured at pointerdown). actionEconomy OFF ⇒ advisory without charge (chargeSlot gates on that flag by design). Hostility = players-vs-NPCs by token origin array (map JSON carries no faction truth — NPC-vs-NPC parked §16); §16 also parks the cross-view auto-ROLL (budget consumed at trigger; attack resolves on the defender's existing OA lane, which tolerates already-spent). Live :80: trigger + `reactionsUsed:1` persisted, second withdrawal denied `reaction is already used`, enforcement OFF zero log lines; campaign restored (map snapshot, turnState {}, flags off). Suite 39,796 green; lint clean. |
| 2026-10-13 | **§8.3 categories #1 + initiative-20 cadence delivered** | Two expiry slices on the same machinery. #1 (rank 1, 352 bites): producer gap closed — `zoneDurationClock.js` `armDurationClockIfEnforced` (zones live AND parseable authored duration ⇒ ONE merged `addExpiration`, CLA-334 minutes×10/hours×600; off ⇒ ZERO writes; indefinite ⇒ no fabricated clock) wired at monsterSummon (despawn via existing `remove_summoned_creatures`), monsterSelfAura, and `SaveAttackAoeModal.armZoneTargets` (strips armed zone tes + caster tracking key). Cadence seam (ranks 3/4, 193+120 bites): `drainRoundWrapClocks` rides `runRoundWrapHousekeeping` — at the round wrap (= RAW initiative count 20, top of the tracker) drains every round-matured clock across ALL stores independent of owner/target activity (normal consumers needed owner/target active ⇒ lair zones lingered mid-round); one rewrite per dirty store + `enforcement_clock_expired` audit; `expireOnCreatureName` anchors untouched at the wrap. Parser gained the initiative-20 clause with a bounded-by-guard (re-crest/die/dismiss-bounded rows merely *mentioning* initiative — grasping mud — never clocked). Dream plane: rounds:2 nearest-seam ⇒ rounds:1 wrap-exact while zones live, legacy verbatim off. Registry descs flipped on the seven initiative/re-crest entries; triage CSV re-scanned. Live :80: armed `lair_fog_cloud` te expired at the round-2 wrap exactly (te stripped, owner store drained, audit logged); campaign fully restored (te/Summary/round/active/clock stores/flags off). +18 clock tests; lint clean; full suite 39,814 green. |
| 2026-10-13 | **§8.3 cover delivered — last §8.3 category** | New `coverService.js`: intervening-creature half cover −2 at the AC seam. Walls stay TOTAL (§8.2 denies); three-quarters never fabricated (75% obscuration is unmeasurable on a token grid, MA-1215). Zones flag widens both §8.2 seams (`isCoverEnforced` sync pre-check); the gate's allowed path stamps `campaign/_cover_shot` (attacker+target+round matched; clear shots write NULL wiping stale stamps; stacks after the Barkskin floor in `computeTargetAc`) + `enforcement_cover` audit. Off ⇒ zero writes, byte-identical. Live :80 three-state: interposed ⇒ EB adjudicated AC 7 (base 9−2) + stamp + log "Half cover (−2 AC): EvasiveFighter interposes at (12,8)"; clear line ⇒ stamp wiped; enforcement OFF ⇒ AC 9 zero writes. Restored fully. Three live-quirks documented: attacker needs a placed token (honest ALLOW-before-stamp), cs anchors are per-creature, Admin panel lacks zones/LoS/OA checkboxes (follow-up). 5 partial-mock suites patched (+getCurrentCombatRound); LoS gate split for the complexity cap. +13 tests; lint clean; suite 39,836 green. |
