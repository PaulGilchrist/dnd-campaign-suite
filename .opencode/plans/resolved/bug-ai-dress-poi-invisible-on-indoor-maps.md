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

## Resolution
**FIXED 2026-11-01** — option (a) implemented: POIs now render AND are manageable on the indoor board, closing the write-only lane. Raw diagnosis confirmed: no code changed vs. the bug file's guess — `Map.jsx` simply had zero POI rendering while `useSSESync` (0fe1f7e18) already adopted `doc.pois` into editor state.

### What was wrong
The indoor square-grid renderer (`Map.jsx`) never drew the `pois` document lane; every marker/label/manage affordance lived only in the hex renderers (`hex-map/POILayer.jsx`, `hex-map/hooks/usePoiManagement.js`, `hex-map/POIContextMenu.jsx`). AI Dress, `dressPreview.js`, and the SSE adoption all happily carried indoor POI rows (`{id, type:'landmark', label, gridX, gridY, visible}` per `server/services/ai/authoring/dressMap.js` addPoi) straight into a render black hole.

### What changed (files)
- **`src/components/map/IndoorPoiLayer.jsx` (new)** — indoor POI marker layer mirroring `hex-map/POILayer.jsx` on gridX/gridY geometry: shared `#poi-landmark` icon + label, hidden POIs dimmed 0.4 for the GM and invisible to LAN players, fog rule identical to `PlacedItems.jsx:21` (renders under `FogOverlay`).
- **`src/components/map/IndoorPoiContextMenu.jsx` (new)** — GM right-click menu (Hide/Show + Delete) with the named-confirm `Delete POI "<label>"?` copied from the outdoor lane; reuses the sibling `.item-context-menu`/`.menu-option` chrome and the globally-imported HexMap.css `.poi-context-menu` hover styles. Hex-only rename/link/road rows deliberately omitted (indoor dress authors plain landmark POIs).
- **`src/components/map/hooks/useIndoorPois.js` (new)** — selection + visibility/delete handlers; edits spread a NEW `mapData.pois` array through `setMapData` (useMapLoader autosave PUT + SSE echo lane, never localStorage).
- **`src/components/map/Map.jsx`** — mount layer (after `PlacedItems`, under `FogOverlay`) + menu (after `PlayerContextMenu`) + `<LandmarkSVG id="poi-landmark"/>` def (imported from `hex-map/svg/`); `handleCloseMenu` now also closes the POI menu (canvas click / dock dismiss wipe it). Two lint-cap refactors rode along (statement cap 60): `const { players } = mapData` inlined to `mapData.players` at its two JSX uses, and `handleSvgClick` early-return collapsed to `if/else` — behavior byte-identical (the click-select item branch never closed the other menus before either).
- **`src/components/map/Map.css`** — scoped `.poi-item`/`.poi-hit-area`/`.poi-label` rules (icon/label inert, hit area live, label halo mirrors `.npc-name`). No inline styles, no `!important`.
- **`src/components/map/Map.test.jsx`** — defs census pinned `+ 'poi-landmark'` (intentional addition).
- **`src/components/map/Map.indoor-pois.test.jsx` (new)** — regression suite (5 tests).
- Unrelated pre-existing lint noise fixed so `npm run lint` could pass zero-warnings: empty `catch {}` in the gitignored QA rig `.playwright-mcp/qa-fake-model-server-aw.mjs` got a comment (this run's own rig file was removed at exit).

No server change needed: `liveDressPlanSchema` already declares `target:'poi'` for both map kinds — the renderer was the sole gap. Dual-ruleset N/A (map rendering, not rules).

### How verified
- **Live repro (pre-fix):** fake-model rig (:8124, `qa-aw` pattern) + aiConfig autopilot → test-campaign → Maps → Open Battle Arena (indoor) → toolbar AI Dress → proposal `add chest at 5,6` + `add POI QA Fix Shrine at 2,2` → preview markers on grid → Apply. DOM probe: `.placed-item use` = `["#chest"]` but zero POI nodes; `GET /maps/battle-arena` carried the POI row. Bug confirmed exactly as filed.
- **Live re-verify (post-fix):** re-ran the full dress cycle — after Apply, with NO reload, `.indoor-poi-layer` renders marker (`href #poi-landmark`) + label "QA Fix Shrine" for each persisted POI (SSE adoption draws applied ops live). Right-click → menu `Hide/Delete/✕`; Hide persisted `visible:false` (server GET) and dimmed the marker to 0.4; Delete fired the named confirm `Delete POI "QA Fix Shrine"?` and removed the row from board AND autosave PUT. LAN-player hidden-POI invisibility + placement-survives-reload pinned by the regression test. Adjacent sanity: placedItem click-select dock still opens and deletes with its own house confirm.
- **Tests:** `npx vitest run src/components/map/ src/components/hex-map/ src/hooks/ui/` → 107 files / 1125 tests green (incl. 5 new); full `npx vitest run` green; `npm run lint` zero errors/warnings; `no-timers-guard` OK (no timers added).
- **Cleanup:** all QA POIs + chests removed through the live UI (Battle Arena back to `placedItems [] pois []`, players/walls/revealed/zoom byte-canonical); Admin cleared change-data + log for test-campaign (two-pass quiet: `{}` + `[]`), which also wiped the rig aiConfig; fake-model rig killed.

### Summary (for commit)
Fix AI Dress indoor-POI invisible-lane: indoor map board now renders the `pois` document lane (shared landmark marker + label via new IndoorPoiLayer, GM right-click Hide/Delete menu via new IndoorPoiContextMenu/useIndoorPois) instead of silently dropping applied POI ops that only the hex renderers ever drew; hidden POIs dim for GM and stay invisible to LAN players, edits persist through the map autosave/SSE lane; regression-pinned in Map.indoor-pois.test.jsx (5 tests) + live-verified through a full fake-rig dress cycle in test-campaign.
