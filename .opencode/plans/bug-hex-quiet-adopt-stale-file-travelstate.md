# Quiet trip-adoption mount never reconciles a diverged map-file travelState (stale resume cache)

## Summary
After a mid-plan reload loses the ~1s debounced map-file writeback, the reopened editor correctly adopts the STORE trip but never rewrites the map file's travelState, which still describes the PREVIOUS trip. The file's resume cache stays wrong indefinitely (60+ s observed while the editor was mounted on the trip), so any later boot with no live travel keys (per-key removals, admin clear, cache eviction) will materialize the WRONG trip via the file-adoption lane (that lane trusts the file bytes whenever `travel-mode` is absent from change-data — proven live in run-H's wipe-and-adopt lane).

## Steps to reproduce
In `test-campaign` on a hex map (map closed, no travel keys):
1. Open map, press Travel, plan a west route ~180px (destination ≈ (16,10)). Wait ≥3s — `GET /maps/<slug>` now shows `travelState.destination = (16,10)`.
2. Cancel the trip (panel Cancel), press Travel again, plan a shorter route ~120px (destination ≈ (17,10)).
3. Within ~600ms of the plan click, reload the page (the file PUT debounce loses the writeback), re-select campaign, reopen the map.
4. Observe: panel auto-adopts the STORE trip (destination (17,10), Remaining matches its path) — yet `GET /maps/<slug>` keeps returning `travelState.destination = (16,10)` (old trip, old path) even after 60+ s mounted, unmodified. Only the next real travel mutation rewrites it.

## Expected behavior
Either the mount reconciles the file with the authoritative adopted bytes (one dirty PUT), or `GET` file bytes always reflect the trip a client would resume into. A resume cache that disagrees with the live trip is a time bomb for exactly the crash/clear scenarios where it gets consulted.

## Actual behavior
File `travelState` diverges from the store (different destination + path) indefinitely on a quiet adopted mount; zero PUTs. Live-proven divergence both directions read back from disk; the wrong-trip RESURRECTION consequence is argued from the file-adoption gate (code read: `hasRuntimeValue('campaign','travel-mode')` only checks key PRESENCE, run-H proved the lane adopts whatever the file says) — not separately walked this run because the store-wipe probe now hits the null-echo crash bug (bug-hex-arrival-null-echo-blank-screen).

## Likely location
`src/hooks/management/useTravelManagement.js`: the map-file write-back publisher seeds `publishedTravelRef = buildPublishSnapshot(init)` from the mount-time SYNCED store bytes (:166, comment "seeding from the mount snapshot keeps a quiet open — resume included — silent") while `init` for the render side also resolves from the store when present — so store≠file produces zero publishes. The file-adoption lane (:191) skips because the store speaks. Confident on the mechanism (byte reads + code read); confident on the risky gate.

## Suggested fix
When a mount adopts a store trip and `resumedTripRef`/loaded file travelState exists but is NOT deep-equal to the adopted snapshot, seed `publishedTravelRef` from the FILE bytes instead of the store snapshot — the existing effect then publishes exactly one reconciliation PUT (quiet opens where file==store stay byte-silent, preserving the a2da687d7 zero-PUT contract). Add a unit test: store trip ≠ file trip on mount ⇒ exactly one `onTravelStateChange` with the store snapshot.

## Severity
Data integrity risk (moderate) — wrong trip resurrects only after the store goes quiet, but that is precisely the reload/admin-clear recovery flow the file lane exists for.
