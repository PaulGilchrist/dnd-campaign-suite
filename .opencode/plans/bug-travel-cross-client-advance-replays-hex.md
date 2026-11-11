# Cross-client travel advance replays the last hex (double budget charge, ghost log row)

## Summary
When a shared overland trip is advanced by one client, another client that adopted that advance via the SSE echo still drives `advanceOneHex` off a stale local `pathIndexRef`. Its next Advance press re-walks the already-traversed hex: it charges the shared daily travel budget again, writes a duplicate `travel advance` log row, and no-ops the index — before advancing normally on the following press.

## Steps to reproduce
Start from a clean-ish test-campaign with an active outdoor map whose `partyPosition` is set (the run used sandbox `jt-travel`, party (5,3), weather clear, `travel-eventFrequency:'none'`, `travel-dailyBudget:12`).

1. Tab A (GM, localhost:5173): open the map, press the Travel tool, click a destination hex ~9 hexes away, Advance the full route to arrival (clean, one charge per step — establishes the control).
2. Arm a NEW destination 2 hexes away (path = 3 points, costs 0.9375/hex under rain).
3. Tab B (visitor, `http://<en0-ip>:5173`, isolated context): select campaign → `Map` (auto-opens the active outdoor map) → Back to 2D if needed → press the Travel tool — the panel ADOPTS the live shared trip (Advance One Hex enabled).
4. Tab B: click Advance once. Server: `travel-pathIndex` 0→1, accrued +0.9375. Tab A's tube live-mirrors (behind/ahead split updates).
5. Tab A: click Advance ONCE. Observe server change-data.
6. Tab A: click Advance again.

## Expected behavior
Step 5 should take the shared party from hex 1 to hex 2 (arrival at the final hex): exactly one budget charge, `travel-pathIndex` 1→2/arrival clear, one `travel advance` row.

## Actual behavior
Step 5 charges the budget (accrued 7.6875 → 8.625, GET-verified) and logs a `travel`/`advance` row, but `travel-pathIndex` stays **1** — it re-wrote the hex the visitor already moved through (party position unchanged, no arrival bytes). Only the SECOND press (step 6) arrives. Live capture: trip 2 of 2 route hexes cost **3 advances** (final accrued 9.5625 = trip-1 6.75 + 3×0.9375). At a nearly-spent daily budget this replay can even fire the false `dayExhausted` wall before a real step.
Arrival itself is honest: trip keys REMOVED (not null-ghosted), `travel-started-by` null-released, day-state survives, toast `Arrived at destination — travel complete`, party file writeback (16,2).

## Likely location
Confident: `src/hooks/management/useTravelManagement.js`. `advanceOneHex` reads `pathIndexRef.current` (line ~494), but the ref is only backfilled at mount/resume (~:271), arrival-clear (~:443), new-destination (~:463) and LOCAL advance (~:538). No effect mirrors the synced `pathIndex`/`path` into the refs when an external SSE echo changes them — the code comment at :149-153 explicitly acknowledges the refs must be repopulated "or every advance silently no-ops", but only the mount/resume lane does it. The mirror UI (tube, panel) reads the synced STATE, so display is correct while the press math is a step behind — the classic display/truth split. Symmetric: the visitor tab replays GM steps the same way (same hook; only the GM face was ridden live).

## Suggested fix
Add an adoption-only backfill: `useEffect(() => { pathRef.current = safePath; pathIndexRef.current = safePathIndex; }, [path, pathIndex])` (null-proof guards already exist as `safePath`/`safePathIndex`). A local advance sets the ref first and the echo then writes the same bytes, so it is idempotent; alternatively make `advanceOneHex` read the synced values with the same coercions and drop the refs. Check the §87/§93 harness laws — nothing else consumes these refs.

## Severity
Data integrity risk — the shared daily travel budget is a game-state resource; a phantom charge per cross-client seam can falsely lock the party into dayExhausted/camp, and the campaign log gains dishonest duplicate rows.
