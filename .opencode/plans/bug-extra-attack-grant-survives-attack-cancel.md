# bug: Extra Attack grant row + turn latch survive an attack Cancel — same-turn re-press is short-changed, log claims voided attacks

## Summary
The new Extra Attack chain (shipped 2026-11-23, `ebcf5345b`) stamps its per-turn grant (`_extraAttackGrantedTurn` runtime latch + an `automation/extra_attack` log row) at PRESS time. Cancelling the staged attack — which the app's own `attack_cancelled` row declares "staged damage voided, no damage applied" — never refunds either artifact. The log therefore carries an orphan row claiming "2 weapon attacks" for an action that was voided, and a legitimate re-press the same turn silently gets only ONE swing because the latch still says the Attack action's extra swings were already granted.

## Steps to reproduce
Start from an empty test-campaign store (change-data `{}`, log `[]`).
1. In test-campaign, mount Initiative (bakes the 14-PC skeleton board), quick-spawn a Goblin (`+ Monster` → search Goblin → select row → `Spawn`), arm FixtureFighter5e's target select to Goblin.
2. Open FixtureFighter5e's sheet; press the Longsword row (`div.left.clickable`). Swing 1 + swing 2 popups appear sequentially; DONE both (two roll rows + one `extra_attack` grant row are logged; latch `{round:1, activeCreature:<active>}` stamped).
3. Press `Next →` on the Initiative toolbar so `activeCreatureName` moves (e.g. Goblin → AasimarTest) — the latch now mismatches, so a fresh press re-grants.
4. Back on the sheet, press Longsword again. When the swing-1 popup shows a **HIT** (buttons `Done` / `Cancel attack`), click **Cancel attack**. Observed: `extra_attack` grant row logged AGAIN, one `roll` row, one `attack_cancelled` row "…staged damage voided, no damage applied", no swing-2 popup (chain correctly dropped).
5. WITHOUT changing turn/round, press Longsword a third time. Observe: swing 1 rolls and commits, but **no swing 2 chain** and **no new `extra_attack` grant row** — the re-press is short-changed to one attack although the previous action was fully voided.

## Expected behavior
Per the app's own press-lane doctrine (`useCharActionsAttackHandlers.js` header: "denied refusals must not consume economy — plan §7.2 semantics") and the Cancel-is-a-full-revert face witnessed in prior rides (YG run: "Cancel attack = verbatim attack_cancelled row, zero writes" for the bucket), a cancelled staged attack should leave the turn's Extra Attack grant available for the retry, and the `extra_attack` grant row should only assert attacks that actually resolve (or be written at chain completion, not at press).

## Actual behavior
Live-verified 2026-11-23 (dev pair :5173, test-campaign):
- After step 4: log tail = `extra_attack` grant ("… 2 weapon attacks with Longsword") + `roll` + `attack_cancelled` ("staged damage voided, no damage applied"). Latch reads `{round:1, activeCreature:"AasimarTest"}`.
- Step 5: popup swing 1 (d20 15 +6 → 21 HIT), Done commits (roll + hp_change + damage roll rows), **no swing-2 popup**, grant count stays 2 (no new grant). One cancelled press consumed the turn's extra-swing budget outright.
- Contradictory audit: the log shows an Attack action asserting 2 attacks, then its voiding, then a same-turn re-press that delivers 1 attack with no grant row.

## Likely location
`src/components/char-sheet/useExtraAttackChain.js`:
- `beginExtraAttackChain()` writes the latch (`grantAttackActionBudget()`) and `addEntry(...extra_attack...)` at PRESS time.
- The `attack-staged-cancelled` bus listener only nulls `chainRef.current` — it never clears the durable runtime latch nor any grant-row compensation.
Note the author comment: "cancelling the action leaves the remaining swings unused" — so the latch retention MAY be intended; but it contradicts (a) the §7.2 no-consume-on-void semantics cited in the sibling handler and (b) makes the press-time grant row factually false for voided actions. Also note there is no refund lane today for ANY press-time stamp on cancel (`_attackActionTakenRound` survives too) — the extra-attack latch is the first one that changes the player's NEXT attack's swing count, which is where the shortfall bites.

## Suggested fix
Decide + implement one of:
1. **Refund on cancel** (preferred, matches §7.2): in the `handleCancelled` bus listener, also `setRuntimeValue(playerName, '_extraAttackGrantedTurn', null)` so a re-press re-grants; optionally log the grant row only when the FIRST swing commits (`dice-roll-done`) rather than at press.
2. Or make the grant honest at press: reword the row to "declares the Attack action" and accept the shortfall — but then the sibling `attack_cancelled` wording ("voided") should say the action was forfeited.
Add a unit pin on the cancel→re-press double-press sequence (the existing `useCharActionsAttackHandlers.extraAttack.test.js` covers press/re-press but not cancel→re-press swing counts).

## Severity
Minor UX issue with a data-integrity edge: the board remains consistent (no phantom HP/state), but the campaign log asserts attacks that were voided and the player loses a rules-entitled swing on a legitimate retry. Low frequency (requires Cancel mid-chain), but it is exactly the "close-but-not-exact" audit honesty the project doctrine rejects.
