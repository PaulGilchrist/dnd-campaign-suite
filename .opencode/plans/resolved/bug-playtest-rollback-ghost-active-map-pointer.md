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

## Resolution
FIXED 2026-11-25 (fix subagent run). The diagnosis held verbatim: reproduced live in `test-campaign` (Activate Battle Arena → EB Playtest Goblin → Start → End Playtest → Roll back) and the probe showed `GET /active-map` = `travel-encounter-stage` (file absent — maps dir back to the four baseline docs), `PUT maps/battle-arena/deactivate` = the exact 409 refusal from the repro steps, and the restored `__map__` change-data key naming `battle-arena` while `activeMaps` named the ghost.

**What was actually wrong** matches the Likely location: the rollback route (and every other folder-replacing admin lane — upload success, upload-failure recovery) calls `reloadCampaign()`, which reloaded change data + log cache but never reconciled the memory-only `activeMaps`. One refinement over the suggested fix: the fix went INTO `reloadCampaign()` rather than just the rollback route, because the upload lanes share the identical gap (an uploaded zip's maps folder replaces the disk wholesale; the pointer survived it too). Blind `activeMaps.delete()` (the first suggested option) would ALSO have failed the "Expected" clause "Deactivating the map that `__map__`/the restored disk records as active must succeed" — the repro's restored snapshot honestly recorded battle-arena as active — so the pointer is RE-DERIVED from the freshly reloaded `__map__` value, kept only if the restored maps folder actually holds the file (admin-clear delete otherwise). Full-reset keeps working unchanged: its clear runs before `reloadCampaign`, the reload then finds no `__map__` on disk and deletes again (no-op).

**Files changed:**
- `server/routes/campaigns-admin.js` — `reloadCampaign()` now reconciles `activeMaps` from the restored `__map__.activeMapName` (with an `isPlausibleMapSlug` path-separator guard mirroring `isSafeSnapshotName`'s discipline) + file-existence check; covers rollback, upload, upload-recovery, and full-reset seams in one place.
- `server/routes/campaigns-admin-rollback-active-map.test.js` — NEW regression suite (mirrors the mocked-fs rig of `campaigns-admin-rollback-selection.test.js`): re-point-to-restored-existing-slug pin, ghost-file eviction pin, absent-`__map__` eviction pin, and three traversal-shape non-promotion pins (6 tests).

**Verification:**
- `npx vitest run server/routes/campaigns-admin-rollback-active-map.test.js` → 6/6 pass.
- `npx vitest run server/routes server/utils` → 146 files / 2552 tests pass.
- `npm run lint` → zero warnings.
- Live re-verification on localhost (dev pair with the fix, server restarted since `node server.js` has no watcher): full repro cycle re-run — after "Roll back campaign", `GET /active-map` = `battle-arena` (never the ghost), maps dir = the four baseline files, `PUT maps/battle-arena/deactivate` → `{"message":"Map deactivated successfully","activeMap":null}`, subsequent `/active-map` = `null` with `__map__` also `{activeMapName:null}` (channels converged), re-Activate from the manager re-lights exactly one Active row. Adjacent sanity: a second Deactivate refuses honestly with the "no map is currently active" face.
- Closeout: Admin Clear Change Data + Clear Campaign Log (both success strips witnessed); verified `change-data` `{}`, `log` `[]`, disk files ABSENT, battle-arena md5 `94fcd0bf…` and the 15-char roster aggregate `e41642cf…` hold the baseline pins. The two fix-run playtest snapshot zips remain in `.snapshots/` under the retention policy (the explore map documents snapshot count is NOT a baseline pin).
