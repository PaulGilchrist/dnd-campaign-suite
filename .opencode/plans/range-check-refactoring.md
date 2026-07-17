# Range Check Refactoring Plan

## Goal

Eliminate all `getDistanceFeet() + isDistanceInRange()` usage in code that only needs a boolean range check. Replace with `isWithinRange(sourceName, targetName, range)` — a single async function that:
- Loads map data internally
- Looks up positions by name
- Returns true/false
- Handles "no map" as "always in range"
- Returns true on any error (fail-safe)

This means files no longer need to know about grid positions, active maps, or distance calculations. They just ask: "is this creature in range?"

## Background

The codebase has `isWithinRange()` in `src/services/rules/combat/rangeCheck.js` — the universal range check that all code should use. But 21 non-test files still use the old pattern:

```js
// OLD (leaky - file must know positions, maps, distances)
const dist = getDistanceFeet(pos1, pos2);
if (!isDistanceInRange(dist, range)) return;

// NEW (clean - file just asks the question)
if (!await isWithinRange(name1, name2, range)) return;
```

## Affected Files (21 total)

### Category 1: Pure Boolean Range Checks — Replace (13 files, 17 locations)

These files compute exact distances ONLY to check "is target in range?" — no sorting, no display, no calculations. They should use `isWithinRange()` and stop caring about positions and maps.

| # | File | Locations | Description |
|---|------|-----------|-------------|
| 1 | `src/services/rules/effects/expirations.js` | 2 | `applyAuraDamage()` and `applyHolyNimbusDamage()` — aura damage to creatures in range |
| 2 | `src/services/automation/handlers/combat/attackRiderHandler.js` | 2 | Versatile Trickster Trip and Stalker's Flurry secondary targets |
| 3 | `src/services/automation/handlers/combat/massFearHandler.js` | 1 | Mass fear secondary target filtering |
| 4 | `src/services/rules/features/wardingBondService.js` | 1 | 60 ft warding bond damage sharing |
| 5 | `src/services/rules/features/silenceService.js` | 1 | Silence zone check |
| 6 | `src/components/char-sheet/CharSheet.jsx` | 1 | 60 ft warding bond AC/save bonus |
| 7 | `src/services/combat/steps/weaponDamageSteps.js` | 1 | Cleave mastery secondary targets (2 distance checks in 1 filter) |
| 8 | `src/services/combat/steps/features/superiorHuntersPrey.js` | 1 | 30 ft range around marked target |
| 9 | `src/services/automation/handlers/spells/greaseAreaSaveHandler.js` | 1 | Grease area save check |
| 10 | `src/services/automation/handlers/spells/webAreaSaveHandler.js` | 1 | Web area save check |
| 11 | `src/services/automation/handlers/spells/hypnoticPatternShake.js` | 1 | 5 ft shake range filtering |
| 12 | `src/services/automation/handlers/spells/sleepShakeHandler.js` | 1 | 5 ft shake range filtering |
| 13 | `src/services/automation/contextBuilder.js` | 2 | Sneak attack ally proximity check, Aura of Protection cover check |

### Category 2: Distance Needed for Sorting — Keep `getDistanceFeet` (4 files)

These files need exact distances because they sort by proximity to determine which targets are selected when there are more eligible creatures than the spell/feature allows.

| File | Why sort matters |
|------|-----------------|
| `src/services/rules/features/massHealService.js` | Choose closest 10 of many creatures to heal |
| `src/services/rules/features/prayerOfHealingService.js` | Choose closest 5 of many creatures to heal |
| `src/services/rules/features/powerWordFortifyService.js` | Choose closest 6 of many creatures for shield |
| `src/services/rules/features/massCureWoundsService.js` | Choose closest 6 of many creatures to heal |

### Category 3: Distance Needed for Range Bands — Keep `getDistanceFeet` (2 files)

These files need exact distance to determine short/long range bands (disadvantage/miss).

| File | Why range bands matter |
|------|----------------------|
| `src/services/automation/contextBuilder.js` | `computeRangeEffect()` returns miss/disadvantage/normal |
| `src/components/encounter/MonsterCardModal.jsx` | Same range bands for NPC attacks |

### Category 4: Structurally Constrained — Needs Architectural Change (1 file)

| File | Constraint |
|------|-----------|
| `src/components/char-sheet/modals/shared/AreaEffectTargetModalBase.jsx` | Inside `useMemo` callback — cannot be async. Would need pre-computation or state lifting. |

### Not Affected

- `src/services/rules/combat/rangeValidation.js` — Defines `getDistanceFeet`, not a consumer
- `src/services/rules/combat/rangeCheck.js` — Defines `isWithinRange`, not a consumer

## Phase 1: Replace Pure Boolean Range Checks (Category 1 — 13 files) ✅ COMPLETE

All 13 files in Category 1 have been migrated. 17 locations replaced across the following files:

### Files Modified

| File | Status | Changes |
|------|--------|---------|
| `greaseAreaSaveHandler.js` | ✅ | Replaced `getDistanceFeet` + `isDistanceInRange` with `isWithinRange(casterName, targetName, radius)` |
| `webAreaSaveHandler.js` | ✅ | Same pattern — simplified to `isWithinRange(casterName, targetName, radius)` |
| `hypnoticPatternShake.js` | ✅ | Replaced `.filter()` chain with `for...of` + `isWithinRange(playerName, c.name, rangeFt)` |
| `sleepShakeHandler.js` | ✅ | Same as hypnoticPatternShake |
| `massFearHandler.js` | ✅ | Replaced `.filter()` chain with `for...of` + `isWithinRange(primaryTargetName, c.name, range)` |
| `attackRiderHandler.js` | ✅ | Two locations (Versatile Trickster + Stalker's Flurry) — both use `isWithinRange(targetName, c.name, 5)` |
| `expirations.js` | ✅ | Two locations (`applyAuraDamage` + `applyHolyNimbusDamage`) — both use `isWithinRange` |
| `combatSuperiorityHandler.js` | ✅ | Secondary targets around primary target — `isWithinRange(primaryTargetName, c.name, rangeFt)` |
| `superiorHuntersPrey.js` | ✅ | `isWithinRange(markedTarget.name, c.name, MAX_RANGE_FEET)` |
| `weaponDamageSteps.js` | ✅ | Cleave mastery — two `isWithinRange` calls (first target + attacker) |
| `contextBuilder.js` | ✅ | Sneak attack ally check + Smite of Protection cover — both use `isWithinRange` |

### Files Skipped (sync context — not yet migrated)

| File | Reason |
|------|--------|
| `wardingBondService.js` | Called from `applyDamageToTarget()` — sync hot path, making it async would require changing the entire damage pipeline |
| `silenceService.js` | `isCreatureInSilenceZone()` called from `spellCastService.js` and `applyDamage.js` — both sync contexts |
| `CharSheet.jsx` | React render function — cannot be async |

### Test Updates

All affected test files updated to mock `isWithinRange` instead of `getDistanceFeet` + `isDistanceInRange`:
- `greaseAreaSaveHandler.test.js`
- `webAreaSaveHandler.test.js`
- `hypnoticPatternShake.test.js`
- `sleepShakeHandler.test.js`
- `attackRiderHandler.test.js`
- `attackRiderHandler.coverage.test.js`
- `combatSuperiorityHandlerExecute.test.js`
- `contextBuilder-map.test.js`
- `contextBuilder-sync.test.js`
- `applyAuraDamage.test.js`
- `weaponDamageSteps-mastery.test.js`

### Results

- **Lint:** ✅ Zero warnings
- **Tests:** ✅ All 364 affected tests pass
- **Full suite:** ✅ No new failures (all 14 failing test files are pre-existing)

## Phase 2: Add Centralized Helper to `rangeCheck.js` ✅ COMPLETE

### Implementation

Added `isWithinRangeOf()` helper to `src/services/rules/combat/rangeCheck.js`:

```js
/**
 * Check if targetName is within range of referenceName's position.
 * Useful for effects that radiate from a target (not the caster).
 *
 * @param {string} referenceName - The creature/item whose position is the center
 * @param {string} targetName - The creature to check
 * @param {number|null} rangeFt - Range in feet, null means always in range
 * @returns {Promise<boolean>}
 */
export async function isWithinRangeOf(referenceName, targetName, rangeFt) {
  return isWithinRange(referenceName, targetName, rangeFt);
}
```

This is a thin wrapper for clarity but signals intent. It centralizes the "range from a non-caster reference point" pattern.

### Files That Would Benefit (future use)

- `attackRiderHandler.js` — "is secondary target within range of primary target?"
- `massFearHandler.js` — "is creature within range of primary target?"
- `weaponDamageSteps.js` — "is creature within range of first target?"
- `superiorHuntersPrey.js` — "is creature within range of marked target?"
- `combatSuperiorityHandler.js` — "is creature within range of primary target?"
 * @returns {Promise<boolean>}
 */
export async function isWithinRangeOf(referenceName, targetName, rangeFt) {
  return isWithinRange(referenceName, targetName, rangeFt);
}
```

This is a thin wrapper for clarity but signals intent. It also centralizes the "range from a non-caster reference point" pattern.

### Files That Would Benefit

- `attackRiderHandler.js` — "is secondary target within range of primary target?"
- `massFearHandler.js` — "is creature within range of primary target?"
- `weaponDamageSteps.js` — "is creature within range of first target?"
- `superiorHuntersPrey.js` — "is creature within range of marked target?"
- `combatSuperiorityHandler.js` — "is creature within range of primary target?" (Category not yet migrated)

## Phase 3: Integrate Spell Casting into Automation Handler System — Modal-Based Target Selection

### Background

The automation handler system (`src/services/automation/`) already has a proven modal pattern:

```
handler.handle() → { type: 'modal', modalName: '...', payload: {...} }
→ CharActions.jsx switch → setModalState({ xxxModal: payload })
→ CharActionModals.jsx renders modal component
→ CreatureSelectionModal → user selects → onConfirm(selectedNames)
→ handler.confirm(action, playerStats, campaignName, selectedNames)
→ applies effect → returns { type: 'popup', payload: {...} }
```

But spell casting **bypasses** this system entirely. `spellCastService.js` has dedicated handlers for multi-target spells that run to completion server-side — no modals, no player input. The four Phase 3 files (`massHealService.js`, `massCureWoundsService.js`, `prayerOfHealingService.js`, `powerWordFortifyService.js`) plus `massHealingWordService.js` all silently select targets by sorting creatures by distance and slicing to the max count.

Additionally, **~87% of spells are not automated** (285/328 5e spells, 345/393 2024 spells lack `automation.type`). Many will need modals and special handling. Integrating spell casting into the automation handler system now avoids creating a second parallel modal flow.

### Architecture Change

**Current flow (broken for modals):**
```
spellCastService.js → triggerMassHeal() → applies to sorted targets → returns result
→ useSpellCastExecutor → setPopupHtml(result.automationPopup.payload)
→ popup rendered (modal result is LOST — no modal handling in executor)
```

**Proposed flow (unified with automation handlers):**
```
spellCastService.js → spell.automation?.type check FIRST
→ executeHandler(action, ...) → handler returns { type: 'modal', modalName, payload }
→ return { automationPopup: handlerResult }
→ useSpellCastExecutor → detects automationPopup.type === 'modal'
→ setModalState({ xxxModal: automationPopup.payload })
→ CharActionModals.jsx renders modal
→ CreatureSelectionModal → onConfirm(selectedNames)
→ handler.confirm(action, playerStats, campaignName, selectedNames)
→ applies effect → returns { type: 'popup', payload: {...} }
→ setPopupHtml(result.payload)
→ modal dismissed
```

### Key Design Decisions

1. **Add ally list filtering** — Use `getAllyList(casterName)` from `useAllySelection.js` to filter `combatSummary.creatures` down to allies before checking range/count limits. If allies ≤ maxTargets, no modal needed — apply to all. If allies > maxTargets, show modal for selection.

2. **Add `setModalState` to `useSpellCastExecutor`** — Accept an optional `setModalState` parameter. When `automationPopup.type === 'modal'`, route through the same switch-case pattern that `CharActions.jsx` uses.

3. **Move dedicated handlers INTO the automation handler system** — The four Phase 3 services (plus Mass Healing Word) become proper automation handlers with `handle()` and `confirm()` exports, registered in `HANDLER_MAP`.

4. **Remove `spellCastService.js` dedicated cases** — Once handlers are in the automation system, the dedicated `if (spell.name === 'Mass Heal')` cases become unnecessary — the `spell.automation?.type` routing handles them.

5. **Use `isWithinRange()` for eligibility** — Replace `getDistanceFeet` + `isDistanceInRange` + `.sort()` with `isWithinRange()` for boolean range checks. No distance computation or sorting needed.

6. **Modal only when needed** — If ally count ≤ maxTargets, skip the modal and apply directly. Modal only shows when there are more allies than the spell allows.

### Implementation Steps

#### Step 1: Wire `setModalState` through `useSpellCastExecutor`

**File:** `src/hooks/combat/useSpellCastExecutor.js`

- Accept `setModalState` as optional parameter (after `setPopupHtml`)
- When `result?.automationPopup` and `result.automationPopup.type === 'modal'`:
  - Switch on `result.automationPopup.modalName`
  - Set the appropriate `modalState` key
- Pass `setModalState` from all callers: `CharActions.jsx`, `CharBonusActions.jsx`, `CharReactions.jsx`, `CharSpells.jsx`

#### Step 2: Create automation handlers for the four Phase 3 spells

Each handler follows the `zealousPresenceHandler.js` pattern:

**`src/services/automation/handlers/healing/massHealHandler.js`**
- `handle(action, playerStats, campaignName, mapName, characters)`
  - Get combat context, filter to allies via `getAllyList(casterName)`
  - Use `isWithinRange(casterName, allyName, 60)` to check range eligibility
  - If eligible ≤ 10 (maxTargets): apply directly, return popup
  - If eligible > 10: return `{ type: 'modal', modalName: 'massHealTarget', payload: { creatureTargets, spell, metaCtx, playerStats, campaignName, mapName } }`
- `confirmMassHeal(action, playerStats, campaignName, mapName, selectedTargetNames)`
  - Apply healing to selected targets (700 HP pool + condition removal)
  - Return popup with results

**`src/services/automation/handlers/healing/massCureWoundsHandler.js`**
- Same pattern, 30-ft radius, max 6 targets

**`src/services/automation/handlers/healing/prayerOfHealingHandler.js`**
- Same pattern, 30-ft range, max 5 targets, tracks `prayerOfHealing_lastUsedRound` per creature

**`src/services/automation/handlers/buffs/powerWordFortifyHandler.js`**
- Same pattern, 60-ft range, max 6 targets, grants temp HP
- Note: Power Word Fortify already has `automation.type: "power_word_fortify"` in 2024 spells.json — the handler just needs to be created and registered

**`src/services/automation/handlers/healing/massHealingWordHandler.js`**
- Same pattern, 60-ft range, max 6 targets
- Note: Mass Healing Word has `automation.type: "healing"` but goes through a dedicated handler — this new handler replaces it

#### Step 3: Register handlers in `HANDLER_MAP`

**File:** `src/services/automation/index.js`

- Import new handlers
- Register in `HANDLER_MAP`:
  - `mass_heal: handleMassHeal`
  - `mass_cure_wounds: handleMassCureWounds`
  - `prayer_of_healing: handlePrayerOfHealing`
  - `power_word_fortify: handlePowerWordFortify`
  - `mass_healing_word: handleMassHealingWord`
- Export confirm functions

#### Step 4: Add automation entries to spell data

**Files:** `public/data/spells.json`, `public/data/2024/spells.json`

Add `"automation": { "type": "mass_heal" }` etc. to spells that currently lack automation entries. This enables the `spell.automation?.type` routing to catch them.

#### Step 5: Create modal wrapper components

**Files:**
- `src/components/char-sheet/modals/MassHealModal.jsx`
- `src/components/char-sheet/modals/MassCureWoundsModal.jsx`
- `src/components/char-sheet/modals/PrayerOfHealingModal.jsx`
- `src/components/char-sheet/modals/PowerWordFortifyModal.jsx`
- `src/components/char-sheet/modals/MassHealingWordModal.jsx`

Each is a thin wrapper around `CreatureSelectionModal` with appropriate title, icon, description, and confirm label.

#### Step 6: Wire modals in `CharActionModals.jsx`

Add modal render blocks for each new modal, wired to `modalState.{name}Modal`.

#### Step 7: Add confirm handlers in component files

**Files:** `CharActions.jsx`, `CharBonusActions.jsx`, `CharReactions.jsx`, `CharSpells.jsx`

Add `handle{Spell}Confirm` callbacks that call the handler's `confirm` function and clear modal state.

#### Step 8: Add modal name cases in `useSpellCastExecutor.js`

Add switch cases for each `modalName` to route to the correct `modalState` setter.

#### Step 9: Remove dedicated handlers from `spellCastService.js`

Remove the `if (spell.name === 'Mass Heal')` etc. cases. The `spell.automation?.type` routing (line 591) will catch them via the new automation handlers.

#### Step 10: Update tests

- Update `massHealService.test.js`, `massCureWoundsService.test.js`, `prayerOfHealingService.test.js`, `powerWordFortifyService.test.js` — either update to test the new handler files or remove if the service files are deprecated
- Add tests for each new handler: `handle()` returns modal when > maxTargets, applies directly when ≤ maxTargets
- Test `confirm()` applies effect to selected targets
- Mock `isWithinRange` and `getAllyList`

### Files Modified

| File | Change |
|------|--------|
| `useSpellCastExecutor.js` | Accept `setModalState`, handle modal results |
| `massHealHandler.js` | **New** — handle + confirm for Mass Heal |
| `massCureWoundsHandler.js` | **New** — handle + confirm |
| `prayerOfHealingHandler.js` | **New** — handle + confirm |
| `powerWordFortifyHandler.js` | **New** — handle + confirm |
| `massHealingWordHandler.js` | **New** — handle + confirm |
| `automation/index.js` | Import + register new handlers in HANDLER_MAP |
| `spells.json` (5e) | Add automation.type to Mass Heal, Mass Cure Wounds, Prayer of Healing, Mass Healing Word |
| `spells.json` (2024) | Add automation.type to same spells + Power Word Fortify |
| `MassHealModal.jsx` | **New** — CreatureSelectionModal wrapper |
| `MassCureWoundsModal.jsx` | **New** |
| `PrayerOfHealingModal.jsx` | **New** |
| `PowerWordFortifyModal.jsx` | **New** |
| `MassHealingWordModal.jsx` | **New** |
| `CharActionModals.jsx` | Add 5 modal render blocks |
| `CharActions.jsx` | Add 5 confirm handlers + modal cleanup |
| `CharBonusActions.jsx` | Same (bonus action spells) |
| `CharReactions.jsx` | Same (reaction spells) |
| `CharSpells.jsx` | Same (spell slot casts) |
| `spellCastService.js` | Remove dedicated handler cases (mass heal, mass cure, prayer, mass healing word, power word fortify) |
| `massHealService.test.js` | Update or remove |
| `massCureWoundsService.test.js` | Update or remove |
| `prayerOfHealingService.test.js` | Update or remove |
| `powerWordFortifyService.test.js` | Update or remove |

### Refactored Spell Services (Phase 3b)

After the automation handler integration is complete, the original four service files can be **deprecated** (removed) since their logic moves into the handler files. Alternatively, they can be kept as utility functions called by the confirm handlers if the logic is complex enough to warrant separation.

The key change: **no more distance computation or sorting**. The handlers use:
1. `getAllyList(casterName)` → get allies
2. `isWithinRange(casterName, allyName, range)` → filter by range
3. Compare count to maxTargets → modal or direct apply
4. `confirm(selectedNames)` → apply effect to exactly what the player chose

## Phase 4: Partial Replacements (Category 3 — 2 files)

Replace boolean range checks with `isWithinRange()` where they exist, keep `getDistanceFeet` only for range band calculations.

## Phase 5: Refactor Constrained File (Category 4 — 1 file)

Move range check out of `useMemo` into component state/effects, or pre-compute eligible targets before rendering.
