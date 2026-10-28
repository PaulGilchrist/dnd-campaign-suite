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
