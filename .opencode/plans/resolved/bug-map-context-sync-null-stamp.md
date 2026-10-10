# MapContextSync force-stamps `__map__: null`, clobbering active map server state

### Summary
Every client running `MapContextSync` force-POSTs its *local* `activeMapName` to the shared runtime key `__map__` — including `null` when that tab has no map open. A tab that merely selects the campaign (or a read-only player tab) overwrites the server's `__map__.activeMapName` with `null`, desyncing it from the authoritative `activeMaps` used by `/maps`. Every grid-distance gate that reads `getRuntimeValue('__map__','activeMapName')` then sees no map.

### Steps to reproduce
1. GM tab (localhost): in `test-campaign`, activate a map (e.g. QA Fog Map). Confirm `GET /api/campaigns/test-campaign/maps` shows `isActive: true`.
2. Player tab (LAN IP e.g. http://100.92.171.80:5173): select `test-campaign`. Watch network.
3. Inspect `GET /api/campaigns/test-campaign/change-data`.

### Expected behavior
`__map__.activeMapName` should reflect the server-authoritative active map (`activeMaps`), or the player tab should not write map state at all (players are read-only).

### Actual behavior
On campaign-select, the player tab fires `POST /api/campaigns/test-campaign/__map__` with body `{"value":{"activeMapName":null}}` (observed twice per select, requests #1366/#1368). Afterwards `change-data.__map__` is `{activeMapName:null}` while `/maps` reports the map still `isActive:true` — two sources of truth permanently disagree until some tab re-stamps the real name. Confirmed live.

### Likely location
Confident: `src/components/common/MapContextSync.jsx:9-24`. It force-stamps (bypassing the equality guard) `activeMapName: mapKey` on every `[campaignName, activeMapName]` change; a freshly-mounted tab has local `activeMapName = null` (App.jsx:342) and its initial-map fetch (App.jsx:406-418) races this stamp. Nothing reconciles `__map__` against the server's `activeMaps` after activation, and the activate route (maps.js:241-258) publishes SSE but does not update the `__map__` runtime key.

### Suggested fix
Root cause is a client-owned mirror of server state with no authoritative source. Options:
1. Make the server own `__map__`: have `POST .../activate` (and rename/delete) write `__map__` server-side; drop the client stamp of `null` and only stamp non-null on explicit GM open.
2. Gate the stamp: in `MapContextSync`, skip the force-stamp when `mapKey` is null on initial mount (let the App.jsx active-map fetch set it first), and never write from `isLocalhost===false` clients.
First read `src/App.jsx` (activeMapName init + MapsAreaView) and `server/routes/maps.js` activate/rename/delete routes to pick the least-invasive seam.

### Severity
Data integrity risk — all grid/range enforcement (`rangeCheck.js`, spell/range handlers reading `__map__.activeMapName`) silently loses the map context whenever a second tab selects the campaign, so "within X ft" gates degrade to gridless/lenient.

## Resolution

**Fixed 2026-10-10.** Both suggested seams were needed, plus a correction to the diagnosis:

**What was actually wrong** (verified live): the mismatch was persistent even with a *single* GM tab — clicking **Activate** updates the server's `activeMaps` (and `/maps` `isActive`) but never wrote the `__map__` runtime key, and the only writer of `__map__` (`MapContextSync`) mirrors *local tab* state, which "Activate" doesn't change. The second-tab null stamp observed in the repro (#1365/#1367, `{"activeMapName":null}`) was real but self-healed ~moments later once that tab's active-map fetch resolved and it re-stamped the real name (`battle-arena`, #1382/#1384). The persistent clobber case is: GM activates **after** any tab has mounted — every tab's local `activeMapName` is null, nothing stamps the real name, and `/maps` vs `change-data.__map__` disagree indefinitely.

**Fix (server owns `__map__`, clients never stamp null):**
- `server/routes/maps.js` — new `stampActiveMapContext(campaign, mapKey)` helper mirroring the established `positioning` POST pattern in `campaigns-changedata.js` (write `characterChangeData` → `markDirty` → `publish('change-{campaign}-__map__')`). Called from **activate** (real name), **rename** (when the renamed map is active), and **delete** (null, only when the deleted map was active). All clients update instantly via the existing SSE `change-{campaign}-{key}` handler in `App.jsx`.
- `src/components/common/MapContextSync.jsx` — only stamps `__map__` (local store + force-POST) when `mapKey` is non-null; a freshly-mounted tab's null never touches the server. `__campaign__` stamp unchanged. Dual-ruleset N/A (rules-agnostic infra); no 2024 sibling exists.
- `server/routes/maps-rename.test.js` — its `changeData.js` mock now exports `characterChangeData`/`markDirty` to mirror the module (500s otherwise).

**Verification:**
- Live repro re-run (Playwright, GM localhost tab + player tab on LAN IP): after Activate, `change-data.__map__` = `{activeMapName:'battle-arena'}` and `/maps` `isActive:true` agree *immediately*, with no POST from any tab required. Player-tab campaign-select fired **zero** `__map__` null POSTs (previously 2); its single `__map__` POST carried the authoritative non-null name. Server state stayed `battle-arena` at all times. Adjacent sanity: player "Map" click opened the battle-arena grid (`svg.grid-svg` present, 0 console errors).
- Tests: new `server/routes/maps-active-map-context.test.js` (7 tests: activate stamps/repairs/broadcasts, delete clears only when active, rename follows only when active) + new `src/components/common/MapContextSync.null-stamp.test.jsx` (2 tests: never stamps null; stamps resolved real name) — all pass. Touched folder: `maps.test.js` + `maps-rename.test.js` + new file = 94 passed. `npm run lint` clean (zero warnings).
- Cleanup: Admin → Clear Change Data (keys `[]`) + Clear Campaign Log (0 entries) on `test-campaign`. Existing maps Battle Arena / Test Map left in place, battle-arena active.
