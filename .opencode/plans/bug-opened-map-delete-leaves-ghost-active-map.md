# Bug: deleting an Opened-but-never-Activated map leaves a ghost `__map__` active-map stamp

## Summary

Opening a map from the Maps manager (row **Open**) force-stamps the shared change-data key `__map__` with that map's slug via the client `MapContextSync`, WITHOUT the server recording it as the active map (`GET /active-map` stays null). The map DELETE route only clears `__map__` when its in-memory `activeMaps` matches — so deleting a map that was merely Opened leaves `__map__` pointing at a now-nonexistent map, permanently, in shared change-data (replayed to every tab on SSE connect and re-hydrated on every campaign select).

## Steps to reproduce

Both legs live-verified 2026-11-17 in `test-campaign` (dev pair, localhost):

UI leg:
1. In test-campaign, create a sandbox map: `POST /api/campaigns/test-campaign/maps` `{"name":"fi-ghost-3","type":"indoor","gridSize":5}`.
2. Maps view → click the row's **Open** (NOT Activate). Let the editor mount; return to the manager.
3. `GET /api/campaigns/test-campaign/active-map` → `{"activeMapName": null}` (server never activated it), while `GET …/change-data` shows `"__map__": {"activeMapName":"fi-ghost-3"}` — already two sources of truth.
4. Delete the map (row Delete / `DELETE /api/campaigns/test-campaign/maps/fi-ghost-3`) → 200, file gone (GET 404).
5. `GET …/change-data` → `__map__` STILL `{"activeMapName":"fi-ghost-3"}` — a ghost slug survives. Reload / re-select the campaign and the ghost re-hydrates (observed in a fresh tab).

API control probe (isolates the root cause):
1. Map A: `POST /maps` → `PUT /maps/A/activate` → `DELETE /maps/A` → `__map__` becomes `{"activeMapName": null}` (honest clear — `activeMaps` matched).
2. Map B: `POST /maps` → client-face stamp `POST /api/campaigns/test-campaign/__map__` `{"value":{"activeMapName":"B"}}` (the exact bytes MapContextSync force-stamps; activation route NOT used) → `DELETE /maps/B` → `__map__` keeps `{"activeMapName":"B"}` forever.

## Expected behavior

Deleting the map the campaign's stored active-map context points at should clear/neutralize `__map__` regardless of which lane stamped it (the delete handler should reconcile the persisted key, not just its own memory), or opening a map should not write shared active-map state at all without server-side activation.

## Actual behavior

`__map__` (shared change-data, disk-persisted, SSE-replayed on every connect) keeps naming a deleted map. Every consumer that reads the active-map context — `rangeCheck.js` distance gates via the runtime `__map__` mirror, the deactivated-map advisory (`mapIsActive` comparison in App.jsx) — believes tokens are on a map whose file 404s. It only self-heals when a GM later Opens/Activates another map or via the wildcard `DELETE /api/campaigns/:c/__map__` (manually performed 200 during cleanup) — a lane normal users don't know exists.

## Likely location

Confident (read the code): the divergence is between
- `src/components/common/MapContextSync.jsx` lines 71-77 — GM Open force-stamps `__map__` unconditionally on the local `activeMapName` transition, bypassing the activate route so `activeMaps` (server memory) never learns about it; and
- `server/routes/maps.js` DELETE handler (~line 664) — the “If this was the active map, clear it” branch tests only `activeMaps.get(campaign) === mapKey`, a store the client force-stamp never writes.

The activate route (`stampActiveMapContext`) and the client force-stamp are two writers of the same change-data key with only ONE of them reflected in the delete guard's source of truth.

## Suggested fix

In the DELETE (and rename-away) handler, ALSO reconcile the persisted key: after `fs.unlinkSync`, read the campaign change-data `__map__.activeMapName` (in-memory cache), and if it equals the deleted slug, `stampActiveMapContext(campaign, null)` (or delete the key) and publish the `map-activate` null face so all tabs adopt. Alternative (bigger): stop the client force-stamp from writing `__map__` on plain Open (make activation the sole writer) — but the file's comments state the force-stamp deliberately survives admin wipes to re-seed, so the delete-side reconcile is the low-risk change. Check `server/routes/maps-active-map-context.test.js` for the stamping contract before editing.

## Severity

Data integrity risk — shared runtime state keeps naming a nonexistent map after the delete; distance/range adjudication and the active-map advisory silently operate on a ghost context until an unrelated lane overwrites the key.
