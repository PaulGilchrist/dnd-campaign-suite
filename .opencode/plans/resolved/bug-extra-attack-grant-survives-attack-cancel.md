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

## Resolution
FIXED 2026-11-23 (fix run, dev pair :5173, test-campaign). Root cause confirmed as diagnosed: `useExtraAttackChain.beginExtraAttackChain()` both stamped the `_extraAttackGrantedTurn` latch and wrote the `automation/extra_attack` grant row at PRESS time, while the `attack-staged-cancelled` bus listener only nulled `chainRef.current` — so a Cancel dropped the chain but kept the spend and kept the (now false) grant assertion on the log.

Implemented the file's preferred Option 1 (§7.2 refund), with one deliberate scoping decision: **the refund fires only when the action never ADVANCED** (the cancelled popup is the pressed swing itself, `chain.grantLogged === false`). Once an earlier swing resolved, the Attack action is (partly) spent — the latch stays and the `attack_cancelled` row alone logs the voided swing (matches 5e: a committed attack is not undone by abandoning a later one). The grant row is no longer press-time at all: it is written by `logExtraAttackGrant()` on the FIRST chain advance — the moment the pressed swing has resolved (hit committed or miss drained) and the action is proven to proceed. A press cancelled before its first swing resolved therefore logs only its roll + `attack_cancelled` rows, never a grant row. (Logging at first advance rather than at `dice-roll-done` also covers MISS-only chains, which have no Done event but did genuinely resolve their attacks.)

Files changed:
- `src/components/char-sheet/useExtraAttackChain.js` — chain object carries `extraAttacks`/`grantLogged`; grant row moved from `beginExtraAttackChain` to `logExtraAttackGrant` (called from `advanceOrFinish`); `handleCancelled` clears the chain AND refunds the latch (`setRuntimeValue(playerName, '_extraAttackGrantedTurn', null)`) when nothing advanced; header comments record the refund doctrine; bus-effect deps extended to `[playerName, campaignName, setRuntimeValue]` per the sibling `useCharActionsEventListeners` convention.
- `src/components/char-sheet/useExtraAttackChain.test.jsx` — updated press/round-wrap/lv18 pins to the advance-time grant row (zero rows at press), extended the Cancel pin (no grant row + latch refund + same-turn re-press re-grants the FULL chain), and added a pin that cancelling a LATER swing keeps the latch (spent action). Dual-ruleset note: the chain module is ruleset-agnostic (`getExtraAttacks` reads both tables) — no 5e/2024 sibling needed changing. `_attackActionTakenRound`/slot stamps were NOT refunded (out of scope; they don't change the next press's swing count).

Verification:
- Unit: `npx vitest run src/components/char-sheet/useExtraAttackChain.test.jsx` → 14/14 green; `npx vitest run src/components/char-sheet/` → 613 files / 5686 tests green; adjacent siblings (`useCharActionsAttackHandlers.extraAttack`, `CharActions.attackDwell`, `AttackResultPopup.staged-cancel`, `AttackResultPopup.footer-button-names`) → 42/42 green. `npm run lint` → zero warnings.
- Live (test-campaign on :5173, clean-store start, FixtureFighter5e vs quick-spawned Goblin, `__forceNextD20` seam):
  1. Press 1 → two sequential popups commit, exactly ONE `extra_attack` row — now landing between swing 1's commit trio and swing 2's rows (advance-time, honest).
  2. `Next →` (active Goblin→AasimarTest), Press 2 forced nat-20 → **Cancel attack**: log tail = roll + `attack_cancelled` only, grant count STAYS 1 (no orphan row), latch reads `null` (refunded), chain drops.
  3. Press 3 same turn: **two** attack popups (26 crit HIT → Done → 21 HIT → Done, goblin hp_change rows), NEW grant row (count → 2), latch re-stamped `{round:1, activeCreature:"AasimarTest"}` — the re-press delivers the full 2-swing chain.
  Adjacent sanity held: same-turn double-press without a cancel still grants once (latch respected), MISS chains still advance + log one grant row.
- Closeout: browser closed, headless admin clear-change-data + clear-log, GET-verified cd `{}` + log `[]`; no monsters/characters/fixture files touched (char aggregate + npcs/inventory pins unaffected — only runtime buckets churned and were cleared).

Playbook-grade notes for the map owners: (1) the ZB coverage-row face "grant row at PRESS" is superseded — the row now rides the first chain advance, and a Cancelled-before-resolution press writes NO grant row and REFUNDS the `_extraAttackGrantedTurn` latch; (2) probe pitfall — a `.popup-modal` innerText census truncated at ~110 chars can cut the "vs AC" verdict out of a CRITICAL HIT line (the doubled-damage banner is longer); use ≥160 chars when counting attack faces.
