# Player "Map" button dead-stuck on blank screen after a no-active-map alert

### Summary
If a player clicks the sidebar "Map" button when no map is active, the view is already switched to `mapsManager` and the active-map load fails with an alert. Every subsequent click on "Map" early-returns, so even after the GM activates a map the player sees a permanently blank content area until they navigate to another view first.

### Steps to reproduce
1. GM (localhost tab): in `test-campaign`, ensure NO map is active (or use a fresh campaign state where nothing is activated).
2. Player tab: open the app via the LAN URL (e.g. `http://100.92.171.80:5173` — non-localhost so the read-only sidebar with singular "Map" button is shown), select `test-campaign`.
3. Click "Map" → alert "No map is currently active. Ask your Game Master to activate one." → dismiss. Content area is blank.
4. GM tab: Maps → "Activate" on a map (e.g. QA Fog Map). Verify `GET /api/campaigns/test-campaign/maps` returns `isActive: true` for it.
5. Player tab: click "Map" again.

### Expected behavior
The second click should re-run the active-map load and render the now-active map (or the player should be pushed the map automatically via the `map-activate-<campaign>` SSE event).

### Actual behavior
Second click does nothing: no network request fires, content stays blank, sidebar shows Map highlighted with an empty main area. Confirmed live: two further Map clicks produced zero new requests; only workaround is clicking another view (e.g. Notes) and then Map — after which the map renders correctly with fog.

### Likely location
Confident: `src/App.jsx` `handleMapsClick()` — the `else if (activeView === 'mapsManager') { return; }` guard assumes being on mapsManager means a map is visible, but for players mapsManager renders blank when `mapsView.type === 'none'`. The first click sets `activeView='mapsManager'` before `loadActiveMapAndOpen()` fails, leaving that combination stuck.

### Suggested fix
In `handleMapsClick`, for non-localhost clients check `mapsView.type !== 'map'` as well as `activeView` before early-returning — i.e. if the player is not actually viewing a map, always call `loadActiveMapAndOpen()`. Better: subscribe players to the `map-activate-<campaign>` SSE event and auto-open/auto-close the active map (currently only MapsManager listens, and players never mount it).

### Severity
Broken feature — players cannot reach the map without knowing an undocumented view-switch workaround, precisely during the most common live-play flow (GM activates a map mid-session).
