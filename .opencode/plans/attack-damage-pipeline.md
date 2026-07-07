# Attack → Damage Pipeline

## Problem

The attack→damage transition has two duplicating code paths with the same modal pattern:

- **`autoDamageRoll`** (`CharActions.jsx`, `CharSpells.jsx`, `CharSpecialActions.jsx`) — handles spells/automation, called after `SHOW_DICE_ROLL_DELAY` or via `dice-roll-done` event
- **`resolveAttackDamage`** (`useAttackDamageResolution.js`) — handles weapon attacks, called from damage button

Both accumulate bonus damage, show modals (Cunning Strike, damage type choice, etc.), and call `rollDamage()`. Adding a new feature means adding it to both files.

## What's Already Done (previous session)

- BI Defense button condition: `isDamageType` → `hit` in `DiceRollResult.jsx`
- Added Done button on attack popup
- Removed "Rolling damage..." text
- Removed `SHOW_DICE_ROLL_DELAY` timer from `useLoggedDiceRoll.js`
- Added `dice-roll-done` event + listener to trigger `autoDamageRoll`

## Risk Assessment

The full pipeline refactor is medium risk. `autoDamageRoll` and `resolveAttackDamage` have ~600+ lines combined with 100+ tests. To minimize risk:

1. Keep the existing `pendingDamageRef` + `proceedWithDamage` resume pattern (it already works)
2. Don't change the modal components — only change how they're called
3. Incremental: extract one step at a time, test after each

## Plan

### Step 1: Safe cleanup (low risk, do first)

**Remove `setPopupHtml(null)` from Done handler** in `CharSheet.jsx:800`

The Done button currently dispatches `dice-roll-done` AND clears the popup. Clear is unnecessary — `rollDamage()` replaces the attack popup with the damage popup naturally. Keeping the attack popup visible also means any intervening modals (Cunning Strike, damage type choice, etc.) overlay it correctly.

Files: `CharSheet.jsx`

### Step 2: Create `damagePipeline.js` service

**New file: `src/services/combat/damagePipeline.js`**

Exports:
- `buildPipeline(playerStats, campaignName, helpers)` — builds the ordered step array
- `runPipeline(pipeline, state, resumeRef)` — runs steps, pauses for modals
- `resumePipeline(pipeline, state, resumeRef, fromStepIndex)` — resumes after modal

Pipeline steps (same order as today, same logic moved from existing files):

```
 1. housekeeping          — Sudden Strike clear, Horde Breaker, Overchannel state
 2. attackRiderManeuvers  — Battle Master: prompt on hit/miss     → modal (existing)
 3. cunningStrike         — Rogue: deduct sneak dice              → modal (existing)
 4. rollBaseDamage        — Roll attack.damage (doubled on crit)  → no modal
 5. buildContext          — Get sneak dice, save DC, etc.         → no modal
 6. sneakAttack           — Apply Sneak Attack formula            → no modal
 7. twoWeaponFighting     — TWF feat bonus                       → no modal
 8. targetEffects         — Rider damage from target effects      → no modal
 9. automationBonuses     — Barb rage, Divine Fury, Frenzy        → modal for type choice
10. weaponHitBonuses      — Divine Strike, Primal Strike          → modal for type choice
11. natural20Bonuses      — Overwhelming Strike, etc.             → no modal
12. celestialRevelation   — Aasimar extra damage                  → no modal
13. featureRiders         — attack_rider automations              → no modal
14. saveAttackDamage      — Spells: halved on save success        → no modal
15. overchannel           — Wizard Overchannel                    → no modal
16. damageTypeModifiers   — Empowered Strikes, Enhanced Unarmed   → modal for choice
17. weaponMasteries       — Cleave, Topple, Tactical Master       → modal for targets/saves
18. proceedToDamage       — Call proceedWithDamage()              → final step
```

### Step 3: Refactor `resolveAttackDamage` to use pipeline

**Modify: `useAttackDamageResolution.js`**

Replace the inline `resolveAttackDamage` function with a call to `runPipeline()`:

```js
const resolveAttackDamage = async (attack) => {
  const state = {
    attack,
    hit: popupHtml?.hit || popupHtml?.isCrit,
    isCrit: popupHtml?.isCrit,
    isNatural20: popupHtml?.isNatural20,
    targetName: popupHtml?.targetName,
    isBonusActionAttack: attack.type === 'Bonus Action',
    // Populated by pipeline steps:
    formula: null, total: 0, rolls: [], modifier: 0,
    playerStats, campaignName, mapName,
    sneakDice: 0, // set in buildContext
  };
  const pipeline = buildPipeline(playerStats, campaignName, pipelineHelpers);
  await runPipeline(pipeline, state, pendingDamageRef, pipelineHelpers);
};
```

### Step 4: Refactor `autoDamageRoll` to use pipeline

**Modify: `CharActions.jsx`, `CharSpells.jsx`, `CharSpecialActions.jsx`**

Each `autoDamageRoll` normalizes `autoDamage` to an `attack`-like object and calls the same pipeline:

```js
const autoDamageRoll = async (autoDamage, isCrit) => {
  const attack = normalizeAutoDamage(autoDamage);
  const state = {
    attack,
    hit: true,
    isCrit,
    isNatural20: false,
    targetName: autoDamage.targetName,
    isBonusActionAttack: false,
    // ... same as above
    autoDamageSource: 'char-actions',
    overchannelActive: autoDamage.overchannelActive,
    // ... other autoDamage-specific fields
  };
  const pipeline = buildPipeline(playerStats, campaignName, pipelineHelpers);
  await runPipeline(pipeline, state, pendingDamageRef, pipelineHelpers);
};
```

Since both paths now call `buildPipeline()` with the same pipeline, all features work identically for weapons and spells.

### Step 5: SSE logging

**No new SSE infrastructure needed.** Each pipeline step already:
- Logs meaningful events via `addEntry()` (broadcast via SSE campaign log)
- Updates runtime state via `setRuntimeValue()` (broadcast via SSE `changeData`)
- Uses `pendingDamageRef` for pause/resume (local ref, not SSE)

For steps that need remote player interaction (like BI Defense), the step can:
1. Set a runtime state flag (e.g., `{targetName}: { biPrompt: { ... } }`) — SSE broadcast
2. Other clients detect the flag via their `Subscriber`
3. Remote user responds → runtime state update → SSE broadcast back
4. Step detects response and continues

This uses the EXISTING SSE infrastructure (`setRuntimeValue` + `Subscriber`) — no new SSE events needed.

## Step interface

```js
// Each pipeline step:
{
  name: 'cunningStrike',       // unique name for pause/resume
  condition: (state) => boolean, // true = run this step
  run: async (state, context) => {
    // context: { setModal, addEntry, getRuntime, setRuntime, ... }
    if (state.shouldPause) {
      await context.setModal('attackRiderModal', { action, playerStats });
      return null; // pauses pipeline
    }
    return { ...state, formula, total, rolls, modifier }; // modified state
  }
}
```

## Resume pattern (unchanged)

When a modal appears, the pipeline pauses. The modal handler reads `pendingDamageRef.current` (stored by the step) and calls `proceedWithDamage()` or `resumePipeline()`. This is exactly how the existing code works — no change needed.

## Files changed

| File | Change |
|------|--------|
| `src/services/combat/damagePipeline.js` | **New** — pipeline definition + runner |
| `CharSheet.jsx` | Remove `setPopupHtml(null)` from Done handler |
| `useAttackDamageResolution.js` | Replace `resolveAttackDamage` body with pipeline call |
| `CharActions.jsx` | `autoDamageRoll` calls pipeline instead of inline logic |
| `CharSpells.jsx` | Same |
| `CharSpecialActions.jsx` | Same |
| `useModalHandlers.js` | Possibly simplify — modals call `resumePipeline` instead of `proceedWithDamage` |
| `useCharActionModals.js` | Pass pipeline helpers down |

## Test strategy

1. **No test changes in Step 1** (one-line removal of `setPopupHtml(null)`)
2. **Step 2-4: existing tests still pass** — the pipeline runs the same logic, just organized differently
3. **Add pipeline tests** in `src/services/combat/damagePipeline.test.js`:
   - Step ordering
   - Condition skipping
   - Modal pause + resume cycle
   - SSE logging at each step
4. **Gradual migration** — can move one step at a time from existing files to pipeline, testing after each

## What this enables

- New automation: add one step object to `damagePipeline.js`
- Works for both weapons AND spells
- Steps can broadcast SSE, log, set runtime state
- Steps can pause for local modals or remote player input
- Future: replace `dice-roll-done` custom event with direct pipeline call through DiceRollContext
