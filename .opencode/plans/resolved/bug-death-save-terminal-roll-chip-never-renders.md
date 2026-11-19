# Death-save result chip never renders on life-ending rolls (NAT 20 / fatal 3rd failure)

## Summary
The sheet Death-Saves block is designed to show a per-roll result chip (`(20) NAT 20 Success`) with a 2000 ms dwell after every roll. On rolls that END the dying state — a natural 20 (restore to 1 HP) or any roll landing the 3rd failure (DEAD) — the chip never enters the DOM at all, so the NAT 20 celebration face and the instant-death face are unobservable live. Only unit tests pin these faces.

## Steps to reproduce
1. In `test-campaign` on localhost:5173, open the EvasiveFighter sheet.
2. Drop HP to 0 (click the `Hit Points: 112/112 (cur/max)` row → native-setter `0` + Enter). The Death Saves block mounts with the Roll control.
3. (Optional controlled rig, ~75% terminal per press) scoped PATCH the bucket to a nearly-fatal track:
   `PATCH /api/campaigns/test-campaign/EvasiveFighter` body `{"value":{"currentHitPoints":0,"isDead":0,"deathSaves":[false,false,false],"deathFailures":[true,true,false]}}`
4. Attach a `MutationObserver` for `.death-saves-result` (subtree), then click `div.death-saves-roll[role=button]`.
5. Press once. Repeat for several lives; over ~30 organic rolls NAT 20s did occur (log rows `isNatural20:true`).

## Expected behavior
`LastRollResult` mounts with the `(roll)` + `NAT 20`/`NAT 1` + Success/Failure chip for its 2000 ms dwell on EVERY roll, including the terminal ones (this is exactly what `DeathSavingThrows.test.jsx` pins for `isNat20`/`isNat1` results).

## Actual behavior
- Non-terminal rolls: chip mounts ~1 ms after the press (`add@1` in the observer) and polls see it — normal.
- Fatal 3rd-failure rolls: the observer recorded either NO add/remove at all (round 0) or only a removal of the pre-existing subtree at ~1 ms (round 2); DOM polling (60 ms × 25) never saw `.death-saves-result`. The container is already the DEAD-badge branch.
- NAT 20 rolls: 3/3 occurrences (log rows `roll:20, isNatural20:true, success:true`) — chip never observed in DOM; the block unmounts (`Hit Points: 1/112` immediately).
- The underlying state/log is honest in every case (`death_save` roll row + `result:'dead'` row; tracks reset; HP 0→1) — only the chip face is lost.

## Likely location
Confident: `src/components/char-sheet/char-summary/DeathSavingThrows.jsx` `rollDeathSave()` — `setLastRoll(...)` and the terminal runtime writes (`isDead` line ~156, `currentHitPoints = restoredToHp` line ~136, tracks lines 166-167) land in the same React batch (the runtime store mirror updates optimistically, so the `isDead`/HP-driven re-render is in the SAME commit): the final commit renders the DEAD-badge branch (chip lives in the non-dead branch) or, for NAT 20, `CharHitPoints.jsx`'s `currentHitPoints <= 0 && <DeathSavingThrows/>` gate removes the whole block — React never creates the chip node.

## Suggested fix
Do NOT defer the game-state writes — the no-timers policy forbids delaying `isDead`/HP on a wall-clock dwell. Instead relocate the dwell host: `CharHitPoints.jsx` already listens for the `death-save-result` window event — let it (or CharSummary) render the LastRollResult chip OUTSIDE the `currentHitPoints <= 0` gate / outside the branch swap, so terminal results still paint their chip for the 2 s. Keep an aria-live/label so the NAT 20 moment reads to screen readers too. Check whether the monster-prompt modal lane (`DeathSavePromptModal`) shares the pattern.

## Severity
Minor UX issue — no state corruption (log rows, tracks, HP are all honest and pinned); the feedback face the component explicitly designs (2 s dwell) silently doesn't exist for exactly the two most dramatic outcomes.

## Resolution
**FIXED 2026-11-19 (subagent fix run).**

**Root cause — the "Likely location" guess was confirmed exactly against the code.** `rollDeathSave()` set the chip's local `lastRoll` state and then synchronously wrote the terminal runtime keys (`isDead` on the fatal 3rd failure; `currentHitPoints` on NAT 20) in the same event-handler batch. The runtime mirror notifies optimistically, so React's ONLY commit rendered either the DEAD-badge branch (which never included `{lastRoll && <LastRollResult/>}`) or, for NAT 20, `CharHitPoints`' `currentHitPoints <= 0 && <DeathSavingThrows/>` gate unmounted the whole block — the chip DOM node was never created. Live repro pre-fix (test-campaign, forced rolls via a scoped `Math.random` override — `rollD20` is `Math.floor(Math.random()*20)+1`, so a click-window patch makes terminal rolls deterministic): fatal roll → observer recorded ZERO add/remove of `.death-saves-result`, 0/25 polls saw it, DEAD badge + honest rows present; NAT 20 → same zero census, HP 0→1, block unmounted. Non-terminal control on the same build: `add@1` ms, chip `(7)Failure` seen — bug reproduced as filed.

**Fix — relocated the dwell host, per the suggested direction (no game-state writes were delayed).**
- `CharHitPoints.jsx` (never unmounts) now owns `lastRoll` state + the benign 2000 ms dwell (`setLastRoll`, an existing no-timers-guard benign category) and renders `LastRollResult` (moved here, with `role="status"` so terminal moments announce to AT) OUTSIDE the `currentHitPoints <= 0` gate / branch swap. Its pre-existing `death-save-result` window listener now also paints the chip (modal-driven rolls — the old DeathSavingThrows listener role, fixing the same crush for that lane) and guards chip paint on `e.detail.roll != null` so bare restore events (HP lift only) paint no ghost chip.
- `DeathSavingThrows.jsx` lost the chip, its local state/listener/timer, and now reports every sheet roll through a new `onRollResult` callback BEFORE the terminal runtime writes. It does NOT dispatch the `death-save-result` window event — the page-singleton listener in `useLoggedDiceRollEventHandlers.js` logs a row per event, so a sheet-lane dispatch would double-log (sheet logs its own row directly).
- Dual-ruleset: `deathSaveRules.js` is shared by both rulesets and no 2024 sibling of this component exists — no twin fix needed. Monster-prompt lane: `DeathSavePromptModal` needed no change (its result stage is modal-local; its window-event consumer is now CharHitPoints, unit-pinned).

**Files changed:** `src/components/char-sheet/char-summary/CharHitPoints.jsx`, `src/components/char-sheet/char-summary/DeathSavingThrows.jsx`, `src/components/char-sheet/char-summary/DeathSavingThrows.test.jsx` (chip assertions became `onRollResult` payload pins; the event-chip trio moved to CharHitPoints), new `src/components/char-sheet/char-summary/CharHitPoints.death-save-chip.test.jsx`.

**Verification:**
- Live re-run of the exact repro steps post-fix on :5173 (test-campaign): fatal 3rd failure → chip `add@1` ms, `(7)Failure` visible at 51 ms alongside the simultaneously-mounted DEAD badge, dwell `rm@2002`, honest `death_save` roll + `result:'dead'` rows. NAT 20 → chip `add@1`, `(20)NAT 20Success` with the `.death-saves-nat--20` span, visible at 52 ms even though the block unmounted (`Hit Points: 1/112`), cleared after the 2 s dwell. Non-terminal control still mounts at `add@2`/`rm@2003` with `role="status"`. Console clean on a fresh load (only the 2 mid-edit HMR module-versions from the fix session, per the HMR-hygiene law).
- Tests: `CharHitPoints.death-save-chip.test.jsx` + `DeathSavingThrows.test.jsx` 26/26; whole `char-summary/` folder 56 files / 702 tests pass; death-save event-family suites (modal, finality-rows, initiative callbacks, event-handler singleton, relentless rage, reaction heal, rules, save-prompt service, initiative-init-rolled) 9 files pass. `npm run lint` clean (zero warnings); `npm run guard:no-timers` OK (45 sites, all benign).
- Cleanup: Admin panel cleared change-data (`{}`) + campaign log (`[]`) for test-campaign (native confirms accepted); disk cd/log absent; `EvasiveFighter.json` md5 `0df29ff32…` byte-exact to the PD baseline pin.

**New recipe worth keeping:** forcing death-save outcomes deterministically — patch `Math.random` around a single click (`()=>0.999` → NAT 20, `()=>0.3` → roll 7 failure, `()=>0.6` → roll 13 success); the roll happens synchronously inside the click handler, so restore immediately after `.click()`.

