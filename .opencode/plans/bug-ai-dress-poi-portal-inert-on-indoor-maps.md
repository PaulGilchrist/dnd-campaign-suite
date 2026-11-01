# AI Dress portal POI (`targetMap`) applies on INDOOR maps but the portal is dead — `linkedMap` has zero indoor consumers

### Summary
The dress op set advertises `poi.targetMap` ("optionally a portal") for every map kind, and applying such a plan on an indoor map persists `linkedMap` into the doc, but the indoor view has no click/enter lane and no consumer reads `linkedMap` — the marker renders as a plain landmark and clicking it does nothing. Only hex maps implement portal entry. The GM silently gets a fake door.

### Steps to reproduce
1. In `test-campaign`, with AI enabled against a fake model returning `{"ops":[{"op":"add","target":"poi","poi":{"name":"QA AY Gate","description":"A gate to the arena.","targetMap":"battle-arena"},"gridX":7,"gridY":2}]}` (QA rig: instruction containing `POIPORTAL`).
2. Maps → Open "Test Map" (indoor) → toolbar **AI Dress** → submit → the preview says only "add POI QA AY Gate at 7,2" (portal destination not mentioned).
3. **Apply to map**. `GET /api/campaigns/test-campaign/maps/test-map` confirms `pois[0].linkedMap === "battle-arena"` persisted.
4. Left-click the "QA AY Gate" marker on the grid (and as a LAN player in a second tab, with the map activated via `PUT .../maps/test-map/activate`).
5. Observe: no navigation, no Enter badge, no golden ring, no description popup, no campaign-log entry, no network request beyond autosave, zero console errors. Right-click does offer Hide/Delete (menu lane works), so the row is alive — only the portal capability is dead.
6. Control: the hex lane implements the feature — `src/components/hex-map/POILayer.jsx` renders an "Enter" badge + golden ring for valid linked POIs adjacent to the party and calls `onPoiEnter` (and `HexMap.jsx` refuses invalid targets with an audit pair), and players see POI markers on LAN there.

### Expected behavior
Either the op set refuses `poi.targetMap` on indoor maps (the way `item`/`token` are gated: "item/token ops are indoor-only") so the model can't promise a door that can't open, or indoor linked POIs get an entry affordance (icon variant + click → open linked map, or at minimum activate-for-all-viewers) mirroring the hex lane. And the preview copy should name the portal ("add portal POI X → battle-arena") instead of the generic "add POI X at 7,2".

### Actual behavior
Plan validates, applies, persists, renders as an ordinary landmark; the portal capability is inert forever with zero feedback. Same-shape op on a hex map works (golden Enter badge when the party is adjacent).

### Likely location
- `server/services/ai/authoring/dressMap.js` — `INDOOR_ONLY = new Set(['item','token'])` gates item/token but poi+targetMap rides through; `addPoi` spreads `linkedMap` regardless of `ctx.place.outdoor`; prompt in `buildDressMessages` advertises `poi.targetMap` without the map-kind caveat.
- Client: `src/components/map/IndoorPoiLayer.jsx` — hit area has only `onContextMenu`, no `onClick`; grep `linkedMap` app-wide: consumers exist ONLY under `src/components/hex-map/` (POILayer.jsx:13-16, HexMap.jsx:404-427). Confident.
- `src/services/maps/dressPreview.js` — preview label for POI adds doesn't surface `targetMap` either.

### Suggested fix
Cheapest honest fix (mirrors the existing INDOOR_ONLY idiom): in `dressMap.js` `applyOne`, reject `poi.targetMap` when `!INDOOR_ONLY.has(...)` — i.e. when `doc.type !== 'outdoor' && op.target === 'poi' && op.poi?.targetMap`, push error `poi portals are outdoor-only (party travel is hex-based)` so the repair loop can re-propose without the link, and add the same line to the system prompt. Longer-term (needs owner call): wire indoor entry on `IndoorPoiLayer` (click → `onPoiEntered` via the existing map-switch lane). Also name the destination in the preview copy server + client.

### Severity
Broken feature — an explicitly offered, previewed-and-confirmed capability is inert by map kind with no validation, no copy, and no runtime feedback; players learn doors mean "enter" on hexes and get a dead icon indoors.
