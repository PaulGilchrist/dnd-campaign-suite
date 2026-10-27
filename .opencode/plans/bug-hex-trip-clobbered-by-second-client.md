# Second client opening a hex map destroys an in-progress trip started by another client (no adoption, silent reset)

## Summary
Hex travel state (`travel-mode/-destination/-path/...`) is campaign-shared, but a second GM client that opens the same outdoor map does NOT reliably adopt an already-live trip. Depending on the branch hit in `useTravelToolSync`, its Travel-tool press either runs `startPlanning()` (fresh session) or `cancelTravel()` — both wipe the first client's route (`travel-destination` → null, `travel-path` → []) with zero feedback to the client that owns the trip. Reproduced live twice with two different wipe paths.

## Steps to reproduce
Start state: `test-campaign`, one localhost tab (A) on an outdoor hex map mid-trip.

**Leg 1 — fresh second tab, startPlanning clobber (live-proven):**
1. Tab A: open an outdoor map → Travel tool → plan a 3–4 hex route → Advance once. Server (GET `/api/campaigns/test-campaign/change-data`): `travel-mode:"traveling"`, `travel-pathIndex:1`, `travel-destination:{q:17,r:10}`.
2. Open a SECOND browser tab (B) to the app, select `test-campaign` (header verified), Maps → Open the SAME map. The Travel toggle is NOT auto-pressed and the travel panel does NOT auto-mount — B shows no sign of a live trip.
3. B: press the Travel tool (`button[aria-label*="Travel mode"]`) once.
4. Server immediately after: `travel-mode:"planning"`, `travel-destination:null`, `travel-path` gone, `travel-pathIndex:0` — A's trip is destroyed. A's own UI silently flips ("Select a destination", Remaining 0 hexes) with no message explaining why.

**Leg 2 — reopen + toggle press, cancelTravel clobber (live-proven):**
1. Tab A mid-trip again (`planning`, pathIndex 1, destination q:16, path length 4).
2. Tab B: Back to maps → re-open the map (panel auto-mounts this time — file/store adoption worked).
3. B: press the Travel toggle once to dismiss the panel.
4. Server: `travel-mode:"inactive"`, `travel-destination:null`, `travel-path:[]` — shared trip cancelled from B, again with no confirmation and no explanation on A.

## Expected behavior
Either (a) a second client adopts the live shared trip on map open (as the reopen/adoption lane already does) and its tool-press only affects its own view of a shared, still-live trip; or (b) any press that would `startPlanning`/`cancelTravel` over a trip started elsewhere warns / is gated (the code already has a `resumeSession` immunity concept for reopen — it just doesn't cover the late-joining tab). At minimum, the owning client should see feedback ("travel cancelled by another session"), not a silent state flip.

## Actual behavior
Silent destruction of shared travel state by any second client; A (owner) gets no message — its panel just re-derives from the surviving array payloads.

## Likely location
`src/components/hex-map/hooks/useTravelToolSync.js` (confident for the branch mechanics, medium for the adoption race root cause):
- Leg 1: B mounted WITHOUT recognizing the live trip (`isTravelActive` false at mount — the session-keyed store seeding on campaign-select appears to run before/without the `travel-*` values landing, so `openedLiveRef` stays false and `hasLoadedTrip` doesn't cover it), then press → branch 1 `toolJustActivated && travelMode==='inactive'` → `startPlanning()` clears destination/path even though the SERVER was mid-trip (local store said inactive).
- Leg 2: branch 3 with `prevTool === TOOL_TRAVEL` = "deliberate exit" → `cancelTravel()` on shared state.
- Related: the `change-<campaign>-travel-mode` "inactive"/"planning" STRING echoes are dropped by `App.jsx:100` (`typeof event.data !== 'object'` guard — see sibling bug file), which likely also starves late-joining clients of the correct mode at mount time. Same root family.

## Suggested fix
First read: how B's campaign store hydrates `travel-*` scalar keys on select/open (`App.jsx` `fetchCampaignChangeData` + `seedCharServerKeys` equivalents for the campaign store) — if scalars are seeded, the mount-time `isTravelActive` check should see `traveling`; if not, fix the seed/SSE-guard so it does. Then in `useTravelToolSync` branch 1, before `startPlanning()` re-read the server value (or gate on a freshly-synced `travel-mode`) so a press can't reset a trip the local store merely hasn't hydrated yet; and consider confirming before `cancelTravel` when the trip wasn't started by this session (e.g. compare an owner/session stamp).

## Severity
Data integrity risk — shared campaign state (an active journey with accrued budget/pathIndex/exhaustion context) is destroyed without warning by a second viewer; single worst trigger is just "GM opened the map in another tab".
