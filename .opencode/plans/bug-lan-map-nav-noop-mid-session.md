# LAN player's Map view cannot be re-opened mid-session — nav click silently falls back to the previous view

## Summary
On a LAN (non-localhost) player tab, once the player has left the shared Map view (e.g. clicks Log), clicking the **Map** nav button again does nothing visible: the view stays on the previous page (Log), while the app DOES mount/fetch a map in the background — and fetches the WRONG map (`battle-arena` even though `__map__.activeMapName = test-map`). No error boundary, no console error, no toast. A full page reload + campaign re-select recovers (Map view opens correctly, includes live spell-overlay shapes). Mid-session, three different click routes (role click, evaluate-dispatched click, trusted mouse click at fresh bounding box) all failed repeatedly over ~2 minutes.

## Steps to reproduce
1. `npm run dev`; open the LAN URL (e.g. `http://192.168.0.224:5173`) in a fresh (isolated) browser context.
2. Select `test-campaign`; click nav **Map** — the active map renders (works).
3. GM tab (localhost): Maps → **Activate** a different map (e.g. Test Map).
4. LAN tab: click nav **Log**, then click nav **Map** again.
5. Observe: the visible view remains the Campaign Log (`sidebar-active-indicator` still "Log", content `div.campaign-tool.log-view`).
6. Repeat step 4 — every attempt fails until the tab is fully reloaded.

## Expected behavior
Clicking Map re-mounts the shared-map view for the current `activeMapName` (as it does in a fresh session) and stays mounted.

## Actual behavior
- Map click resolves without error but the previous view (log-view) remains rendered; polling 5×600 ms after the click shows no map content (`svg` count stays at the icon baseline, no `.map` container).
- Network trace at click time: `GET /api/campaigns/test-campaign/maps` then `GET /api/campaigns/test-campaign/maps/battle-arena` — a map the tab never displayed and that is NOT the active map (`GET /__map__` = `{"activeMapName":"test-map"}`).
- Zero console errors, zero failed requests — a silent no-op.
- Recovery: reload → re-select campaign → Map works, correct map loads, overlay circles render.

## Likely location
Guessing, black-box: the player Map view's mapName resolution appears to read a stale/module-level "last map" (battle-arena was mounted earlier in this session by the hex→? flow) rather than the live `__map__` change-data value on re-entry; then the loader's rejected-load path (`useMapLoader.rejected-load` / `useHexMapSSESync`) silently unmounts the view back to the previous route instead of rendering or erroring. Check `src/components/map/Map.jsx` + `hooks/useMapLoader.js` for the player-view entry (`src/routes/config.js` Map route) and whatever effect can reset the active view within ~600 ms of mounting.

## Suggested fix
Investigate the mid-session remount: log/trace why the map view unmounts itself when re-entered on a LAN client after another map was activated (suspect a "rejected load" or activeMapName-staleness guard). At minimum, surface honest feedback (toast + stay on Map with the correct document) instead of silently falling back, and resolve mapName from `__map__` at click time rather than any cached name.

## Severity
**Broken feature** (read-path only) — LAN players lose access to the shared map view for the rest of the session and only recover via manual reload; silent failure with no feedback.
