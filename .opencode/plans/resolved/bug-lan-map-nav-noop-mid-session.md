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

## Resolution
**FIXED 2026-11-02.**

**What was actually wrong** (differs from the black-box guess): `handleMapsClick` in `src/App.jsx` had a player branch that assumed `mapsView.type === 'map'` ⇒ the player is "already on their only view, do nothing". That assumption only holds while `activeView === 'mapsManager'` — but `MapsAreaView` (the only mount point of the Map view) renders ONLY when `activeView === 'mapsManager'`. Once the player navigates to any other nav (e.g. Log), the map view is unmounted while `mapsView` still says `'map'`, so every subsequent Map click was a silent no-op stuck on the previous view — exactly the reported behavior, no reload ever healing it mid-session. A fresh session works because `mapsView` resets to `type:'none'` on campaign select, reaching the healthy `else` branch (`setActiveView('mapsManager')` + `loadActiveMapAndOpen()`).

**Not confirmed:** the "rejected-load / stale module-level map name" hypothesis. Live probe with resource-timing instrumentation showed the mid-session Map click fires **zero** network requests — there is no transient mount, no loader rejection, no unmount effect. The `GET /maps` + `GET /maps/battle-arena` pair in the original trace was background traffic from an earlier moment, not the click. The staleness concern was however REAL in a secondary sense: `mapsView.mapName` retains the old map after a GM activation while the player is away, so re-entry via the stale name would open the wrong document.

**Files changed**
- `src/App.jsx` — `handleMapsClick`: player + `mapsView.type === 'map'` + `activeView !== 'mapsManager'` now re-arms the view (`setActiveView('mapsManager')`) and re-resolves the CURRENT active map at click time (`loadActiveMapAndOpen()`, which reads the live server `isActive` flag). Clicking Map while already viewing it remains the established no-op (pinned by the sibling test).
- `src/App.map-navigation.test.jsx` — new Player regression test `re-clicking Map after leaving to another view re-mounts the map and follows the current active map` (locks BOTH legs: view re-mount after Log, and following a GM activation made while away — dungeon-1→crypt-2) + header contract docstring updated.

**Verification**
- Repro reproduced live first (LAN IP :5173, isolated context, `npm run dev:locked`): Log→Map re-click kept `sidebar-active-indicator` "Log" + `div.campaign-tool.log-view` mounted across 5 clicks, zero console errors, zero click-time requests — matching the report.
- Post-fix live re-run in test-campaign: Map re-click → indicator "Maps", log-view gone, `.map` container mounted on **Test Map** (the then-active map); repeat cycle stable; GM activating Battle Arena while the player sat on Log → one Map click opened **Battle Arena** (fresh resolution at click time — the "resolve from `__map__` at click time" ask); fresh-session Map open, Log nav, and character-sheet nav all still fine; console errors: 0.
- `npx vitest run src/App.map-navigation.test.jsx` — 11 passed; honesty check: with the fix branch disabled the new test fails exactly as described (no remount), passes when restored. Touched-area run (App.map-navigation / map-unavailable / map-activate / state-transitions / runtime-events + Sidebar + mockComponents): **206 passed**. `npm run lint` — clean (zero warnings).
- Cleanup: change-data `{}` + log `[]` two-pass verified from a quiet (deselected) tab; maps back to baseline (both inactive).
