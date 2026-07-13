# Brutal Strike Automation Plan — Barbarian (2024 Rules)

## Session Context

**This plan covers Brutal Strike (level 9) and Improved Brutal Strike (levels 13, 17) for the 2024 Barbarian.** A new implementation session should read this plan top-to-bottom before touching any code.

**Key files the new session MUST read first:**
- `src/components/char-sheet/modals/shared/RecklessAttackModal.jsx` — Modal to modify (38 lines)
- `src/components/char-sheet/CharActions.jsx` lines 395-456 — Reckless Attack handlers
- `src/components/char-sheet/CharActionModals.jsx` lines 944-951 — Modal rendering
- `src/services/combat/steps/weaponDamageSteps.js` lines 416-516 — `automationBonuses` step (Brutal Strike damage)
- `src/services/automation/handlers/combat/attackRiderHandler.js` — Existing rider effect handler
- `src/services/combat/conditions/conditionEffects.js` lines 541-594 — How `targetEffects` are consumed
- `src/services/automation/contextBuilder.js` lines 241-254 — How `next_attack_advantage` is consumed
- `src/services/automation/common/oncePerTurn.js` — Once-per-turn utilities
- `public/data/2024/classes.json` lines 258-495 — Brutal Strike JSON definitions (levels 9, 13, 17)

---

## Pre-Existing Bugs to Fix

### Bug 1: Brutal Strike damage never applies (actions vs passives mismatch)

`weaponDamageSteps.js:508-512` filters `ctx.playerStats.automation.actions` for `attack_rider` with `strength_attack_hit_after_reckless`. But `automationCollector.js:417-426` routes `attack_rider` with `chooseOne`/`trigger` to `passives`, NOT `actions`. Result: the filter finds zero matches — Brutal Strike damage never applies.

**Fix:** Change line 509 to look at both `actions` and `passives`.

### Bug 2: Level 17 "Improved Brutal Strike" deduplicated

`rules.js:1070-1074` uses `lodash.uniqBy('name')` on `playerStats.specialActions`. At level 17, the passives array would contain:
1. "Brutal Strike" (level 9) — 1d10, chooseOne, 2 options
2. "Improved Brutal Strike" (level 13) — 1d10, chooseOne, 4 options
3. "Improved Brutal Strike" (level 17) — 2d10, maxEffects:2, 4 options

`uniqBy` keeps the first "Improved Brutal Strike" (level 13), removing the level 17 version. This loses the 2d10 damage and `maxEffects: 2`.

**Fix:** Rename the level 17 entry in `classes.json` to a distinct name (e.g., "Brutal Strike (Level 17)").

### Bug 3: Sundering Blow +5 bonus not implemented

`conditionEffects.js:546-551` handles `next_attack_advantage` by incrementing `attackAdvantageCount` (grants advantage). But Sundering Blow should grant a **+5 bonus** to the attack roll, not advantage. The `value: "+5_to_next_attack_vs_target"` in the JSON is not consumed by any code.

**Fix:** Add a new effect type (e.g., `next_attack_bonus`) that stores a numeric bonus, and consume it in `contextBuilder.js`.

---

## Feature Behavior by Level

| Level | Feature Name | Damage | Options | Select | Effects |
|-------|-------------|--------|---------|--------|---------|
| 9 | Brutal Strike | 1d10 | Forceful Blow, Hamstring Blow | Choose 1 (radio) | **Logging only** (movement) |
| 13 | Improved Brutal Strike | 1d10 | Forceful, Hamstring, Staggering, Sundering | Choose 1 (radio) | Staggering & Sundering **automated** via targetEffects |
| 17 | Brutal Strike (Level 17) | 2d10 | Forceful, Hamstring, Staggering, Sundering | Choose up to 2 (checkboxes) | Staggering & Sundering **automated** via targetEffects |

### Effect Automation Details

| Effect | JSON field | Automated? | How |
|--------|-----------|------------|-----|
| Forceful Blow | `push_15ft` | Logging only | — |
| Hamstring Blow | `speed_reduction` | Logging only | — |
| Staggering Blow | `disadvantage_on_next_save` + `noOpportunityAttacks: true` | **Yes** | Stored in `targetEffects` → consumed by `conditionEffects.js:542,580` |
| Sundering Blow | `next_attack_bonus` with value `5` | **Yes** (after Bug 3 fix) | Stored in `targetEffects` → consumed by `contextBuilder.js` (new code) |

---

## UI Design: Two-Mode Modal

`RecklessAttackModal` operates in two modes based on combat state:

### Mode 1: `full` — Neither Reckless nor Brutal Strike active
- Header: "Reckless Attack"
- Body: Reckless Attack description + Brutal Strike section (if feature exists)
- Brutal Strike section:
  - Checkbox: "Use Brutal Strike (forgo Advantage, +Nd10 damage)"
  - When checked, show effect choices:
    - Level 9-16: Radio buttons (choose 1 of 2 or 4)
    - Level 17: Checkboxes (choose up to 2 of 4)
  - Brief description under each option
- Buttons: "Attack Recklessly" / "Normal Attack"

### Mode 2: `brutalOnly` — Reckless already active, Brutal Strike unused
- Header: "Brutal Strike"
- Body: "Reckless Attack is already active. Use Brutal Strike on this attack?"
- Same effect choices as mode 1
- Buttons: "Apply Brutal Strike" / "Skip"

### Trigger Logic in CharActions.jsx

```js
// Case 1: Full modal (Reckless not yet active)
if (hasRecklessFeature && !isRecklessActive && !isOfferedThisTurn) {
    setModalState({ recklessAttackModal: { attack, mode: 'full', hasBrutalStrike, brutalStrikeOptions, maxEffects } });
    return;
}

// Case 2: Brutal-only modal (Reckless active, Brutal Strike remaining)
if (hasRecklessFeature && isRecklessActive && hasBrutalStrike && !brutalStrikeUsedThisTurn) {
    setModalState({ recklessAttackModal: { attack, mode: 'brutalOnly', hasBrutalStrike: true, brutalStrikeOptions, maxEffects } });
    return;
}
```

---

## Runtime State Keys

| Key | Set By | Read By | Cleared By |
|-----|--------|---------|------------|
| `_brutalStrikeActive` | CharActions (on confirm) | weaponDamageSteps (on hit) | weaponDamageSteps (after applying) |
| `_brutalStrikeEffects` | CharActions (on confirm) | weaponDamageSteps (on hit, for targetEffects) | weaponDamageSteps (after applying) |
| `_BrutalStrike_usedRound` | weaponDamageSteps (on hit) OR CharActions (on confirm) | CharActions (to check if used) | Auto-expires via round comparison |

### Cleanup Strategy

Mark Brutal Strike as **used when the player confirms it** (not when damage applies). This matches D&D rules: you declare the forgo, and it's done for the turn whether it hits or misses. Set both `_brutalStrikeActive` and `_BrutalStrike_usedRound` in the confirm handler.

---

## Implementation Steps

### Step 1: Fix classes.json deduplication

**File:** `public/data/2024/classes.json`

- Rename the level 17 feature from `"Improved Brutal Strike"` to `"Brutal Strike (Level 17)"` (line 459)
- This prevents `uniqBy('name')` from removing it

### Step 2: Fix Sundering Blow +5 bonus (Bug 3)

**Files:**
- `src/services/combat/conditions/conditionEffects.js` — Add `next_attack_bonus` handling
- `src/services/automation/contextBuilder.js` — Consume the bonus in attack roll calculation

**conditionEffects.js changes (~line 546):**
```js
if (te.effect === 'next_attack_bonus') {
    effects.attackBonus = (effects.attackBonus || 0) + (parseInt(te.value, 10) || 5);
}
```

**contextBuilder.js changes (~line 241):**
After the existing `next_attack_advantage` block, add a block that finds `next_attack_bonus` effects for the target and adds the bonus to the hit calculation. The bonus should be stored in the context result so the attack roll step can add it.

**Note:** Verify how `attackBonus` from `targetEffects` flows into the actual attack roll. Check `attackCalc2024.js` or the attack roll step to find where to inject the bonus.

### Step 3: Modify RecklessAttackModal.jsx

**File:** `src/components/char-sheet/modals/shared/RecklessAttackModal.jsx`

**New props:**
- `mode` — `'full'` | `'brutalOnly'`
- `hasBrutalStrike` — boolean
- `brutalStrikeOptions` — array of `{ name, effect, noOpportunityAttacks?, value? }`
- `maxEffects` — number (1 for level 9-16, 2 for level 17)
- `onConfirm(attack, brutalStrikeChoice)` — callback with `{ useBrutalStrike, effectChoices: string[] }`

**UI additions:**
- `useState` for `useBrutalStrike` (boolean) and `effectChoices` (array of selected option names)
- When `hasBrutalStrike` is true, render Brutal Strike section in the modal body
- When `maxEffects > 1`: render checkboxes; when `maxEffects === 1`: render radio buttons
- Effect descriptions (for display only):
  - Forceful Blow: "Push target 15 ft"
  - Hamstring Blow: "Reduce target Speed by 15 ft"
  - Staggering Blow: "Disadvantage on next save, no Opportunity Attacks"
  - Sundering Blow: "+5 to next attack against target"
- `onConfirm` passes `{ attack, useBrutalStrike, effectChoices }` to callback
- In `brutalOnly` mode: header changes to "Brutal Strike", body changes, confirm button says "Apply Brutal Strike"

### Step 4: Modify CharActions.jsx

**File:** `src/components/char-sheet/CharActions.jsx`

**`handleAttackClick` (~line 395):**
- Detect Brutal Strike from `playerStats.automation.passives`:
  ```js
  const brutalStrikePassives = (playerStats.automation?.passives || []).filter(
      p => p.type === 'attack_rider' && p.trigger === 'strength_attack_hit_after_reckless'
  );
  // Pick the highest-level version (last in array, since features are processed in level order)
  const brutalStrikePassive = brutalStrikePassives[brutalStrikePassives.length - 1];
  const hasBrutalStrike = !!brutalStrikePassive;
  const brutalStrikeOptions = brutalStrikePassive?.options || [];
  const maxEffects = brutalStrikePassive?.maxEffects || 1;
  ```
- Check if Brutal Strike was used this turn:
  ```js
  const brutalStrikeUsedKey = '_BrutalStrike_usedRound';
  const brutalStrikeUsedValue = getRuntimeValue(playerStats.name, brutalStrikeUsedKey, campaignName);
  const brutalStrikeUsedThisTurn = brutalStrikeUsedValue && brutalStrikeUsedValue.activeCreature === currentCreature;
  ```
- Add Case 2 (brutalOnly modal) after the existing Case 1

**`handleRecklessAttackConfirm` (~line 422):**
- Change signature to accept `brutalStrikeChoice` as second parameter
- After existing Reckless Attack activation:
  ```js
  if (brutalStrikeChoice?.useBrutalStrike) {
      setRuntimeValue(playerStats.name, '_brutalStrikeActive', true, campaignName);
      setRuntimeValue(playerStats.name, '_brutalStrikeEffects', brutalStrikeChoice.effectChoices, campaignName);
      // Mark as used immediately (matches D&D rules: once per turn, declared upfront)
      markOncePerTurn('Brutal Strike', '_BrutalStrike_usedRound', playerStats, campaignName);
  }
  ```

**New handler — `handleBrutalStrikeConfirm`:**
- For the `brutalOnly` mode (Reckless already active)
- Sets `_brutalStrikeActive`, `_brutalStrikeEffects`, marks `_BrutalStrike_usedRound`
- Closes modal, proceeds to attack roll

**New handler — `handleBrutalStrikeCancel`:**
- For the `brutalOnly` mode cancel
- Closes modal, proceeds to attack roll without Brutal Strike

### Step 5: Modify CharActionModals.jsx

**File:** `src/components/char-sheet/CharActionModals.jsx` (~line 944-951)

- Pass `mode`, `hasBrutalStrike`, `brutalStrikeOptions`, `maxEffects` from `modalState.recklessAttackModal`
- Route `onConfirm` to `handleRecklessAttackConfirm` (full mode) or `handleBrutalStrikeConfirm` (brutalOnly mode)
- Route `onCancel` to `handleRecklessAttackCancel` (full mode) or `handleBrutalStrikeCancel` (brutalOnly mode)

### Step 6: Fix and gate Brutal Strike damage in weaponDamageSteps.js

**File:** `src/services/combat/steps/weaponDamageSteps.js`

**Fix Bug 1 — Change line 508-512:**
```js
// attack_rider (Brutal Strike) — gated on _brutalStrikeActive
const brutalStrikeActive = getRuntimeValue(ctx.playerStats.name, '_brutalStrikeActive', ctx.campaignName);
if (brutalStrikeActive) {
    const allAutomation = [...(ctx.playerStats.automation.actions || []), ...(ctx.playerStats.automation.passives || [])];
    const matchingRiders = allAutomation.filter(
        x => x.type === 'attack_rider' && x.damageExpression && x.trigger === 'strength_attack_hit_after_reckless'
    );
    // Use the highest-level version (last match, since features are in level order)
    const rider = matchingRiders[matchingRiders.length - 1];
    if (rider) {
        const r = rollExpression(rider.damageExpression);
        if (r) {
            formula += ` + ${rider.damageExpression} [${rider.damageType || 'same_as_weapon'}]`;
            total += r.total;
            rolls = [...rolls, ...r.rolls];
        }

        // Apply chosen effects to target via targetEffects
        const effectChoices = getRuntimeValue(ctx.playerStats.name, '_brutalStrikeEffects', ctx.campaignName) || [];
        const targetName = ctx.targetName;
        if (effectChoices.length > 0 && targetName) {
            const storedEffects = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
            const riderOptions = rider.options || [];

            for (const choiceName of effectChoices) {
                const option = riderOptions.find(o => o.name === choiceName);
                if (!option) continue;

                // Staggering Blow and Sundering Blow are automated via targetEffects
                // Forceful Blow and Hamstring Blow are logging only
                if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
                    const newEffect = {
                        target: targetName,
                        source: ctx.playerStats.name,
                        option: option.name,
                        effect: option.effect,
                        value: option.effect === 'next_attack_bonus' ? 5 : (option.value || null),
                        noOpportunityAttacks: option.noOpportunityAttacks || false,
                        duration: 'until_start_of_next_turn',
                    };
                    storedEffects.push(newEffect);
                }
            }
            setRuntimeValue(ctx.campaignName, 'targetEffects', storedEffects, ctx.campaignName);
        }

        // Log to campaign log
        const effectNames = effectChoices.join(' + ') || 'no effect';
        addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ctx.playerStats.name,
            abilityName: rider.name,
            description: `${rider.name}: ${rider.damageExpression} ${rider.damageType === 'same_as_weapon' ? (ctx.attack?.damageType || 'weapon') : (rider.damageType || 'weapon')} damage to ${targetName || 'target'} — ${effectNames}`,
        }).catch(() => {});

        // Clear active flags
        setRuntimeValue(ctx.playerStats.name, '_brutalStrikeActive', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, '_brutalStrikeEffects', null, ctx.campaignName);
    }
}
```

**Also update the step condition (line 420):**
```js
condition: (ctx) => ctx.isMeleeOrUnarmed && (!!ctx.playerStats.automation?.actions || !!ctx.playerStats.automation?.passives),
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `public/data/2024/classes.json` | Edit | Rename level 17 feature to "Brutal Strike (Level 17)" |
| `src/services/combat/conditions/conditionEffects.js` | Edit | Add `next_attack_bonus` effect handling |
| `src/services/automation/contextBuilder.js` | Edit | Consume `next_attack_bonus` in attack roll calculation |
| `src/components/char-sheet/modals/shared/RecklessAttackModal.jsx` | Edit | Add Brutal Strike UI (checkbox, radio/checkbox effects, two modes) |
| `src/components/char-sheet/CharActions.jsx` | Edit | Pass Brutal Strike props, add handlers for both modes |
| `src/components/char-sheet/CharActionModals.jsx` | Edit | Pass new props to RecklessAttackModal, route callbacks |
| `src/services/combat/steps/weaponDamageSteps.js` | Edit | Fix actions→passives, gate damage, apply effects, log |
| `src/services/combat/steps/weaponDamageSteps-bonuses.test.js` | Edit | Update existing test + add new tests for gated behavior |
| `src/components/char-sheet/CharActions.stateModals.test.jsx` | Edit | Add tests for Brutal Strike modal props |

---

## Edge Cases

1. **First attack, no Reckless yet** → Full modal with Reckless + Brutal Strike
2. **First attack, Brutal Strike checked** → Reckless active + Brutal Strike flag set + `_BrutalStrike_usedRound` marked → attack rolls with advantage + 1d10/2d10 on hit
3. **First attack, Brutal Strike unchecked** → Reckless active, no Brutal Strike → attack rolls normally
4. **Second attack, Reckless active, Brutal Strike unused** → Brutal-only modal appears
5. **Second attack, Reckless active, Brutal Strike already used** → No modal, proceed to attack
6. **Brutal Strike checked, attack misses** → `_brutalStrikeUsedRound` already set (used for the turn), `_brutalStrikeActive` stays set but damage step doesn't run → clear in housekeeping or after pipeline
7. **Level 17, two effects selected** → Both stored in `targetEffects`, both applied
8. **Staggering Blow + Hamstring Blow at level 17** → Staggering automated, Hamstring logged only

---

## Execution Order

1. **Step 1** — Fix classes.json deduplication (trivial, no dependencies)
2. **Step 2** — Fix Sundering Blow +5 bonus (standalone, new effect type)
3. **Step 3** — Modify RecklessAttackModal.jsx (UI only, no logic changes)
4. **Step 4** — Modify CharActions.jsx (wiring, depends on Step 3)
5. **Step 5** — Modify CharActionModals.jsx (wiring, depends on Steps 3-4)
6. **Step 6** — Fix and gate Brutal Strike damage in weaponDamageSteps.js (core logic, depends on Steps 1-2)
7. **Step 7** — Update tests

After all steps: run `npm run lint` and `npm run test:run`.

---

## Testing Strategy

1. **Unit test** the `automationBonuses` step: verify damage is gated on `_brutalStrikeActive`
2. **Unit test** the RecklessAttackModal: verify checkbox/radio rendering for both modes
3. **Unit test** CharActions: verify runtime state is set correctly for both full and brutalOnly modes
4. **Unit test** `conditionEffects.js`: verify `next_attack_bonus` effect is consumed
5. **Integration test**: full flow from modal → attack → hit → damage + effects applied
