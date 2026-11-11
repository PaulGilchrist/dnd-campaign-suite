# Released delegation: visitor's already-open monster card keeps rolling damage

## Summary
When the GM releases a delegated monster (control-select back to "— GM —"), a visitor
device that ALREADY has that monster's stat-block card open (`mc-overlay`) is not
locked out: the overlay stays fully live and chip presses continue to roll, hit, and
apply real damage. The release audit promises control only "until released", and the
open-gate law (`controller !== null`, creatureControl.js LAN-trust D2) is only checked
at OPEN time — a fresh avatar click on the released monster is honestly inert, so the
gate works for new opens but not for stale-open cards.

## Steps to reproduce
1. In `test-campaign` on localhost (GM tab), join a Goblin via Encounter Builder
   ("Select Goblin" → "Join Encounter").
2. On the Goblin's Initiative card, set `[data-testid="control-select"]`
   (aria "Assign who controls Goblin") to a player, e.g. AasimarTest.
3. Open a second browser context as a LAN visitor (isolated context at
   `http://<en0-ip>:5173`), select `test-campaign`, go to Initiative.
4. Visitor: trusted-click the Goblin avatar (`img.avatar-image[alt="Goblin"]`) — the
   monster card overlay opens ("Your turn!" cue present). Arm AasimarTest in
   `[aria-label="Goblin target"]` (targetName lands server-side).
5. GM tab: release control — select "— GM —" in the control-select. Verify: audit row
   "Goblin returned to the GM.", cs row `controller` absent, visitor's YourTurnCue
   disappears live.
6. Visitor tab (overlay STILL open — it never closed): click the overlay's first
   `.mc-dice-link[data-kind="attack"]` (Scimitar +4), press Done on the popup.

## Expected behavior
Releasing control immediately revokes the visitor's ability to run the card — the
open overlay should close or disable its action chips (same zero-trust face as the
inert avatar click after release).

## Actual behavior
- The `mc-overlay` survives the release echo with zero visual change.
- The Scimitar press rolls honestly: popup "Scimitar | 19 | d20 15 +4 | ✓ HIT (19 vs
  AC 12)", and the log gains a `roll` row (characterName "Goblin", hit:true), a damage
  roll row, and an `hp_change` row applying damage to AasimarTest (runtime bucket
  143 → 136 witnessed earlier in the same lane; this press added more).
- Control probe: closing the overlay and re-clicking the avatar after release =
  correctly INERT (no overlay). So only the stale-open lane leaks.
- No console errors; all writes 200 (change-data buckets are visitor-writable by
  design for delegation, so the server cannot tell which device pressed).

## Likely location
Confident on the mechanism, guessing on the ideal fix site:
- Open-time gate: `createNpcClickHandler.js` / `creatureControl.js` (canOperate checks
  `creature.controller !== null` when the avatar is clicked).
- The visitor's `MonsterCardModal`/`mc-overlay` open state is per-client `useState`
  (the 579aca8d2 stat-block-privacy design); nothing re-validates `controller` on the
  combatSummary SSE echo while it is mounted. `src/components/initiative/Initiative.jsx`
  (modal render branch) or the modal component itself would need the live gate.

## Suggested fix
Make the visitor-side overlay render-gate on LIVE controller state, not open-time state:
when `isLocalhost === false`, only render `mc-overlay` for a creature whose CURRENT
`combatSummary` row still carries a `controller` (optionally still `!== null`, since
LAN-trust D2 accepts any device); when the controller field disappears, the modal
unmounts (or all `.mc-dice-link` chips + target-select disable with an honest
"control returned to the GM" notice). A closing effect on the combatSummary change
handler keyed by the open creature's name is the smallest surface. Add a regression
pin: released-mid-open → chip click produces zero roll rows.

## Severity
Data integrity risk — the release audit explicitly promises the device "can run its
card … until released", yet damage/rolls keep landing after release; GMs cannot trust
the picker as a kill-switch for an open tab.
