# Recommendation #4: Server-First Enforcement — Make SSE Obvious and Enforceable

## Problem

The server-first architecture exists (`setRuntimeValue` → POST → `publish()` → SSE → `setRuntimeObject`), but developers bypass it with `useState`/`useRef`/`window` globals. This creates inconsistent state across clients. The pattern is documented in AGENTS.md as a "gotcha" but needs to be **enforced** so future developers can't accidentally bypass it.

## Solution

Two-pronged approach:

1. **`useSyncedState` hook** — A wrapper that replaces `useState` for game-affecting state. It's impossible to forget SSE sync because the hook does it automatically.
2. **ESLint rules** — Warn/error on `window.` access and flag `useState`/`useRef` usage patterns that indicate game state stored locally.

## Part 1: `useSyncedState` Hook

### Design

```js
// src/hooks/runtime/useSyncedState.js

/**
 * Server-first state hook.
 * Replaces useState for any state that should be visible to all clients.
 *
 * Usage:
 *   const [value, setValue] = useSyncedState(campaignName, 'myKey', defaultValue);
 *
 * - Reads from runtime store on mount
 * - Writes to runtime store on change (triggers SSE broadcast)
 * - All clients see the same value automatically
 * - skipSync=true prevents re-POST loops on SSE echo
 */
export function useSyncedState(campaignName, key, defaultValue) {
  const [value, setValue] = useState(() => getRuntimeValue(characterKey, key) ?? defaultValue);
  
  const setValueSynced = useCallback((newValue) => {
    setRuntimeValue(characterKey, key, newValue, campaignName);
  }, [campaignName, characterKey, key]);
  
  return [value, setValueSynced];
}
```

### Key Design Decisions

- **`campaignName` + `key` required** — Makes the SSE contract explicit in the call site
- **Returns `[value, setValue]`** — Drop-in replacement for `useState`
- **`defaultValue`** — Only used on first mount; server state takes priority
- **`characterKey`** — The runtime store key (usually the character name or campaign name)
- **No `skipSync` needed** — `setRuntimeValue` always POSTs; `setRuntimeObject` on the receiving end uses `skipSync=true`

### Migration Path

Replace `useState` declarations for game-affecting state with `useSyncedState`:

```diff
- const [pendingDamage, setPendingDamage] = useState(null);
+ const [pendingDamage, setPendingDamage] = useSyncedState(campaignName, 'pendingDamage', null);
```

### Files to Migrate (by priority)

#### Critical — `window.__` globals (game-breaking)
| File | Variable | Current Key Pattern |
|------|----------|-------------------|
| `src/hooks/combat/useLoggedDiceRoll.js` | `window.__pendingSaves` | `campaignName` → `'pendingSavePrompts'` |
| `src/hooks/combat/savePrompt.js` | `window.__createSaveListenerPrompts` | `campaignName` → `'pendingSaveListeners'` |

#### High — Pipeline/Modal state
| File | Variable | Runtime Key |
|------|----------|-------------|
| `src/components/char-sheet/useCharActionModals.js` | `pendingDamageRef` | `campaignName` → `'pipeline-pause'` |
| `src/components/char-sheet/CharActions.jsx` | `showCleaveTargetSelection` + `cleaveSecondTargets` | `campaignName` → `'cleavePending'` |
| `src/components/char-sheet/CharActions.jsx` | `tacticalMasterModal` | `campaignName` → `'tacticalMasterPending'` |
| `src/components/char-sheet/CharActions.jsx` | `autoDamageRollContext` | `campaignName` → `'autoDamageContext'` |

#### Medium — Travel management
| File | Variables | Runtime Key |
|------|-----------|-------------|
| `src/hooks/combat/useTravelManagement.js` | 13 state vars | `campaignName` → `travel-{subKey}` |

#### Low — Combat UI state
| File | Variables | Runtime Key |
|------|-----------|-------------|
| `src/components/initiative/initiative.jsx` | `conditionPickerTarget`, `concentrationPickerTarget`, `viewingMonster` | `campaignName` → `combat-ui-{subKey}` |

### New Hook: `useSyncedStateBatch`

For cases where multiple related values change together:

```js
export function useSyncedStateBatch(campaignName, characterKey, keys, defaults = {}) {
  // Returns { values: Map, setValues: (updates: Map) => void }
  // Batch-write avoids multiple SSE broadcasts
}
```

## Part 2: ESLint Rules

### Rule 1: `no-window-access`

Warn on any `window.` access. The only legitimate uses are browser APIs (`window.fetch`, `window.EventSource`), not application state.

```js
// eslint-plugin-custom rules
'no-window-access': 'error'
```

**Exceptions for existing code:** Add `/* eslint-disable no-window-access */` comments only for the `window.__pendingSaves` and `window.__createSaveListenerPrompts` usages, which will be removed during migration.

### Rule 2: `no-local-game-state`

Warn when `useState` or `useRef` is used with names that suggest game state (keywords: `pending`, `active`, `current`, `target`, `choice`, `modal`, `popup`, `save`, `damage`, `attack`, `creature`, `condition`, `buff`, `debuff`).

```js
'no-local-game-state': 'warn'
```

This is a **warn**, not error, because:
- Some `useState`/`useRef` are legitimately local (ephemeral UI, DOM refs, per-client display)
- During migration, it will surface candidates for conversion
- Once migration is complete, it can be upgraded to `error`

### Rule 3: `require-synced-state`

When a component has `setRuntimeValue` calls, warn if it also has `useState` with game-state-like names. This catches the common pattern where some state is synced but not all.

```js
'require-synced-state': 'warn'
```

### ESLint Configuration Update

```js
// eslint.config.js additions
{
  files: ['**/*.js', '**/*.jsx'],
  rules: {
    // Existing rules...
    'no-window-access': 'error',
    'no-local-game-state': 'warn',
    'require-synced-state': 'warn',
  }
}
```

## Part 3: AGENTS.md Documentation Update

Add a new section to AGENTS.md:

```markdown
## Server-First Pattern

**Every piece of game state MUST go through the runtime store.**

### The Pattern

```js
// READ
const [value, setValue] = useSyncedState(campaignName, 'myKey', defaultValue);

// OR for existing code not yet migrated:
const value = getRuntimeValue(characterKey, 'myKey');
await setRuntimeValue(characterKey, 'myKey', newValue, campaignName);
```

### What Goes in the Runtime Store

| Category | Examples |
|----------|----------|
| HP/SP | `currentHitPoints`, `spellSlots_level_1` |
| Conditions/Buffs | `activeConditions`, `activeBuffs` |
| Pipeline State | `pipeline-pause`, `cleavePending` |
| Save Prompts | `pendingSavePrompts` |
| Travel State | `travel-pace`, `travel-destination` |
| Combat UI | `conditionPickerTarget`, `concentrationPickerTarget` |

### What Stays Local (per-client only)

| Category | Examples |
|----------|----------|
| Ephemeral UI | `isLoading`, `showModal` (component-specific toggle) |
| DOM refs | `ref={useRef(null)}` for focus/scroll |
| Event ordering | `pendingPromptIdRef` (race condition guard) |
| Display formatting | `theme`, `expandedSections` |

### Anti-Patterns (ESLint will catch these)

- `window.__someState` — **ERROR**: Always use `setRuntimeValue`
- `useState` with `pending`/`active`/`current` in the name — **WARN**: Consider `useSyncedState`
- `useRef` storing game data — **WARN**: Consider `getRuntimeValue`/`setRuntimeValue`
```

## Implementation Order

### Phase 1: Foundation (no breaking changes)
1. Create `src/hooks/runtime/useSyncedState.js` — the hook
2. Create `src/hooks/runtime/useSyncedState.test.js` — tests
3. Add ESLint rules to `eslint.config.js`
4. Update AGENTS.md with Server-First Pattern section

### Phase 2: Critical fixes (game-breaking bugs)
5. Migrate `window.__pendingSaves` → `useSyncedState` in `savePrompt.js`
6. Migrate `window.__createSaveListenerPrompts` → `useSyncedState` in `savePrompt.js`
7. Fix `cleaveAttackPending` / `setCleaveAttackPending` prop passing bug
8. Run lint + tests

### Phase 3: Pipeline state sync
9. Migrate `pendingDamageRef` → runtime store key `pipeline-pause`
10. Update `actionPipeline.js` to read/write `pipeline-pause` from runtime store
11. Update `useModalHandlers.js` to read from runtime store
12. Run lint + tests

### Phase 4: Modal state sync
13. Migrate all 57 modal states in `useCharActionModals.js` → `useSyncedState`
14. Update `CharActions.jsx` cleave/tactical master state
15. Run lint + tests

### Phase 5: Travel management sync
16. Migrate `useTravelManagement.js` 13 state vars → `useSyncedState`
17. Run lint + tests

### Phase 6: Combat UI sync
18. Migrate `initiative.jsx` picker states → `useSyncedState`
19. Run lint + tests

### Phase 7: Enforcement
20. Upgrade ESLint `no-local-game-state` from `warn` to `error`
21. Run full lint — fix any remaining warnings
22. Final test run

## Risk Mitigation

- **Phase 1 is additive** — no existing code changes
- **`useSyncedState` is a drop-in replacement** — same API as `useState`
- **ESLint rules start as `warn`** — no breaking changes during migration
- **Tests verify each phase** — run `npm run test:run` after each phase
- **`setRuntimeValue` already handles SSE** — no new server infrastructure needed
- **`skipSync=true` prevents echo loops** — existing pattern, well understood

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/runtime/useSyncedState.js` | Server-first state hook |
| `src/hooks/runtime/useSyncedState.test.js` | Hook tests |
| `eslint-plugin-custom/rules/no-window-access.js` | ESLint rule |
| `eslint-plugin-custom/rules/no-local-game-state.js` | ESLint rule |
| `eslint-plugin-custom/rules/require-synced-state.js` | ESLint rule |

### Modified Files
| File | Change |
|------|--------|
| `eslint.config.js` | Add custom plugin + rules |
| `AGENTS.md` | Add Server-First Pattern section |
| `src/hooks/combat/savePrompt.js` | Migrate `window.__` globals |
| `src/hooks/combat/useLoggedDiceRoll.js` | Migrate `window.__pendingSaves` usage |
| `src/components/char-sheet/useCharActionModals.js` | Migrate `pendingDamageRef` + modal states |
| `src/components/char-sheet/CharActions.jsx` | Migrate cleave/tactical master state |
| `src/components/char-sheet/useModalHandlers.js` | Read from runtime store |
| `src/services/combat/actionPipeline.js` | Read/write pipeline state from store |
| `src/hooks/combat/useTravelManagement.js` | Migrate 13 state vars |
| `src/components/initiative/initiative.jsx` | Migrate picker states |
