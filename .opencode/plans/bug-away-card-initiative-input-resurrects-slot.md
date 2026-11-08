# Bug: Away (split-party) creature can hold its initiative slot back by simply typing in the card's initiative input

## Summary
Split-party law says an away PC "holds NO initiative slot" and its card "parks at the back of the board (initiative is wiped on split)". But the initiative input on an away card is never disabled or guarded: stamping it through the ordinary `handleInitiativeChange` → `setInitiative` lane writes initiative back onto the away row AND re-sorts the board with the legacy raw sort, pulling the away card out of its parked back position into the middle of the tracker. The store then holds `away: true` rows with live initiative values, contradicting the feature's own invariant and the audit text ("removed from the initiative tracker").

## Steps to reproduce
Start from a settled Initiative page in test-campaign with the 13-PC placeholder board:

1. Stamp initiative via the card inputs: AasimarTest = 20, ElderPaladin = 15, FeyRanger = 10 (blur each).
2. Click **Split Party** → untick **FeyRanger** and **HexWarlock** → **Apply**.
   - Verified correct here: store rows get `away: true, initiative: ''` and both cards park at the back with the Away badge.
3. **Face A (stale display on split):** look at FeyRanger's greyed card — its Initiative input still shows `10` even though the store says `''` (uncontrolled `defaultValue` input is not reset on split; the keyed row is moved, not remounted, so DOM value survives).
4. **Face A2 (stale display on rejoin):** reopen Split Party → re-tick FeyRanger → Apply. Store + audit row are correct (`initiative: '15'`, "rejoined the party — initiative set to 15 (end of the round)"), but the card input STILL shows the stale `9` until the page is reloaded.
5. **Face B (slot resurrection + un-parking):** on **HexWarlock**'s away card, focus the Initiative input, type `12`, press Tab to blur (no click needed — keyboard-only).
6. Wait for the write to settle; GET `/api/campaigns/test-campaign/change-data`.

## Expected behavior
Per `src/services/combat/creaturePresence.js` module law ("no held slot while separated", "AWAY rows strictly last"):
- Either the away card's initiative input should be disabled/read-only (the slot doesn't exist), or stamping it should first rejoin the creature (with the end-of-round semantics), or be refused with feedback.
- The away row must never carry a numeric initiative, and the away card must not reorder to the middle of the board.
- The split toggle should clear/reset the input's displayed value so it doesn't show a wiped slot.

## Actual behavior
- After step 2 the away card still *displays* initiative `10` while the store holds `''` (misleading GM bookkeeping).
- After step 4 the store holds `HexWarlock { away: true, initiative: '12' }` and `FeyRanger { away: true, initiative: '9' }` (9/10 apart — the 9 was a spinner click in my first probe, keyboard-only repro gives the typed value) and both away cards jumped to mid-board: order became `[AasimarTest 20, ElderPaladin 15, HexWarlock(away) 12, FeyRanger(away) 9, <present unrolled…>, …]`.
- Turn navigation still skips them (the presence filter holds), so the tracker doesn't walk onto them — but the board display, the modal's `(Init n)` annotation, and the store all now violate the documented invariant.

## Likely location
Confident: `handleInitiativeChange` in `src/components/initiative/createCreatureHandlers.js` (line ~276) has an `isLocalhost` gate but no presence gate, and `setInitiative` in `src/services/encounters/initiativeService.js` (line ~130) does a raw `creatures.sort((a,b) => b.initiative - a.initiative)` with no `isCreaturePresent` tie-break — unlike the sibling `sortCreaturesForBoard` that owns the "away strictly last" law. The stale display face is `InitiativeControl` in `src/components/initiative/CreatureCard.jsx` (uncontrolled `defaultValue={creature.initiative ?? ''}`, no `key` bump on presence change). Secondary: `maybeGrantThiefsReflexesSecondTurn` runs inside `handleInitiativeChange` before any presence check, so a Thief's-Reflexes holder who is away could also be granted a `(Second Turn)` row from a blurred card input.

## Suggested fix
- In `handleInitiativeChange` (or `setInitiative`): when the target row is a player with `away === true`, either no-op (optionally with a toast "rejoin first") or route through `applyPresenceChanges` semantics — and in all cases re-sort with `sortCreaturesForBoard` (present-first, away-last) instead of the raw initiative sort.
- Disable the input on away cards: pass `isAway` into `InitiativeControl` (`disabled={!isLocalhost || isAway}`) and/or key the input on `${creature.name}-${creature.away ? 'away' : 'here'}` so the stale `defaultValue` remounts to `''` when split.
- Add an away guard in `maybeGrantThiefsReflexesSecondTurn`'s call site (skip when the holder row is away).

## Severity
Data integrity risk — the feature's central invariant (no slot while away, parked last) is silently breakable by a single ordinary GM keystroke on the very card the feature just greyed out; stores can persist contradictory `away + initiative` rows that every future consumer must special-case.
