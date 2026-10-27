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

## Resolution

**Fixed 2026-10-27.** Both legs re-reproduced live first (they still clobbered even after 947b9702c), then fixed and re-verified live on `test-campaign`.

### What was actually wrong
The original guess was half-right. The late-join hydration starvation it leaned on (`App.jsx` scalar-guard) was already closed by 947b9702c — a second client DOES now adopt a live trip on open (panel auto-mounts, toggle auto-presses). The surviving root cause was **ownership**: `useTravelToolSync` decides destructive branches purely from local tool/mirror bytes and had no notion of *which session started the trip*. The reopen/late-join adoption lane made the toggle `aria-pressed=true`, so B's first press was parsed as a **deliberate tool-exit** (`prevTool === TOOL_TRAVEL`) → `cancelTravel()` — wiping A's `travel-mode`/`travel-destination`/`travel-path` with zero provenance check. (The `startPlanning`-shape wipe of the original report is the sibling ordering of the same missing ownership gate: exit-cancel followed by a press starts fresh planning.)

### The fix — mirror the existing adoption lane + a server-first owner stamp
- **`src/services/maps/travelSession.js` (new)** — per-tab provenance: `getSessionId()` (random token in `sessionStorage`, survives reload/reopen — UI identity only, zero game state) and the shared half: `travel-started-by` claim/release through the runtime store.
- **`src/hooks/management/useTravelManagement.js`** — `startPlanning()` claims `travel-started-by` = this tab's token; `cancelTravel()` releases it (arrival lands through the same inactive seam).
- **`src/services/automation/common/campaignKeys.js`** — registers `travel-started-by` as a campaign key.
- **`src/components/hex-map/hooks/useTravelToolSync.js`** — new `campaignName` option wires `readSharedTripAuthority()`: reads the campaign-bucket `travel-mode` + `travel-started-by` synchronously (local mirrors update at SSE-apply time, so this is the server truth) and, when the live trip belongs to another tab (`foreignTrip`), replaces both destructive paths: the activation press **adopts** instead of `startPlanning()`, and a toggle-off over a foreign trip is **held** (console-noted, panel stays mounted; the panel's explicit Cancel remains the owner-visible exit). Own-session flows — press→plan, deliberate exit→cancel, arrival/force-off provenance reset — are untouched, and with no `campaignName` wired every pre-fix pinned contract stands byte-identical (extracted `readSharedTripAuthority`/`activeTripToolAction` keep complexity clean).
- **`src/components/hex-map/HexMap.jsx`** — passes `campaignName` into the hook.

Adoption is the primary remedy (per Expected (a)); the gate makes destruction structurally impossible for non-owners, so no silent flip remains for the owner (Expected's minimum bar) and no confirm dialog is needed.

### Verification
- **Live, both legs, `test-campaign`, dev:locked (:5173):** owner A pressed Travel (claimed `travel-started-by: f3ec7457…`), planned (8,5) 17-hex route, advanced → `traveling`/pi1. Fresh client B opened the map — **auto-adopted** (panel + pressed toggle), pressed the toggle twice → **zero destructive POSTs from B**; server stayed `traveling`, pi1, dest `{q:8,r:5}`, path 17, owner stamp intact. Leg 2: B back-to-maps → reopen (adopted again) → toggle-off presses → held again, zero writes. Owner sanity: A's panel Cancel still cancels fully (`travel-mode:inactive`, dest/path null/[], `travel-started-by:null`, tool released) and a fresh re-press starts its own planning normally.
- **Tests:** new `src/components/hex-map/hooks/useTravelToolSync.shared-trip.test.js` (6 tests: adopt-on-press, adopt-on-late-join, toggle-off hold, own-press flows, unclaimed-stamp legacy reopen contract, no-lane legacy cancel). Full touched-area run green: hex-map + map + management + services/maps = 130 files / 1669 tests; hooks folder 146/146; `npm run lint` exit 0 (zero warnings); `no-timers-guard` OK.
- **Cleanup:** tabs closed, `admin/clear-change-data` + `admin/clear-log` 200 from quiet state (`{}` / `[]` verified), QA maps `qa-trip-bug`/`qa-trip-bug2` deleted — maps back to baseline [Battle Arena, Test Map].

Rulesets: travel is campaign-level and ruleset-agnostic (no `rules` branching in any touched file) — both 5e and 2024 characters share this lane unchanged.

