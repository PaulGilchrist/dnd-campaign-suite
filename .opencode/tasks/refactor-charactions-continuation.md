# CharActions Refactoring Plan

## Context (What Was Analyzed)

**Problem**: `CharActions.jsx` is ~1,554 lines and growing. It was meant to be a UI component that displays character actions, but it has accumulated 400+ lines of automation handler logic (a giant `switch(auto.type)` with 15+ cases), 270 lines of attack context building, 170 lines of metamagic flow, plus all the imports and state management. Each new feature/trait from classes.json, races.json, feats.json, or backgrounds.json requires writing a new case from scratch with no reuse.

**Root Cause**: The current architecture has no separation between UI presentation and rules/automation logic. Furthermore, there's no separation between "shared patterns" (e.g., rolling damage, applying healing, sending save prompts) and "feature-specific details" (e.g., Stunning Strike's speed halved on success). An automation type like `save_only` is supposed to be a generic pattern, but it contains Stunning Strike-specific logic hardcoded in the success/fail branches.

**Data Files**: Automations are defined in:
- `public/data/classes.json` (~50+ automation entries)
- `public/data/races.json` (12+ automation entries)
- `public/data/feats.json` (3+ automation entries)
- `public/data/backgrounds.json` (few entries)

**Current File Structure**:
```
src/components/char-sheet/
  CharActions.jsx          <- 1,554 lines, the target of this refactor
  CharActions.test.jsx     <- ~520 lines, tests for CharActions
  CharBonusActions.jsx     <- 216 lines, calls onAutomationAction from parent
  CharReactions.jsx        <- 210 lines, has its own switch(auto.type)
  CharSpecialActions.jsx   <- also exists, likely similar pattern
  DiceRollResult.jsx       <- reusable popup component
  MetamagicPopup.jsx       <- extracted metamagic UI
  SpellDetailPopup.jsx     <- spell detail popup

src/services/
  automationService.js     <- collects/dispatches automation info from features
  classFeatures.js         <- gets class-specific features (maxFocusPoints, etc.)
  damageUtils.js           <- getCombatContext, getTargetFromAttacker, etc.
  applyDamage.js           <- applyDamageToTarget
  applyHealing.js          <- applyHealingToTarget
  diceRoller.js            <- rollExpression, rollExpressionDoubled, parseExpression
  savePromptService.js     <- sendSavePrompt
  spellCastService.js      <- executeSpellCast
  rangeValidation.js       <- computeRangeEffect, getDistanceFeet, etc.
  coverService.js          <- computeCover
  featRangeService.js      <- computeFeatRangeEffects
  buffService.js           (in char-summary/) - setInnateSorceryActive, getInnateSorceryBonus

src/hooks/
  useRuntimeState.js       <- getRuntimeValue, setRuntimeValue
  useMetamagic.js          <- getCurrentSorceryPoints, spendSorceryPoints, etc.
  useSpellMetamagicFlow.js <- metamagic flow (confirm/skip)
  useSpellUpcastFlow.js    <- spell upcasting
  useLoggedDiceRoll.js     <- rollAttack, rollDamage, quickRollPlayerSave
  useActionPopup.js        <- showWeaponMasteryPopup, buildFeatureDetailHtml

public/data/classes.json   <- feature definitions with .automation blocks
```

## Agreed Architecture (By Automation Type)

### Directory Structure to Create

```
src/services/automation/
  index.js                 <- dispatcher: maps type -> handler function
  contextBuilder.js        <- builds the context object passed to all handlers
  common/
    savePrompt.js          <- send save prompt + listen for result (common pattern)
    damageRoll.js          <- roll damage + apply to target (common pattern)
    healingRoll.js         <- roll healing + clip to max HP + log (common pattern)
    buffToggle.js          <- toggle active buffs on/off (common pattern)
    resourceCheck.js       --- check and spend resources (FP, SP, charges, uses)
    targetResolver.js      <- resolve target from attacker via combat + map data
  handlers/
    saveOnlyHandler.js     <- handles automation.type === 'save_only'
    saveAttackHandler.js   <- handles automation.type === 'save_attack'
    healingHandler.js      <- handles automation.type === 'healing', 'self_healing'
    buffHandler.js         <- handles automation.type === 'temp_buff'
    conditionHandler.js    <- handles automation.type === 'set_condition'
    sorceryHandler.js      <- handles 'sorcery_aura', 'sorcery_incarnate'
    spellCastHandler.js    <- handles automation.type === 'free_spell'
    initiativeHandler.js   <- handles automation.type === 'initiative_action'
    bonusAttackHandler.js  <- handles 'bonus_attacks', 'bonus_action_attack'
    resourcePoolHandler.js <- handles 'resource_pool'
    fontOfMagicHandler.js  <- handles 'font_of_magic' (UI modal + logic)
    extraActionHandler.js  <- handles 'extra_action'
    combatStanceHandler.js <- handles 'combat_stance'
    damageAuraHandler.js   <- handles 'damage_aura'
    attackRiderHandler.js  <- handles 'attack_rider'
    damageBonusHandler.js  <- handles 'damage_bonus'
    healingPoolHandler.js  <- handles 'healing_pool' (UI modal + logic)
    spellModifierHandler.js<- handles 'spell_modifier' (Metamagic trigger)
```

### Design Decisions

1. **Organization**: By automation type (e.g., `saveOnlyHandler.js` handles ALL `save_only` features). Common helpers in `common/`.

2. **Attack Context Builders**: Extract `buildAttackContextSync` and `buildAttackContext` into `src/services/automation/contextBuilder.js`. Keeps CharActions lean, makes the logic testable from outside React.

3. **Metamagic Handling**: Leave as-is. The `~170 lines of metamagic flow is already partially extracted (useSpellMetamagicFlow.js, useMetamagic.js). It's working and doesn't need to move.

4. **Migration Strategy**: All at once. Tests will catch regressions.

---

## Part 1: Create `/src/services/automation/common/` Helpers (COMPLETE)

Each helper is a pure function that handles one repeated pattern. They receive raw data (playerStats, campaignName, mapName) and return results. No React hooks — these are plain JS utility functions.

---

## Part 2: Create `/src/services/automation/contextBuilder.js` (COMPLETE)

Extract `buildAttackContextSync` and `buildAttackContext` from CharActions.jsx. These are pure functions that build an attack context (with target info, resistance notices, range/cover effects) given an attack description and map/campaign data.

**Important**: The `_advantageOn_` runtime tracking (Stunning Strike advantage) is tightly coupled to the Stunning Strike mechanic. It should probably live in `saveOnlyHandler.js`, not in the general attack context builder. If there are no other features that modify `forcedMode` via runtime state, remove it from contextBuilder and keep it in the handler.

---

## Part 3: Create `/src/services/automation/handlers/` Handler Files (COMPLETE)

Each handler follows this contract:

```js
/* HANDLER CONTRACT:
   Each handler file exports a single async function with this signature:
   
   export async function handle(action, playerStats, campaignName, mapName) {
       // action: the full action object { name, description, automation: {...}, hasAutomation: true }
       // playerStats: computed stats (level, abilities, spellAbilities, class, etc.)
       // campaignName: string for runtime state and SSE
       // mapName: string or undefined
   
       // Returns: { 
           type: 'popup' | 'modal' | 'none',
           payload: { ...data to render the popup/modal },
           logEntries?: [{ type, characterName, ... }],
           runtimeUpdates?: { key, value }[],
       }
   }

   If the handler determines it cannot proceed (no resources, no target, etc.), 
   it returns an error payload that the UI can display. */
}
```

**IMPORTANT**: The handlers should NOT directly call `setPopupHtml`, React's setState is a component concern. They return structured data back to CharActions.jsx handles it by rendering the appropriate popup/modal.

---

## Part 4: Create `/src/services/automation/index.js` — Dispatcher

This is the glue layer. It maps automation types to handler functions and returns structured results.

```js
// index.js
import { handle as handleSaveOnly } from './handlers/saveOnlyHandler.js';
import { handle as handleSaveAttack } from './handlers/saveAttackHandler.js';
import { handle as handleHealing } from './handlers/healingHandler.js';
import { handle as handleBuff } from './handlers/buffHandler.js';
import { handle as handleCondition } from './handlers/conditionHandler.js';
import { handle as handleSorcery } from './handlers/sorceryHandler.js';
import { handle as handleSpellCast } from './handlers/spellCastHandler.js';
import { handle as handleInitiative } from './handlers/initiativeHandler.js';
import { handle as handleBonusAttack } from './handlers/bonusAttackHandler.js';
import { handle as handleResourcePool } from './handlers/resourcePoolHandler.js';
import { handle as handleFontOfMagic } from './handlers/fontOfMagicHandler.js';
import { handle as handleHealingPool } from './handlers/healingPoolHandler.js';
import { handle as handleExtraAction } from './handlers/extraActionHandler.js';
import { handle as handleCombatStance } from './handlers/combatStanceHandler.js';
import { handle as handleDamageAura } from './handlers/damageAuraHandler.js';
import { handle as handleAttackRider } from './handlers/attackRiderHandler.js';
import { handle as handleSpellModifier } from './handlers/spellModifierHandler.js';

const HANDLER_MAP = {
    save_only: handleSaveOnly,
    save_attack: handleSaveAttack,
    healing: handleHealing,
    self_healing: handleHealing,
    temp_buff: handleBuff,
    set_condition: handleCondition,
    sorcery_aura: handleSorcery,
    sorcery_incarnate: handleSorcery,
    free_spell: handleSpellCast,
    initiative_action: handleInitiative,
    bonus_attacks: handleBonusAttack,
    bonus_action_attack: handleBonusAttack,
    resource_pool: handleResourcePool,
    font_of_magic: handleFontOfMagic,
    healing_pool: handleHealingPool,
    extra_action: handleExtraAction,
    combat_stance: handleCombatStance,
    damage_aura: handleDamageAura,
    attack_rider: handleAttackRider,
    spell_modifier: handleSpellModifier,
};

export async function executeHandler(action, playerStats, campaignName, mapName) {
    if (!action?.automation) return null;
    
    const handler = HANDLER_MAP[action.automation.type];
    if (!handler) return null;

    try {
        return await handle(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error(`[automation] Handler ${action.automation.type} failed:`, e);
        return { type: 'popup', payload: { error: `Failed to execute ${action.name}` } };
    }
}
```

---

## Part 5: Refactor CharActions.jsx

After extracting all handlers, ContextBuilder moves into `contextBuilder.js` (Part 1), the metamagic handling stays. CharActions.jsx becomes ~300 lines:

### What Stays in CharActions.jsx

1. **Imports**: Trim to only what's needed locally
2. **State declarations**: All useState for popups, modals, selected spell, pending metamagic — unchanged
3. **Passive useEffect** (initiative recovery lines 68-97): Keep local — it's not triggered by user click, it's event-driven
4. **useLoggedDiceRoll hook**: Unchanged
5. **Attack context builders**: REPLACE with calls to `contextBuilder.js` OR if the context builder is a separate service, remove these functions entirely. The `handleDamageClick` and `handleAttackClick` are thin wrappers around context building + roll. They can stay local or move to a service. Decision: keep local for now — they tightly coupled to useLoggedDiceRoll which returns rollAttack/rollDamage callbacks
6. **Metamagic handling** (~170 lines): Leave as-is per user request
7. **Spell casting flows**: `handleActionSpellClick`, `handleActionSpellDamageClick`, `handleSpellAttackClick`, `handleSpellDamageClick` — these gate through metamagic for Sorcerers. Keep local.
8. **JSX rendering**: Unchanged

### What Gets Removed from CharActions.jsx

- **The entire `handleAutomationAction` function** (~400 lines, lines 471-1085): REplaced with:
```js
import { executeHandler } from '../../services/automation/index.js';

const handleAutomationAction = async (action) => {
    if (cannotAct) return;
    const result = await executeHandler(action, playerStats, campaignName, mapName);
    if (!result) return;

    switch (result.type) {
        case 'popup':
            setPopupHtml(result.payload);
            break;
        case 'modal':
            // Route to the correct modal state:
            switch (result.modalName) {
                case 'healingPool': setHealingPoolModal(result.payload); break;
                case 'handOfHealing': setHandOfHealingModal(result.payload); break;
                case 'fontOfMagic': setFontOfMagicModal(true); break;
                case 'setCondition': setSetConditionModal(result.payload); break;
            }
            break;
        case 'roll':
            // Pass roll payload to rollAttack or rollDamage from useLoggedDiceRoll
            if (result.payload.rollType === 'damage') {
                rollDamage(
                    result.payload.name, 
                    result.payload.formula, 
                    result.payload.total, 
                    result.payload.rolls, 
                    result.payload.modifier, 
                    result.payload.context
                );
            }
            break;
        case 'notify_buffs_changed':
            if (onBuffsChange) onBuffsChange();
            break;
    }

    // Log entries from handler result
    if (result.logEntries) {
        result.logEntries.forEach(entry => addEntry(campaignName, entry).catch(() => {}));
    }
};
```

---

## Part 6: Also Refactor CharReactions.jsx and CharSpecialActions.jsx

CharReactions.jsx has its own `switch(auto.type)` in `handleAutomationReaction` (lines 55-95). It should also route through `executeHandler`.

Similar for CharBonusActions.jsx — it currently passes `onAutomationAction` from parent, which calls the same switch. After refactoring, it can call `executeHandler` directly or continue using the callback pattern (the parent now uses the handler dispatcher).

---

## Implementation Order

1. **Create `src/services/automation/` directory structure**
2. **Create `common/` helper files** (all 6)
3. **Create `contextBuilder.js`** — extract from CharActions.jsx lines 128-264 and 173-296
4. **Create all handler files in `handlers/`** — write from scratch using the specs above, referencing original CharActions.jsx code
5. **Create `index.js` dispatcher**
6. **Refactor CharActions.jsx** — remove `handleAutomationAction`, replace with dispatcher call
7. **Refactor CharReactions.jsx** — same pattern
8. **Run tests**: `npm test` (or however the project runs tests)
9. **Fix any failing lint issues: Run lint check and fix

---

## Key Design Principles for Handlers

1. **Handlers return structured results, not side effects.** They don't call `setPopupHtml`, they return `{ type: 'popup', payload: {...} }`. The UI component decides how to display it.

2. **Runtime state changes ARE allowed in handlers.** Calling `setRuntimeValue` for saving resources, toggling buffs, applying conditions is the domain logic belongs in the handler.

3. **DOM events (`window.dispatchEvent`) are allowed.** This is already used heavily (focus-points-updated, combat-summary-updated, innate-sorcery-updated). Keep this pattern — it's how the app communicates between components without tight coupling.

4. **Logging (`addEntry`) — decided in Part 1**. Either keep in handlers or move to UI layer. For now: keep in handlers where it makes sense (fire-and-forget log), for complex multi-entry logging, return `logEntries` array and let the caller handle it.

5. **Each handler is importable, testable without React.** A handler is just a function `(action, playerStats, campaignName, mapName) => Promise<Result>`. Write unit tests that mock runtime state and verify correct results are returned.

6. **The `MONK_KI_FEATURES` list** (line 305) — this Ki point check should move into the individual handlers that spend Ki (`healingHandler`, saveOnlyHandler for Stunning Strike, etc.). The handler knows whether it costs Ki because the automation data marks it. If the data doesn't have a cost field, check by name:
```js
const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];
// This list should move into the relevant handlers, or better yet be driven by automation data:
// "automation": { "type": "save_only", "costType": "monk_ki", "costAmount": 1 }
```

## Migration Checklist

- [x] Create `src/services/automation/common/savePrompt.js`
- [x] Create `src/services/automation/common/damageRoll.js`
- [x] Create `src/services/automation/common/healingRoll.js`
- [x] Create `src/services/automation/common/buffToggle.js`
- [x] Create `src/services/automation/common/resourceCheck.js`
- [x] Create `src/services/automation/common/targetResolver.js`
- [x] Create `src/services/automation/contextBuilder.js` — extracted from CharActions.jsx
- [x] Create `src/services/automation/handlers/saveOnlyHandler.js`
- [x] Create `src/services/automation/handlers/saveAttackHandler.js`
- [x] Create `src/services/automation/handlers/healingHandler.js`
- [x] Create `src/services/automation/handlers/buffHandler.js`
- [x] Create `src/services/automation/handlers/conditionHandler.js`
- [x] Create `src/services/automation/handlers/sorceryHandler.js`
- [x] Create `src/services/automation/handlers/spellCastHandler.js`
- [x] Create `src/services/automation/handlers/initiativeHandler.js`
- [x] Create `src/services/automation/handlers/bonusAttackHandler.js`
- [x] Create `src/services/automation/handlers/resourcePoolHandler.js`
- [x] Create `src/services/automation/handlers/fontOfMagicHandler.js`
- [x] Create `src/services/automation/handlers/healingPoolHandler.js`
- [x] Create `src/services/automation/handlers/extraActionHandler.js`
- [x] Create `src/services/automation/handlers/combatStanceHandler.js`
- [x] Create `src/services/automation/handlers/damageAuraHandler.js`
- [x] Create `src/services/automation/handlers/attackRiderHandler.js`
- [x] Create `src/services/automation/handlers/spellModifierHandler.js`
- [ ] Create `src/services/automation/index.js` — dispatcher
- [ ] **Refactor `CharActions.jsx`** — remove handleAutomationAction, use executeHandler
- [ ] **Refactor `CharBonusActions.jsx`** — update if needed (currently uses callback from parent)
- [ ] **Refactor `CharReactions.jsx`** — use executeHandler for reaction automations
- [ ] Run tests: verify nothing breaks
- [ ] Run lint: fix any issues

## Important References and Gotchas

### CharActions.jsx Line Numbers (Original File)
- Lines 1-43: Imports
- Lines 45-96: State + useEffect for initiative recovery — USE THIS TO DETERMINE IF INITIATIVE ACTION IS AVAILABLE. Lines 1280-264: `buildAttackContextSync` and `buildAttackContext` — EXTRACT to contextBuilder.js
- Lines 266-303: Individual damage/attack click handlers — KEEP LOCAL or extract to service
- Lines 471-1085: **The big switch-on-type** — REMOVE, replace with executeHandler call
- Lines 1102+: Metamagic flow handling — LEAVE AS-IS
- Lines 1347-1552: JSX render — UNCHANGED

### Data File Paths (Automations)
- `public/data/classes.json` — most automation definitions, ~50 entries
- `public/data/races.json` — passive buffs, attack riders, conditional advantages
- `public/data/feats.json` — attack riders, auto effects, resource pools
- `public/data/backgrounds.json` — minimal

### Existing Services Already Used by CharActions.jsx
These are already imported and working. Do NOT re-implement their functionality:
- `useLoggedDiceRoll.js` — provides rollAttack, rollDamage, quickRollPlayerSave, popupHtml/setPopupHtml
- `useMetamagic.js` — sorcery points management
- `useSpellUpcastFlow.js` — spell upcasting UI flow
- `useSpellMetamagicFlow.js` — metamagic confirm/skip flow
- `diceRoller.js` — rollExpression, rollExpressionDoubled, parseExpression
- `damageUtils.js` — getCombatContext, getTargetFromAttacker, getResistanceNotice
- `applyDamage.js` — applyDamageToTarget (for direct damage outside UI)
- `applyHealing.js` — applyHealingToTarget
- `classFeatures.js` — getClassFeatures (for maxFocusPoints, martialArtsDie, etc.)
- `savePromptService.js` — sendSavePrompt (sends custom event to other clients)
- `buffService.js` (in char-summary/) — innateSorcery active/inactive toggle
- `runtimeState.js` — getRuntimeValue/setRuntimeValue (the key:value store for runtime data)
- `logService.js` — addEntry (for campaign logging)

### DOM Events Used by Current Code
Don't break these custom events — they're how the app communicates cross-component:
- `initiative-rolled` — fired when initiative rolled, triggers focus point recovery (line 91)
- `save-prompt` / `save-result` — save prompt flow
- `focus-points-updated` — notifies UI of FP changes
- `combat-summary-updated` — notifies UI of combat state changes
- `innate-sorcery-updated` — notifies UI of innate sorcery state

### Test File Notes
- `CharActions.test.jsx` mocks useLoggedDiceRoll, useMetamagic, sanitize, fetch — will need to mock the new dispatcher too
- Tests currently check: render section header, display attacks, handle clicks on spells/attacks/actions
- After refactor add tests should verify the dispatcher and handler return correct results for each type

### Coding Standards (from AGENTS.md)
- **JS over TS** — all new files should be `.js` not `.jsx` (handlers are plain JS, no React components)
- **No inline styles** — use existing CSS classes from `CharActions.css`
- **ES modules** — all imports/exports should use ES module syntax
- **Font Awesome** — if icons needed in handler-rendered content, use Font Awesome class names
