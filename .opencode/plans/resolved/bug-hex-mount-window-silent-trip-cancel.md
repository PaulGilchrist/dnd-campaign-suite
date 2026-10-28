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

## Resolution

**FIXED 2026-10-27** (this run).

### What was actually wrong
The bug file's "likely location" was confirmed with one refinement. `useTravelToolSync`'s
branch 3 (tool NONE/deselected while `travelMgmt.isTravelActive` is true) decides
adopt/hold/cancel/mirror from `readSharedTripAuthority`, which read
`getRuntimeValue('campaign','travel-mode')` as a **two-state** value: a live string
⇒ `tripLive`, anything else (`'inactive'` **or null/missing**) ⇒ "not live". The
legacy `!resumeSession` fall-through then fired `cancelTravel()` on that second state.

The two read channels diverge because they treat a **missing** campaign-store key
differently:
- `travelMgmt.isTravelActive` comes from `useSyncedState('campaign','travel-mode',
  init.travelMode, …)` — on a missing key it falls back to its **declared default**
  `init.travelMode`, which is live when the loader carries a file trip or a just-
  claimed/echoed mode is still committed.
- `getRuntimeValue('campaign','travel-mode')` returns raw **`null`** for a missing key.

So any pass where the shared `travel-mode` key is momentarily absent (boot change-data
seed lag, or — **worsened by 171a9dcbe**, which now mirrors a cleared-key echo as a key
REMOVAL so a removed key also reads `null`) while the local mirror still renders the trip
live ⇒ `isTravelActive` true + `tripLive` false + fresh-boot `!resumeSession` ⇒ silent
`cancelTravel()`. The distinguishing fact — the authority read simply **could not see**
the trip vs **confirmed it gone** — was collapsed into "cancel".

### The fix (src/components/hex-map/hooks/useTravelToolSync.js)
Made the shared authority read **three-state** — live / **CONFIRMED** `inactive` / **UNKNOWN**
(missing) — via a new `modeConfirmedInactive` (`sharedMode === 'inactive'`) alongside
`tripLive`. `activeTripToolAction` now holds a new rule **before** the legacy cancel:

```
if (!tripLive && !modeConfirmedInactive) return 'adopt';   // UNKNOWN ⇒ adopt, never cancel
```

An UNKNOWN read ADOPTS the trip (recovers/holds the press, sets `openedLiveRef`, re-presses
the toggle, logs `"[useTravelToolSync] Shared travel-mode authority unreadable … holding
the live trip, not cancelling it"`). A confirmed cancel still requires the explicit
`'inactive'` byte (or the deliberate own-trip exit / the no-lane contract, which report
`modeConfirmedInactive: true` so they stay byte-identical). Log-message selection was
extracted to a module-level `adoptLogMessage(foreignTrip, tripLive)` helper to keep the
effect's cyclomatic complexity under the lint cap. No new event types or abstractions — it
reuses the existing adopt lane and mirrors the `useTravelToolSync` helper style.

### Files changed
- `src/components/hex-map/hooks/useTravelToolSync.js` — three-state authority + UNKNOWN-adopt guard + `adoptLogMessage` helper.
- `src/components/hex-map/hooks/useTravelToolSync.mount-window.test.js` — new regression lock (5 tests).

### Verification
- **Required regression** (mount with local active + authority null ⇒ no `cancelTravel`): PASS.
  Plus a foreign-owner null variant, a first-press→desync→null variant (sighting 2), and two
  guard rails proving cancel is NOT over-suppressed (confirmed-`'inactive'` external-start
  still cancels; deliberate owner exit on a confirmed-live trip still cancels).
- `npx vitest run src/components/hex-map/hooks/` → **151 passed** (both prior sibling files
  `useTravelToolSync.test.js` + `useTravelToolSync.shared-trip.test.js` byte-unchanged green).
- `npx vitest run src/components/hex-map src/hooks/management/useTravelManagement*` → **526 passed**.
- `npm run lint` → **0 errors, 0 warnings** (was 1 complexity warning at 16, resolved by the helper extraction).
- **Live re-verify (Playwright, test-campaign, Vite :5173 — fresh source):**
  - Mount-window reopen (reload mid-plan, no writeback settle): across 4 bounded cycles the
    trip **survived** every sample (mode `planning`, path stable, panel auto-mounted, toggle
    auto-pressed), **zero cancel-signature bytes** and zero cancel console output.
  - Deterministic UNKNOWN-window amplifier (boot `change-data` GET delayed 3s so the campaign
    store is empty through the whole mount churn while the file loader adopts a live trip):
    trip still adopted, no cancel.
  - Owner-cancel lane intact: deliberate toolbar-off over a confirmed-live own trip ⇒
    mode `inactive`, path `[]`, `travel-started-by` released to `null` (correct cancel).
  - The genuine sub-render race did not reproduce in clean cycles in *either* the pre- or
    post-fix build (consistent with the bug file's "≥1.5s settles adopted on 4 lanes" note —
    it is a narrow timing race); the behavioural contract is therefore locked by the unit
    tests, and the live pass confirms the adopted + owner-cancel lanes are correct on the
    fixed build. Non-reproduction of the raw race is recorded honestly here.

### Note (out of scope)
`src/components/map/Map.jsx:469` (`const { players } = mapData`) blanks the SPA via
`Players.jsx:14` when a map file lacks `players` — hit incidentally this run when a scratch
`PUT {travelState:null}` (the maps PUT lane is a **full-object replace**, not a patch)
dropped the field. Pre-existing and unrelated to the hex-travel fix; flagged for backlog.
