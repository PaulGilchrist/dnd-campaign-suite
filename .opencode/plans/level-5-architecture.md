# Level 5 Architecture — GM-Optional Campaign Suite

| | |
|---|---|
| **Status** | Draft (pending approval) |
| **Type** | Long-term architecture / roadmap |
| **Date** | 2026-09-25 |
| **Scope** | Add a Level 5 "GM-optional" mode to the existing D&D Campaign Suite without regressing Levels 1–4 |
| **Related** | `docs/app-exploration.md`, `AGENTS.md` (Server-First Pattern, combat pipeline), `docs/monster-actions-manifest.json` (GM-enforced catalog source) |

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
| **3** | Maps | + Batic maps for turn-based movement, positioning, cover, AoE overlay placement (vs theater of the mind). | ✅ Functional |
| **4** | Combat | + Dice rolls, rule application (to-hit, saves, durations, conditions), full PvE **and** PvP/NPC-vs-NPC/ally/arena (1v1, 2v2, 3v3). | ✅ Functional |
| **5** | GM-optional | + Enforced turn/action-economy/movement, automated spatial rules, runtime AI for NPC behavior, narrative adjudication, and world continuity. GM is optional, not required. | 🆕 This plan |

**Core constraint:** Level 5 must be *additive and optional*. With every L5 feature off, the app must be behaviorally identical to today (L1–4 preserved).

---

## 2. Investigation Findings

The codebase is further along toward Level 5 than it appears. Much of the enforcement machinery **already exists as primitives** that L5 can reuse rather than rebuild.

### 2.1 Reusable primitives (do not rebuild)

| Primitive | Location | How L5 reuses it |
|---|---|---|
| Condition action-gate `cannotAct` / `cannotActActions` / `cannotActReason` | `src/services/combat/conditions/conditionEffects.js` | Base "can this creature act at all?" layer (incapacitated/paralyzed/petrified/stunned/unconscious/restrained; `cannotActActions` for action/bonus-action-only blocks like Stinking Cloud) |
| Action-economy buckets (`actions` / `bonusActions` / `reactions` / `passives` / `specialActions`) | `src/services/combat/automation/automationRouter.js` (`routeAutomation`) | Already classifies every automation by the economy slot it consumes — the exact taxonomy L5 needs to charge a budget |
| Combat state `{ round, creatures[], activeCreatureName, lastAttack, lastAppliedTurnStartCreature }` | `src/services/encounters/combatData.js` (`getCombatSummary`, `getActiveCreatureName`, `loadCombatSummary`), `getCombatContext()` | Turn-order + round source of truth, already cached + SSE-synced |
| Turn-transition engine (turn-start / turn-end / round-wrap) | `src/components/initiative/navigationHandlers.js` (`createNextCreatureHandler`, `runRoundWrapHousekeeping`, `applyTurnStartGate`, `applyOutgoingTurnEndPasses`) | Existing seams where per-turn state is reset — L5 resets action economy + movement here |
| Once-per-round latch pattern | `PLAYER_ROUND_LATCH_KEYS` in `navigationHandlers.js` (30+ keys) | Existing "budget" idiom (round-keyed self-re-arming latch); L5 adds a *generic* economy orthogonal to these |
| Movement flag `steadyAimMovedThisTurn` | `src/components/map/hooks/useSelectMove.js` (`applySelectionMove`) | Seed for a real movement budget (currently a boolean) |
| Range + spatial services | `src/services/rules/combat/rangeCheck.js` (`isWithinRange`), `src/services/maps/lineOfSight.js`, `reachability.js`, `effectiveWalls.js` | Spatial enforcement (range, LoS, reachability) already computed; L5 wires them into gating |
| **"GM-enforced" advisory catalog** (189 markers, non-test files) | monster/lair/zone automation (e.g. `monsterLegendaryUses.js`, lair services) | **The app's own explicit list of what the GM adjudicates by hand today** — L5's conversion backlog |
| Server-first runtime store + SSE | `src/hooks/runtime/useRuntimeState.js` (`getRuntimeValue`/`setRuntimeValue`), `useSyncedState.js`, `src/services/ui/sseClient.js` | All L5 state flows through this (single source of truth, broadcast to all clients) |
| Procedural generators | `src/services/encounters/encounterGenerator.js`, `campaign/settlementGenerator.js`, `maps/dungeonGenerator.js`, `items/lootGenerator.js`, `maps/dungeonNamegen.js` | World content; L5 Phase 3 upgrades these with AI |
| Combat automation engine | `src/services/automation/` (200+ handlers), `src/services/combat/actionPipeline.js` (event chain), `src/services/combat/automation/automationCollector.js` | The execution substrate L5 gates sit in front of; AI executes *through* these |
| GM/authority marker | `src/hooks/management/useCampaignManagement.js:9` (`isLocalhost` from hostname) | Today's GM=authority signal; L5 generalizes into a `referee` role |

### 2.2 What does NOT exist (the L5 gap)

- **Unified per-creature action economy** — no `actionsUsed` / `bonusActionsUsed` / `reactionsUsed` / `movementUsed`. (Only scattered per-feature round latches.)
- **Turn-lock / whose-turn enforcement** — `activeCreatureName` is **display-only**. Any player can take any action at any time; nothing in `src/hooks/combat/*` reads whose turn it is before acting.
- **Movement *budget*** — only the boolean `steadyAimMovedThisTurn`; no feet-consumed counter, no speed clamp.
- **Token-moving teleport** — teleport automations exist (e.g. `psychic_teleportation`, `teleportModal`) but only move *role-play*; the map token `gridX/gridY` is set manually by the GM/player.
- **Runtime LLM** — zero AI calls anywhere. All "Generate …" buttons (NPC/Settlement/Encounter/Dungeon/Loot) are procedural.
- **Referee/authority assignment** — authority is inferred from `isLocalhost` only; no assignable referee, no oversight console.

---

## 3. Decisions (locked)

Four tradeoffs were decided with the owner. These constrain all design below.

| # | Decision | Choice | Consequence |
|---|---|---|---|
| **D1** | L5 priority | **Enforcement-first** | Phases 0–2 (deterministic rules engine) are the core deliverable. AI (Phase 3) is designed to *plug into* the enforcement engine, not precede it. Lower risk, no LLM dependency, yields a solid "rules referee" even before AI exists. |
| **D2** | Enforcement location | **Client gate only** | No server middleware. Enforcement is a `canTakeAction()` gate in the runtime store + UI, mirroring the existing `cannotAct` gate. Because all clients share the same SSE-synced `combatSummary`, each client enforces consistently against shared state. Trusted-client model (a determined client could bypass — accepted for a table that trusts itself; mitigated by the optional referee + audit log). |
| **D3** | AI source | **Bundled / self-hosted local model** | Phase 3 `ai/` service is a thin, keyless HTTP client to a local LLM (e.g. Ollama `localhost:11434`, or any OpenAI-compatible local endpoint). Free, private, offline. Provider-agnostic adapter; first concrete provider = local endpoint. Config per campaign (endpoint URL + model + temperature). Runs server-side so every client uses it. |
| **D4** | L5 authority | **Optional human referee** | A `referee` runtime role (default = the `isLocalhost` client, reusing today's authority idea) controls the Referee console: enforcement toggles, End Turn, confirm/override AI rulings, session state. Referee disabled = full autopilot. |

---

## 4. Guiding Principles

1. **Optional, default OFF.** Every L5 feature is a feature flag. With all flags off, the app is behaviorally identical to today (L1–4 preserved). Enforcement is an *additive gate in front of* existing automation, never a rewrite.
2. **Server is the source of truth.** All L5 state lives in the runtime store and is SSE-broadcast. (Per D2, *enforcement evaluation* is client-side against that shared state; *state mutation* still flows through the store.)
3. **AI is a proposer/referee, never a state-writer.** The AI emits validated structured JSON (NPC intents, rulings, narrative) that flows through the **same** automation + enforcement gates as a human click. This preserves determinism, L1–4, and testability.
4. **Systematically convert the "GM-enforced" catalog.** The 189 `GM-enforced (no consumer)` markers are the explicit backlog of hand-adjudication. L5 = engine-enforce the high-value deterministic ones (Phases 1–2), AI-handle the narrative ones (Phase 3).
5. **Reuse, don't duplicate.** L5 builds on `conditionEffects`, `automationRouter`, `combatData`, `navigationHandlers`, `rangeCheck`, and the runtime store — not parallel systems.
6. **No big-bang refactor of existing latches.** The new generic `turnState` economy is *orthogonal* to the existing 30+ per-feature round latches and is added alongside them.

---

## 5. State & Data Model

### 5.1 Where L5 state lives

- **Combat turn state** → extend `combatSummary` (single source of truth, already cached in `combatData.js` and SSE-synced). Turn state is intrinsically part of combat and must survive reload + broadcast.
- **Enforcement feature flags + referee role + AI config** → campaign-level runtime keys via `useSyncedState('campaign', …, …, campaignName)`, consistent with existing campaign keys (`'campaign','targetEffects'`, `'campaign','activeCreatureName'`, `'campaign','lastAttack'`).

### 5.2 `combatSummary` extension

```js
// Existing shape (combatData.js):
combatSummary = {
  round: 1,
  creatures: [ { name, type: 'player'|'npc', initiative, currentHp, maxHp, concentration, … } ],
  activeCreatureName: '…',
  lastAppliedTurnStartCreature: `${round}:${name}`,
}

// NEW (Level 5):
combatSummary.turnState = {
  [creatureName]: {
    actionsUsed: 0,        // generic Action budget (1/turn)
    bonusActionsUsed: 0,   // Bonus Action budget (1/turn)
    reactionsUsed: 0,      // Reaction budget (1/round, re-arms at round wrap)
    movementUsedFeet: 0,   // feet consumed this turn (clamped to speed)
    hasMoved: false,       // bool convenience (replaces steadyAimMovedThisTurn semantics)
    turnActive: true,      // this creature's turn is currently open
  },
}
```

Rationale:
- **Orthogonal** to the existing per-feature round latches (`_FastHands_usedRound`, etc.) — those stay as-is (Principle 6).
- **Per-creature** so multi-actor (summons, allies, PvP) each have their own economy.
- **Reset** at the existing turn/round-wrap seams in `navigationHandlers.js` (Principle: reuse seams).

### 5.3 Campaign-level L5 config (runtime keys)

```js
// useSyncedState('campaign', 'enforcement', {
//   mode: 'off',            // 'off' | 'on'   (master switch)
//   turnLock: false,        // Phase 1
//   actionEconomy: false,   // Phase 1
//   movementBudget: false,  // Phase 1
//   lineOfSight: false,     // Phase 2
//   zones: false,           // Phase 2
//   opportunityAttacks: false, // Phase 2
// }, campaignName)

// useSyncedState('campaign', 'referee', null, campaignName)
//   → creature/character name or null. null ⇒ default to isLocalhost client (D4).

// useSyncedState('campaign', 'aiConfig', {
//   endpoint: 'http://localhost:11434', // Ollama (D3)
//   model: 'llama3.1:8b',
//   temperature: 0.7,
//   mode: 'suggest',        // 'suggest' (human confirms) | 'autopilot'
// }, campaignName)

// useSyncedState('campaign', 'sessionState', { phase: 'exploration' }, campaignName)
//   → 'exploration' | 'encounter' | 'travel' | 'roleplay'  (Phase 4)
```

**Default (mode:'off') ⇒ every gate resolves "allowed" ⇒ today's behavior.** This is the L1–4 safety guarantee.

---

## 6. Phase 0 — Enforcement Foundation

The backbone. Nothing in Phases 1–4 works without this. **All off-by-default.**

### 6.1 New module: `src/services/combat/turnState.js`

Pure functions over `combatSummary` (testable without React):

```js
// Read a creature's economy (defaults to a fresh/empty state when absent).
export function getTurnState(combatSummary, creatureName) →
  { actionsUsed, bonusActionsUsed, reactionsUsed, movementUsedFeet, hasMoved, turnActive }

// Charge a budget; returns the new turnState entry. Caller persists.
export function spendAction(combatSummary, creatureName, bucket /* 'action'|'bonusAction'|'reaction' */)
export function spendMovement(combatSummary, creatureName, feet)   // clamped ≥0

// Reset one creature's economy (called from turn-transition seams).
export function resetForTurn(combatSummary, creatureName)
// Re-arm reaction economy for everyone (called from round-wrap seam).
export function rearmReactions(combatSummary)
```

Persistence: `storage.set('combatSummary', summary, campaignName)` (SSE broadcasts to all clients, exactly as combat summary does today).

### 6.2 New module: `src/services/combat/canTakeAction.js` (the gate)

```js
// The single L5 enforcement gate. Returns { allowed, reason }.
export async function canTakeAction({ playerStats, action, bucket, campaignName, mapName, characters }) →
  { allowed: boolean, reason: string | null }
```

Decision logic (short-circuit, in order):
1. `enforcement.mode === 'off'` → `{ allowed: true }` (**today's behavior**).
2. Condition gate (existing): reuse `computeConditionEffects` → `cannotAct` / `cannotActActions` / `cannotActReason`.
3. Turn-lock (if `enforcement.turnLock`): is this creature `activeCreatureName`? Reactions may be allowed off-turn (per rules); actions/bonus only on own turn.
4. Action economy (if `enforcement.actionEconomy`): does `getTurnState` have budget in `bucket`?
5. Spatial (Phase 2, if relevant flags): range / LoS via `isWithinRange` / `lineOfSight`.

**Off → step 1 returns immediately ⇒ zero behavior change.**

### 6.3 Gate wiring (the only existing-code edits in Phase 0)

- `src/components/char-sheet/useCharActionsAutomation.js:351` — replace `if (cannotAct) return;` with the `canTakeAction` gate (deny → `setPopupHtml(reason)` + optional log + return). `cannotAct` still drives the visual disabled state; the gate adds turn/economy denial.
- Attack + spell entry points (`useLoggedDiceRollAttack.js`, `useSpellCastExecutor.js`, `CharBonusActions.jsx`) — same gate call before executing.
- **No change** to the 200+ automation handlers, the pipeline, or the router.

### 6.4 Reset wiring

- In `navigationHandlers.js`:
  - On **turn transition** (new active creature): `resetForTurn(newActiveName)` + mark outgoing `turnActive=false`.
  - On **round wrap** (`runRoundWrapHousekeeping`): `rearmReactions(all)`, reset `movementUsedFeet`, `hasMoved`.
- Mirrors the existing `lastAppliedTurnStartCreatureRef` round-scoped gate pattern.

### 6.5 UI (Phase 0)

- **End Turn button** in the initiative control row (today only `← Prev` / `Next →`). End Turn = advance + reset, distinct from manual Prev/Next.
- **Action-economy readout** on the char sheet + creature card: `1 Action · 1 Bonus · 1 Reaction · Movement 30/30 ft`.
- **Enforcement settings surface**: new **Referee** panel (or an Admin subsection) with the `enforcement` toggles + referee assignment. Referee-only visibility (see §12).
- All UI off-by-default; hidden/disabled when `mode:'off'`.

### 6.6 Exit criteria (Phase 0)

- With `mode:'off'`: `npm run test:run` + `npm run lint` green; L1–4 behavior unchanged (regression gate).
- With `mode:'on'` + `turnLock` only: a non-active creature's action click is denied with a reason; the active creature proceeds.
- Co-located `turnState.test.js` + `canTakeAction.test.js` pass; existing suites green.

---

## 7. Phase 1 — Rules Enforcement

The owner's explicit asks (turn enforcement, action economy, movement limit).

### 7.1 Turn-lock (whose turn)
- Gate (Phase 0) denies non-active creatures' **actions/bonus actions** when `turnLock` is on.
- **Reactions** remain allowed off-turn (rules-correct) but are charged to the reaction budget.
- Auto-advance option: after the active creature's economy is spent or End Turn is pressed, advance `activeCreatureName` through `getNextCreatureName` (`initiativeService.js`).

### 7.2 Action economy
- `spendAction` charges `action` / `bonusAction` / `reaction` buckets from the `automationRouter` taxonomy.
- Deny + reason when budget exhausted ("No actions left this turn").
- Multi-attack features (Extra Attack, etc.) still consume **one** action — the economy charges the *slot*, not the number of attacks. (Verify against existing `extra_action` routing.)

### 7.3 Movement budget
- Replace the boolean `steadyAimMovedThisTurn` semantics with `movementUsedFeet` (kept in sync where `steadyAimMovedThisTurn` is read, e.g. Steady Aim).
- **Map drag clamp** in `src/components/map/hooks/useSelectMove.js` (`applySelectionMove`): when `movementBudget` is on and the map is active, compute the drag distance in feet (reuse `getDistanceFeet` from `rangeValidation.js`), and clamp/snap the token so `movementUsedFeet ≤ speed`. Show a "out of movement" affordance (reuse the existing `drag-invalid` class in `Players.jsx`).
- **Difficult terrain** cost (2 ft/5 ft) wired in where movement is computed — this converts a current `GM-enforced` residual into engine behavior.
- **Graceful degradation**: if no active map / no positioned tokens, mirror `isWithinRange`'s fallback (return true / skip clamp) so non-map play is unchanged.

### 7.4 Turn timer (optional)
- Per-turn countdown in the Referee/Initiative panel; auto-advance on expiry (toggle). Pure client UI + runtime key; off by default.

### 7.5 Exit criteria
- A creature cannot exceed 1 action / 1 bonus / 1 reaction per turn, or its movement budget, when the flags are on; can do all of it freely when off.
- Map drag is clamped to remaining movement; difficult-terrain costs double.
- Co-located tests for each; full suite green.

---

## 8. Phase 2 — Spatial & Zone Enforcement

Convert the high-value **"GM-enforced"** spatial/markers into optionally-enforced engine features.

### 8.1 Token-moving teleport
- Add/extend a `teleport` automation type that **writes `gridX/gridY`** for the token via the map save path (`mapsService.saveMapData` / the active-map token list), instead of only logging RP text.
- Existing teleport features (`psychic_teleportation`, Blink/Misty Step handlers, `teleportModal`) route through it.
- Teleport is **exempt from the movement budget** (it's not movement per rules), but still respects range/LoS flags and turn economy (it's a bonus action, e.g.).

### 8.2 Line of sight → targeting
- Wire `src/services/maps/lineOfSight.js` into the gate when `lineOfSight` is on: a target behind a wall (via `effectiveWalls.js`) is out of range for ranged attacks/casts and triggers the deny/reason path.
- Melee + 5-ft adjacency unaffected.

### 8.3 Cover, difficult terrain, zones
- **Cover** (half/three-quarters) → AC bonus applied in `targetAcComputation.js` when the `zones` flag is on and the target is behind terrain.
- **Zone/area persistence**: fog-of-war, lair/regional actions, and area effects with **initiative-count-20 cadence** and **duration clocks** — promote from `GM-enforced advisory` prose to enforced state (armed targetEffect + round/cadence expiry consumer), reusing the existing `pendingExpirations` + `clearExpirationEffects` machinery.
- This is the largest Phase 2 slice; tackle one zone category at a time, converting its `GM-enforced` markers to an engine consumer and updating the manifest's `verified` status via `.opencode/plans/mark-row.mjs`.

### 8.4 Opportunity attacks
- Auto-trigger an OA when a creature within an enemy's reach (5 ft) moves away, charging the defender's **reaction** budget (Phase 1) and running the existing OA automation (Speedy opportunity-attack passives already exist in `initiative.jsx` / `ConditionEffectBadges`).
- Respect `Sentinel`, `opportunity_attacks_disadvantage`, and the reaction budget.

### 8.5 Exit criteria
- Each converted `GM-enforced` marker has an engine consumer + a test; the manifest row is flipped to `verified`.
- With Phase 2 flags off, all prior behavior is unchanged.

---

## 9. Phase 3 — Runtime AI (local model)

Per D1, this **comes after** enforcement is solid; the AI executes *through* the existing enforcement + automation, never around it.

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
- Input: freeform player action + current world/combat context (assembled from `combatSummary`, quest/faction/NPC state, active map).
- Output (validated): a structured ruling = `{ type: 'dice'|'automation'|'narrative'|'target_effect'|'hp_change', … }` that maps onto the **existing** automation (rolls, `targetEffectDefinitions`, HP writes) **or** a logged narrative outcome.
- The ruling passes through the **same** `canTakeAction` gate + runtime store as a human action (Principle 3).
- `aiConfig.mode:'suggest'` → presents the ruling for the referee/human to confirm before applying. `autopilot` → applies + logs.

### 9.3 AI NPC director
- On an NPC's turn (enforcement mode, Phase 1 turn-lock on), the AI decides the NPC's actions (attack / cast / move / legendary action / legendary resistance / dialogue) and **issues them through the same automation handlers** the GM would click.
- Reuses NPC stat-blocks (`npcsService`, `npcStatBlockUtils`) + the monster action data (`docs/monster-actions-manifest.json`) as the decision context.
- **Arena / PvP / NPC-vs-NPC** works for free: the director is per-creature and faction-aware (uses the existing faction data).
- Dialogue: a chat endpoint bound to an NPC (personality/goals/secrets from the NPC record) — the L5 replacement for "GM voices the NPC."

### 9.4 AI world continuity
- Upgrade the procedural generators (settlement/encounter/quest/rumor) with AI: richer, campaign-consistent content that evolves (consequences of quest outcomes, NPC attitude shifts, random downtime events).
- Still writes through the normal CRUD/runtime-store paths; AI only *generates* the payload.

### 9.5 Safety (non-negotiable)
- **AI never writes state directly.** Only validated structured output → automation/gate/store.
- **Full audit log** of every AI ruling (reuse the campaign log: `type:'ai_ruling'`), so the referee can review/undo.
- **Referee override** always available (D4): the referee can veto/redo any AI action.
- **Deterministic core stays deterministic**: dice rolls, to-hit, damage, saves are the engine's; the AI *narrates* and *selects*, it does not roll.

### 9.6 Exit criteria
- `aiConfig.mode:'suggest'`: NPC turn produces a sensible proposed action; referee confirms → executes via automation.
- Referee endpoint maps a freeform action to a correct ruling in a set of scripted cases.
- Every AI path is logged; with AI disabled, L1–4 unchanged.

---

## 10. Phase 4 — Session Orchestration

The glue that makes L5 run end-to-end without a GM.

### 10.1 Session state machine
- `sessionState.phase` ∈ `exploration | encounter | travel | roleplay`.
- Transitions driven by AI + automation + the referee: e.g. `useTravelManagement.js` (travel) can auto-trigger `encounter` (reuse `encounterGenerator.js` + the encounter builder); combat end → `exploration`.
- The active phase gates which features are active (e.g. turn-lock only meaningful in `encounter`).

### 10.2 Auto-encounter
- AI or rules triggers encounters by location / quest / time / random chance; populates the encounter builder (party auto-populated from characters, difficulty selector) and starts the initiative tracker.

### 10.3 Loot / XP / downtime automation
- Reuse `lootGenerator.js` + AI (Phase 3.4) for post-encounter loot, XP, and downtime progression; writes through normal character management.

### 10.4 Referee console
- The human-oversight surface (D4): enforcement toggles, referee assignment, session phase, End Turn, AI mode (suggest/autopilot), AI ruling review/override/undo, audit-log viewer, and "take over the GM" (drop back to manual L1–4).
- This is what makes L5 *safe*: even in autopilot, a person can intervene.

---

## 11. GM Task Catalog

The 189 `GM-enforced` markers + manual activities, classified by how L5 handles them.

### 11.1 Deterministic → rules engine (Phases 0–2)
Enforce optionally via `canTakeAction` + turnState + spatial services:
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

Today: **GM = `isLocalhost`** (hostname-derived, `useCampaignManagement.js:9`); network clients are read-only.

L5 generalizes this into an assignable **referee** role (D4):

- `referee` runtime key: a character/creature name, or `null` ⇒ default to the `isLocalhost` client (preserves today's behavior when unassigned).
- **Referee capabilities** (Referee console, Phase 4): set enforcement flags, assign/strip referee, End Turn, advance phase, confirm/override/undo AI, take over manual control.
- **Players** (non-referee): act through the enforced gates; can see shared state (init, HP, conditions) as today.
- **Referee disabled (autopilot):** no human authority; AI + engine run the session; audit log remains the safety net.
- **Backward compat:** a campaign with no L5 features and `referee:null` behaves exactly like today (GM=localhost, players read-only).

> Note: with D2 (client gate only), the "authority" is a UX/permission distinction (who sees the console, who can override), not a hard anti-cheat boundary. State mutation still flows through the shared runtime store.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Large existing test surface regresses** | Every L5 feature off-by-default; Phase 0's exit gate requires `npm run test:run` + `npm run lint` green with `mode:'off'` before proceeding. Add co-located tests per gate. |
| **Refactoring the 30+ round latches** | Do **not** refactor them. The new `turnState` economy is orthogonal and additive (Principle 6). |
| **Movement clamp breaks non-map play** | Mirror `isWithinRange`'s fallback: no active map / no positioned tokens ⇒ skip clamp. |
| **Action economy mis-charges multi-attack** | Charge the *slot* (action), not attack count; verify against `extra_action` routing + write a focused test. |
| **AI writes state directly / hallucinates rules** | AI = proposer only (Principle 3); validated structured output; engine rolls dice; full audit log; referee override. |
| **Local model unavailable/slow** | `aiConfig` endpoint is configurable; degrade gracefully to "AI unavailable → manual" if the endpoint is down. `suggest` mode never blocks the game. |
| **Zones/lair actions are the fuzziest engine work** | Tackle one zone category at a time in Phase 2; convert its `GM-enforced` markers to a consumer + test; flip manifest rows via `mark-row.mjs`. |
| **Scope creep in L5** | Enforcement-first (D1); each phase has exit criteria; AI is last and pluggable. |

---

## 14. Test Strategy

- **Unit** (co-located `*.test.js`): `turnState.test.js`, `canTakeAction.test.js` (matrix: flag on/off × bucket × whose-turn × condition), `movementBudget.test.js`, `localProvider.test.js` (mock endpoint), AI schema validators.
- **Integration**: gate wired into `useCharActionsAutomation` (mock `combatSummary` + enforcement on/off); map-drag clamp in `useSelectMove` (mock map data); round-wrap resets in `navigationHandlers`.
- **Regression gate**: Phase 0 ships only when `mode:'off'` yields a green full suite + lint (zero warnings). This is the L1–4 safety proof, run after every phase.
- **AI**: scripted cases for referee rulings + NPC director decisions; assert the *engine* rolled the dice (not the AI); assert audit-log entries.
- **Playwright** (manual verification on `test-campaign` only): turn-lock denial, End Turn advance, movement clamp, referee console, suggest→confirm AI flow.

---

## 15. Implementation Order

Ordered by dependency and risk (enforcement-first, D1):

1. **Phase 0** — `turnState.js` + `canTakeAction.js` + `enforcement`/`referee` runtime keys + End Turn button + economy readout + Referee settings panel. **Off-by-default. Tests first.** ← *first increment*
2. **Phase 1** — turn-lock, action economy, movement budget + drag clamp, turn timer.
3. **Phase 2** — token-moving teleport → line-of-sight → cover/difficult-terrain → zones/lair (one at a time) → opportunity attacks.
4. **Phase 3** — `server/services/ai/` (local provider + schemas + prompts) → AI referee → AI NPC director → AI world continuity.
5. **Phase 4** — session state machine → auto-encounter → loot/XP/downtime → Referee console.

Each phase: implement → co-located tests → `npm run lint` + `npm run test:run` green → (Playwright on `test-campaign`) → update this doc's status + the manifest where relevant.

---

## 16. Open Questions & Future Considerations

- **Reaction timing granularity:** enforce "once per round" vs allow multiple reactions if the feature grants them (e.g. multiple reaction features) — needs a per-creature reaction-cap model.
- **Shared/borrowed actions:** features that let another creature act (e.g. command companions, Help action) — how the economy charges a *different* creature's budget.
- **2024 vs 5e differences:** action economy is largely the same, but resource pools (e.g. 2024 Focus Points vs ki) differ — confirm `turnState` stays ruleset-agnostic (charge slots, not class resources).
- **Local model capability:** which local model size yields reliable structured output for the referee/director; whether a larger model is needed for freeform adjudication.
- **Persistence of AI context:** how much world/quest/NPC state to include in each AI prompt (token budget) without leaking secrets across clients.
- **Undo/rollback:** the Admin "Rollback to Snapshot" exists — integrate AI-override undo with snapshots.
- **Multi-campaign AI:** whether `aiConfig` is per-campaign (current design) or global.
- **SSE load:** L5 adds more runtime-key writes (turnState, flags) — confirm the single shared SSE connection + 10s change-data debounce still handle the volume without the documented connection-exhaustion issue.

---

## Appendix A — Key file references

| Concern | File(s) |
|---|---|
| Condition gate | `src/services/combat/conditions/conditionEffects.js` |
| Economy taxonomy | `src/services/combat/automation/automationRouter.js` |
| Combat summary / active creature | `src/services/encounters/combatData.js`, `getCombatContext()` |
| Turn-transition seams | `src/components/initiative/navigationHandlers.js`, `initiative.jsx` |
| Gate wiring point | `src/components/char-sheet/useCharActionsAutomation.js:351`, `useLoggedDiceRollAttack.js`, `useSpellCastExecutor.js`, `CharBonusActions.jsx` |
| Movement / drag | `src/components/map/hooks/useSelectMove.js`, `src/components/map/Players.jsx`, `src/services/rules/combat/rangeValidation.js` (`getDistanceFeet`) |
| Range / LoS / walls | `src/services/rules/combat/rangeCheck.js`, `src/services/maps/lineOfSight.js`, `effectiveWalls.js`, `reachability.js` |
| Runtime store | `src/hooks/runtime/useRuntimeState.js`, `useSyncedState.js`, `src/services/ui/sseClient.js` |
| Authority marker | `src/hooks/management/useCampaignManagement.js:9` |
| Generators | `encounters/encounterGenerator.js`, `campaign/settlementGenerator.js`, `maps/dungeonGenerator.js`, `items/lootGenerator.js` |
| Travel | `src/hooks/management/useTravelManagement.js` |
| GM-enforced catalog | `docs/monster-actions-manifest.json` + 189 in-code markers; flip via `.opencode/plans/mark-row.mjs` |

## Appendix B — Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-25 | D1 Enforcement-first | Lower risk, no LLM dependency, solid "rules referee" before AI. |
| 2026-09-25 | D2 Client gate only | Fits current arch, minimal change; trusted-client model accepted (referee + audit mitigate). |
| 2026-09-25 | D3 Local model | Free, private, offline; provider-agnostic adapter keeps options open. |
| 2026-09-25 | D4 Optional human referee | Reuses `isLocalhost` authority; preserves a human safety valve; can be disabled for autopilot. |
