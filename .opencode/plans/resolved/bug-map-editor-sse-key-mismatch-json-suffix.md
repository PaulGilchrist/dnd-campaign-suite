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

## Resolution
FIXED — 2026-10-24.

**Root cause (confirmed as diagnosed):** `MapsManager.jsx` "Open" passed the raw `map.fileName` (`test-map.json`) to `onOpenMap`; `MapsAreaView` stored it verbatim into `mapsView.mapName` and rendered `<Map mapName="test-map.json">`. Fetches survived because `mapsService` sanitizes via `toKebabCase` (strips `.json`), but `useSSESync`/`useHexMapSSESync` build `expectedKey = map-data-<campaign>-<mapName>` and the server publishes suffix-free (`server/routes/maps.js:169-170`, `:303`) — so `event.key !== expectedKey` dropped EVERY live map update in the manager-opened editor (both indoor grid and outdoor hex paths, since the same prop feeds `HexMap`).

**Fix (strip at the seam, mirroring the established pattern):**
- `src/components/maps-manager/MapsManager.jsx` — Open button now emits `map.fileName.replace(/\.json$/, '')`, exactly like the correct supplier seams `App.jsx:491` (`loadActiveMapAndOpen`) and `App.jsx:448`, and the same normalization already used inside MapsManager's own `isActive` comparison (`MapsManager.jsx:147`). One line; fixes both grid and hex editor routes; `activeMapName` also becomes suffix-free, matching the server's canonical `__map__.activeMapName` (`maps.js:22`). No server change needed (publish was already correct). Dual-ruleset: N/A — UI seam, not a rules module.

**Tests:**
- NEW `src/components/maps-manager/MapsManager.open-sse-key.test.jsx` — locks the full chain: manager mount → click Open → emitted mapName is exactly `'test-map'` → fed into `useSSESync` (as Map.jsx wires it) → emit `map-data-test-campaign-test-map` → merged walls state updates; plus belt pin that a `.json`-suffixed key is never accepted. Verified red pre-fix (`expected 'test-map.json' to be 'test-map'`; `setMapData` 0 calls), green post-fix (2/2).
- `src/components/maps-manager/MapsManager.test.jsx` — updated the one existing assertion that pinned the BUGGY bytes (`onOpenMap('map-a.json')`) to the fixed contract (`'map-a'`, `'map-b'`). This was a stale pin of the defect, not an unrelated test.
- Touched-area run: `src/components/maps-manager/ + src/components/map/ + App.map-navigation + App.state-transitions` → **56 files / 643 tests passed**. `App.map-activate.test.jsx` → 6/6 passed (auto-open seam intact). `npm run lint` → exit 0, zero warnings.

**Live re-verification (Playwright, test-campaign, dev :5173):**
- Pre-fix repro confirmed the defect exactly: tab A fiber prop `mapName: "test-map.json"`, shared-SSE observer caught `key: "map-data-test-campaign-test-map"` (walls:9) while tab A's SVG kept 0 `.wall-cell` forever.
- Post-fix: tab A manager-Open now mounts with `mapName: "test-map"` and loads all 9 disk walls; tab B painted 6 fresh walls → tab A SVG updated **9 → 15 within ~1-2s, no reload**. Then erase round-trip: tab B erased all → tab A live-updated 15 → 0; disk back to `walls: []` (original baseline). Manager Open load + Back→manager + Activate flow sanity-checked; manager listing intact.
- Cleanup: all test walls removed (disk verified 0), Admin Clear Change Data + Clear Campaign Log executed and API-verified (`log: 0 entries`, `change-data: {}`); tab B closed.

