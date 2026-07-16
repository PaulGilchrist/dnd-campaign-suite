# Avenging Angel Integration Plan

## Overview

Avenging Angel (Paladin Oath of Vengeance capstone) needs full integration matching Elder Champion/Holy Nimbus/Living Legend patterns. The handler already exists with flight buff and Frightful Aura logic. Missing: badge display, expiration on initiative/short rest/long rest, spell slot consumption for second use, and "already active" popup.

## Behavior

- **First use:** Normal activation, sets `avengingAngelRestUsed = true`, no spell slot cost
- **Clicked while active:** Shows "Avenging Angel is already active." popup — does NOT toggle off, does NOT consume slot
- **Used earlier but inactive now:** Clicking reactivates by consuming a level 5 spell slot
- **Subsequent reactivations:** Each consumes another level 5 spell slot
- **Expiry:** Cleared on initiative roll (new combat), short rest, and long rest

## Files to Modify

### 1. `src/services/automation/handlers/class-cleric-paladin/avengingAngelHandler.js`

**Add rest-used key:**
```js
const AVENGING_ANGEL_REST_KEY = 'avengingAngelRestUsed';
```

**Change handle() logic (replace lines 24-57):**

Current code toggles off when active. Replace with Elder Champion pattern:

```js
// Check if already active — show popup, do NOT toggle off
const isActive = getRuntimeValue(playerName, AVENGING_ANGEL_KEY, campaignName);
if (isActive) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} is already active.`,
            automation: auto,
        },
    };
}

// Check if already used this rest period — if so, consume level 5 spell slot
const alreadyUsed = getRuntimeValue(playerName, AVENGING_ANGEL_REST_KEY, campaignName);
if (alreadyUsed) {
    const slotKey = 'spell_slots_level_5';
    const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? 0);
    if (currentSlots <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} cannot be used again until a long rest or level 5 spell slot becomes available.`,
                automation: auto,
            },
        };
    }
    await setRuntimeValue(playerName, slotKey, currentSlots - 1, campaignName);
    // ... proceed with activation (same as below, with different log message)
}
```

**Activation block (lines 59-97):** Keep existing activation logic but:
- Add `await setRuntimeValue(playerName, AVENGING_ANGEL_REST_KEY, true, campaignName);` after setting active flag (only on first use, not second use)
- Update log message for second use to mention spell slot expenditure

### 2. `src/components/char-sheet/char-summary/CharClassFeatures.jsx`

**Add badge variable (line ~352):**
```js
const avengingAngelActive = useRuntimeValue(playerStats.name, 'avengingAngelActive', campaignName);
```

**Add badge display (line ~375, after elderChampionActive badge):**
```jsx
{avengingAngelActive && <span className="automation-badge">Avenging Angel</span>}
```

### 3. `src/components/char-sheet/useInitiativeEffects.js`

**Add clearing on initiative roll (line ~47, after elderChampionActive clearing):**
```js
// Clear Avenging Angel active state on initiative roll (new combat)
setRuntimeValue(playerStats.name, 'avengingAngelActive', false, campaignName);
```

### 4. `src/services/rules/effects/restRules.js`

**Short rest clearing (line ~364, after elderChampionActive clearing):**
```js
// Clear Avenging Angel active state on short rest
updates.avengingAngelActive = null;
```

**Long rest clearing (line ~425, after elderChampionActive clearing):**
```js
// Clear Avenging Angel active state on long rest
charData.avengingAngelActive = null;
```

**Add to LONG_REST_RESOURCES (line ~150, after elderChampionRestUsed):**
```js
'avengingAngelRestUsed'
```

### 5. `src/services/character/featureCategories.js`

**Uncomment Avenging Angel from 5e actions array (line ~27):**
```js
"Avenging Angel",
```

### 6. `src/services/automation/handlers/class-cleric-paladin/avengingAngelHandler.test.js`

**Replace "deactivation (toggle off)" test section with:**

- Test: "should show already active popup when clicked while active" (no state changes, just popup)
- Test: "should show cannot be used popup when already used and no level 5 slots available"
- Test: "should consume level 5 spell slot and reactivate when already used"
- Test: "should set restUsed flag on first use but not on second use"

Update existing test assertions accordingly.

## Summary of Runtime State Keys

| Key | Type | Purpose |
|-----|------|---------|
| `avengingAngelActive` | boolean | Currently active? |
| `avengingAngelAuraTargets` | string[] | Creatures affected by Frightful Aura |
| `avengingAngelRestUsed` | boolean | Used at least once since long rest |

## Pattern Consistency

This matches Elder Champion exactly:
- Same "already active" popup (no toggle off)
- Same level 5 spell slot consumption for second use
- Same rest-used tracking key pattern
- Same expiry points (initiative, short rest, long rest)
- Same badge display pattern in CharClassFeatures
