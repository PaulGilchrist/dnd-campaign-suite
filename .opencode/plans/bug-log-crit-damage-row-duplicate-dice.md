# Bug: Log view renders CRIT damage rows with the dice values duplicated

## Summary
Every critical-hit damage row in the Log view renders the rolled dice twice — e.g. `Slashing 1d6*2+2 (6) (6) 14`. The producer stores a display-formatted `formula` with the rolls already baked in (`formatDamageFormula(formula, rolls, true)` → `"1d6*2+2 (6)"`), while the Log renderer *additionally* prints `entry.rolls` inline right after the formula. Non-crit damage rows are clean because their stored `formula` is the bare authored expression (`"1d6+2"`).

## Steps to reproduce
1. In `test-campaign`, on the Initiative view, quick-spawn a Goblin (`+ Monster` → search `Goblin` → select row → `Spawn`).
2. Arm a target on the Goblin card (e.g. `select[aria-label="Goblin target"]` → FeyRanger).
3. Force a critical: in the page console set `Math.random` to return ~0.999 (d20 → 20), click the Scimitar dice chip in the monster card modal (`.mc-overlay`), press `Done` on the staged `Critical Hit! — damage dice doubled` popup, then restore `Math.random`.
4. Open the Log view and read the damage row for that commit.

## Expected behavior
The row shows the formula and the dice once, consistent with non-crit rows, e.g. `Slashing 1d6*2+2 (6) 14` or `Slashing 1d6*2+2 — (6) 14`.

## Actual behavior
The dice values print twice. Live-observed row (2026-11-20, run BBB):

```
log-entry log-roll
GoblinScimitar08:25:25 PM→ FeyRangerSlashing1d6*2+2 (6)(6)14
```

The wire row was honest: `{type:'roll', rollType:'damage', formula:'1d6*2+2 (6)', rolls:[6], total:14}` — a single `(6)` — so the duplication is purely in the Log view render. No console errors; the row's data is correct, the presentation is redundant.

## Likely location
Confident on the render seam, confident on the producer seam; the disagreement between them is the root cause:
- Renderer: `RollDiceValues` in `src/components/log/LogRollEntry.jsx` (~lines 209–225) renders `<span className="log-dice-formula">{entry.formula}</span>` followed by `<span className="log-dice-values-inline">({entry.rolls.join(', ')})</span>` — fine for authored formulas, duplicative when the formula already embeds the rolls.
- Producers that bake rolls into the stored `formula` on crits: `src/hooks/combat/handlers/handlePlainDamage.js:431`, `handleAutoMiss.js:68,110`, `handleNpcSaveDamage.js:345,373,406,470`, `src/hooks/combat/useLoggedDiceRollDamage.js:52` — all `isCrit ? formatDamageFormula(formula, rolls, true) : formula` (`formatDamageFormula` in `src/services/dice/diceRoller.js` appends ` (rolls)`).

No test pins the crit-shape render (`LogRoll.test.jsx` only pins `formula:'8d6'` + inline rolls, i.e. the non-crit shape), so this is an unowned interaction, not intended design.

## Suggested fix
Pick one owner for the dice display. Cheapest safe option: in `RollDiceValues`, suppress the inline rolls span when `entry.formula` already ends with the same dice annotation — or better, stop baking rolls into the stored `formula` on the producers and let `formatDamageFormula(..., true)` be a *popup/message-only* display concern, keeping the stored row byte `1d6*2+2` (renderer already shows rolls). If stored bytes must stay as-is (audit/export consumers may read `formula`), add a guard in the renderer: if `entry.formula` contains the `(${rolls.join(', ')})` tail, render the formula alone. Add a pin for the crit shape (formula ending with the rolls tail + rolls array) alongside the existing non-crit pin.

## Severity
Minor UX issue — no data corruption (wire bytes honest) and no functional loss, but every critical damage row in the shared audit trail displays a confusing doubled `(6) (6)`, and the app ships it on all crit lanes (monster chips and PC sheet both route through the same handlers).
