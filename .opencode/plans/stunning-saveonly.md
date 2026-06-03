# Stunning Strike Save-Only Automation — Handoff Summary

## Background
Stunning Strike was crashing with `TypeError: undefined is not an object (evaluating 'formula.replace')` because it's a save-only control effect with NO `damage` field. The `auto.damage` value was `undefined`, and `rollExpression(undefined)` crashed in `diceRoller.js`.

## What Was Implemented (Uncommitted)

**4 files modified:**

1. **`src/services/diceRoller.js:31`** — Added null guard: `if (!formula) return null;` before `formula.replace()`. Fixes the crash for all callers.

2. **`src/services/automationService.js:64-75`** — Added `'save_only'` case in `buildAttackInfo()` returning structured data (type, name, saveType, saveDc, conditionInflicted, duration, successEffect, hasAutomation). Line 513 also registered it in `collectAutomationFromFeatures()` alongside `'save_attack'`.

3. **`public/data/2024/classes.json:4588`** — Changed `"type": "save_attack"` to `"type": "save_only"`. (Verify this is correct path vs 5e classes.json.)

4. **`src/components/char-sheet/CharActions.jsx`** — Added `sendSavePrompt` import + full `'save_only'` handler case:
    - Target resolution via `getTargetFromAttacker()` / `getCombatContext()`
    - Save DC computation (ability-based 8+CON+prof or hardcoded)
    - `sendSavePrompt()` to trigger SavePromptModal
    - Log entry on activation
    - Event listener `handleSaveResult` that applies effects based on save outcome:
      - FAIL: Adds `'stunned'` to target's `activeConditions` via `setRuntimeValue()`
      - SUCCESS: Sets `${conditionInflicted}_speedHalved` timestamp for speed halving

## Critical Issues Identified

### A. Event Listener Missing Cleanup
`handleSaveResult` added with addEventListener at line 579 but only self-removed inside handler (line 563). No cleanup in useEffect. If multiple automations fire or component re-renders, stale listeners accumulate. Add `{ once: true }` option instead.

### B. `conditionInflicted` is NULL for Stunning Strike
AutomationService line 70: `conditionInflicted: auto.conditionInflicted || null`. The classes.json may use `"condition": "stunned"` not `"conditionInflicted"`. Need fallback: `auto.conditionInflicted || auto.condition || 'stunned'`. Same concern for `successEffect`.

### C. Missing Conditional Flow
The SavePromptModal dispatches `save-result` CustomEvent (line 86 in Modal.jsx) — this IS picked up by CharActions handler. But event flow needs validation:
- `sendSavePrompt()` triggers a fetch to `/api/campaigns/{campaign}/savePrompt-{targetName}`
- This is served by campaigns-changedata route which stores data AND broadcasts SSE
- Subscriber picks up the event and pipes it to SavePromptModal via handleEvent
- Modal dispatches CustomEvent with `detail: { promptId, targetName, saveType, saveDc, success, roll, total, ... }`
- CharActions' `handleSaveResult` receives event.detail.success — SHOULD WORK but needs end-to-end testing

### D. Target Resolution May Fail Silently
If no combatSummary in localStorage, all targets default to `playerStats.name` (the monk). Stunning Strike should apply against an attack target, not the player themselves. Non-combat fallback is incorrect — need a visible target selection mechanism or at minimum prevent self-targeting.

### E. `until_start_of_next_turn` Duration Expiration Not Implemented
Line 95 shows partial pattern: when initiative rolls, clears `stunned_speedHalved` timestamp. But does NOT auto-remove 'stunned' from `activeConditions`. Condition persists after turn expires. Both timestamp AND condition must be cleared on initiative roll.

### F. No Tests for `save_only`
automationService.test.js likely has no test coverage for the new type.

## Out of Scope (Not Implemented)
- Multi-target save_only for AoE effects  
- Full duration auto-expiration (condition removal after turn ends)
- Attack advantage state machine for saves succeeded
- Save prompts when no combat is active but valid target exists

## Pre-existing Test Failures
Full suite: 97 failed / 3208 passed. These are pre-existing (mock issues in useRuntimeState.js). Not caused by these changes.
