# Handoff: Stunning Strike `until_start_of_next_turn` Duration System

## Current State (Completed)
- `parseExpression()` null guard added to prevent crash ✓
- `save_only` automation type fully defined in automationService.js ✓
- 2024/classes.json updated: Stunning Strike type changed to `"save_only"` ✓
- CharActions.jsx save_only handler added: sends save prompt to target creature via SSE ✓
- sendSavePrompt imported in CharActions.jsx ✓

## The Handoff - What Needs Implementing Next

### Problem
The current `save_only` handler fires the save prompt, but:
1. No one processes the SAVE RESULT (stunned vs speed halved) when the player rolls
2. No duration tracking exists for `"until_start_of_next_turn"` effects
3. Conditions applied manually in CharConditions.jsx - need automation to apply/remove them

### Required Changes

#### 1. Wire Save Result Handler in CharActions.jsx

After `sendSavePrompt()` fires, listeners already exist via SSE events. But the save-only flow needs a separate result handler (different from damage saves).

In `CharActions.jsx` around line ~493 in the `save_only` case, AFTER calling `sendSavePrompt()`, add:

```javascript
// Listen for the save result to arrive back from SavePromptModal
const handleSaveResult = async (event) => {
    const detail = event.detail;
    if (detail.promptId !== promptId) return; // only handle this specific prompt
    
    const cs = getCombatContext();
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    if (!target) return;
    
    const targetName = target.name;
    const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    
    if (detail.success) {
        // Success: speed halved until start of next turn
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: `save-${auto.type}`,
            targetName,
            saveDc,
            saveType: auto.saveType,
            success: true,
            description: `${targetName} succeeded on ${auto.saveType} save. Speed halved until start of next turn.`
        });
        
        // Track speed-halved effect for this target
        setRuntimeValue(targetName, 'stunnedUntil', {
            speedHalved: true,
            expiresAfterNextTurnStart: Date.now() + someDuration // see note below
        }, campaignName);
    } else {
        // Fail: apply the stunned condition
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: `save-${auto.type}`,
            targetName,
            saveDc,
            saveType: auto.saveType,
            success: false,
            description: `${targetName} failed ${auto.saveType} save. Stunned until start of next turn.`
        });
        
        // Apply stunned condition to target
        const newConditions = [...conditions, 'stunned'];
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
    }
    
    // Clean up event listener
    window.removeEventListener('save-result', handleSaveResult);
};

window.addEventListener('save-result', handleSaveResult, { once: true });
```

**CRITICAL NOTE**: The existing `useLoggedDiceRoll.js` already has a `save-result` event listener (line 43). It triggers `computeDamageAfterSave()` which expects damage values. We need to make sure save-only results don't crash there - it should probably skip silently when the save result has no associated damage formula.

#### 2. Duration System: `until_start_of_next_turn`

This is a simple duration that lasts "until the start of this creature's next turn" in combat. It needs:

a) A global state object to track all active turn-based effects (or a campaign-scoped one):
```javascript
// Simple approach: use localStorage under a dedicated key
// Store format: { <creatureName>: { untilTurnStartTimestamp: number, untilTurnId: string } }
// The creature's "next turn start" = when their initiative fires again.
// Until then: treat it as persistent for the session.

const TURN_START_KEY = 'nextTurnStart';
setRuntimeValue(targetName, TURN_START_KEY, {
    stunned: true, // or any condition being applied
    lastTurnTimestamp: Date.now(),
    nextTurnStart: Date.now() + 15000 // approx 15 seconds for session design
}, campaignName);
```

b) A system to "tick" when a creature's turn starts:
- When the `initiative-rolled` custom event fires (already exists! See line 61-83 in CharActions.jsx), check all `nextTurnStart` entries
- For creatures whose turn has started, clear their duration effects

Where to wire this: In the existing init handler at **CharActions.jsx lines 60-83**, where it listens for `'initiative-rolled'`, ADD:

```javascript
window.addEventListener('initiative-rolled', (e) => {
    const rollingName = utils.getName(e.detail.characterName);
    
    // Only process if THIS creature's turn started (not the trigger caster)
    // OR process ALL creatures when ANY initiative is rolled
    
    // For simplicity: check all tracked duration effects
    const cs = localStorage.getItem('combatSummary');
    if (!cs) return;
    try {
        const combatData = JSON.parse(cs);
        for (const creature of combatData.creatures || []) {
            const nextTurnData = getRuntimeValue(creature.name, 'nextTurnStart', campaignName);
            if (!nextTurnData) continue;
            
            // "Next turn starting" = when another creature's initiative rolls 
            // OR when this same creature's name matches the rolling creature
            const myTurnStarted = e.detail.characterName === creature.name;
            const anyTurnStarted = true; // or more specific logic
            
            if (myTurnStarted || anyTurnStarted) {
                // Clear duration effects for this turn start
                setRuntimeValue(creature.name, 'stunnedUntil', null, campaignName);
                // ... clear other effects too
                
                // Optionally auto-remove conditions from duration expiry
                const storedConditions = getRuntimeValue(creature.name, 'activeConditions') || [];
                const filteredConditions = storedConditions.filter(c => c !== 'stunned');
                setRuntimeValue(creature.name, 'activeConditions', filteredConditions, campaignName);
            }
        }
    } catch {}
});
```

**Important**: The existing init handler is inside the `useEffect` at line 60. It currently only handles Monk Focus Point recovery. We need to extend it slightly or add a SECOND effect. Either way, DO NOT break the existing FP recovery logic that's already there.

#### 3. Handle "Speed Halved" as a Combat Modifier

When speed is halved:
- Store `speedHalved: true` in runtime state for the target creature
- When computing player movement range or any HP/position update, check this flag

In `combatSummary.creatures`, each creature has an init object. Add:
```javascript
// Example combat summary creature shape after modifications:
{
    name: 'Target OGL',
    // ... existing fields ...
    speedHalvedUntilNextTurn: true // <- add this flag
}
```

Or store it separately and check during any distance/movement calculations. The cleanest approach mirrors how `stunned` is already tracked via `activeConditions`.

#### 4. Handle "Next Attack Roll vs Target has Advantage" (from Success Effect)

When the target succeeds on the save, this should make "next attack roll against the target have Advantage". This means:
- Track a per-target flag like `targetAdvantageUntilNextSave`: true | false
- When building attack context for ANY creature's attack against a target with this flag, inject advantage

In **attackCalc.js** (or wherever attack bonuses/advantage are computed), add a check for the "speed halved / stunned" duration flag on the target BEFORE applying the normal advantage/disadvantage math.

OR - more simply: when building attack context in **CharActions.jsx's buildAttackContextSync()**, read from the runtime store and set `base.forcedMode = 'advantage'` if the target has the speed-halved effect active.

This is likely at lines 130-205 in CharActions.jsx where `buildAttackContextSync` builds context with `forcedMode` checks for existing advantages/disadvantages.

## Files to Modify (next session)

| File | What |
|------|------|
| `src/components/char-sheet/CharActions.jsx` | Add save-result listener in save_only case; extend initiative-rolled handler for duration tracking |
| `src/services/diceRoller.js` | Already fixed (null guard). No changes needed. |
| `src/services/automationService.js` | Already updated. No changes needed. |
| `src/services/savePromptService.js` | May need to add `sendSaveResultWithEffects()` if save results need to carry extra metadata for duration tracking |
| `src/components/common/SavePromptModal.jsx` | Potentially add success/failure display text for save_only (not damage-based saves) |
| `src/hooks/useLoggedDiceRoll.js` | Ensure `save-result` handler skips gracefully when no damage involved (line 43-107 area) |

## Files That May Need Investigation But Not Changes

| File | Why Check |
|------|-----------|
| `src/services/conditionEffects.js` | How conditions are resolved - may need to add "stunned" handling in combat calculations |
| `src/components/char-sheet/char-summary/CharConditions.jsx` | Where conditions are manually toggled - may need UI for duration expiry |

## Known Constraints (from prior session)
- This system uses `"until_start_of_next_turn"` as the simplest viable duration format
- Full implementation would track actual combat rounds and timestamps
- For now: treat "next turn" as "after this round of initiative resolves"  
- Do NOT implement other durations like "1_minute", "10_minutes", etc. - those are out of scope
- The `stunned` condition is already defined in conditionUtils.js (`CONDITION_SAVE_MAP.stunned = 'con'`)

## Testing Checklist (for next session)
1. Click Stunning Strike on Monk → save prompt appears for target
2. Roll SAVE SUCCESS → speed halved flag set, no condition applied  
3. Roll SAVE FAIL → stunned condition applied to target creature
4. Next turn (or initiative roll) → stunned removed, success effects cleared
5. Check combatSummary creatures have correct state throughout
