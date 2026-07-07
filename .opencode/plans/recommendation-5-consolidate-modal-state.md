# Recommendation #5: Consolidate Modal State

## Problem

`useCharActionModals.js` manages **60+ individual `useSyncedState` variables** (each with its own getter/setter pair), all of which are threaded through 4+ files (`CharActions.jsx`, `CharActionModals.jsx`, `useModalHandlers.js`, `useAttackDamageResolution.js`). This creates:

1. **API explosion** — `useCharActionModals` returns 130+ named exports (60 state + 60 setters + 15 handlers)
2. **Prop drilling** — `CharActions.jsx` passes 120+ props to `CharActionModals`
3. **No type safety** — each modal type is a separate destructured prop, easy to lose track
4. **Hard to audit** — can't easily see all modals in one place, hard to add new ones consistently
5. **SSE key sprawl** — 60+ unique `modal-*` keys in the runtime store

## Target Architecture

```
useCharActionModals.js:
  const [modalState, setModalState] = useSyncedState(campaignName, 'modalState', {});
  // setModalState merges updates: setModalState({ attackRiderModal: {...} })
  // setModalState({ attackRiderModal: null })  // close modal
  return { modalState, setModalState, pendingDamage, ...handlers };

CharActions.jsx:
  const { modalState, setModalState, ...other } = useCharActionModals(...);
  // Access: modalState.attackRiderModal
  // Set: setModalState({ attackRiderModal: { ... } })

CharActionModals.jsx:
  // Receives modalState and setModalState as props
  {modalState.attackRiderModal && <AttackRiderModal ... onClose={() => setModalState({ attackRiderModal: null })} />}
```

## Design Decisions

### 1. Unified modalState object in runtime store

Single `useSyncedState` call with key `modalState`:

```js
const [modalState, setModalState] = useSyncedState(campaignName, 'modalState', {});
```

The `modalState` object is a dictionary keyed by modal name:
```js
{
  attackRiderModal: { action, playerStats, campaignName, targetName },
  healingPoolModal: { name, pool, isDicePool, ... },
  damageTypeChoice: { title, types },
}
```

### 2. `setModalState` — merge helper

Wrap `useSyncedState`'s setter to merge instead of replace:

```js
const [modalState, _setModalState] = useSyncedState(campaignName, 'modalState', {});
const setModalState = React.useCallback((updates) => {
  _setModalState(prev => ({ ...prev, ...updates }));
}, [campaignName, _setModalState]);
```

### 3. No bridge, no backward compatibility

Direct migration. All callers updated at once. Clean final state.

### 4. What stays separate

- `pendingDamage` (pipeline-pause) — NOT part of modalState
- `buildCtx`, `buildCtxSync` — NOT part of modalState
- Handler functions — returned as-is, receive `setModalState` instead of individual setters
- `combatSuperiorityModal` from `useCombatSuperiorityModal` — NOT part of modalState

## Implementation Steps

### Step 1: `useCharActionModals.js` — replace 60+ `useSyncedState` with one

```js
// OLD (69 lines):
const [healingPoolModal, setHealingPoolModal] = useSyncedState(campaignName, 'modal-healingPool', null);
const [handOfHealingModal, setHandOfHealingModal] = useSyncedState(campaignName, 'modal-handOfHealing', null);
// ... 67 more ...

// NEW (3 lines):
const [modalState, _setModalState] = useSyncedState(campaignName, 'modalState', {});
const setModalState = React.useCallback((updates) => {
  _setModalState(prev => ({ ...prev, ...updates }));
}, [campaignName, _setModalState]);
```

Update `useModalHandlers` call to pass `setModalState` and `modalState` instead of individual setters:

```js
// OLD:
const { handleMasteryClose, ... } = useModalHandlers({
    setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal, ...
});

// NEW:
const { handleMasteryClose, ... } = useModalHandlers({
    setModalState, modalState,
});
```

Update `useAttackDamageResolution` call similarly:

```js
// OLD:
const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution({
    setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal, setAttackRiderModal,
    setAttackRiderManeuverPrompt, setSweepingAttackTargetModal, setSecondaryTargetModal,
});

// NEW:
const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution({
    setModalState, modalState,
});
```

Return only the unified API:

```js
return {
    modalState,
    setModalState,
    pendingDamage,
    setPendingDamage,
    buildCtx,
    buildCtxSync,
    // Combat superiority (from useCombatSuperiorityModal)
    combatSuperiorityModal, setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    handleCombatSuperiorityReopenSelection,
    // Handlers (from useModalHandlers)
    handleMasteryClose,
    handleWeaponMasteryChoice,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleConstellationSelect,
    handleElderChampionRestore,
};
```

### Step 2: `useModalHandlers.js` — individual setters → `setModalState`

```js
// OLD:
const handleMasteryClose = async () => {
    setWeaponMasteryModal(null);
    if (pendingDamage) { ... }
};

const handleDivineFuryDamageType = (chosenType) => {
    setDivineFuryChoice(null);
    setPendingDamage(null);
    proceedWithDamage(...);
};

// NEW:
const handleMasteryClose = async () => {
    setModalState({ weaponMasteryModal: null });
    if (pendingDamage) { ... }
};

const handleDivineFuryDamageType = (chosenType) => {
    setModalState({ divineFuryChoice: null });
    setPendingDamage(null);
    proceedWithDamage(...);
};
```

All 16 handler functions updated similarly. Individual setter props replaced with `setModalState` and `modalState`.

### Step 3: `useAttackDamageResolution.js` — individual setters → `setModalState`

```js
// OLD:
setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal: _, setAttackRiderModal,
setAttackRiderManeuverPrompt, setSweepingAttackTargetModal, setSecondaryTargetModal,

// NEW:
setModalState, modalState,
```

All internal calls updated:
```js
// OLD: setDamageTypeChoice(null)
// NEW: setModalState({ damageTypeChoice: null })

// OLD: setAttackRiderModal({ ... })
// NEW: setModalState({ attackRiderModal: { ... } })
```

### Step 4: `CharActions.jsx` — update destructuring

```js
// OLD:
const {
    healingPoolModal, setHealingPoolModal,
    handOfHealingModal, setHandOfHealingModal,
    attackRiderModal, setAttackRiderModal,
    // ... 120+ props ...
} = useCharActionModals({ ... });

// NEW:
const {
    modalState,
    setModalState,
    pendingDamage,
    buildCtx,
    buildCtxSync,
    // Combat superiority
    combatSuperiorityModal, setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    // Handlers
    handleMasteryClose,
    handleWeaponMasteryChoice,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleConstellationSelect,
    handleElderChampionRestore,
    resolveAttackDamage,
} = useCharActionModals({ ... });
```

All direct setter calls updated:
```js
// OLD: setAttackRiderModal({ action, playerStats, campaignName, targetName })
// NEW: setModalState({ attackRiderModal: { action, playerStats, campaignName, targetName } })

// OLD: setTacticalMasterModal({ ... })
// NEW: setModalState({ tacticalMasterModal: { ... } })

// OLD: setSecondaryTargetModal({ ... })
// NEW: setModalState({ secondaryTargetModal: { ... } })

// OLD: setSweepingAttackTargetModal(event.detail)
// NEW: setModalState({ sweepingAttackTargetModal: event.detail })
```

All render expressions updated:
```js
// OLD:
{healingPoolModal && <HealingPoolModal ... onClose={() => setHealingPoolModal(null)} />}
{attackRiderModal && <AttackRiderModal ... onClose={() => setAttackRiderModal(null)} />}

// NEW:
{modalState.healingPoolModal && <HealingPoolModal ... onClose={() => setModalState({ healingPoolModal: null })} />}
{modalState.attackRiderModal && <AttackRiderModal ... onClose={() => setModalState({ attackRiderModal: null })} />}
```

### Step 5: `CharActionModals.jsx` — update destructuring and renders

```js
// OLD (function signature):
export default function CharActionModals({
    healingPoolModal, setHealingPoolModal,
    handOfHealingModal, setHandOfHealingModal,
    attackRiderModal, setAttackRiderModal,
    // ... 120+ props ...
}) {

// NEW:
export default function CharActionModals({
    modalState,
    setModalState,
    // Combat superiority
    combatSuperiorityModal, setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    handleAttackRiderManeuverUse,
    handleAttackRiderManeuverSkip,
    // Handlers
    handleMasteryClose,
    handleWeaponMasteryChoice,
    handleWeaponKindMasteryClose,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleConstellationSelect,
    handleElderChampionRestore,
    handleSweepingAttackConfirm,
    handleBaitAndSwitchChoiceConfirm,
    handleCommanderStrikeChoiceConfirm,
    handleRallyChoiceConfirm,
    handleBulwarkOfForceConfirm,
    handleCoronaEnemySelectionConfirm,
    handleRadianceOfDawnConfirm,
    handleMantleOfInspirationConfirm,
    handleTricksterBlessingConfirm,
    handleBardicInspirationConfirm,
    handleInspiringMovementConfirm,
    handleDivineInterventionCast,
    // Non-modal
    pendingDamage,
    buildCtx,
    buildCtxSync,
    autoDamageContext,
    rollDamage,
    setPopupHtml,
    mapName,
    playerStats,
    campaignName,
    characters,
}) {
```

All render expressions updated:
```js
// OLD:
{healingPoolModal && <HealingPoolModal ... onClose={() => setHealingPoolModal(null)} />}
{attackRiderModal && <AttackRiderModal ... onClose={() => setAttackRiderModal(null)} />}

// NEW:
{modalState.healingPoolModal && <HealingPoolModal ... onClose={() => setModalState({ healingPoolModal: null })} />}
{modalState.attackRiderModal && <AttackRiderModal ... onClose={() => setModalState({ attackRiderModal: null })} />}
```

### Step 6: `CharReactions.jsx` — migrate 2 `useState` to `useSyncedState`

```js
// OLD:
const [arcaneWardRestoreModal, setArcaneWardRestoreModal] = React.useState(null);
const [inspiringMovementAllyModal, setInspiringMovementAllyModal] = React.useState(null);

// NEW:
const [modalState, setModalState] = useSyncedState(campaignName, 'modalState', {});
// Access: modalState.arcaneWardRestoreModal
// Set: setModalState({ arcaneWardRestoreModal: value })
```

### Step 7: `CharClassFeatures.jsx` — migrate 1 `useState` to `useSyncedState`

```js
// OLD:
const [weaponKindMasteryModal, setWeaponKindMasteryModal] = React.useState(null);

// NEW:
const [modalState, setModalState] = useSyncedState(campaignName, 'modalState', {});
// Access: modalState.weaponKindMasteryModal
// Set: setModalState({ weaponKindMasteryModal: value })
```

### Step 8: Update `CharActionModals.jsx` imports

The component no longer imports 20+ modal component files directly. Instead, it receives `modalState` and renders conditionally. The imports stay the same (modal component files are still needed) but the destructuring changes.

### Step 9: Update tests

- **`useCharActionModals.test.js`** — test `modalState` object instead of 60+ individual props
- **`CharActionModals.rendering.test.jsx`** — update destructuring to `modalState`, `setModalState`
- **`CharActionModals.handlers.test.jsx`** — update props passed to component
- **`CharActionModals.inline-modals.test.jsx`** — update destructuring
- **`CharActionModals.inline-choice-modals.test.jsx`** — update destructuring
- **`CharActions.*.test.jsx`** — update destructuring from `useCharActionModals`
- **`useModalHandlers.test.js`** — update props (individual setters → `setModalState`)
- **`useModalHandlers-damage.test.js`** — update props
- **`useModalHandlers-features.test.js`** — update props
- **`useAttackDamageResolution.*.test.js`** — update props (individual setters → `setModalState`)

## Files Changed

| File | Change |
|------|--------|
| `useCharActionModals.js` | 69 `useSyncedState` → 1 `modalState` + `setModalState` |
| `useCharActionModals.test.js` | Test unified `modalState` object |
| `CharActions.jsx` | Destructure `modalState`/`setModalState`, update all 120+ references |
| `CharActionModals.jsx` | Destructure `modalState`/`setModalState`, update all 110+ references |
| `useModalHandlers.js` | Individual setters → `setModalState` (16 handlers) |
| `useAttackDamageResolution.js` | Individual setters → `setModalState` (7 setters) |
| `CharReactions.jsx` | 2 `useState` → `useSyncedState` + `modalState` |
| `CharClassFeatures.jsx` | 1 `useState` → `useSyncedState` + `modalState` |
| `CharActionModals.rendering.test.jsx` | Update destructuring |
| `CharActionModals.handlers.test.jsx` | Update props |
| `CharActionModals.inline-modals.test.jsx` | Update destructuring |
| `CharActionModals.inline-choice-modals.test.jsx` | Update destructuring |
| `CharActions.clickHandlers.test.jsx` | Update destructuring |
| `CharActions.elderChampion.test.jsx` | Update destructuring |
| `CharActions.haste.test.jsx` | Update destructuring |
| `CharActions.monkKi.test.jsx` | Update destructuring |
| `CharActions.rendering.test.jsx` | Update destructuring |
| `CharActions.stateModals.test.jsx` | Update destructuring |
| `useModalHandlers.test.js` | Update props |
| `useModalHandlers-damage.test.js` | Update props |
| `useModalHandlers-features.test.js` | Update props |
| `useAttackDamageResolution.test.js` | Update props |
| `useAttackDamageResolution.advancedAutomations.test.js` | Update props |
| `useAttackDamageResolution.automationDamage.test.js` | Update props |
| `useAttackDamageResolution.classFeatures.test.js` | Update props |
| `useAttackDamageResolution.feats.test.js` | Update props |
| `useAttackDamageResolution.maneuvers.test.js` | Update props |

## Testing Plan

1. **`useCharActionModals.test.js`**:
   - Verify `modalState` exists as a single object with all 60+ modal keys
   - Verify `setModalState({ attackRiderModal: X })` sets the value
   - Verify `setModalState({ attackRiderModal: null })` clears it
   - Verify setting one modal doesn't affect others

2. **Full suite**: `npm run test:run` — all 799 files should pass

3. **Lint**: `npm run lint` — no new warnings

## What Gets Deleted After Migration

From `useCharActionModals.js`:
- Lines 10-78: 69 `useSyncedState` calls for individual modals (~69 lines)
- Lines 124-215: 130+ individual return properties (~90 lines)

From `CharActions.jsx`:
- Lines 697-780: 80+ destructured modal props (~80 lines)
- 120+ direct `setXxxModal` calls → `setModalState({ xxxModal: ... })`

From `CharActionModals.jsx`:
- 120+ destructured modal props in function signature (~120 lines)
- 110+ `setXxxModal(null)` calls in `onClose` handlers

From `useModalHandlers.js`:
- 12 individual setter props in function signature
- 30+ direct `setXxx(null)` calls

From `useAttackDamageResolution.js`:
- 7 individual setter props in function signature
- 15+ direct `setXxx(...)` calls

From `CharReactions.jsx`:
- 2 `useState` declarations → `useSyncedState`

From `CharClassFeatures.jsx`:
- 1 `useState` declaration → `useSyncedState`

**Net reduction**: ~500 lines of repetitive state declarations and prop drilling → ~50 lines of unified API.
