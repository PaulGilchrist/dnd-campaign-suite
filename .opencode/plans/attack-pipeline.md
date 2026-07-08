# Attack Pipeline Improvements Plan

## Session Context

**This plan was produced after a full-codebase exploration of the attack pipeline refactor.** A new implementation session should read this plan top-to-bottom before touching any code.

**Key files the new session MUST read first:**
- `src/services/combat/steps/sseObservers.js` — SSE broadcast observers (current, will be rewritten)
- `src/App.jsx` lines 362-399 — `handleRuntimeEvent` (where pipeline events are silently ignored)
- `src/services/combat/actionPipeline.js` — Pipeline engine (77 lines, unchanged)
- `src/services/combat/steps/weaponDamageSteps.js` — 14-step weapon pipeline (1044 lines)
- `src/services/combat/steps/spellDamageSteps.js` — 4-step spell pipeline (139 lines, will be enhanced)
- `src/services/combat/steps/index.js` — Pipeline builder (57 lines)
- `src/services/combat/steps/features/index.js` — 18 feature modules (39 lines)
- `src/hooks/runtime/useSyncedState.js` — Synced state hook (65 lines)
- `src/components/char-sheet/useCharActionModals.js` — Where `pipeline-pause` synced state is consumed
- `src/components/char-sheet/CharActionModals.jsx` — Modal rendering component
- `src/services/shared/logPoster.js` — Redundant wrapper (will be deleted)
- `src/services/rules/rulesFactory.js` — Has delegation wrappers (will be cleaned)
- `server/routes/pipeline-events.js` — SSE endpoint (POST stores, GET retrieves, publish broadcasts)
- `server/routes/sse.js` — `/subscribe` SSE endpoint

**Critical architecture insight:** The pipeline event flow is broadcast + listen. SSE observers POST events to the server. Clients subscribe via `EventSource` to `/subscribe`. `App.jsx` `handleRuntimeEvent` processes SSE events. **Pipeline events are currently silently ignored** — this is the bug preventing cross-client modal visibility.

**Pipeline step structure:** `{ name, subscribe, emit, condition(ctx), handler(ctx) → { data?, modal?, popup?, nextEvent? } | null }`

**Feature module structure:** `{ name, condition(ctx), handler(ctx, prevData) → { data?, modal?, sideEffects? } | null }`

---

## Goals

1. **Automatic SSE broadcast AND listen** — Remove the manual `EVENT_MAPPING` object. Every pipeline step broadcasts via SSE automatically. Clients already listen via `Subscriber.jsx` → `handleRuntimeEvent` → `setRuntimeObject` with `skipSync=true` → `useSyncedState`. The current problem: pipeline events are received but silently ignored (App.jsx line 380-383 returns early). Pipeline events MUST be processed so all clients see all modals/pauses.
2. **Spell pipeline parity** — Bring the spell pipeline closer to weapon pipeline feature coverage (feature riders, automation bonuses, mastery effects) so it scales to 390+ spells.
3. **Remove dead code** — Clean up `logPoster.js` wrapper, `rulesFactory.js` delegation wrappers, dead SSE observer, and empty directory.

## Current State

### SSE Architecture (Broadcast + Listen)

The SSE system works in two directions:

1. **Broadcast (POST):** SSE observers POST pipeline events to `/api/campaigns/:campaign/pipeline-event` → server stores in `characterChangeData` → server publishes via SSE to all clients.
2. **Listen (subscribe):** `Subscriber.jsx` connects to `/subscribe` via `EventSource` → receives SSE events → calls `handleRuntimeEvent` → `setRuntimeObject(storeKey, event.data, campaignName, skipSync=true)` → `useSyncedState` re-renders.

### The Problem

In `App.jsx` lines 380-383, pipeline events are **silently ignored**:

```js
if (event.key.startsWith('pipeline-')) {
  const prefix = `pipeline-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  return;  // ← Always returns, does nothing
}
```

This means when User A triggers a modal step, the event is POSTed and stored on the server, but User B never processes it. User B's `pendingDamage` (`useSyncedState(campaignName, 'pipeline-pause', null)`) is **never set** because `pipeline-pause` is only populated when the SSE handler calls `setRuntimeObject('pipeline-pause', data, ...)` — but pipeline events never reach that code path.

### How `pendingDamage` Currently Works

- `useCharActionModals` declares `const [pendingDamage, setPendingDamage] = useSyncedState(campaignName, 'pipeline-pause', null)`.
- `setPendingDamage` is only ever called with `null` (to clear). It is never set to a non-null value in any handler.
- `pendingDamage` is populated by SSE sync: when the server stores `pipeline-pause` data, all clients receive it via SSE and `useSyncedState` updates the local React state.
- But `pipeline-pause` data is never POSTed by any SSE observer because pipeline events are ignored in `handleRuntimeEvent`.

### What Needs to Happen

1. **Broadcast:** SSE observers must POST every pipeline event automatically (remove EVENT_MAPPING).
2. **Listen:** `App.jsx` `handleRuntimeEvent` must process pipeline events and call `setRuntimeObject` for `pipeline-pause` and other pipeline state keys so `useSyncedState` hooks update across all clients.

### Other Current State Issues

- **Spell pipeline** has 4 steps vs weapon's 14 steps. Missing: feature riders, automation bonuses, mastery effects, target effects, superiority bonuses, etc.
- **`logPoster.js`** is a redundant wrapper around `addEntry()` with silent error suppression.
- **`rulesFactory.js`** has 12 core delegation wrappers + 6 class/race wrappers that add zero logic.
- **`overchannel:self-damage`** SSE observer never fires (no step emits this event).
- **Empty directory** at `src/services/combat/automationInfoBuilder/`.

---

## Implementation Steps

### Step 1: Automatic SSE Broadcasting AND Listening

**Files:**
- `src/services/combat/steps/sseObservers.js` — broadcast side
- `src/App.jsx` lines 380-383 — listen side

**Current approach:**
- **Broadcast:** Static `EVENT_MAPPING` object (45 entries) maps pipeline events to SSE keys. Manual opt-in.
- **Listen:** `App.jsx` `handleRuntimeEvent` receives pipeline events but silently ignores them (lines 380-383 return early).

**New approach:**

#### 1a. Broadcast — Remove EVENT_MAPPING

1. Remove `EVENT_MAPPING` constant entirely.
2. Create a single wildcard observer that fires on every event.
3. The wildcard observer POSTs to the SSE endpoint with the event name as the key.
4. Keep the modal-specific observers (`*` checking `result.modal`, `pipeline:resumed` for `modal:dismissed`).

#### 1b. Listen — Process Pipeline Events

1. In `App.jsx` `handleRuntimeEvent`, replace the early-return block (lines 380-383) with actual processing.
2. Pipeline events stored as `pipeline-{campaign}-{key}` should be unwrapped and passed to `setRuntimeObject` so `useSyncedState` hooks update across all clients.
3. Specifically, `pipeline-pause` events must be processed — when User A's pipeline pauses, User B's `pendingDamage` synced state must update.
4. `modalState` events must also be processed — when User A triggers a modal, User B must see it.

**Result:** Any step that emits an event automatically broadcasts via SSE. All clients receive and process pipeline events in real-time. Zero configuration needed for new events.

**Tests to update:** `src/services/combat/steps/sseObservers.test.js`
- Remove the "should include all 20 mapped events" test (or replace with "should broadcast all events automatically").
- Remove individual event tests (replace with a single test verifying wildcard behavior).
- Keep modal observers tests (they test different logic).
- Add tests for `App.jsx` `handleRuntimeEvent` pipeline event processing.

---

### Step 2: Spell Pipeline Enhancement

**File:** `src/services/combat/steps/spellDamageSteps.js`

**Current approach:** 4 steps — `spellHousekeeping → spellContext → spellRollDamage → spellOverchannel → spellProceedToDamage`. No feature riders, no automation bonuses, no mastery effects.

**New approach:** Add the missing step categories from the weapon pipeline that are relevant to spell attacks:
1. **`spellFeatureRiders`** — Reuse the same `featureModules` array (already imported in weapon steps).
2. **`spellAutomationBonuses`** — Empowered Evocation is already in `spellContext`; add spell-specific automation bonuses (e.g., `cantrip_bonus` for Blessed Strikes).
3. **`spellProceedToDamage`** — Already exists, keep as-is.

**Revised spell pipeline flow:**
```
spell:do → spell:context → spell:formulas → spell:rolled → spell:riders → spell:ready → spell:applied
```

**Changes:**
1. Add `spellFeatureRiders` step between `spell:rolled` and `spell:overchannel`.
2. Import `featureModules` from `./features/index.js`.
3. Reuse the same feature dispatch loop pattern from weapon's `featureRiders` step.
4. This ensures all 18 existing features (colossus slayer, piercer, etc.) also fire for spell attacks.

**Tests to update:** `src/services/combat/steps/index.test.js` — verify spell pipeline has feature riders step.

---

### Step 3: Remove logPoster.js Wrapper

**File:** `src/services/shared/logPoster.js`

**Current approach:** Thin wrapper around `addEntry()` with `.catch(() => {})` error suppression.

**New approach:** Replace all `postLogEntry()` callers with direct `addEntry()` calls using proper error logging per code conventions ("Don't swallow errors. Always log or surface them.").

**Changes:**
1. Find all files importing `postLogEntry` from `logPoster.js`.
2. Replace each import with `addEntry` from `logService.js`.
3. Replace each `postLogEntry(campaignName, entry)` call with `addEntry(campaignName, entry).catch((e) => { console.error('[log] Error:', e); })`.
4. Delete `logPoster.js`.

**Files affected:**
- `src/services/shared/logPoster.js` — delete
- `src/services/encounters/combatLoggingService.js` — replace import + calls
- `src/services/encounters/encounterToInitiative.js` — replace import + calls
- `src/services/automation/handlers/spells/fearHandler.js` — replace import + calls
- `src/services/automation/handlers/spells/holdMonsterHandler.js` — replace import + calls
- `src/services/automation/handlers/spells/stinkingCloudHandler.js` — (test only, update mock)
- `src/services/automation/handlers/spells/silenceHandler.js` — (test only, update mock)
- `src/services/automation/handlers/spells/fleshToStoneHandler.js` — (test only, update mock)
- `src/services/automation/handlers/spells/slowHandler.js` — (test only, update mock)
- `src/services/automation/handlers/spells/friendsHandler.js` — replace import + calls
- `src/services/automation/handlers/reactions/boonOfRecoveryHandler.js` — replace import + calls
- `src/services/automation/handlers/shieldOfFaithHandler.js` — replace import + calls
- `src/services/automation/handlers/healing/aidHandler.js` — replace import + calls
- `src/services/automation/handlers/healing/revivificationHandler.js` — replace import + calls
- `src/services/automation/handlers/buffs/mageArmorHandler.js` — replace import + calls
- `src/services/automation/handlers/buffs/heroesFeastHandler.js` — replace import + calls
- `src/services/automation/handlers/buffs/longstriderHandler.js` — replace import + calls
- `src/services/automation/handlers/class-bard/bardicInspirationHandler.js` — replace import + calls
- `src/services/automation/common/healingRoll.js` — replace import + calls
- `src/services/combat/steps/spellDamageSteps.js` — replace `.catch(() => {})` with proper error logging
- `src/services/combat/steps/weaponDamageSteps.js` — replace `.catch(() => {})` in cleave step with proper error logging
- Multiple test files — update mocks from `postLogEntry` to `addEntry`

**Tests to update:**
- `src/services/encounters/combatLoggingService.test.js` — mock `addEntry` instead of `postLogEntry`
- `src/services/encounters/encounterToInitiative.test.js` — mock `addEntry` instead of `postLogEntry`
- All test files that mock `logPoster.js` — mock `logService.js` instead

---

### Step 4: Remove rulesFactory.js Delegation Wrappers

**File:** `src/services/rules/rulesFactory.js`

**Current approach:** 12 core delegation wrappers (lines 33-79) + 6 class/race delegation wrappers (lines 82-100) that simply forward arguments to `rules`.

**New approach:** Callers that need these methods should use `rules` directly. The only callers of these wrappers are in `rulesFactory.test.js` (tests). No production code calls them.

**Changes:**
1. Remove lines 31-100 (all delegation wrappers).
2. Keep `getSenses` (lines 107-141) — it has real logic (Truesight, Blindsight from passives).
3. Keep `getDruid*` and `getRogueSneakAttack` — they dispatch to classRules which varies by ruleset.
4. Update `rulesFactory.test.js` to call `rules` directly for the removed methods, or remove those test cases.

**Tests to update:** `src/services/rules/rulesFactory.test.js`
- Tests for `getAbilityLongName`, `getAbilities`, `getActions`, `getArmorClass`, `getAttacks`, `getHitPoints`, `getLanguages`, `getMagicItems`, `getProficiencyChoiceCount`, `getProficiencies`, `getSpellAbilities`, `getSpellMaxLevel` — change to call `rules` directly.
- Tests for `getDruid*` and `getRogueSneakAttack` — keep as-is (not wrappers).
- Test for `getImmunities` — keep but call `rulesFactory.getRules(playerSummary).raceRules.getImmunities()` directly.
- Test for `getResistances` — keep but call `rulesFactory.getRules(playerSummary).raceRules.getResistances()` directly.
- Test for `getSenses` — keep as-is (has real logic).

---

### Step 5: Clean Up Dead Code

**Changes:**
1. Delete `src/services/combat/automationInfoBuilder/` (empty directory).
2. Remove `'overchannel:self-damage': 'overchannel:self-damage'` from SSE observer (will be handled by Step 1's automatic broadcasting).

---

## File Change Summary

| File | Action |
|------|--------|
| `src/services/combat/steps/sseObservers.js` | Rewrite: remove EVENT_MAPPING, use wildcard observer |
| `src/services/combat/steps/sseObservers.test.js` | Update tests for new automatic broadcasting |
| `src/App.jsx` | Process pipeline events in handleRuntimeEvent (replace early-return) |
| `src/App.jsx` | Add tests for pipeline event processing |
| `src/services/combat/steps/spellDamageSteps.js` | Add featureRiders step for spell attacks |
| `src/services/combat/steps/index.test.js` | Add test for spell pipeline feature riders |
| `src/services/shared/logPoster.js` | Delete |
| `src/services/rules/rulesFactory.js` | Remove delegation wrappers (lines 31-100) |
| `src/services/rules/rulesFactory.test.js` | Update tests for removed wrappers |
| `src/services/encounters/combatLoggingService.js` | Replace postLogEntry with addEntry |
| `src/services/encounters/combatLoggingService.test.js` | Update mocks |
| `src/services/encounters/encounterToInitiative.js` | Replace postLogEntry with addEntry |
| `src/services/encounters/encounterToInitiative.test.js` | Update mocks |
| `src/services/automation/handlers/spells/fearHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/spells/holdMonsterHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/spells/friendsHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/reactions/boonOfRecoveryHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/shieldOfFaithHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/healing/aidHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/healing/revivificationHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/buffs/mageArmorHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/buffs/heroesFeastHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/buffs/longstriderHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/handlers/class-bard/bardicInspirationHandler.js` | Replace postLogEntry with addEntry |
| `src/services/automation/common/healingRoll.js` | Replace postLogEntry with addEntry |
| `src/services/combat/steps/spellDamageSteps.js` | Replace `.catch(() => {})` with proper error logging |
| `src/services/combat/steps/weaponDamageSteps.js` | Replace `.catch(() => {})` in cleave step with proper error logging |
| Multiple test files | Update mocks from postLogEntry to addEntry |
| `src/services/combat/automationInfoBuilder/` | Delete empty directory |

---

## Execution Order

1. **Step 1a** — Automatic SSE broadcast (safest, no dependencies)
2. **Step 1b** — Pipeline event listening in App.jsx (depends on 1a for data to arrive)
3. **Step 2** — Spell pipeline enhancement (depends on Step 1 for SSE coverage)
4. **Step 3** — Remove logPoster.js (standalone, many files)
5. **Step 4** — Remove rulesFactory wrappers (standalone)
6. **Step 5** — Clean up dead code (trivial, can be combined with any step)

After all steps: run `npm run lint` and `npm run test:run`.
