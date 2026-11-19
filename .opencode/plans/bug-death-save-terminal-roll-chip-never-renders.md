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
