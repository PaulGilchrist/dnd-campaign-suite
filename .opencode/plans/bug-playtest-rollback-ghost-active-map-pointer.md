# bug-playtest-rollback-ghost-active-map-pointer

## Summary
Ending an Encounter Playtest rolls the campaign disk back to the restore point, but the server's in-memory active-map registry (`activeMaps` in `server/utils/changeData.js`) is never cleared. The staged playtest map (`travel-encounter-stage`) was activated during the test and its file is deleted by the rollback's `fs.rmSync` + extract, yet `activeMaps.get(campaign)` still points at that now-nonexistent slug. Every playtest end leaves this ghost until the next `Activate` (or an admin `clear-change-data`) overwrites it. The playtest design note itself promises "the staged doc + active-map pointer ... roll back together" — the pointer leg is not implemented server-side.

## Steps to reproduce
1. In `test-campaign`, open the Maps manager and click **Activate** on any indoor map (e.g. Battle Arena).
2. Open the Encounters view (Encounter Builder), tick a monster (e.g. Goblin), press **Playtest** → **Start Playtest**. The staging lane creates + activates `travel-encounter-stage` and joins the board; the PlaytestBanner appears.
3. Press **End Playtest** → **Roll back campaign**. The tab reloads with "Campaign restored from <zip>" and the board is clean.
4. With the browser closed (or a fresh tab), probe:
   - `GET /api/campaigns/test-campaign/active-map` → reports the GHOST slug (`travel-encounter-stage`), whose file no longer exists in `maps/`.
   - `PUT /api/campaigns/test-campaign/maps/battle-arena/deactivate` → refused with
     `{"error":"\"battle-arena\" is not the active map — \"travel-encounter-stage\" stays active.","activeMap":"travel-encounter-stage"}`
     while `ls public/campaigns/test-campaign/maps/` shows only the four pre-playtest files.

Live-proved 2026-11-25 (explore run): exactly the refusal above, with the four-file maps dir verified in the same probe.

## Expected behavior
After a rollback the active-map pointer must match the restored state: either `activeMaps.delete(campaign)` (like the sibling admin lanes) or re-derive it from the restored `__map__` change-data key. Deactivating the map that `__map__`/the restored disk records as active must succeed, and `/active-map` must never name a file that does not exist.

## Actual behavior
`activeMaps` keeps the deleted staged slug. `/active-map` serves a ghost, the manager list shows no row active (no file matches), and the deactivate lane honestly refuses because the requested slug is not the (ghost) active one. `__map__` (restored from disk by `reloadCampaign`) and `activeMaps` (untouched) diverge — two channels disagree about which map is active.

Recovery exists but is not surfaced: pressing Activate on any map overwrites the pointer; `POST /admin/clear-change-data` also clears it (`campaigns-admin.js:325`).

## Likely location
CONFIDENT: `server/routes/campaigns-admin.js` POST `/api/campaigns/:campaign/admin/rollback` (lines ~500–542) — it flushes logs, rm+extracts, and calls `reloadCampaign()`, but never touches the imported `activeMaps` Map. Its sibling routes all reconcile: rename (:123-125), campaign delete (:240), clear-change-data (:325), clear-log (:377). `reloadCampaign()` (:459) only does `readFile(); logCache.delete(campaign); publish('reload-…')`. The playtest End lane (`src/services/encounters/playtestService.js` `endEncounterPlaytest`) rides this route, so every playtest inherits the gap.

## Suggested fix
In the rollback route, immediately after `reloadCampaign(campaign)` (or before the extract), add `activeMaps.delete(campaign)` — matching the admin-clear lanes. If the restored `__map__` should keep its active map live, instead re-point `activeMaps` from the restored change-data value (`characterChangeData.get(campaign)?.__map__?.activeMapName`, only if that file exists after extraction). Either way, extend `server/routes/campaigns-admin.test.js` / the rollback test suite with a pin: activate a slug → rollback to a snapshot that lacks it → `GET /active-map` must return `null` (or the snapshot's active map), never the ghost.

## Severity
Minor UX issue / state-integrity divergence — no data loss (disk is honestly restored and the ghost self-heals on the next Activate), but `/active-map` lies between rollback and next activation, visitor tabs get a waiting face for an active map that "exists" per the pointer, and the GM's legitimate Deactivate is refused by an honest guard reading corrupted state. It also breaks the playtest lane's own documented "the active-map pointer rolls back" promise.
