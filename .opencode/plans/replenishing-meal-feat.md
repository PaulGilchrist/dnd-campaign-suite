# Plan: Chef Feat — Replenishing Meal

## Summary

Implement the Chef feat's **Replenishing Meal** feature: track meals as cur/max, make it interactive in CharSpecialActions, distribute meals via CreatureSelectionModal, auto-apply +1d8 on first hit dice roll during short rest, and consume the meal. Reset meals on rest. Add campaign logging.

---

## Files to Modify

### 1. `public/data/2024/feats.json` (line ~804)
**Change `casting_time` from `"1 action"` to `"passive"`** so the Replenishing Meal benefit routes to `specialActions` instead of `actions`.

```diff
- "casting_time": "1 action"
+ "casting_time": "passive"
```

### 2. `src/services/combat/automation/automationService.js` (line ~48)
**Add `"healing_bonus"` to `INTERACTIVE_PASSIVE_EFFECTS`** so the feature becomes clickable in CharSpecialActions.

```diff
 const INTERACTIVE_PASSIVE_EFFECTS = new Set([
     'abjuration_savant',
     'divination_savant',
     'evocation_savant',
     'illusion_savant',
     'persistent_rage',
     'superior_defense',
+    'healing_bonus',
 ]);
```

### 3. NEW: `src/components/char-sheet/char-summary/CharFeatFeatures.jsx`
**Create a new component** to display feat-tracked resources (cur/max) under CharClassFeatures.

- Import `TrackedResourceInput` from `./TrackedResourceInput.jsx`
- Import `useRuntimeValue` from `../../../hooks/runtime/useRuntimeState.js`
- Render `Replenishing Meal` TrackedResourceInput when `replenishingMealReceived > 0` (for recipients)
- Render `Replenishing Meal` TrackedResourceInput for the Chef (cur/max, max = 4 + proficiency bonus)
- Only render when current > 0 for recipients; always render for the Chef when they have the feat

```jsx
// Props: { playerStats, campaignName }
// For the Chef (has Replenishing Meal feat):
//   <TrackedResourceInput label="Replenishing Meals" resourceKey="chefReplenishingMeals"
//     playerName={playerStats.name} getMax={() => 4 + (playerStats.proficiency || 0)}
//     deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
//
// For any creature that received a meal:
//   Render when replenishingMealReceived > 0
//   <TrackedResourceInput label="Replenishing Meal" resourceKey="replenishingMealReceived"
//     playerName={playerStats.name} getMax={() => 1}
//     deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
```

**Detection logic:**
- Chef detection: `(playerStats.automation?.passives ?? []).some(p => p.type === 'healing_bonus' && p.name === 'Replenishing Meal')`
- Recipient detection: `useRuntimeValue(playerStats.name, 'replenishingMealReceived', campaignName)` — if value > 0, show it

### 4. `src/components/char-sheet/char-summary/CharSummary.jsx` (line ~513)
**Render CharFeatFeatures** immediately after CharClassFeatures.

```diff
  <CharClassFeatures playerStats={playerStats} campaignName={campaignName} />
+ <CharFeatFeatures playerStats={playerStats} campaignName={campaignName} />
  <CharRaceFeatures playerStats={playerStats} campaignName={campaignName} />
```

### 5. `src/components/char-sheet/CharSpecialActions.jsx`
**Add click handler for Replenishing Meal** to open CreatureSelectionModal and distribute meals.

**State additions:**
- `const [replenishingMealModal, setReplenishingMealModal] = useState(null);`

**Detection in the component body:**
```js
const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'healing_bonus' && p.name === 'Replenishing Meal'
);
const replenishingMealCur = useRuntimeValue(playerStats.name, 'chefReplenishingMeals', campaignName);
const replenishingMealMax = hasReplenishingMeal ? 4 + (playerStats.proficiency || 0) : 0;
```

**Handler — distribute meals:**
```js
const handleReplenishingMealClick = async () => {
    if (cannotAct) return;
    if (!hasReplenishingMeal) return;
    const current = Number(replenishingMealCur ?? replenishingMealMax);
    if (current <= 0) {
        setPopupHtml('<b>Replenishing Meal</b><br/>No meals remaining.<br/><span class="dice-roll-hint">click to dismiss</span>');
        return;
    }
    // Build creature list from combatSummary + characters
    const combatSummary = await getCombatContext(campaignName);
    const allCreatures = [
        ...(characters || []).map(c => ({ name: c.name, type: 'player' })),
        ...(combatSummary?.creatures || []).filter(c => c.type !== 'player').map(c => ({ name: c.name, type: 'monster' }))
    ];
    // Dedupe by name
    const seen = new Set();
    const targets = allCreatures.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
    setReplenishingMealModal({ targets, maxTargets: current });
};

const handleReplenishingMealConfirm = async (selectedNames) => {
    if (!replenishingMealModal) return;
    const { maxTargets } = replenishingMealModal;
    const count = Math.min(selectedNames.length, maxTargets);
    // Set each recipient's meal to 1
    for (const name of selectedNames.slice(0, count)) {
        setRuntimeValue(name, 'replenishingMealReceived', 1, campaignName);
    }
    // Decrease chef's meals
    const current = Number(replenishingMealCur ?? replenishingMealMax);
    setRuntimeValue(playerStats.name, 'chefReplenishingMeals', current - count, campaignName);
    // Log
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Replenishing Meal',
        description: `${playerStats.name} distributed ${count} replenishing meal${count > 1 ? 's' : ''} to ${selectedNames.slice(0, count).join(', ')}.`,
        timestamp: Date.now(),
    }).catch(() => {});
    // Popup
    const html = `<b>Replenishing Meal</b><br/>Granted ${count} meal${count > 1 ? 's' : ''} to: ${selectedNames.slice(0, count).join(', ')}.<br/><span class="dice-roll-hint">click to dismiss</span>`;
    setPopupHtml(html);
    setReplenishingMealModal(null);
};
```

**Rendering in the click handler (`handleAutomationClick`):**
Add a case for `healing_bonus` type before the generic `executeHandler` call:
```js
if (auto?.type === 'healing_bonus') {
    handleReplenishingMealClick();
    return;
}
```

**JSX — render the CreatureSelectionModal:**
```jsx
{replenishingMealModal && (
    <CreatureSelectionModal
        title="Replenishing Meal"
        icon="fa-utensils"
        targets={replenishingMealModal.targets}
        maxTargets={replenishingMealModal.maxTargets}
        description="Choose creatures to receive a replenishing meal."
        note="Each creature can hold at most 1 meal. During a Short Rest, a creature that eats the meal and rolls a Hit Die gains extra 1d8 HP."
        confirmLabel="Distribute Meals"
        confirmIcon="fa-utensils"
        onConfirm={handleReplenishingMealConfirm}
        onSkip={() => setReplenishingMealModal(null)}
    />
)}
```

**Note:** `getCombatContext` needs to be imported from `'../../services/rules/combat/damageUtils.js'` (already used elsewhere in the file).

### 6. `src/components/char-sheet/ShortRestModal.jsx`
**Auto-apply +1d8 on the first hit dice roll if the creature has a replenishing meal, then consume it.**

**Detection at the top of the component:**
```js
const hasMeal = Number(getRuntimeValue(playerStats.name, 'replenishingMealReceived', campaignName) ?? 0) > 0;
const [mealConsumed, setMealConsumed] = React.useState(false);
```

**Modify `handleRollOne` (line ~133):**
```js
const handleRollOne = () => {
    if (remainingHitDice <= 0) return;
    const { total, rolls } = rollDice(1, hitDie);
    let hp = computeHitDieRecovery(total, conBonus);
    if (hasMeal && !mealConsumed) {
        const { total: mealTotal } = rollDice(1, 8);
        const mealBonus = Math.max(1, mealTotal);
        hp += mealBonus;
        setMealConsumed(true);
        setRuntimeValue(playerStats.name, 'replenishingMealReceived', 0, campaignName);
    }
    setRemainingHitDice(prev => prev - 1);
    setRecoveredHp(prev => prev + hp);
    setRollLog(prev => [...prev, { roll: rolls[0], hp }]);
};
```

**Modify `handleRollAll` (line ~142):**
```js
const handleRollAll = () => {
    if (remainingHitDice <= 0) return;
    let totalHp = 0;
    let newRolls = [];
    let mealApplied = false;
    for (let i = 0; i < remainingHitDice; i++) {
        const { total, rolls } = rollDice(1, hitDie);
        let hp = computeHitDieRecovery(total, conBonus);
        if (hasMeal && !mealApplied) {
            const { total: mealTotal } = rollDice(1, 8);
            const mealBonus = Math.max(1, mealTotal);
            hp += mealBonus;
            mealApplied = true;
            setMealConsumed(true);
            setRuntimeValue(playerStats.name, 'replenishingMealReceived', 0, campaignName);
        }
        totalHp += hp;
        newRolls.push({ roll: rolls[0], hp });
    }
    setRemainingHitDice(0);
    setRecoveredHp(prev => prev + totalHp);
    setRollLog(prev => [...prev, ...newRolls]);
};
```

**Modify `handleComplete` (line ~221) — add meal consumption to log entries:**
```js
// After existing roll logging, add:
if (mealConsumed) {
    logEntries.push(`Replenishing Meal consumed: +1d8 HP`);
}
```

**Add a "Replenishing Meal" section in the UI** (between Song of Rest and Sorcerous Restoration, or similar) to show the meal bonus was applied:
```jsx
{hasMeal && !mealConsumed && (
    <div className="short-rest-section">
        <h4>Replenishing Meal</h4>
        <p>Your next Hit Die roll gains +1d8 HP. The meal will be consumed.</p>
    </div>
)}
{mealConsumed && (
    <div className="short-rest-section">
        <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Replenishing Meal consumed (+1d8 HP)</span>
    </div>
)}
```

**Import needed:** `rollDice` is already imported. `getCombatContext` is already imported.

### 7. `src/services/rules/effects/restRules.js`
**Reset replenishing meals on long rest** (near line ~873 where bolstering treats are handled).

```js
// Chef: Replenishing Meals reset on Long Rest
const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'healing_bonus' && p.name === 'Replenishing Meal'
)
if (hasReplenishingMeal) {
    const mealMax = 4 + (playerStats.proficiency || 0)
    setRuntimeValue(name, 'chefReplenishingMeals', mealMax, campaignName, true)
}
```

**Also add to the long rest log resources list (line ~890):**
```js
if (hasReplenishingMeal) resources.push('Replenishing Meals');
```

**Short rest reset** — The user said "Resets the replenishing meals of the player with the feat to 4 plus your Proficiency Bonus on short rest or long rest." This means the Chef's meals reset to max on short rest too. This needs to happen in `applyShortRest` or at the end of the short rest flow. Since `applyShortRest` is in restRules.js, add the reset there:

In `applyShortRest` (around line ~225), add:
```js
// Chef: Replenishing Meals reset on Short Rest
const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'healing_bonus' && p.name === 'Replenishing Meal'
)
if (hasReplenishingMeal) {
    const mealMax = 4 + (playerStats.proficiency || 0)
    setRuntimeValue(name, 'chefReplenishingMeals', mealMax, campaignName, true)
}
```

### 8. `src/components/log/Log.jsx`
**No changes needed.** The `ability_use` type is already registered (line 817) and renders via `AbilityUseEntry`. The `short_rest` type is also registered (line 818) and renders via `RestEntry`. Both are already in the log rendering switch.

---

## Runtime State Keys

| Key | Owner | Description |
|-----|-------|-------------|
| `chefReplenishingMeals` | Chef player | Current number of meals available (cur/max, max = 4 + proficiency) |
| `replenishingMealReceived` | Any creature | Whether this creature has a meal (1 = yes, 0 = no). Max 1 per creature. |

---

## Campaign Log Entries

| Event | Type | Example |
|-------|------|---------|
| Meal distribution | `ability_use` | "Chef distributed 2 replenishing meals to Fighter, Rogue." |
| Meal consumed (short rest) | Included in `short_rest` message | "... \| Replenishing Meal consumed: +1d8 HP" |
| Long rest (meal reset) | Included in `long_rest` message | "Resources restored: ... Replenishing Meals" |

---

## Verification

1. **Lint:** `npm run lint` — zero warnings
2. **Tests:** `npm run test:run` — all existing tests pass
3. **Manual testing:**
   - Give a character the Chef feat
   - Verify Replenishing Meal shows in CharSpecialActions (not CharActions)
   - Verify CharFeatFeatures shows in CharSummary with cur/max
   - Click Replenishing Meal → CreatureSelectionModal opens
   - Distribute meals → log entry created, Chef's meals decrease, recipients show meal in their CharFeatFeatures
   - Recipient takes short rest → first hit dice roll gets +1d8, meal consumed, log entry
   - Chef takes short rest → meals reset to max
   - Chef takes long rest → meals reset to max
