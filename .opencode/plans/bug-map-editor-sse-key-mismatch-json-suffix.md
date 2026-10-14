# Bug: Map editor opened from Maps manager never live-syncs (mapName keeps `.json` suffix, SSE keys never match)

### Summary
When the GM opens a map via the Maps manager "Open" button, the editor receives `mapName` with the `.json` file suffix (e.g. `test-map.json`). Its SSE subscription builds `expectedKey = "map-data-test-campaign-test-map.json"` while the server publishes `map-data-test-campaign-test-map` — so **every live map update (walls, players/tokens, revealed/fog, placedItems, grid size) is silently dropped**. A second tab painting walls never appears in the first, forever.

### Steps to reproduce
1. In test-campaign, open two browser tabs on http://localhost:5173, both select test-campaign (localhost = GM in both).
2. Tab A: Maps → Test Map → **Open** (editor renders the current map from disk).
3. Tab B: Maps → Test Map → Open, then Paint a vertical wall (drag down any column). The wall appears in tab B; `GET /api/campaigns/test-campaign/maps/test-map.json` shows the new wall cells persisted; tab B publishes.
4. Watch tab A for 10+ seconds: its SVG keeps the OLD `.wall-cell` count (verified: 14 vs server 24 after 8s). No reload, no error.

Verified internals (tab A):
- SSE event DOES arrive: instrumented the shared `subscribeToSSE` handler set — handler fires with `key:"map-data-test-campaign-test-map"`, `data.walls.length=24`.
- React state stays stale: fiber dump of the mounted Map component shows `mapData.walls = Set(14)`.
- Mounted Map props: `mapName = "test-map.json"` → `useSSESync` builds `expectedKey` ending in `.json` → `if (event.key !== expectedKey) return;` drops every event.

### Expected behavior
Tab A live-updates walls/players/revealed within ~1s of tab B's edit (same behavior players get via the `map-activate` auto-open path).

### Actual behavior
Zero live sync in the manager-opened editor; silent. Worse: the stale tab auto-saves its own `mapData` (revealed merges, drags), so a full-map POST from the deaf tab can **regress newer server state** (lost-update risk on walls/revealed).

### Likely location
Confident: `src/components/maps-manager/MapsManager.jsx:363` — `<button onClick={() => onOpenMap(map.fileName)}>Open</button>` passes the raw filename WITH `.json`. `App.jsx handleEnterMap` stores it verbatim into `mapsView.mapName` and renders `<Map mapName=…>`. Compare the correct player path: `App.jsx:491` `activeMap.fileName.replace(/\.json$/, '')`. Server publish is suffix-free: `server/routes/maps.js:301`.

### Suggested fix
Strip the suffix at the seam: `onOpenMap(map.fileName.replace(/\.json$/, ''))` — or normalize once inside `handleEnterMap`/`Map` (`const baseName = (mapName||'').replace(/\.json$/,'')` and use it for `expectedKey` + fetch). Add a regression test: manager-open mount + emit `map-data-<c>-<name>` → walls state updates.

### Severity
Broken feature — multi-tab real-time map sync (the flagship server-first feature) is completely dead in the most common GM route (opening from the Maps manager), silently, with data-loss potential on concurrent edits.
