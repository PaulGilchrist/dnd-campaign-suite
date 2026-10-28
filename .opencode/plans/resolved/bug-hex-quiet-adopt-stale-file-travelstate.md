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

## Resolution
FIXED 2026-10-27. Root cause refined from the black-box guess: the mount-time publish was NOT skipped as suspected — it fires at mount commit (store already hydrated, `publishedTravelRef` seeds from `null` because `initialTravelState` is still pending), reaches `setTravelStateRef`, and is then SILENTLY CLOBBERED when `useMapLoader.applyExistingMap` (src/components/hex-map/hooks/useMapLoader.js :99-109) resolves the async GET: it re-adopts the FILE's travelState into `travelStateRef.current` AND seeds the dirty-gate baseline `lastSavedRef` with the same stale bytes. The publisher never re-fires (its `publishedTravelRef` already equals the store snapshot; `initialTravelState` wasn't a dep) ⇒ envelope == baseline ⇒ zero PUTs. Live repro matched this exactly: panel adopted store trip (18,9, Remaining 3) while `GET /maps/qa-hex-quietadopt` kept (17,9)/5-hex path ≥60 s, zero map PUTs via fetch-spy; the time-bomb consequence was also walked this run (null-echo crash 171a9dcbe is dead): wiping the travel keys with the editor back-navigated + reload + reopen resurrected the WRONG trip from the file (panel Remaining 4 = stale 5-hex path).

Fix (src/hooks/management/useTravelManagement.js, publisher block): a resume mount now HOLDS its premature publish while the document is still loading (bytes already moved off the mount snapshot — real mutations inside the load window — still publish), and when `initialTravelState` first lands, seeds `publishedTravelRef` from the FILE snapshot (exactly what the loader wrote into ref+baseline). Diverged file ⇒ the existing effect publishes exactly ONE store-snapshot reconciliation (one dirty PUT through the loader's debounce); file == store ⇒ deep-equal ⇒ byte-silent (a2da687d7 zero-PUT contract intact). Adoption mounts (store silent at mount) are untouched, and a file-less mount (fresh/no-file-trip map) defers the resume publish but still publishes every real mutation.

Verified:
- New regression suite `src/hooks/management/useTravelManagement.quiet-adopt-reconcile.test.js` (4 tests): diverged-file mount ⇒ exactly one publish with the store snapshot; equal-file mount ⇒ zero publishes; adoption lane lock (one publish of the file's own bytes, never a null wipe); file-less deferral doesn't strand the write-back lane. Pre-fix check: 3/4 fail on HEAD code (premature publish), adoption lock passes both sides.
- `npx vitest run src/hooks/management/ src/components/hex-map/` ⇒ 50 files / 579 tests green. `npm run lint` ⇒ clean.
- Live re-verify in test-campaign (:5173 fresh code): replayed the full repro (plan A 180px → file==A → cancel → plan B 120px → reload @350 ms loses B's debounced PUT) — reopened editor adopted the STORE trip (Remaining 3) AND `GET /maps/<slug>` showed `travelState.destination = (18,9)` with path length 4 within ~4.5 s, exactly ONE reconciliation PUT in the request-spy. Quiet reopen with no divergence ⇒ ZERO map PUTs. Normal plan→advance×3→arrive cycle still works end-to-end (arrived msg, completed keys removed, mode inactive, file sheds travelState with one PUT, no null-echo crash).
- Cleanup: scratch map `qa-hex-quietadopt` deleted; admin clear-change-data + clear-log; change-data `{}` + log `[]` + maps [battle-arena, test-map] GET-verified.
