# Campaign rename leaves a ghost folder: server re-creates the OLD campaign directory from stale in-memory caches (log flush + stale-client writes)

## Summary
Renaming a campaign via `PUT /api/campaigns/:campaign {newName}` moves the folder and migrates three in-memory maps, but NOT `logCache` (from `server/routes/log.js`). The debounced log flush iterates EVERY `logCache` key and calls `ensureDataDir(campaign)` — which `mkdirSync(recursive)`-recreates the old campaign folder — then writes the FULL pre-rename log into it. Result: both old and new campaign folders exist on disk with (near-identical) data. This was observed live during the 2026-10-25 fix cycle: after the rename-bug-fix round-trip (test-campaign → test-campaign-renamed → test-campaign), the `test-campaign-renamed/` bucket was resurrected onto disk ~1 min later mid-session ("empty data/ folder + pre-revert log" per playbook §11 CAMPAIGN-RENAME GHOST-FOLDER). `characterChangeData.saveFile()` DOES have a phantom guard (skips + purges memory when the campaign dir no longer exists), but the log flush has no such guard — and once the log flush recreates the folder, the change-data guard sees an existing dir and happily writes the stale snapshot back too. Secondary lane: stale browser clients (SSE subscribers + runtime store still keyed to the old name) keep POSTing under the old campaign name after a rename; CRUD routes call `ensureDataDir(campaign)` (jsonEntityCrud.js:35/71, sessions.js:22, settlements.js:22, log.js:35) which recreates the deleted/renamed-away folder on ANY write — no campaign-exists validation.

## Steps to reproduce
1. In test-campaign (on :5173), ensure the log is non-empty (GET `/api/campaigns/test-campaign/log` — this populates `logCache['test-campaign']`).
2. Rename: `curl -X PUT --max-time 10 http://localhost:5173/api/campaigns/test-campaign -H 'Content-Type: application/json' -d '{"newName":"test-campaign-renamed"}'`.
3. Immediately touch anything that schedules a log flush or any ensureDataDir write under the OLD name — easiest: GET `/api/campaigns/test-campaign/log` (loadLog seeds logCache) or have a stale client tab POST change-data under the old name.
4. Wait ~3–20s (debounce: log flush 1s, change data 2s).
5. `ls public/campaigns/` and `curl -s --max-time 5 http://localhost:80/api/campaigns`.

## Expected behavior
After a rename only the NEW folder exists. Server writes against a campaign whose directory does not exist must be rejected (404) — never silently re-created — and rename must migrate/purge ALL campaign-keyed in-memory state including `logCache`.

## Actual behavior
Both folders exist: old name carries the full pre-rename `campaign-log.json` (and can carry a stale `character-change-data.json` snapshot once the folder was re-created by the log flush). The campaign list API shows the ghost until the server is restarted.

## Likely location
CONFIDENT (code reading):
- `server/routes/campaigns-admin.js:99-112` `migrateCampaignMemoryMaps` — migrates `characterChangeData`, `spellOverlayData`, `activeMaps` but NOT `logCache` (compare the DELETE route at :207-211 which DOES delete `logCache`).
- `server/routes/log.js:31-47` `saveLogFile()` — iterates all `logCache.keys()`, calls `ensureDataDir(campaign)` (:35) with no "campaign dir exists" guard, resurrecting folders for stale keys.
- `server/utils/campaignPaths.js:32-37` `ensureDataDir` — `mkdirSync(recursive)` blind creator; used by all CRUD write routes, so stale clients re-materialize renamed-away/deleted campaigns.
- `server/utils/changeData.js:104-133` `saveFile()` — phantom guard exists but only deletes memory when dir missing; ordering with the log-flush resurrection defeats it.

## Suggested fix
1. In `migrateCampaignMemoryMaps`: also move the `logCache` entry old→new (import already available pattern: DELETE route imports `logCache` from './log.js').
2. In `log.js saveLogFile`: skip + purge memory keys whose campaign directory no longer exists (mirror `changeData.js:110-118` guard exactly).
3. Consider (scope-check first): reject writes to non-existent campaigns in the CRUD write path instead of `ensureDataDir` auto-creating (may be wide-reaching — at minimum fix lanes 1 and 2 which are the confirmed resurrection mechanism; note the rest).
4. The DELETE route already purges logCache — keep as-is.

## Notes
- Filed by the coordinator after the fix cycle for bug-campaign-rename-double-prompt (which fixed the UI double-prompt; the server round-trip was reported "sound" but leaves this ghost residue under debounce).
- Cleanup lane when a ghost exists: `DELETE /api/campaigns/:ghost` purges all memory maps so saveFile sweeps can't re-flush (playbook §11).

## Resolution
**Diagnosis CONFIRMED verbatim** (live pre-fix repro on the running dev server, 2026-10-25): POST log entry into `test-campaign` (seeds `logCache['test-campaign']` + schedules the 1s flush) → `PUT` rename to `test-campaign-renamed` inside the debounce window → stale-client GET + POST under the OLD name → after the sleep, `ls public/campaigns/` showed **BOTH** folders; the ghost `test-campaign/` carried the full pre-rename `campaign-log.json` (both marker entries), and `GET /api/campaigns` listed 6 folders. Two resurrection lanes proven: (a) the pending `saveLogFile()` flush iterating the un-migrated old `logCache` key → `ensureDataDir()` mkdir-recursed the folder; (b) stale-client POST under the old name re-seeding + re-scheduling the same flush.

**Files changed:**
- `server/routes/campaigns-admin.js` — `migrateCampaignMemoryMaps()` now also moves the `logCache` entry old→new (4th block, mirroring `characterChangeData`/`spellOverlayData`/`activeMaps`; `logCache` was already imported for the DELETE route).
- `server/routes/log.js` — `saveLogFile()` flush loop gained the phantom guard mirroring `changeData.js:110-118`: `if (!fs.existsSync(campaignDir(campaign)))` → `console.error` + `logCache.delete` + `continue` (checks the CAMPAIGN dir, not the data dir — a live campaign that merely lost `data/` still gets it recreated by `ensureDataDir`). Imported `campaignDir` from `campaignPaths.js`.
- `server/routes/campaigns-admin.test.js` — 2 new rename tests: logCache migrates old→new (old key gone so no sweep can resurrect; content follows the rename; nothing written under the old name) + no phantom key created for uncached campaigns. Existing mock conventions reused.
- `server/routes/log.test.js` — new "Phantom-campaign guard in flush" suite: stale key whose campaign dir is gone is skipped + purged (no write, no mkdir, live campaign still persists) + data-dir-only removal still persists. Mock updated: `campaignDir` added to the `campaignPaths` mock, `ensureCampaign()` now also registers the campaign root dir (real folders always have it; the guard checks it via the mocked fs).

**Post-fix verification (live, fresh API restart):** same repro sequence → after rename + old-name GET/POST + 20s wait, `ls public/campaigns/` shows ONLY `test-campaign-renamed` (no ghost ever appears); `/tmp/dnd-api.log` carries the `[log] Skipping persist … phantom campaign regeneration` purge message once; log content followed the rename (`GHOST-VERIFY-MARKER` readable + on disk under the new name); revert via PUT and a full **browser Admin modal round-trip** (rename → select → Admin → Rename Campaign → `#rename-campaign-input` → Rename; modal value now decides, no native prompt) both legs clean with 20s debounce waits — final `ls`/`GET /api/campaigns` = exactly the 5 baseline folders. Adjacent sanity: throwaway campaign create → log seed → DELETE → 20s → no resurrection; normal log write under `test-campaign` persists to disk + GET. Final state: log + change-data cleared for `test-campaign` via Admin; `GET /log` = `[]`.

**Tests/lint:** targeted files 69/69; `npx vitest run server/routes server/utils` 62 files/1501 tests green; full `npm run test:run` 2803 files/31275 passed (3 expected fail); `npm run lint` zero warnings.

**Residual deliberately left (lane 3 — `ensureDataDir` auto-create on stale-client writes):** NOT guarded. Blast radius assessed too wide for this ticket: the CRUD factory's auto-create also fires on **GET** (`loadOrInit`, jsonEntityCrud.js:35), so a campaign-exists 404 gate there changes read semantics for every entity route, and the factory is only one of six `ensureDataDir` call sites (sessions.js:22, settlements.js:22, inventory.js:79, npcs.js:86, log.js — routes with bespoke write paths). A factory-only guard would close one lane while leaving the rest, with ~20 CRUD test files' mock conventions (many never register the campaign root dir) as collateral risk. The confirmed resurrection mechanism is fully closed by fixes 1+2: even when a stale-client POST is still accepted in memory with 200, the flush guard now skips + purges it before it can touch disk. Proper fix = campaign-exists middleware at router-mount level returning 404, owned by a dedicated ticket. Side effect of the fix worth knowing: a stale client GETting the old name after a rename receives `[]` (cache migrated + disk moved) instead of stale data — honest, and prompts a campaign re-select.
