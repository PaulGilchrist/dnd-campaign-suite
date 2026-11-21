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

## Resolution
**FIXED 2026-11-20** (renderer-side fix; the producer guess confirmed, the "stop baking" suggestion deliberately NOT taken).

### What was actually wrong
Root cause matched the diagnosis: crit producers bake the rolled dice into the stored `formula` via `formatDamageFormula(formula, rolls, true)` → `"1d6*2+2 (6)"` (the documented, owner-pinned crit wire shape — playbook "Crit damage lane log shape", and the spell-lane note that source-marking "would strip the `(N)` roll list"), while `RollDiceValues` in `src/components/log/LogRollEntry.jsx` additionally printed `entry.rolls` inline right after the formula → `1d6*2+2 (6)(6)14`. Non-crit rows are clean because their stored formula is the bare authored expression.

### Which owner was picked
The **renderer** is the fix owner. The baked-roll formula is canonical wire data: `attackRollDamageCalc-crit-ledger-shape.test.js` and the playbook pin the `1d6*2+1 (N)` shape, and `docs/test-setup-playbook.md` §"Crit damage lane log shape" instructs future crit proofs to pin it. Changing the producers would rewrite the audit trail's stored bytes — the bug file's own fallback option ("if stored bytes must stay as-is … add a guard in the renderer") is the right one. Verified across all producers that every baked tail uses the SAME array as the entry's `rolls` (handlePlainDamage non-GWF, handleAutoMiss, handleNpcSaveDamage primary/twin/multi, useLoggedDiceRollDamage immunity), so an **exact tail match** covers every duplicating lane; the one lane where they legitimately differ (GWF: `displayRolls` doubled pool vs baked base rolls) is left untouched and keeps rendering both.

### Files changed
- `src/components/log/LogRollEntry.jsx` — new `formulaAlreadyShowsRolls(entry)` guard (`entry.formula.endsWith('(' + rolls.join(', ') + ')')`); the `.log-dice-values-inline` span is suppressed only on an exact duplicate. Dual-ruleset: the renderer is shared by both 5e and 2024 lanes; no sibling module needs the fix (producers unchanged).
- `src/components/log/LogRoll.test.jsx` — new pin "renders crit damage dice once when the stored formula already ends with the rolls annotation": crit damage row (`1d6*2+2 (6)` + `rolls:[6]`) and crit save-damage row render formula+total with NO inline span; GWF-mismatch row (`2d6*2+1 (5, 3)` + `rolls:[5,3,5,3]`) still renders its inline `(5, 3, 5, 3)`; existing non-crit pin extended in the same family file.

### How verified
1. **Live repro (before fix):** dev pair (`CAMPAIGN_LOCK=test-campaign npm run dev`), :5173, quick-spawned Goblin armed at FeyRanger, value-slot `Math.random` 0.999 → staged `CRITICAL HIT! — DAMAGE DICE DOUBLED ✓ HIT (24 vs AC 12)` → Done. Wire row honest (`formula "1d6*2+2 (6)"`, `rolls:[6]`, `total:14`); Log view row rendered `Slashing1d6*2+2 (6)(6)14` (`.log-dice-formula "1d6*2+2 (6)"` + `.log-dice-values-inline "(6)"`). Bug confirmed exactly as filed.
2. **Live re-verify (after fix, HMR):** the stored crit row re-rendered as `Slashing1d6*2+2 (6)14` — inline span gone, total intact. Fresh crit commit #2 (same rig) produced a new row byte-identical in the fixed shape. Non-crit control commit (pinned 0.5 → `d20 11 … ✓ HIT (15 vs AC 12)`): row renders `1d6 + 2` + inline `(4)` + total 6 — adjacent behavior unchanged. Zero app console errors (the single error line was the harness's own bad selector).
3. **Tests:** `npx vitest run src/components/log/LogRoll.test.jsx` 30/30 green (incl. new crit pin); full folder `npx vitest run src/components/log/` 20 files / 286 tests green.
4. **Lint:** `npm run lint` clean (zero warnings).
5. **Cleanup:** admin clear-log + clear-change-data POSTed from localhost; closed-tab GET-verified `log []` + `change-data {}`, disk cd/log files ABSENT, owner fixtures untouched; dev pair killed by recorded PIDs with all SSE clients drained (`destroyed: true`).
