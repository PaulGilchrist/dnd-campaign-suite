# Chef - Bolstering Treats: Implementation Plan

## Data Model

| Runtime Key | Owner | Type | Max | Set By |
|---|---|---|---|---|
| `chefBolsteringTreats` | Chef (feat holder) | cur/max | `playerStats.proficiency` | Long rest, short rest craft |
| `bolsteringTreat` | Any recipient | 0/1 | 1 | Chef distribution |

## File Changes

---

### 1. `public/data/2024/feats.json` (line 823)

**Change** Bolstering Treats `casting_time` from `"1 bonus action"` to `"passive"`.

This routes the automation into `specialActions` only (via `automationCollector.js` line 430-436 and `rules.js` line 1357-1358), removing it from `bonusActions` where it currently appears but isn't clickable. The distribution is handled inline in CharSpecialActions (like Replenishing Meal), not via the handler.

---

### 2. `src/services/combat/automation/automationService.js` (line 14-46)

**Add** `'temp_hp_buff'` to `INTERACTIVE_HANDLER_TYPES` Set.

This makes `isInteractiveAutomation()` return `true` for `temp_hp_buff` features, allowing them to be clickable in CharSpecialActions. Other `temp_hp_buff` features (Mantle of Inspiration, Vitality of the Tree) already work through `executeHandler`, so this change is safe.

---

### 3. `src/components/char-sheet/CharSpecialActions.jsx` — Distribution UI

**Following the Replenishing Meal pattern** (lines 102-146, 882-895):

**Detection** (near line 102):
```js
const hasBolsteringTreats = (playerStats.automation?.specialActions ?? []).some(
    p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
);
const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
const bolsteringTreatsMax = hasBolsteringTreats ? (playerStats.proficiency || 0) : 0;
```

**State** (near line 76):
```js
const [bolsteringTreatsModal, setBolsteringTreatsModal] = useState(null);
```

**Click handler** — mirrors `handleReplenishingMealClick` (lines 108-125):
- Guard: `cannotAct`, `!hasBolsteringTreats`, `current <= 0`
- Build target list from `characters` + `combatSummary.creatures` (excluding chef)
- Open `CreatureSelectionModal` with `maxTargets = current`

**Confirm handler** — mirrors `handleReplenishingMealConfirm` (lines 127-146):
- For each selected creature: `setRuntimeValue(name, 'bolsteringTreat', 1, campaignName)`
- Decrement chef: `setRuntimeValue(playerStats.name, 'chefBolsteringTreats', Math.max(0, current - count), campaignName)`
- Log via `addEntry()` with `type: 'ability_use'`, `abilityName: 'Bolstering Treats'`
- Show popup confirmation, close modal

**Routing in `handleAutomationClick`** (near line 279):
```js
if (auto?.type === 'temp_hp_buff' && auto?.craftCount) {
    handleBolsteringTreatsClick();
    return;
}
```
The `auto.craftCount` field distinguishes Bolstering Treats from other `temp_hp_buff` features.

**JSX** (near line 882): Render `CreatureSelectionModal` when `bolsteringTreatsModal` is non-null.

---

### 4. `src/components/char-sheet/char-summary/CharFeatFeatures.jsx`

**Add** tracked resources for both chef and recipients:

- **Chef**: Check if feat holder has `chefBolsteringTreats > 0`, show `TrackedResourceInput` with `resourceKey="chefBolsteringTreats"`, `getMax` returning `playerStats.proficiency`
- **Recipient**: Check if `bolsteringTreat > 0`, show `TrackedResourceInput` with `resourceKey="bolsteringTreat"`, `getMax` returning `1`
- Both only display when current > 0

---

### 5. `src/components/char-sheet/CharBonusActions.jsx` — Eat treat (tracked resource pattern)

**Following the ShortRestModal Replenishing Meal pattern** (lines 25-27, 141-146, 475-485):

**Detection** (near top of function):
```js
const bolsteringTreat = useRuntimeValue(playerStats.name, 'bolsteringTreat', campaignName);
const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
const hasBolsteringTreat = Number(bolsteringTreat ?? 0) > 0;
const hasChefBolsteringTreats = Number(chefBolsteringTreats ?? 0) > 0;
const showEatTreat = hasBolsteringTreat || hasChefBolsteringTreats;
```

**Click handler**:
```js
const handleEatBolsteringTreat = useCallback(async () => {
    if (cannotAct) return;
    const isChef = hasChefBolsteringTreats;
    const usesKey = isChef ? 'chefBolsteringTreats' : 'bolsteringTreat';
    const current = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
    if (current <= 0) return;
    
    const tempHpAmount = playerStats.proficiency || 0;
    const existingTempHp = Number(getRuntimeValue(playerStats.name, 'tempHp') || 0);
    setRuntimeValue(playerStats.name, 'tempHp', Math.max(existingTempHp, tempHpAmount), campaignName);
    setRuntimeValue(playerStats.name, usesKey, current - 1, campaignName);
    
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Bolstering Treat',
        description: `${playerStats.name} ate a bolstering treat, gaining ${tempHpAmount} temporary hit points.`,
        timestamp: Date.now(),
    }).catch(() => {});
    
    setPopupHtml(`<b>Bolstering Treat</b><br/>Gained ${tempHpAmount} temporary hit points. (${current - 1} treat${current - 1 !== 1 ? 's' : ''} remaining)<br/><span class="dice-roll-hint">click to dismiss</span>`);
}, [cannotAct, hasChefBolsteringTreats, playerStats, campaignName, setPopupHtml]);
```

**JSX** (near line 216, before the bonusActions list): Conditionally render:
```jsx
{showEatTreat && (
    <div>
        <b className="clickable" onClick={handleEatBolsteringTreat}>Eat Bolstering Treat:</b>
        <span>Eat treat to gain a number of Temporary Hit Points equal to your Proficiency Bonus.</span>
    </div>
)}
```

No automation check needed — purely driven by tracked resource, like `hasMeal` in ShortRestModal.

---

### 6. `src/services/rules/effects/restRules.js` (line 882-898)

**Already implemented** for chef (lines 882-889):
```js
const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
)
if (hasBolsteringTreats) {
    const craftCount = playerStats.proficiency || 0
    setRuntimeValue(name, 'chefBolsteringTreats', craftCount, campaignName, true)
}
```

**Add** clearing of recipient's treats on long rest (after line 889):
```js
setRuntimeValue(name, 'bolsteringTreat', null, campaignName, true)
```

This clears stale `bolsteringTreat` data for all characters on long rest. For the chef, this is overwritten by the line above. For recipients, it clears their distributed treat.

---

### 7. Campaign Logging

Both distribution and consumption use `addEntry()` from `src/services/ui/logService.js` with `type: 'ability_use'`, already registered in `Log.jsx` line 817 as `<AbilityUseEntry>`.

- **Distribution** (CharSpecialActions): `${playerName} distributed ${count} bolstering treat(s) to ${names.join(', ')}.`
- **Consumption** (CharBonusActions): `${playerName} ate a bolstering treat, gaining ${tempHp} temporary hit points.`

---

## No Changes Needed

| File | Reason |
|---|---|
| `tempHpBuffHandler.js` | Handler not called for distribution (inline in CharSpecialActions) or consumption (inline in CharBonusActions). Existing `handleBolsteringTreats` and `craftBolsteringTreats` remain for backward compat but are no longer the primary path. |
| `automationCollector.js` | Already routes `temp_hp_buff` to `specialActions` (line 430-436) |
| `Log.jsx` | Already renders `ability_use` entries (line 817) |
| `ShortRestModal.jsx` | Already handles crafting treats (lines 459-473) and long rest logging (line 908) |
| `restRules.js` long rest log | Already includes "Bolstering Treats" in resources list (line 908) |

---

## Flow Summary

### Distribution (Chef → CharSpecialActions):
1. Chef clicks "Bolstering Treats" in special actions
2. `CreatureSelectionModal` opens showing all creatures (excluding chef), max = remaining treats
3. Chef selects creatures and confirms
4. Each selected creature gets `bolsteringTreat = 1`, chef's `chefBolsteringTreats` decremented
5. Campaign log entry created

### Consumption (Anyone → CharBonusActions):
1. Character with treats > 0 sees "Eat Bolstering Treat" as clickable (tracked resource, no automation)
2. Click grants temp HP = proficiency bonus via `Math.max(existing, new)`
3. Treat count decremented; if < 1, display removed from CharFeatFeatures and CharBonusActions
4. Campaign log entry created
