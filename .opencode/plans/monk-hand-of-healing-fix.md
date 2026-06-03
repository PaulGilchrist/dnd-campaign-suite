# Fix: Monk Hand of Healing Shows 0 in Popup

## Problem
When clicking "Hand of Healing" automation for Monk class, the popup shows 0 instead of rolling the martial arts die and adding Wisdom modifier.

**Root Cause**: In `src/components/char-sheet/CharActions.jsx:490-501`, the `healing` case doesn't evaluate the `healExpression` for Monk features. The expression `"martial_arts_die + WIS modifier"` is passed through as a string, and since no `rolls` are provided, `DiceRollResult` shows `0` (empty array reduces to 0).

## Fix

Replace the `case 'healing':` / `case 'self_healing':` block (lines 490-502) with:

```javascript
case 'healing':
case 'self_healing': {
    // Handle Monk's Hand of Healing: healExpression "martial_arts_die + WIS modifier"
    const expression = auto.healExpression || '';
    const isMonkHealing = expression.includes('martial_arts_die') && expression.includes('WIS');

    if (isMonkHealing) {
        const monkFeatures = getClassFeatures(playerStats);
        const martialArtsDie = monkFeatures?.martialArtsDie || 4;
        const wisdom = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisModifier = wisdom?.bonus || 0;

        const rollResult = rollExpression(`${martialArtsDie}d1`);
        if (!rollResult) break;

        const healAmount = rollResult.total + wisModifier;

        if (setPopupHtml) {
            setPopupHtml({
                type: 'healing',
                name: action.name,
                formula: `${martialArtsDie}d1 + ${wisModifier}`,
                rolls: rollResult.rolls,
                bonus: wisModifier,
                modifier: 0,
                healAmount: healAmount,
                description: `${action.name}: Rolled ${rollResult.total} (${martialArtsDie}d1) + ${wisModifier} (WIS) = <strong>${healAmount}</strong> HP`,
            });
        }
    } else {
        const healAmount = auto.healAmount || auto.healExpression;
        if (setPopupHtml) {
            setPopupHtml({
                type: 'healing',
                name: action.name,
                healAmount: typeof healAmount === 'number' ? healAmount : auto.healExpression,
                description: `${action.name}: Restores ${auto.healExpression} HP`,
            });
        }
    }
    break;
}
```

## Changes Made
- Added detection for Monk healing expressions containing `martial_arts_die` and `WIS`
- Uses `getClassFeatures(playerStats)` to get `martialArtsDie` (already computed from playerStats)
- Retrieves Wisdom modifier from `playerStats.abilities`
- Rolls the die using `rollExpression()` and calculates total healing
- Passes `rolls` and `bonus` to `DiceRollResult` component for proper display
- Falls back to original behavior for non-Monk healing features

## Files Modified
- `src/components/char-sheet/CharActions.jsx` - Updated healing case handler

## Testing
1. Create/load a Monk character (2024 rules)
2. Click "Hand of Healing" in actions
3. Verify popup shows rolled value (martial arts die + WIS modifier) instead of 0
