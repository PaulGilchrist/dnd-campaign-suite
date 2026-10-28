# Admin campaign replace (rollback/upload/full-reset) broadcast `reload-<campaign>` is dropped — other connected clients silently keep serving stale data

## Summary
After an Admin rollback (and the same code path runs for campaign upload and full reset), the server calls `reloadCampaign()` which publishes an SSE event `reload-<campaign>` with `data: null`, plainly intended to tell every connected client "the whole campaign was replaced under you — refresh". No client code consumes that key: the shared SSE dispatcher in `App.jsx` (`handleRuntimeEvent`) drops any event whose `data == null` unless the key starts with `change-<campaign>-`. Passive players/GMs therefore continue interacting against a campaign that no longer exists on the server, with zero reload, notification, or list refresh.

## Steps to reproduce
Proven live 2026-10-28 (run O) in test-campaign, dev:locked, two tabs on localhost:5173:

1. Tab A: in Admin, click **Create Snapshot** (restore point = current state, e.g. NPCs `[Marta Copperkettle]`).
2. Add data that will be rolled back: `POST /api/campaigns/test-campaign/npcs` with body `{"npcs":[…Marta…, {"name":"QA RunO Rollback", …}]}` (array-wrapped envelope).
3. Tab B (second client, same campaign): open the **NPCs** view. It lists `Marta Copperkettle` + `QA RunO Rollback`. Plant `window.__noReload='B-marker'` in Tab B.
4. Trigger a rollback WITHOUT reloading Tab B — e.g. from a terminal: `curl -X POST http://localhost/api/campaigns/test-campaign/admin/rollback` → `{"message":"Rollback complete","restored":"test-campaign-…​.zip"}`. Disk NPCs is now `[Marta Copperkettle]` (GET-verify).
5. Observe Tab B for 2+ s (then minutes, if you like).

## Expected behavior
All clients in the campaign react to the whole-campaign replacement: at minimum refresh the view / re-fetch entity lists, or show a "campaign was restored/updated — reload?" notice. (Initiating client already reloads itself via `window.location.reload()` + sessionStorage `postRestoreNotice`; the SSE broadcast exists precisely for the OTHER clients.)

## Actual behavior
Tab B does nothing:
- still lists `QA RunO Rollback` — an NPC that no longer exists on disk (verified `GET /npcs` → `["Marta Copperkettle"]`);
- `window.__noReload` marker survives = zero page reload;
- no toast/banner/console output; the `reload-test-campaign` SSE frame arrives (server `publish()` writes it to every subscriber of the campaign) and is silently discarded.
Stale data is persistent, not transient — navigation still uses client-side cached entity state until a manual full refresh.

Concrete integrity hazard: any client-side action after the replace POSTs state derived from the vanished campaign (e.g. character buckets, combatSummary writes via `useSyncedState`), writing stale values into the freshly restored files. (Single-NPC edits use per-entity PUT, so simple list-resurrection is limited, but runtime-store buckets do overwrite.)

## Likely location
Confident:
- Server: `server/routes/campaigns-admin.js` → `reloadCampaign()` (line ~396-400) `publish(\`reload-${campaign}\`, null, campaign)` — also reached by upload (success AND failure-rollback lanes) and full-reset.
- Client: `src/App.jsx` `handleRuntimeEvent` (~line 630-649): guard `if (event.data == null && !event.key.startsWith(\`change-${campaignName}-\`)) return;` drops the frame before any handler; a repo-wide grep of `src/` finds ZERO consumers of a `reload-` key (only `window.location.reload()` calls of the initiating client and the sessionStorage `postRestoreNotice` lane).

## Suggested fix
Pick one intentionally:
- **(a) Wire the consumer** (recommended): in `handleRuntimeEvent`, before the null-data guard, handle `event.key === \`reload-${campaignName}\`` → show a dismissible "This campaign was replaced by the GM (restored/uploaded). Reload?" banner, or auto-`window.location.reload()` (the client holds no unsaved game state — server is source of truth). Exclude the initiating client (it reloads itself already; a 250 ms suppression window keyed on postRestoreNotice or just letting the self-reload race is fine).
- **(b) Kill the dead broadcast**: delete the `publish('reload-…')` line so the intent isn't mistaken — but this leaves the stale-clients problem unfixed, so (a) is preferable.

## Severity
**Data integrity risk** — a whole-campaign replace (restore from snapshot, upload backup, full reset) leaves every other connected client silently operating on, and writing back, pre-replace state indefinitely.
