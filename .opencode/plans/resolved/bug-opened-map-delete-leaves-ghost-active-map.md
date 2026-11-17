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

## Resolution

FIXED 2026-11-17 (fix run, live-verified in `test-campaign`).

**What was actually wrong** — the diagnosis in "Likely location" was confirmed exactly:
`MapContextSync` row-Open force-stamps `__map__` via the wildcard change-data POST, which
never touches the server's in-memory `activeMaps`, while the maps DELETE route's clear
branch guarded only on `activeMaps.get(campaign) === mapKey`. Deleting a merely-Opened map
therefore left the disk-persisted, SSE-replayed `__map__` naming a 404-ing slug forever.
Live repro pre-fix: created `fix-ghost-1` → row **Open** (editor mounted, Back-to-maps) →
`GET /active-map` = null while change-data `__map__` = `{"activeMapName":"fix-ghost-1"}` →
row **Delete** (confirm "Yes, Delete Permanently", victim name read first) → file 404 but
`__map__` STILL `{"activeMapName":"fix-ghost-1"}`.

**The fix took the delete-side reconcile** (suggested low-risk option), in
`server/routes/maps.js`:
- **DELETE handler:** after `fs.unlinkSync`, reconcile BOTH sources of truth —
  `activeMaps` as before, plus the persisted `characterChangeData.get(campaign)?.__map__?.activeMapName`;
  if either names the deleted slug, `stampActiveMapContext(campaign, null)` and additionally
  `publish(\`map-activate-${campaign}\`, { activeMap: null })` — the deactivate-route twin
  null face. Without the null face a live GM tab stays armed on the deleted map and its next
  `activeMapName` transition re-stamps the ghost (`MapContextSync` resurrection vector —
  witnessed mid-verification when an API activate armed the tab milliseconds before a DELETE:
  the tab's force-stamp POST landed after the clear and recreated the ghost until the null
  face adoption closed the window).
- **Rename handler:** same dual-source reconcile — renaming away a client-stamped slug moves
  `__map__` to the new slug instead of ghosting the old one.
- Client `MapContextSync` untouched: the force-stamp stays the sole re-seed-after-admin-wipe
  lane per its documented contract.

**Files changed:**
- `server/routes/maps.js` — DELETE + rename dual-source reconcile; delete clears publish the `map-activate` null face.
- `server/routes/maps.delete-ghost-stamp-reconcile.test.js` — NEW regression suite (5 tests): Open-stamped delete clears `__map__` + publishes both `change-<c>-__map__` null and `map-activate` null; activate→delete lane regression-safe (clears + `activeMaps.delete` + null face); non-named delete/touches nothing (negative publish pins); rename-away of a stamped map moves the slug; non-named rename leaves the stamp. Verified RED against the pre-fix handler (temporarily reverted the reconcile — the ghost test failed exactly on the surviving stamp), GREEN after.
- `server/routes/maps.test.js` — mock fix: its `changeData` mock lacked `characterChangeData`/`markDirty`, which the reconciled DELETE now reads; added (mirrors `maps-active-map-context.test.js`).

**Verification:**
- Repro re-run post-fix (full UI lane, dev pair :5173, `fix-ghost-4`): Open → stamp → Delete
  → `__map__` = `{"activeMapName": null}` immediately and after 2 s settle; `GET /active-map`
  null; map doc 404. **Reload + campaign re-select: stays null — no ghost re-hydration**
  (`fix-ghost-6` leg: Open-stamped → out-of-band DELETE → reload + re-select → `__map__` null).
- Resurrection/adoption leg (`fix-ghost-5`): live tab armed, API activate → 1.5 s settle →
  API DELETE → 3 s settle → `__map__` stays `{"activeMapName": null}` (tab adopted the
  `map-activate` null face, no re-stamp).
- Adjacent sanity: activate→delete still honest-clears; rename moves the stamp live
  (`fix-ghost-3` → `fix-ghost-three` → activate → delete → both sources null, doc 404);
  opening another map still re-seeds `__map__` (`Test Map` → `{"activeMapName":"test-map"}`).
- Tests: `npx vitest run server/routes/maps*.test.js` → 21 files / 272 tests passed; adjacent
  client lanes `src/App.map-activate/map-self-heal/map-deactivated-advisory` +
  `src/components/maps-manager` + `src/services/maps` → 40 files / 597 tests passed.
- `npm run lint` → 0 errors / 0 warnings.
- Cleanup: sandbox maps all deleted (maps dir = 4 baseline fixtures, md5s byte-exact to the
  pinned fingerprints `94fcd0bf/860eda23/a0d190d1/8e40779e`); closed-tab two-pass admin
  clears → change-data `{}` + log `[]` GET-verified, disk files absent; dev pair killed by
  PID, ports 80/5173 dark.

**Playbook pitfall recorded:** a live GM tab armed on a map re-stamps `__map__` on its next
`activeMapName` transition — harness lanes that activate/delete out-of-band within the SSE
round-trip can resurrect the stamp after an honest clear; server clears must publish the
`map-activate` null face so tabs disarm. Also: manager rows render the **displayName**
("Test Map"), not the kebab slug — `hasText: 'test-map'` false-times the row locator.

