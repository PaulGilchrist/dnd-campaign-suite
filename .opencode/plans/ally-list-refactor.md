# Plan: Refactor Ally List for All Creatures

## Overview
Extend the Paladin ally list system to work for ALL creatures (players and NPCs), with a consistent UI pattern on both CharSummary and MonsterCardModal. Store allies per-character as a runtime value (array of creature names), persisted to server.

## Key Decisions
- **Storage**: Continue using `setRuntimeValue(name, 'selectedAllies', [...])` - this is already persisted to server and re-read on campaign load
- **Default behavior**: If `selectedAllies` is null, self is the only ally
- **Initiative workflow**: Remove the Paladin-only initiative-time popup; replace with badge/button access
- **Per-character model**: Each creature has its own ally list (not team-based)

---

## Phase 1: Create Shared Ally Selection Hook

### New File: `src/hooks/useAllySelection.js`
Create a reusable hook that encapsulates ally selection logic:
- `getAllyList(characterName, campaignName)` - Returns the ally list, defaulting to `[characterName]` if null
- `setAllyList(characterName, allies, campaignName)` - Persists ally list via `setRuntimeValue`
- `showAllyModal(characterName, creatures)` - Triggers the modal with correct defaults
- This hook will be used by both CharSummary and MonsterCardModal

---

## Phase 2: Create Ally Selection Modal Component

### New File: `src/components/common/AllySelectionModal.jsx`
A modal component that:
1. Receives `creatures` (from `combatSummary.creatures`), `currentAllies` (array of names), and `onConfirm`/`onCancel` callbacks
2. Renders a checkbox list of all creatures with:
   - Player characters shown with class/level info
   - NPCs shown with type and HP
   - Self always pre-selected (checked and disabled, or checked with note)
3. Has "Select All" and "Clear All" buttons
4. Shows ally count
5. Confirm/Cancel buttons

### New File: `src/components/common/AllySelectionModal.css`
Scoped styles for the modal.

---

## Phase 3: Update CharSummary Component

### File: `src/components/char-sheet/char-summary/CharSummary.jsx`
Changes:
1. **Remove** the Paladin-only initiative-time AllySelectionModal (lines 586-593) and the `showAllySelectionModal` state
2. **Add** new state for the ally modal: `showAllyModal`, `allyModalCreatures`
3. **Add** "Allies" badge at bottom of second column (after CharFeats section)
   - Badge shows ally count: "Allies (3)" or just "Allies" if self-only
   - Clicking opens the AllySelectionModal
4. **Load** current allies on mount using `getRuntimeValue(playerStats.name, 'selectedAllies')`
5. **Pass** `combatSummary.creatures` to the modal as the creature list
6. **Update** `handleInitiative` to remove the ally selection check - just roll initiative directly

### File: `src/components/char-sheet/char-summary/CharSummary.css`
Add styles for the ally badge.

---

## Phase 4: Update MonsterCardModal Component

### File: `src/components/encounter/MonsterCardModal.jsx`
Changes:
1. **Add** props: `creatures` (already passed from initiative.jsx), `campaignName` (already passed)
2. **Add** state: `showAllyModal`
3. **Add** "Allies" button in the header area (right side)
   - Button shows ally count: "Allies (2)" or just "Allies" if self-only
   - Clicking opens the AllySelectionModal
4. **Load** current allies on mount using `getRuntimeValue(monster.name, 'selectedAllies')`
5. **Save** allies on confirm via `setRuntimeValue(monster.name, 'selectedAllies', [...], campaignName)`

### File: `src/components/encounter/MonsterCardModal.css`
Add styles for the ally button.

---

## Phase 5: Update Ally Consumption Pattern

### Files to Update (make ally lookup consistent):
All automation handlers that currently read `selectedAllies` should use the shared helper:

```js
// Instead of:
const storedAllies = getRuntimeValue(name, 'selectedAllies', campaignName);
const allies = Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : null;

// Use:
import { getAllyList } from '../../hooks/useAllySelection.js';
const allies = getAllyList(name, campaignName);
// Returns [name] if null, or the stored array
```

Files to update (same pattern, different locations):
- `src/services/combat/auras/auraOfProtection.js` (lines 48-51)
- `src/services/combat/auras/auraComboEffects.js` (lines 19-22)
- `src/services/rules/effects/expirations.js` (lines 831-833, 778-790)
- `src/services/combat/auras/elderChampionAuraUtils.js` (lines 11-14)
- `src/components/common/SavePromptModal.jsx` (lines 151-160)
- `src/services/automation/handlers/class-cleric-paladin/inspiringSmiteHandler.js` (line 68)

**Note**: This is a refactoring step - the behavior stays the same, just the lookup pattern becomes consistent.

---

## Phase 6: Update SavePromptModal for NPC Allies

### File: `src/components/common/SavePromptModal.jsx`
Currently reads `selectedAllies` for each Paladin. Should also read for NPCs:
- When checking for Holy Nimbus save advantage, look for ANY creature (player or NPC) with `selectedAllies` defined
- This allows monsters to have allies that benefit from their auras

---

## Phase 7: Remove Dead Code

### File: `src/components/char-sheet/char-summary/CharSummary.jsx`
- Remove `AllySelectionModal` import (line 26)
- Remove `showAllySelectionModal` state (line 42)
- Remove `allyTargets` state (line 43)
- Remove `handleAllySelectionConfirm` function (lines 389-400)
- Remove the Paladin-only check in `handleInitiative` (lines 373-386)
- Remove the AllySelectionModal render (lines 586-593)

### File: `src/components/char-sheet/modals/AllySelectionModal.jsx`
- Delete this file (it's just a thin wrapper around CreatureSelectionModal)

---

## Phase 8: Update Tests

### Files to Update:
- `src/components/char-sheet/char-summary/CharSummary.test.jsx` - Remove/update ally selection tests
- `src/components/encounter/MonsterCardModal.test.jsx` - Add tests for ally button
- Add new test file for `AllySelectionModal` component

### Test Cases:
1. Ally badge renders on CharSummary with correct count
2. Ally button renders on MonsterCardModal with correct count
3. Clicking badge/button opens modal with correct pre-selections
4. Self is always pre-selected
5. Saving allies persists to runtime state
6. Allies are loaded correctly on mount
7. Default behavior when no allies defined (self only)

---

## Implementation Order

1. **Phase 1**: Create `useAllySelection` hook
2. **Phase 2**: Create `AllySelectionModal` component
3. **Phase 3**: Update CharSummary (remove old, add new badge)
4. **Phase 4**: Update MonsterCardModal (add button)
5. **Phase 5**: Refactor automation handlers to use consistent pattern
6. **Phase 6**: Update SavePromptModal for NPC allies
7. **Phase 7**: Remove dead code
8. **Phase 8**: Update tests

---

## Expected Behavior After Changes

### For Players (CharSummary):
1. Player sees "Allies (3)" badge below CharFeats section
2. Clicking opens modal showing all creatures (players + NPCs)
3. Player's name is always checked
4. Player can select/deselect allies
5. Clicking "Save" persists the list to server
6. Badge updates to show new count

### For Monsters (MonsterCardModal):
1. GM sees "Allies" button in modal header (right side)
2. Clicking opens same modal with all creatures
3. Monster's name is always checked
4. GM can select allies for the monster
5. Clicking "Save" persists the list to server
6. Button updates to show count

### Persistence:
- Allies are stored as `selectedAllies` array in runtime state
- Persisted to server via `setRuntimeValue`
- Re-read on campaign load
- Available to all automation handlers

### Default Behavior:
- If `selectedAllies` is null (never set), self is the only ally
- This maintains backward compatibility with existing characters

---

## Files to Create
- `src/hooks/useAllySelection.js`
- `src/components/common/AllySelectionModal.jsx`
- `src/components/common/AllySelectionModal.css`

## Files to Modify
- `src/components/char-sheet/char-summary/CharSummary.jsx`
- `src/components/char-sheet/char-summary/CharSummary.css`
- `src/components/encounter/MonsterCardModal.jsx`
- `src/components/encounter/MonsterCardModal.css`
- `src/services/combat/auras/auraOfProtection.js`
- `src/services/combat/auras/auraComboEffects.js`
- `src/services/rules/effects/expirations.js`
- `src/services/combat/auras/elderChampionAuraUtils.js`
- `src/components/common/SavePromptModal.jsx`
- `src/services/automation/handlers/class-cleric-paladin/inspiringSmiteHandler.js`

## Files to Delete
- `src/components/char-sheet/modals/AllySelectionModal.jsx`

## Files to Update (Tests)
- `src/components/char-sheet/char-summary/CharSummary.test.jsx`
- `src/components/encounter/MonsterCardModal.test.jsx`
