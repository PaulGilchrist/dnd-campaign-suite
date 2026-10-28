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

## Resolution
**FIXED 2026-10-28.** Root cause confirmed exactly as diagnosed: `reloadCampaign()` (server `campaigns-admin.js:396-400`) publishes `reload-<campaign>` with `data: null` on every rollback/upload/full-reset, and the client dropped it — `App.jsx handleRuntimeEvent` null-data guard (`event.data == null && !key.startsWith('change-<campaign>-')`) rejected the frame before any handler, and a repo-wide grep found zero consumers of a `reload-` key.

**Fix (option (a) — wire the consumer):** a new self-subscribing banner component consumes the frame; no server or dispatch-table changes.

- `src/components/common/CampaignReloadNotice/CampaignReloadNotice.jsx` (new) — subscribes via the shared `subscribeToSSE(campaignName, …)` lane (same pattern as `useLog`), listens ONLY for `key === 'reload-<campaign>'`, and shows a fixed-top `role="alert"` banner ("This campaign was replaced on the server… Reload / Dismiss"). Reload = `window.location.reload()`; Dismiss hides until the next frame; the banner resets on campaign switch. The initiating tab is excluded by the existing sessionStorage `postRestoreNotice` marker (it writes it immediately before its own `reload()`; the guard covers the window where the SSE fan-out echoes back before navigation). UI-only ephemeral state — no game state touched, server remains truth.
- `src/components/common/CampaignReloadNotice/CampaignReloadNotice.css` (new) — scoped styles; colors mirror the `.admin-status--error` warning lane; buttons ride the global `.ct-container .ct-*` classes. No inline styles, no `!important`.
- `src/App.jsx` — 2-line mount only (`<CampaignReloadNotice campaignName={campaignName} />` beside `<Subscriber>`). Deliberately NOT wired into `handleRuntimeEvent`: App sits at its `max-statements` 60 ceiling, and a self-subscribing component (precedent: `useLog`, `PartyInventory`) keeps the shared single-SSE-client invariant with zero added statements.
- `src/components/common/CampaignReloadNotice/CampaignReloadNotice.reload-broadcast.test.jsx` (new) — 6 tests: null-data reload frame surfaces banner; Reload calls `location.reload()`; Dismiss hides and a later frame re-shows; foreign-campaign `reload-*` and ordinary `change-`/`log-` frames stay inert; initiating tab (postRestoreNotice present) never banners; unmount unsubscribes.

Both 5e and 2024 lanes unaffected — the broadcast lane is ruleset-neutral.

**Verification:**
- Live repro re-run pre-fix (this session): Tab B NPC view kept deleted `QA Bugfix Reload` after curl rollback, `window.__noReload` survived, no banner — bug confirmed.
- Live re-verification post-fix, two tabs on :5173 dev:locked, header `test-campaign` verified every hop: curl rollback → passive tab shows the banner within ~2s (marker intact = no forced reload); clicking Reload recovers (list = `[Marta Copperkettle]`, matches disk); Dismiss hides; a UI-initiated rollback from Tab A's Admin shows the banner on Tab B while Tab A self-reloads with its `postRestoreNotice` "Campaign restored from …" banner (initiating lane intact); normal `npcs`-list SSE cross-tab mirroring still works live.
- Tests: new file 6/6; all 7 sibling `src/App.*.test.jsx` + `subscriber.test.jsx` = 81/81 pass. `npm run lint` clean (zero warnings).
- Cleanup: probe NPC removed by the recovery rollback; change-data `{}` + log `[]` GET-verified from closed-tab quiet state.
