# bug-ai-dress-poi-invisible-on-indoor-maps.md

**Found:** 2026-11-01 explore run AW — live-verified in test-campaign on `npm run dev` (locked).

### Summary
On an **indoor** map, the AI Dress flow (map-view toolbar button or list-row button) accepts `add poi` ops, shows a preview marker, persists the POI to the map document on Apply — but the indoor map view renders **nothing** for `pois`: no marker, no label, and no UI to select/remove them. The POI lane exists only on the hex-map (outdoor) renderers. The dress-preview promise "Markers show on the map — read them against the grid before applying" is kept at preview time and silently broken after Apply.

### Steps to reproduce
1. In test-campaign (AI configured), Maps → Open "Battle Arena" (indoor).
2. Toolbar → AI Dress → instruction "add a barrel near the throne" → Dress map (fake/real model).
3. Preview modal lists ops incl. `add POI <name> at x,y`; teal preview markers render on the grid. Click **Apply to map**.
4. Observe the map after Apply: the placedItem op (chest) renders as an icon; the POI renders nothing.
5. Confirm persistence: `GET /api/campaigns/test-campaign/maps/battle-arena` → `pois: [{ id:"ai-dress-poi-…", label:"…", gridX, gridY, visible:true }]` (verified live: `QA AW Shrine` at 6,3 persisted).
6. Also verified not an adoption gap: fresh page reload → campaign re-select → Open Battle Arena — the `placedItems` control written by external PUT renders (screenshot `.playwright-mcp/aw-indoor-lanes.png`, chest icon at 5,6) while a `pois` entry at 2,2 renders nothing.

### Expected behavior
A POI added to an indoor map (the `liveDressPlanSchema` explicitly allows `target:'poi'` on both map kinds — "poi = labelled point of interest (both map kinds)", `server/services/ai/authoring/entitySchemas.js` comment) should render on the indoor board, or at minimum be listed/removable somewhere in the indoor map UI.

### Actual behavior
Zero visual/interaction surface for `pois` on the indoor map. No console errors. The data is silently orphaned — the only cleanup lane is a raw array PUT to `/maps/:name` (no per-POI delete affordance exists indoors). Machine fingerprint: no text node contains the POI label after apply, reload, or external write, while sibling placedItems render.

### Likely location
Confident on the gap, guessing on the fix site:
- `src/components/map/Map.jsx` — zero POI rendering (only a comment mentions pois at :483, about the outdoor-switch instance clearing them).
- POI render/manage lane lives ONLY in `src/components/hex-map/` (`POILayer.jsx`, `usePoiManagement.js`, `POIContextMenu.jsx`).
- Producers that happily write the lane for indoor maps: `server/services/ai/authoring/dressMap.js` (:146-154, indoor branch stores gridX/gridY), `src/services/maps/dressPreview.js` (resolves `doc.pois` for both kinds), `src/components/map/hooks/useSSESync.js` (0fe1f7e18 deliberately adopted the `pois` lane into the indoor editor state to stop autosave clobber — so the data is in client state, just never drawn).

### Suggested fix
Either (a) render + manage POIs on the indoor map — port/mount a POILayer-equivalent in `Map.jsx` (state is already adopted by useSSESync), or (b) gate `target:'poi'` out of the dress proposal for indoor maps (server validate + client preview label) so the flow never promises something the renderer can't show. (a) is likely the RAW-correct choice given the schema comment says both kinds. Investigation: read `Map.jsx` render loop and `hex-map/POILayer.jsx` for the cheapest shared component.

### Severity
Broken feature (indoor lane). Data is honestly persisted (not corrupted), but the feature is silently inert after Apply with no UI escape hatch — exactly "right affordance, invisible result".
