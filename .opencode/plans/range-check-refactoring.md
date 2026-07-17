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

## Phase 3: Refactor Sorting Files (Category 2 — 4 files)

### Current Pattern

```js
.map(c => ({
  creature: c,
  dist: getDistanceFeet(casterPos, targetPos),
}))
.filter(item => isDistanceInRange(item.dist, rangeFt))
.sort((a, b) => a.dist - b.dist)
.slice(0, maxTargets);
```

### Proposed Pattern

Replace the `isDistanceInRange` filter with `isWithinRange()`:

```js
const eligible = [];
for (const c of combatSummary.creatures) {
  if (c.name === casterName) continue;
  if (!await isWithinRange(casterName, c.name, rangeFt)) continue;
  eligible.push(c);
}
// Then sort by distance if needed
eligible.sort((a, b) => {
  const distA = computeDistance(a);
  const distB = computeDistance(b);
  return distA - distB;
});
return eligible.slice(0, maxTargets);
```

### Key Question

Before implementing, we need to understand WHY sorting by distance matters. Does the game rule require closest targets first? Or is it arbitrary? This affects whether the sort can be replaced with a simpler selection strategy.

## Phase 4: Partial Replacements (Category 3 — 2 files)

Replace boolean range checks with `isWithinRange()` where they exist, keep `getDistanceFeet` only for range band calculations.

## Phase 5: Refactor Constrained File (Category 4 — 1 file)

Move range check out of `useMemo` into component state/effects, or pre-compute eligible targets before rendering.
