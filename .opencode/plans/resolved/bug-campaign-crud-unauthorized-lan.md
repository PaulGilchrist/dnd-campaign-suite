# Campaign create/rename/delete API routes have NO host/GM gate — any LAN player can rename or recursively DELETE any campaign when running unlocked

## Summary
Three campaign-management routes in `server/routes/campaigns-admin.js` — `POST /api/campaigns` (create), `PUT /api/campaigns/:campaign` (rename, does `fs.renameSync`), `DELETE /api/campaigns/:campaign` (does `fs.rmSync(dir, {recursive:true})`) — execute for **any** client. Every sibling admin lane (clear-change-data, clear-log, snapshot, rollback, upload, download, full-reset, upload-inspect) starts with an `isLocalhost(req)` 403 guard, and character-create has `refuseUnlessGm` — these three have neither. In normal production (`npm start`, no `CAMPAIGN_LOCK`) a player on the network can permanently destroy or rename production campaigns with a single fetch; the only thing that has been hiding this is the dev-lock middleware, which is not the authority model.

## Steps to reproduce
Live-proven 2026-10-28 (run P) with a **disk-inert** probe (dup-name + nonexistent targets — nothing was created, renamed, or destroyed):
1. Start the app the normal production way (no lock): `npm run api` (or `node server.js`) — confirm `GET /api/server-config` → `{"campaignLocked":false}`.
2. From the player URL (LAN host, not localhost):
   - `curl -X POST -H 'Content-Type: application/json' -d '{"campaignName":"test-campaign"}' http://100.92.171.80/api/campaigns` → **400 `Campaign already exists`** (route BODY executed — a novel name here would create a campaign).
   - `curl -X PUT -H 'Content-Type: application/json' -d '{"newName":"zz"}' http://100.92.171.80/api/campaigns/__no_such__` → **404 `Campaign not found`** (route executed — an existing name here would rename it via `fs.renameSync`).
   - `curl -X DELETE http://100.92.171.80/api/campaigns/__no_such__` → **404 `Campaign not found`** (route executed — an existing name here would `fs.rmSync` the whole campaign dir, no undo).
3. Control on the same socket/session: `curl -X POST http://100.92.171.80/api/campaigns/test-campaign/admin/clear-change-data` → **403 `Only available on localhost`** — proving the admin gate works and is simply absent from the three routes above.
4. With `CAMPAIGN_LOCK` set (dev:locked), all three correctly 403 via the global lock middleware (`Campaign locked to "test-campaign" — ... denied`) — masking the gap in day-to-day dev sessions.

## Expected behavior
Non-GM (non-localhost) clients receive 403 from campaign create/rename/delete, exactly as they already do from every admin data-management lane. The player-view UI hiding the buttons is presentation, not authority.

## Actual behavior
The routes run to completion for LAN hosts when unlocked. Worst case is trivially destructive: `DELETE /api/campaigns/Frostfall` from any device on the network recursively deletes an entire production campaign (characters, maps, data, log) with no confirm, no snapshot, no log.

## Likely location
Confident: `server/routes/campaigns-admin.js` — `POST /api/campaigns` (~:102), `PUT /api/campaigns/:campaign` (~:194), `DELETE /api/campaigns/:campaign` (~:228). The file already defines `isLocalhost(req)` (:46) and applies it to all nine other routes; these three are the outliers. (Note: prior exploration runs recorded “Add-Campaign 403” — that was the CAMPAIGN_LOCK middleware answering, not a host gate.)

## Suggested fix
Add the same `if (!isLocalhost(req)) return res.status(403).json({ error: 'Only available on localhost' });` guard (or `refuseUnlessGm`, whichever matches the intended GM model) to the head of all three handlers, mirroring `clear-change-data` (:250). Add three supertest cases using a non-localhost Host asserting 403 + disk-inert, mirroring `campaigns-admin-clear-change-data.test.js`. Also worth a once-over for other route files that define `isLocalhost`/`refuseUnlessGm` but might have ungated siblings.

## Severity
**Data integrity risk (security)** — one unauthenticated LAN request can irreversibly destroy a production campaign; recursive-delete and rename reach, GM-only operations, exposed to every connected player. Not “broken feature” because nothing is malfunctioning for the GM — it is a silent authority hole.

## Resolution
**FIXED 2026-10-28 (fix run Q).** Confirmed root cause exactly as filed: `POST /api/campaigns`, `PUT /api/campaigns/:campaign`, `DELETE /api/campaigns/:campaign` in `server/routes/campaigns-admin.js` were the only mutating routes in the file without the `isLocalhost(req)` host gate that all nine `/admin/*` siblings enforce.

**Files changed:**
- `server/routes/campaigns-admin.js` — added the canonical guard `if (!isLocalhost(req)) return res.status(403).json({ error: 'Only available on localhost' });` (byte-identical to `clear-change-data`) at the head of all three handlers (+12 lines).
- `server/routes/campaigns-admin-crud-localhost-guard.test.js` (new) — 6 supertest cases mirroring `campaigns-admin-clear-changedata.test.js`: non-localhost Host (`100.92.171.80`) → 403 + disk-inert (mocked `mkdirSync`/`renameSync`/`rmSync` never called, mocked dirs untouched — including probes against EXISTING campaigns that pre-fix would have renamed/destroyed), plus localhost-passes cases for each lane.

**Live pre-fix reproduction** (isolated `PORT=8081 node server.js`, `campaignLocked:false`, LAN-IP host): POST dup-name → **400** `Campaign already exists`; PUT/DELETE `__no_such__` → **404** `Campaign not found`; control `POST …/admin/clear-change-data` → **403** `Only available on localhost`. Routes executed.

**Live post-fix verification** (:8081 restarted with fix): all five LAN probes — including PUT rename and DELETE of EXISTING `test-campaign` — → **403** `Only available on localhost` (gate fires before any disk reach); localhost `GET /api/campaigns` 200, localhost create still reaches route body (400 dup). Browser sanity on :5173: campaign list renders, `test-campaign` selects (header verified), Add Character present. `npx vitest run server/routes` → **67 files / 1207 tests passed** (incl. pre-existing `campaigns-admin.test.js` which binds 127.0.0.1 → gate passes). `npm run lint` → zero warnings.

**Incident during verification (fully reverted, disclosed):** the end-of-run LAN probe against the dev:locked :80 stack renamed `test-campaign` → `zz` (HTTP 200). Cause: the CAMPAIGN_LOCK middleware (`server.js:39-48`) compares only the **:campaign SOURCE param**, and `test-campaign` == the locked name, so a rename AWAY from the locked campaign slips past the lock — the host gate that would have caught it was the very bug being fixed, and :80 predated the fix. Recovery per the documented API-only restart recipe (`app-exploration.md` Reliable Selectors “LAN authority probe” row): copy folder back → kill only the :80 node process → `CAMPAIGN_LOCK=test-campaign node server.js` (Vite :5173 survived) → confirmed `test-campaign`/`zz` dirs byte-identical (`diff -r`) → removed the `zz` copy (the restarted server’s stale `zz` memory key was auto-purged by the changeData phantom-guard: `Skipping persist for campaign "zz" … Removing from memory`). Final disk: `public/campaigns/` byte-identical to run-start baseline; change-data + log cleared to `{}`/`[]` via the Admin lane. The host gate now closes this exact lane: post-fix :80 LAN PUT rename of `test-campaign` returns 403.

**Secondary findings (report only, not fixed):**
1. `POST /api/campaigns/migrate-image-paths` (`campaigns-admin.js:51`) — a one-time GM migration that bulk-rewrites every campaign’s files — has NO host gate. Same-file outlier, not destroy/rename class.
2. `DELETE /api/campaigns/:campaign/:file` (`campaigns-character.js:183`) — character file + image unlink — lacks the `refuseUnlessGm` its sibling POST-create (:216) carries; appears to be known/documented state (player-view delete-lane quirks filed separately), so reported not changed.
3. CAMPAIGN_LOCK middleware (`server.js:44`) checks only the source param — under the lock, a localhost (or future gateless) rename can still move the locked campaign out from under the harness. Consider also validating `req.body.newName` for `PUT /api/campaigns/:campaign` when locked.
4. `POST /api/campaigns/:campaign/maps` (`maps.js:236`) has no `refuseUnlessGm` while all its mutation siblings do — likely intentional (API map-create rigs are documented for exploration runs); flagging for owner adjudication.

