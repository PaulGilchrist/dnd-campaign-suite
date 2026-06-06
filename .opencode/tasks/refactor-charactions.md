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

### `common/savePrompt.js`

**Purpose**: Send a save prompt, listen for the result event, handle success/fail branches. This is the core logic shared between `save_only`, `save_attack`, and any future save-based ability.

```js
// common/savePrompt.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import utils from '../../../services/utils.js';

export function buildSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') {
        const conBonus = playerStats.abilities?.find(a => a.name === 'CON')?.bonus || 0;
        const prof = playerStats.proficiency || 0;
        return 8 + conBonus + prof;
    }
    return auto.saveDc || 10;
}

export function sendSaveAndListen(campaignName, config) {
    /* Returns: { promptId, addListener, removeListener }
       config: { targetName, saveType, saveDc, dcSuccess, onResult(callback), dismisCallback? */
    const promptId = utils.guid();
    
    // Send the prompt via existing service
    import('../../../services/savePromptService.js').then(sendSp => {
        sendSp.sendSavePrompt(campaignName, {
            promptId,
            targetName: config.targetName,
            saveType: config.saveType || 'CON',
            saveDc: config.saveDc,
            dcSuccess: config.dcSuccess,
        });
    });

    function addListener() {
        const handler = (event) => {
            if (event.detail.promptId !== promptId) return;
            config.onResult(event.detail);
            window.removeEventListener('save-result', handler);
        };
        window.addEventListener('save-result', handler);
    }

    function removeListener() {
        // Remove any attached listener by dispatching a cleanup event or tracking the ref
    }

    return { promptId, addListener, saveDc: config.saveDc };
}

export function applySaveSuccessEffect(campaignName, targetName, featureName) {
    /* For Stunning Strike's speed halved + advantage on next attack
       NOTE: This is currently hardcoded to Stunning Strike behavior. 
       If there are other save_only features with DIFFERENT success effects,
       they should pass their own effect functions. */
    const timestamp = Date.now();
    setRuntimeValue(targetName, `${featureName}_speedHalved`, timestamp, campaignName);
    
    // The advantage is stored on the attacker's side
    // But we don't have attacker name here — it needs to come from context
}

export function applySaveFailEffect(campaignName, targetName, condition) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const newConditions = [...conditions, condition || 'stunned'];
    setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
}
```

**IMPORTANT DESIGN NOTE**: The current `save_only` implementation in CharActions.jsx is 100% Stunning Strike specific:
- Success: speed halved until next turn + advantage on next attack against target
- Fail: apply 'stunned' condition until next turn

If a second `save_only` feature exists (e.g., a grab/disarm that stuns or grapples), this code won't work for it. The handler MUST be generic. Consider the handler taking effect config from the automation data itself rather than hardcoding behavior:

```json
// In classes.json, features should define their own effects:
"automation": {
    "type": "save_only",
    "saveType": "CON",
    "saveDc": "ability",
    "effects": {
        "success": [
            { "action": "apply_debuff", "debuff": "speed_halved", "duration": "until_attacker_next_turn" },
            { "action": "grant_advantage_to_attacker_on_target" }
        ],
        "fail": [
            { "action": "apply_condition", "condition": "stunned", "duration": "until_target_next_turn" }
        ]
    }
}
```

For now, keep the effects configurable through the data. The handler reads whatever is in `auto.effects`. If no effects defined, fall back to default (no-op on success, stunned on fail).

### `common/damageRoll.js`

**Purpose**: Roll damage expression, build context with target/resistance info, call rollDamage. Shared between `save_attack`, any attack-related handler.

```js
// common/damageRoll.js
import { rollExpression, rollExpressionDoubled } from '../../../services/diceRoller.js';
import { buildAttackContextSync, buildAttackContext } from '../contextBuilder.js';

export function rollDamageForAction(auto, attackerName, campaignName, mapName, options = {}) {
    /* Returns: Promise<{result, context}>
       auto: the automation object
       options: { isCrit?: boolean, wasRollCalled?: boolean, preRolledResult? }
     
     If options.preRolledResult exists (caller already rolled), use it.
     Otherwise roll here. */
    const damage = auto.damage;
    let result = options.preRolledResult;
    
    if (!result) {
        result = options.isCrit ? rollExpressionDoubled(damage) : rollExpression(damage);
    }
    if (!result) return null;

    const attackForContext = {
        name: auto.name || '',
        damage,
        damageType: auto.damageType || '',
        saveDc: auto.saveDc,
        saveType: auto.saveType || 'DEX',
        saveSuccess: auto.dcSuccess ?? (auto.shape === 'cone' ? 0.5 : 0),
    };

    const ctxPromise = mapName
        ? buildAttackContext(attackForContext, attackerName, campaignName, mapName)
        : buildAttackContextSync(attackForContext, attackerName, campaignName);

    return ctxPromise.then(ctx => {
        // The caller (React component) will call rollDamage with result + ctx
        return { result, context: ctx };
    });
}

export function applyDamageToTargetDirectly(campaignName, targetName, damageAmount, damageTypes, sourceName) {
    /* For cases where we need to apply damage outside the UI flow */
    import('../../../services/damageUtils.js').then(getCs => getCs.getCombatContext(campaignName))
        .then(cs => {
            if (!cs || !targetName) return;
            import('../../../services/applyDamage.js').then(ad => {
                ad.applyDamageToTarget(cs, targetName, damageAmount, damageTypes, campaignName, sourceName);
            });
        });
}
```

### `common/healingRoll.js`

**Purpose**: Roll healing expression, resolve target (self or other), apply and clip to max HP, log to SSE. Shared between `healing`, `self_healing`, `initiative_action`.

```js
// common/healingRoll.js
import { rollExpression } from '../../../services/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../services/damageUtils.js';

export function rollHealingForAction(auto, playerStats, campaignName, isSelf = false) {
    /* Returns: Promise<{healAmount, actualHeal, targetName, newHp, maxHp}> */
    const formula = auto.healExpression || '';
    if (!formula) return Promise.resolve(null);
    
    const result = rollExpression(formula);
    if (!result) return Promise.resolve(null);

    const healAmount = result.total; // Note: some code uses .total + modifier, verify current behavior

    getCombatContext(campaignName).then(cs => {
        let targetName;
        if (isSelf) {
            targetName = playerStats.name;
        } else {
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            targetName = target ? target.name : playerStats.name;
        }

        // Resolve max/current HP for this target
        const targetMaxHp = target.type === 'player' 
            ? (getRuntimeValue(target.name, 'hitPoints') ?? playerStats.hitPoints)
            : (target?.maxHp || playerStats.hitPoints);
        
        const storedHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
        const targetCurrentHp = storedHp != null && storedHp !== '' ? Number(storedHp) :(target?.currentHp ?? targetMaxHp);
        
        const newHp = Math.min(targetMaxHp, targetCurrentHp + healAmount);
        const actualHeal = newHp - targetCurrentHp;

        // Store the result back
        setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);

        return { healAmount, actualHeal, targetName, newHp, maxHp: targetMaxHp, formula: auto.healExpression };
    });
}

export function logHealingToSSE(campaignName, info) {
    /* Log to /api/campaigns/{id}/log as an hp_change event */
    const { targetName, sourceName, actualHeal, newHp, maxHp } = info;
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'hp_change',
            targetName,
            sourceName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            isUnconscious: false,
        })
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
```

### `common/buffToggle.js`

**Purpose**: Toggle active buffs. Shared between `temp_buff`, `sorcery_aura`, and any future buff-based ability.

```js
// common/buffToggle.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export function toggleBuff(playerName, actionName, auto, campaignName) {
    /* Returns: { isActive (after toggle), buffs (array), wasActive (before toggle) } */
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === actionName);
    
    const newBuffs = wasActive
        ? activeBuffs.filter(b => b.name !== actionName)
        : [...activeBuffs, { name: actionName, effect: auto.effect, duration: auto.duration }];
    
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return { isActive: !wasActive, buffs: newBuffs, wasActive };
}

export function getActiveBuffs(playerName, campaignName) {
    const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    return Array.isArray(buffs) ? buffs : [];
}

export function isBuffActive(playerName, buffName, campaignName) {
    return getActiveBuffs(playerName, campaignName).some(b => b.name === buffName);
}
```

### `common/resourceCheck.js`

**Purpose**: Check if a feature has remaining uses/charges, deduct on success. Shared between monk Ki features, Sorcery Points, Channel Divinity charges, innate sorcery uses.

```js
// common/resourceCheck.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getClassFeatures } from '../../../services/classFeatures.js';

export function getResourceAmount(playerStats, resourceName) {
    if (resourceName === 'focusPoints') {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        return classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
    }
    // Generic keyed resource: stored in runtime state by key
    const key = auto.resourceKey || '${actionName.toLowerCase()}.replace(/\s+/g, '') + 'Uses';
    return Number(getRuntimeValue(playerS.name, key,campaignName) ?? 0);
}

export function spendResource(playerName, resourceNameOrKey, amount, campaignName) {
    const stored = getRuntimeValue(playerName, resourceNameOrKey, campaignName);
    const current = stored != null ? Number(stored) : 0;
    const newAmount = current - amount;
    setRuntimeValue(playerName, resourceNameOrKey, newAmount, campaignName);
    return newAmount;
}

export function checkResourceRemaining(resourceKey, maxUses, playerName, campaignName) {
    /* Returns: { remaining (number), canUse (boolean) } */
    const current = getRuntimeValue(playerName, resourceKey, campaignName);
    const used = current != null ? Number(current) : 0;
    return { remaining: maxUses - used, canUse: used < maxUses };
}
```

### `common/targetResolver.js`

**Purpose**: Resolve target from combat context + map positions. This is the most repeated pattern — every handler that affects another character needs to know "who is the target?" and sometimes where they are on a map.

```js
// common/targetResolver.js
import { getCombatContext, getTargetFromAttacker } from '../../../services/damageUtils.js';

export function resolveTarget(campaignName, attackerName) {
    /* Returns: Promise<{target, cs}> or null */
    return getCombatContext(campaignName).then(cs => {
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, attackerName);
        if (!target) return null;
        return { target, cs };
    });
}

export function resolveMapPositions(campaignName, mapName, attackerName) {
    /* Returns: Promise<{attackerPos?, targetPos?}> or null */
    if (!mapName) return Promise.resolve(null);
    
    import('../../../services/mapsService.js').then(maps => 
        maps.loadMapData(campaignName, mapName)
    ).then(mapData => {
        const attackerPlayer = mapData?.players?.find(p => p.name === attackerName);
        if (!attackerPlayer) return null;
        
        return resolveTarget(campaignName, attackerName).then(({ target }) => {
            if (!target) return { attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY } };
            
            const targetPlayer = mapData?.players?.find(p => p.name === target.name);
            const import('../../../services/rangeValidation.js').then(rv => {
                const targetNpc = mapData?.placedItems?.length
                    ? rv.getNearestPlacedItem(mapData.placedItems, target.name, attackerName)
                    : null;
                const targetPos = targetPlayer
                    ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
                    : targetNpc
                        ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                        : null;
                return {
                    attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos,
                };
            });
        });
    }).catch(() => null);
}
```

---

## Part 2: Create `/src/services/automation/contextBuilder.js`

Extract `buildAttackContextSync` and `buildAttackContext` from CharActions.jsx. These are pure functions that build an attack context (with target info, resistance notices, range/cover effects) given an attack description and map/campaign data.

```js
// contextBuilder.js - full spec:

import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../../services/damageUtils.js';
import * as mapsService from '../../services/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../../services/rangeValidation.js';
import { computeCover } from '../../services/coverService.js';
import { computeFeatRangeEffects } from '../../services/featRangeService.js';
import { loadNPCs } from '../../services/npcsService.js';
import { getInnateSorceryBonus } from '../char-summary/buffService.js';

export function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode) {
    /* Synchronous path — no map validation.
       Returns: Promise<{damageType, resistanceNotice, targetName, saveDc, saveType, dcSuccess, attackerName, forcedMode, autoDamageFormula, autoDamageName, coverAcBonus?, coverLevel?}> */
    
    getCombatContext(campaignName).then(cs => {
        const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
        const targetName = target?.name || (cs ? getAttackerTargetName(cs, playerStats.name) : undefined);
        const resistanceNotice = target 
            ? getResistanceNotice([attack.damageType], target.resistances, target.immunities, target.name)
            : null;

        // Check for saving advantage (consumed on use - this is the _advantageOn_ runtime key pattern)
        let hasSaveAdvantage = false;
        if (targetName) {
            const advKey = `_advantageOn_${targetName}`;
            /* NOTE: This requires getRuntimeValue which needs import. 
               The advantage-on-target tracking is a bit specific to Stunning Strike.
               Consider whether this belongs in the general attack context or only in saveOnlyHandler */
        }

        const innateSorceryBonus = getInnateSorceryBonus(playerStats.name, campaignName);
        
        let forcedMode = conditionAttackMode !== 'normal' ? conditionAttackMode : undefined;
        if (hasSaveAdvantage && forcedMode === undefined) forcedMode = 'advantage';
        if (innateSorceryBonus.spellAdvantage && forcedMode === undefined) forcedMode = 'advantage';

        return {
            damageType: attack.damageType,
            resistanceNotice,
            targetName,
            saveDc: (attack.saveDc || 0) + innateSorceryBonus.saveDcBonus,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerStats.name,
            forcedMode,
            autoDamageFormula: attack.damage,
            autoDamageName: attack.name,
        };
    });
}

export function buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode) {
    /* Map-aware path — adds range validation and cover detection.
       Calls buildAttackContextSync first, then augments with map data. */
    
    if (!mapName) return buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode);

    const basePromise = buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode);
    
    Promise.all([basePromise, mapsService.loadMapData(campaignName, mapName), loadNPCs(campaignName)])
        .then(([base, mapData, npcs]) => { /* range + cover logic from CharActions.jsx lines 180-263 */)
        .catch(() => base); // fallback to base context

}
```

**Important**: The `_advantageOn_` runtime tracking (Stunning Strike advantage) is tightly coupled to the Stunning Strike mechanic. It should probably live in `saveOnlyHandler.js`, not in the general attack context builder. If there are no other features that modify `forcedMode` via runtime state, remove it from contextBuilder and keep it in the handler.

---

## Part 3: Create `/src/services/automation/handlers/` Handler Files

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

### Handler Files — Full Specifications

#### `saveOnlyHandler.js` — type: `'save_only'`

Current logic (CharActions.jsx lines 524-621): Sends save prompt, listens for result, applies condition/debuff based on success/fail, triggers log entries and runtime state updates. Currently 97 lines of code that are Stunning Strike-specific.

**Refactored**: Extract the common parts: send save + listen for result → `sendSaveAndListen()` in common/savePrompt.js
- Apply condition on fail → common/savePrompt.js
- Build save DC → common/savePrompt.js
- Log entry → handled by caller (CharActions.jsx) or use addEntry directly

```js
// handlers/saveOnlyHandler.js
import { buildSaveDc } from '../common/savePrompt.js';
import { resolveTarget } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    
    const saveDc = buildSaveDc(auto, playerStats);
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || playerStats.name;

    // Send the save prompt — this dispatches a custom event (save-prompt) that the other side listens for, 
    // then fires save-result. We set up the listener here via helper.
    const saveResult = await sendSaveAndListen(campaignName, {
        targetName,
        saveType: auto.saveType || 'CON',
        saveDc,
        onResult(detail) {
            /* Handle based on data-driven effects or fallback */
            const effects = auto.effects || defaultEffects(auto.name);
            if (detail.success) {
                effects.success?.forEach(effect => applyEffect(effect, targetName, playerStats.name, campaignName));
            } else {
                effects.fail?.forEach(effect => applyEffect(effect, targetName, playerStats.name, campaignName));
            }
        },
    });

    // The actual success/fail logic happens asynchronously via event.
    // For now, show a popup saying save has been sent:
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `Target ${targetName} must make a ${auto.saveType || 'CON'} saving throw (DC ${saveDc}).`,
            automation: auto,
            promptId: saveResult.promptId,
        },
        logEntries: [{
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'CON'} save (DC ${saveDc})`,
            promptId: saveResult.promptId,
        }],
    };
}

function defaultEffects(automationName) {
    /* Fallback when no effects defined in data. Only for backwards compatibility. */
    if ('Stunning Strike') {
        return {
            success: [
                { action: 'apply_debuff', debuff: 'speed_halved', duration: 'until_attacker_next_turn' },
                { action: 'grant_advantage_attacker_on_target' }
            ],
            fail: [
                { action: 'apply_condition', condition: 'stunned', duration: 'until_target_next_turn' }
            ],
        };
    }
    return {};
}

function applyEffect(effect, targetName, attackerName, campaignName) {
    switch (effect.action) {
        case 'apply_debuff':
            setRuntimeValue(targetName, `${effect.debuff}_${Date.now()}`, campaignName);
            // Also add expiration via common helper
            break;
        case 'grant_advantage_to_attacker_on_target':
            const advKey = `_advantageOn_${targetName}`;
            const stored = getRuntimeValue(attackerName, advKey) || [];
            setRuntimeValue(attackerName, advKey, [...stored, targetName], campaignName);
            break;
        case 'apply_condition':
            const conditions = [...getRuntimeValue(targetName, 'activeConditions') || [], effect.condition];
            setRuntimeValue(targetName, 'activeConditions', conditions, campaignName);
            // Add expiration
            break;
    }
}
```

#### `saveAttackHandler.js` — type: `'save_attack'`

Current logic (CharActions.jsx lines 499-523): Rolls damage, resolves save DC, builds attack context, calls rollDamage. Straightforward.

```js
// handlers/saveAttackHandler.js
import { rollExpression } from '../../../services/diceRoller.js';
import { buildSaveDc } from '../common/savePrompt.js';
import { buildAttackContextSync, buildAttackContext } from '../contextBuilder.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    
    const damageResult = rollExpression(auto.damage);
    if (!damageResult) return null;

    const saveDc = buildSaveDc(auto, playerStats);
    const dcSuccess = auto.shape === 'cone' ? 0.5 : 0;

    const attackContext = {
        name: action.name,
        damage: auto.damage,
        damageType: auto.damageType || '',
        saveDc,
        saveType: auto.saveType || 'DEX',
        saveSuccess: dcSuccess,
    };

    const ctx = await (mapName 
        ? buildAttackContext(attackContext, playerStats, campaignName, mapName)
        : buildAttackContextSync(attackContext, playerStats, campaignName));

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: auto.damage,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            context: ctx,
        },
    };
}
```

#### `healingHandler.js` — types: `'healing'`, `'self_healing'`

Current logic (CharActions.jsx lines 628-709): Complex branching for monk martial arts die, target resolution, healing application, logging to SSE, HandOfHealingModal interaction. This is the most tangled handler because it mixes monk-specific logic with generic healing.

**Refactored**: Extract:
- Generic healing roll → `common/healingRoll.js`
- Monk martial arts die resolution → either a helper in `common/monkMechanics.js` or keep in this handler with clear comments
- Hand of Healing modal trigger → return payload with type `'modal'` and modal name `'handOfHealing'`

```js
// handlers/healingHandler.js
import { rollExpression } from '../../../services/diceRoller.js';
import { getClassFeatures } from '../../../services/classFeatures.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { resolveTarget } from '../common/targetResolver.js';
import { logHealingToSSE } from '../common/healingRoll.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const isSelf = auto.type === 'self_healing';
    
    // Check if this involves martial arts die (monk healing)
    const expression = auto.healExpression || '';
    const isMonkHealing = expression.includes('martial_arts_die') && expression.includes('WIS');

    let healAmount, formula, rolls, wisModifier = 0;

    if (isMonkHealing) {
        const monkFeatures = getClassFeatures(playerStats);
        const martialArtsDie = monkFeatures?.martialArtsDie || 4;
        const wisdom = playerStats.abilities?.find(a => a.name === 'Wisdom');
        wisModifier = wisdom?.bonus || 0;

        const rollResult = rollExpression(`1d${martialArtsDie}`);
        if (!rollResult) return null;
        
        healAmount = rollResult.total + wisModifier;
        formula = `1d${martialArtsDie} + ${wisModifier}`;
        rolls = rollResult.rolls;

        const targetInfo = isSelf ? null : await resolveTarget(campaignName, playerStats.name);
        const targetName = targetInfo?.target?.name || playerStats.name;
        
        const { newHp, maxHp, actualHeal } = await applyHealingDirectly(
            playerStats, targetName, healAmount, campaignName);

        logHealingToSSE(campaignName, { targetName, sourceName: action.name, actualHeal, newHp, maxHp });

        const hasPhysiciansTouch = playerStats.characterAdvancement?.some(f => f.name === "Physician's Touch");

        return {
            type: 'modal',
            modalName: 'handOfHealing',
            payload: {
                healName: action.name,
                formula,
                rolls,
                bonus: wisModifier,
                healAmount,
                monkName: playerStats.name,
                targetName,
                targetCurrentHp: newHp,
                targetMaxHp: maxHp,
                hasPhysiciansTouch,
            },
        };
    } else {
        // Generic non-monk healing
        healAmount = auto.healAmount || auto.healExpression;
        
        return {
            type: 'popup',
            payload: {
                type: 'healing',
                name: action.name,
                healAmount: typeof healAmount === 'number' ? healAmount : auto.healExpression,
                description: `${action.name}: Restores ${auto.healExpression} HP`,
            },
        };
    }
}

async function applyHealingDirectly(playerStats, targetName, amount, campaignName) {
    const maxHp = playerStats.hitPoints; // Simplified — for self-healing
    
    const storedHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
    
    const newHp = Math.min(maxHp, currentHp + amount);
    const actualHeal = newHp - currentHp;

    setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);

    if (targetName !== playerStats.name) {
        import('../../../services/applyHealing.js').then(ah => {
            import('../../../services/damageUtils.js').then(getCs => 
                getCs.getCombatContext(campaignName).then(cs => {
                    if (cs) ah.applyHealingToTarget(cs, targetName, amount, campaignName);
                })
            );
        });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { maxHp, newHp, actualHeal };
}
```

#### `buffHandler.js` — type: `'temp_buff'`

Current logic (CharActions.jsx lines 760-778): Toggle buff on/off in runtime state, notify UI.

```js
// handlers/buffHandler.js
import { toggleBuff } from '../common/buffToggle.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    
    const { isActive, wasActive } = toggleBuff(
        playerStats.name, 
        action.name, 
        auto,
        campaignName
    );

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive 
                ? `${action.name} toggled OFF` 
                : `${action.name} activated (${auto.duration || '10 min'})`,
            automation: auto,
        },
    };
}
```

Note: the `onBuffsChange()` callback comes from parent component. The handler doesn't call it — instead CharActions.jsx handles the result dispatches `'active-buffs-changed'` event that bubbled up to parent (use an SSE broadcast or a custom DOM event). Alternatively, make handlers accept extra callbacks via context. **Decision**: pass `callbacks: { notifyBuffsChanged? }` as part of the handler context.

#### `conditionHandler.js` — type: `'set_condition'`

Current logic (CharActions.jsx lines 1018-1081): Complex — resolves save DC, deducts Channel Divinity charges, gets map positions, opens SetConditionModal. ~63 lines.

```js
// handlers/conditionHandler.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getClassFeatures } from '../../../services/classFeatures.js';
import { getCombatContext } from '../../../services/damageUtils.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    // Resolve save DC
    const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
    const chaBonus = cha?.bonus || 0;
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + prof + chaBonus;
    
    const conditionName = auto.condition || 'frightened';
    const saveType = auto.saveType || 'WIS';
    const rangeFeet = parseInt(auto.range) || 60; // Consider using rangeToFeet helper

    // Check and deduct Channel Divinity charges
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const maxCharges = getClassFeatures(playerStats)?.maxChannelDivinity || 0;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    const newCharges = currentCharges - 1;
    setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);

    // Get combat summary and map positions for modal
    const cs = await getCombatContext(campaignName);
    
    let attackerPos = null;
    let mapData = null;
    if (mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, mapName);
            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (attackerPlayer) {
                attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
            }
        } catch { /* positions unavailable */ }
    }

    // Log the activation
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} activated — ${saveType} save DC ${saveDc}, all targets within ${rangeFeet} ft.`,
    }).catch(() => {});

    return {
        type: 'modal',
        modalName: 'setCondition',
        payload: {
            combatSummary: cs,
            attackerName: playerStats.name,
            attackerPos,
            saveDc,
            campaignName,
            mapData,
            featureName: action.name,
            conditionName,
            saveType,
            rangeFeet,
        },
    };
}
```

NOTE: The log entry (`addEntry`) is done here because it's fire-and-forget. Alternatively move it to the handler result and let CharActions handle all logging on result. **Decision**: keep logging in handlers for now — it's consistent with current behavior.

#### `sorceryHandler.js` — types: `'sorcery_aura'`, `'sorcery_incarnate'`

Current logic (CharActions.jsx lines 796-882): Checks innated sorcery uses, sets runtime state, calls buffService functions, dispatches events. ~86 lines.

```js
// handlers/sorceryHandler.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getClassFeatures } from '../../../services/classFeatures.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../../hooks/useMetamagic.js';
import { setInnateSorceryActive } from '../char-summary/buffService.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    // Handle sorcery_aura (uses-based activation)
    if (auto.type === 'sorcery_aura') {
        const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
        const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 2;
        const remaining = currentUses != null ? Number(currentUses) : usesMax;

        if (remaining <= 0) {
            return { type: 'popup', payload: { /* ... */ description: `${action.name} has no remaining uses. Recharges on a long rest.` }; }
        }

        const newRemaining = Math.max(0, remaining - 1);
        setRuntimeValue(playerStats.name, 'innateSorceryUses', newRemaining, campaignName);
        
        setInnateSorceryActive(playerStats.name, true, campaignName);
        window.dispatchEvent(new CustomEvent('innate-sorcery-updated'));

        return { type: 'popup', payload: { /* ... */ description: `${action.name} activated (${newRemaining}/${usesMax} uses remaining).` }; }
    }

    // Handle sorcery_incarnate (SP-spending activation)
    if (auto.type === 'sorcery_incarnate') {
        const cost = auto.cost || 2;
        const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
        const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 2;
        const remaining = currentUses != null ? Number(currentUses) : usesMax;
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));

        if (remaining > 0) {
            return { /* error: can't use while Innate Sorcery has remaining uses */ };
        }

        if (currentSP < cost) {
            return { /* error: not enough SP */ };
        }

        spendSorceryPoints(playerStats.name, cost, campaignName);
        
        setRuntimeValue(playerStats.name, 'innateSorceryUses', 0, campaignName);
        setInnateSorceryActive(playerStats.name, true, campaignName);
        window.dispatchEvent(new CustomEvent('innate-sorcery-updated'));

        return { /* success */ };
    }

    return null;
}
```

#### `spellCastHandler.js` — type: `'free_spell'`

Current logic (CharActions.jsx lines 726-758): Loads spell data, rolls damage if applicable, shows info popup. ~33 lines.

```js
// handlers/spellCastHandler.js
import { rollExpression } from '../../../services/diceRoller.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const spellName = auto.spell || action.name;
    
    // Load spell data
    let spellData = (playerStats.spellAbilities?.spells || []).find(s => s.name === spellName);
    if (!spellData) {
        try {
            const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
            const response = await fetch(spellsUrl);
            const allSpells = await response.json();
            spellData = allSpells.find(s => s.name === spellName);
        } catch (e) { /* fall through to description popup */ }
    }

    // If spell has damage, roll it
    if (spellData?.damage) {
        const slotDmg = spellData.damage.damage_at_slot_level;
        const formula = slotDmg?.[Object.keys(slotDmg)[0]];
        if (formula) {
            const result = rollExpression(formula);
            if (result) {
                return {
                    type: 'roll',
                    payload: {
                        rollType: 'damage',
                        name: spellName,
                        formula,
                        total: result.total,
                        rolls: result.rolls,
                        modifier: result.modifier,
                        context: {
                            damageType: spellData.damage.damage_type || 'Radiant',
                            attackerName: playerStats.name,
                        },
                    },
                };
            }
        }
    }

    // No damage or fetch failed — show info popup
    const usesInfo = auto.uses ? ` (${auto.uses}/long rest)` : '';
    return {
        type: 'popup',
        payload: {
            html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${usesInfo}`,
        },
    };
}
```

#### `initiativeHandler.js` — type: `'initiative_action'`

Current logic (CharActions.jsx lines 1021-1015): Checks long-rest uses, rolls martial arts die + heals, logs to SSE, shows popup. ~93 lines. This is also handled by a useEffect at the top of CharActions.jsx (lines 68-97) — that path triggers when initiative is rolled. The switch case handles manual activation from the UI.

```js
// handlers/initiativeHandler.js
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../../services/diceRoller.js';
import { logHealingToSSE } from '../common/healingRoll.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    if (auto.effect !== 'regain_focus_points_and_heal') {
        // Non-healing initiative action — show description
        return { type: 'popup', payload: { /* automation_info with description */ } };
    }

    // Check use tracking against long-rest limit
    const resourceKey = auto.resourceKey || action.name.toLowerCase().replace(/\s+/g, '') + 'Uses';
    const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? 0);
    
    if (usesUsed >= (auto.usesMax || auto.uses || 1)) {
        return { 
            type: 'popup', 
            payload: { /* error: already used, recharges on ${auto.recharge || 'short rest'} */ } };
    }

    // Roll martial arts die and heal
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const martialArtsDie = classLevel?.martial_arts_die || 4;
    
    const rollResult = rollExpression(`1d${martialArtsDie}`);
    if (!rollResult) return null;

    const healAmount = playerStats.level + rollResult.total;

    const currentHp = Number(getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName)) || 0;
    const maxHp = playerStats.hitPoints;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);

    // Increment use count
    setRuntimeValue(playerStats.name, resourceKey, usesUsed + 1, campaignName);

    logHealingToSSE(campaignName, { 
        targetName: playerStats.name, 
        sourceName: action.name, 
        actualHeal: newHp - currentHp, 
        newHp, maxHp 
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        type: 'popup',
        payload: {
            type: 'healing',
            name: action.name,
            formula: `1d${martialArtsDie} + ${playerStats.level}`,
            rolls: rollResult.rolls,
            bonus: playerStats.level,
            healAmount,
            targetName: playerStats.name,
            targetCurrentHp: newHp,
            targetMaxHp: maxHp,
        },
    };
}
```

#### `bonusAttackHandler.js` — types: `'bonus_attacks'`, `'bonus_action_attack'`
Simple info popup. ~10 lines.

#### `resourcePoolHandler.js` — type: `'resource_pool'`
Simple info popup. The actual resource management is done elsewhere (rest modals). ~5 lines.

#### `fontOfMagicHandler.js` — type: `'font_of_magic'`
Opens FontOfMagicModal. Return `{ type: 'modal', modalName: 'fontOfMagic' }`. ~8 lines.

#### `healingPoolHandler.js` — type: `'healing_pool'`
Opens HealingPoolModal with pool info + Restoring Touch support. Returns `{ type: 'modal', modalName: 'healingPool', payload: {...} }`. ~20 lines.

#### The remaining simple handlers: `extraActionHandler`, `combatStanceHandler`, `damageAuraHandler`, `attackRiderHandler`, `damageBonusHandler`, `spellModifierHandler`
These all boil down to: show an info popup with description, or trigger a specific modal (Metamagic). Each is 10-20 lines.

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
- [ ] Create `src/services/automation/contextBuilder.js` — extracted from CharActions.jsx
- [ ] Create `src/services/automation/handlers/saveOnlyHandler.js`
- [ ] Create `src/services/automation/handlers/saveAttackHandler.js`
- [ ] Create `src/services/automation/handlers/healingHandler.js`
- [ ] Create `src/services/automation/handlers/buffHandler.js`
- [ ] Create `src/services/automation/handlers/conditionHandler.js`
- [ ] Create `src/services/automation/handlers/sorceryHandler.js`
- [ ] Create `src/services/automation/handlers/spellCastHandler.js`
- [ ] Create `src/services/automation/handlers/initiativeHandler.js`
- [ ] Create `src/services/automation/handlers/bonusAttackHandler.js`
- [ ] Create `src/services/automation/handlers/resourcePoolHandler.js`
- [ ] Create `src/services/automation/handlers/fontOfMagicHandler.js`
- [ ] Create `src/services/automation/handlers/healingPoolHandler.js`
- [ ] Create `src/services/automation/handlers/extraActionHandler.js`
- [ ] Create `src/services/automation/handlers/combatStanceHandler.js`
- [ ] Create `src/services/automation/handlers/damageAuraHandler.js`
- [ ] Create `src/services/automation/handlers/attackRiderHandler.js`
- [ ] Create `src/services/automation/handlers/spellModifierHandler.js`
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
