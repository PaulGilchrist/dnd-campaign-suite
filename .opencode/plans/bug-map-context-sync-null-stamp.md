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
