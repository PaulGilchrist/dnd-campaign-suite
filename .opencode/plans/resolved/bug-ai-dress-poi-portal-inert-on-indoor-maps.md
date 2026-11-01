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

## Resolution
FIXED 2026-11-01 — chose the gate direction (mirrors the existing INDOOR_ONLY idiom), not an indoor entry lane. Root cause matched the diagnosis: `applyOne` only gated `item`/`token` on outdoor maps, `addPoi` spread `linkedMap` regardless of `doc.type`, and the prompt advertised `poi.targetMap` with no map-kind caveat. (No dual-ruleset sibling — this is server AI-authoring code, not a 5e/2024 rules module.)

Changes:
- `server/services/ai/authoring/dressMap.js` — new `portalOnIndoor(doc, op)` guard beside `INDOOR_ONLY`, checked in `applyOne` right after it: `poi.targetMap` on a non-outdoor doc rejects the whole plan with `ops[i] "add poi": poi portals are outdoor-only (party travel is hex-based)`, so the ≤2 repair loop feeds the error back and the model re-proposes without the link. System prompt now says portals are OUTDOOR hex maps only. `addPoi` preview copy for the valid hex case names the destination: `add portal POI X → map at q,r`.
- `src/services/maps/dressPreview.js` — `addLabel` mirrors the server copy for grid-overlay markers (`add portal POI X → battle-arena at 7,2`); plain POIs keep the generic name ladder.
- `server/services/ai/authoring/dressMap.poi-portal.test.js` (new) — locks: indoor portal add rejects with the exact error; all-or-nothing (plain poi sibling in the same plan writes nothing); plain indoor poi still applies with generic copy and no `linkedMap`; valid hex portal applies with destination-named preview; poi move/remove unaffected; prompt advertises outdoor-only; persistent portal proposal fails closed after 2 attempts with the error quoted in the repair turn.
- `src/services/maps/dressPreview.test.js` — added portal-label case (modal + overlay copy parity).

Verification:
- Repro re-run live first (bug confirmed exactly as filed: preview "add POI QA AY Gate at 7,2", `linkedMap:"battle-arena"` persisted on test-map, click = zero delta).
- Post-fix live re-verify in test-campaign (fake rig :8123, POIPORTAL marker): indoor map → modal inline alert `ops[0] "add poi": poi portals are outdoor-only (party travel is hex-based)`, NO Apply button, modal stays open (same error surface as the outdoor INDOOR_ONLY negative). POITEST control → plain indoor poi+chest still apply and render in `g.indoor-poi-layer`. Throwaway hex map "QA AZ Hex" → portal op VALID: modal list AND grid overlay both read `add portal POI QA AY Gate → battle-arena at 7,2`, Apply persisted `linkedMap:"battle-arena"` at q,r.
- Tests: `npx vitest run` on the two touched files (20 passed), then `server/services/ai/authoring` + `src/services/maps` (25 files / 360 passed), then full `npm run test:run` (2988 files / 32841 passed, 3 expected fails), `npm run lint` clean.
- Cleanup: test-map restored to baseline (`pois: []`, QA chest removed, players 11 intact), QA AZ Hex deleted, change-data `{}` + log `[]` cleared via Admin lane, fake rig killed.
