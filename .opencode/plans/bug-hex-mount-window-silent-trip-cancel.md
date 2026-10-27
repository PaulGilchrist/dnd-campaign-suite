# Fresh-boot map mount can silently CANCEL a live trip (residual clobber after 75f2aa061)

## Summary
The 75f2aa061 shared-trip fix adopts foreign trips on tool press/toggle, but during the boot/mount hydration window a client can still silently destroy a live trip: `useTravelToolSync` branch-3 falls to its legacy `cancel` action when the LOCAL synced state reads the trip active while `readSharedTripAuthority` momentarily reads `travel-mode` as missing/inactive through the runtime-store channel. Two live sightings this run, both landing the exact cancelTravel byte signature (mode `inactive`, destination `null`, path `[]`, `travel-started-by` released to `null`) with zero user cancel action.

## Steps to reproduce
Timing race — reproduce by repeated attempts in `test-campaign` on a hex map whose FILE carries an older trip (or clean store):
1. Client B: start a trip (press Travel, plan a route) — server shows mode `planning`, owner stamped with B's token, file snapshot lags (reload quickly, <1s after plan, to lose the file writeback).
2. `page.reload()` B, re-select test-campaign, Maps → open the same map within a few seconds of boot.
3. Observed (run-L, sighting 1): the trip is GONE — change-data shows the full cancel signature (`travel-started-by: null` = `releaseTripOwner` POST actually ran, ruling out a non-registered click), panel never mounts (0 `.travel-panel`), toggle unpressed. No console cancel message at all.
4. Sighting 2 (fresh-boot, clean store): open map, press Travel ONCE — startPlanning claims ownership (observed `travel-started-by` = token POST land), then within the same mount churn the store reverts to full idle defaults **with `travel-started-by: null` present** (only `releaseTripOwner` writes that) — the user's first press is swallowed AND the just-started trip cancelled. A second press works normally.
Control: the identical walk with ≥1.5s settle after campaign select ADOPTED correctly on 4 separate lanes this run (open-adopt, press-adopt, toggle-hold, owner-cancel), so the death is strictly mount-window timing, not a deterministic lane.

## Expected behavior
A mount that sees a live trip (own or foreign) adopts or stays inert; `cancel` must never fire on a first-echo pass where the authority read could be stale — especially for a trip owned by THIS tab's token, or within moments of the same tab's own startPlanning press.

## Actual behavior
Silent trip destruction (cancel byte signature, zero confirm, zero feedback), indistinguishable from the run-K clobber except via the release-stamp write.

## Likely location
`src/components/hex-map/hooks/useTravelToolSync.js` branch 3: `adopt` requires `tripLive === true` from `getRuntimeValue('campaign','travel-mode')`; if that read lags the `useSyncedState` value that made `travelMgmt.isTravelActive` true (two read channels over the campaign bucket during boot/SSE replay), the action falls to `cancel` when `!resumeSession` (fresh boot ⇒ `openedLiveRef`/`hasLoadedTrip` both false). Medium confidence — hypothesis from code read + byte forensics; the exact render-ordering was not logged. Also note HexMap's `tool` state desync during mount churn may supply `tool !== TOOL_TRAVEL` while the press is in flight (sighting 2).

## Suggested fix
Invert the mount-time default: when `isTravelActive` is true but `tripLive` reads false AND the client has never pressed the tool this session (`!startedHereRef.current`), prefer ADOPT (or simply hold inert for one settle pass) over CANCEL — the legacy "external start ⇒ cancel" contract predates shared-trip authority and is the only path that produces these bytes. Alternatively/additionally make `readSharedTripAuthority` read the SAME synced value the hook renders with (or treat `null`/missing mode as UNKNOWN, not inactive, for the cancel branch; a confirmed cancel should require an explicit `travel-mode: 'inactive'` string). Add a regression test: mount with local active + authority null ⇒ no cancelTravel call.

## Severity
Data integrity risk — destroys shared travel state with no feedback; race-window reachability (reload mid-trip, fast boot-and-open, first press after map open) is realistic GM behavior.
