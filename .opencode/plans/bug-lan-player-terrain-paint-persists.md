# LAN player can persistently paint terrain on outdoor hex maps (GM-only map editing leaked to network clients)

## Summary
A non-localhost (LAN) visitor to the campaign can arm the hex-map terrain **Paint** tool and write real, persistent terrain edits to the outdoor map document. The server's `PUT /api/campaigns/:campaign/maps/:mapname` skips the `refuseUnlessGm` guard whenever the stored document is `type:'outdoor'`, and the hex toolbar renders Paint terrain / Paint rivers / Roads / Travel mode fully ENABLED (not disabled) in the LAN player view — while the twin indoor-map PUT 403s with "Access denied: GM-only feature" and the AI-Dress button is correctly hidden. This violates the documented permission model ("GM features are localhost-only … network clients get read-only view" — AGENTS.md; and the maps.js comment "players … never resolve its events").

## Steps to reproduce
1. Run `npm run dev` (Vite `--host`) on the GM machine. Note the LAN URL (e.g. `http://192.168.0.224:5173`).
2. In a LAN-originated browser tab/context, select `test-campaign` (any campaign with at least one outdoor hex map; create one as GM: outdoor, gridSize 8, some terrain).
3. GM tab: on Maps, click **Activate** on the outdoor map so the player's Map view follows it.
4. LAN tab: nav **Map** (singular player nav). The hex editor mounts with toolbar buttons "Paint terrain", "Paint rivers", "Connect cities and settlements with roads", "Travel mode" — all clickable (`disabled:false`). AI Dress is absent (proving the tab IS detected as non-localhost).
5. LAN tab: click "Paint terrain", then click an empty hex cell on the board.
6. Within ~12 s (save debounce) the LAN tab fires `PUT /api/campaigns/test-campaign/maps/<hex-slug>` → **200 OK**; `GET` the map (from any client): the terrain dict gained the painted cell (verified: 28 → 30 cells, new `"7,4":"plains"` and `"4,6":"plains"` entries). Change is broadcast to every client via `map-data-<campaign>-<map>` SSE.
7. Control: from the SAME LAN tab, `fetch PUT /api/campaigns/test-campaign/maps/test-map` (indoor doc) → **403 `{"error":"Access denied: GM-only feature"}`**.

## Expected behavior
Per the app's permission model, map EDITING affordances are GM/localhost-only: on a network client the hex toolbar should not enable Paint terrain/rivers/roads (travel is the arguable shared lane), and/or the server should refuse editor-scope mutations (terrain/pois/roads/zoom) from non-localhost PUTs on outdoor documents.

## Actual behavior
- Paint/Rivers/Roads/Travel buttons render enabled in the LAN player tab (only AI-Dress is host-gated).
- A paint click from the LAN tab is saved by the server (200) and persists to disk + broadcasts to all clients. Only the indoor branch is GM-guarded.
- Failed-write feedback is moot because the write SUCCEEDS — the player sees terrain silently change (and the GM's map mutates under them).

## Likely location
- Server: `server/routes/maps.js` PUT handler (~line 332): `if (!isOutdoor && !refuseUnlessGm(req, res)) return;` — the `!isOutdoor` short-circuit exempts ALL outdoor writes from the GM guard (the outdoor branch needs to stay open only for the shared player lanes — fog reveal / party-marker/travel state — not editor fields).
- Client: `src/components/hex-map/HexMapToolbar.jsx` — `paint/rivers/road/travel` buttons are not gated on the `isLocalhost` prop the way `dressButton` is (`HexMap.jsx` passes `isLocalhost` down; toolbar ignores it for the edit tools). `src/components/hex-map/hooks/useTerrainPainting.js` likewise has zero `isLocalhost` references.

## Suggested fix
- Server-first (deny-safe): in the PUT outdoor branch, when `!isLocalhost(req)`, diff incoming body vs stored doc and accept ONLY the player-legit keys (e.g. per-client fog `revealed` sets / travel acks the outdoor lane actually needs players to write); 403 editor-scope deltas (terrain, rivers, roads, pois, placedItems, zoom/pan) with the canonical GM-only response. Investigate which outdoor fields real player sessions write today (grep client outdoor save callers) before scoping.
- Client parity: hide/disable terrain-paint, river, road toolbar buttons when `!isLocalhost` (mirror the dressButton pattern) so the read-only view is honest even before the server fix lands.
- Note: `maps-create-localhost-guard.test.js` covers create; add the outdoor-PUT differential to `maps.test.js`.

## Severity
**Data integrity risk** — any network visitor can silently rewrite a production campaign's outdoor map (terrain/POIs/roads via full-doc save) and broadcast the mutation to all players, while the app's own docs promise read-only LAN views.
