# POI Enter into a deleted linked map silently opens a blank editor and resurrects the map file

## Summary

The hex-map POI "Enter" chip never revalidates its `linkedMap` target after the link was set. If the linked indoor map is deleted (another tab/session, or any removal of the file) while a hex editor is mounted, the golden Enter chip stays live; real-clicking it navigates into a silently-blank fresh indoor editor — and that editor's open-time autosave **PUTs the deleted map file back to disk** as a nameless/typeless ghost document. Zero user-facing feedback anywhere in the chain.

## Steps to reproduce

Starting state: in `test-campaign`, Maps list contains an outdoor hex map (party auto-centred at (20,10) on a gridSize-20 map) and an indoor map, and a POI at an (gridSize-1,10)-style hex adjacent to the party is linked to the indoor map (right-click POI → `Link to Map...` → picker), with the hex editor re-mounted so the golden "Enter" chip renders next to the POI.

1. Open the hex map (`Open "QA Hex RunAI"`) and confirm the Enter chip renders: `g.poi-item-enterable` exists next to the POI.
2. WITHOUT touching the chip yet, delete the linked indoor map from under the mounted editor — e.g. from a second tab's Maps manager, or scripted: `DELETE /api/campaigns/test-campaign/maps/qa-room-runai` → 200, row gone from `GET /maps`.
3. Back on the still-mounted hex editor (no reload), re-read the chip: it is STILL rendered (client-side `validLinkedMaps` set is stale).
4. Real-mouse-click the center of `g.poi-item-enterable rect[fill="transparent"]`.
5. Observe: the SPA navigates to an indoor map editor with a blank grid; NO toast, NO error card, NO "map is gone" notice. Console gains 6 lines (2× resource 404, `Error loading map data: Error: Map not found`, `Failed to load hex map data (falling through to fresh map)` — `hex-map/hooks/useMapLoader.js:397`, and the same pair from `map/hooks/useMapLoader.js:70`).
6. `GET /api/campaigns/test-campaign/maps` — the deleted map is BACK in the list as raw slug `qa-room-runai`; the file on disk was recreated by two `PUT /maps/qa-room-runai` fired by the editor's open-time autosave, with body `{players, walls, gridSize, placedItems}` — no `name`, no `type`, no `description`.

## Expected behavior

Step 4 should refuse honestly: the linked map no longer exists — show feedback (toast/notice), retire the Enter chip, ideally self-heal the POI by clearing its `linkedMap`. At minimum, the fresh-map fallthrough must NOT auto-persist a brand-new file under the deleted map's name.

## Actual behavior

Silent navigation into an unnamed blank map editor + resurrection of the deleted map file as a malformed ghost document (visible in the Maps list with its lowercase slug as name). Two `PUT /maps/qa-room-runai` requests persist it; 6 console error lines are the only trace.

Live capture (run AI, 2026-10-30): newCalls after the click = `GET …/maps/qa-room-runai, GET …/log, GET …/maps, GET …/maps/qa-room-runai, POST …/__map__, PUT …/maps/qa-room-runai, PUT …/maps/qa-room-runai`; screenshot `.opencode/plans/runAI-stale-enter-phantom-map.png`; disk list showed `['Battle Arena','QA Hex RunAI','qa-room-runai','Test Map']`.

## Likely location

Two contributing layers (confident on the first, high-confidence-guess on the second):
- Stale gate: `src/components/hex-map/HexMap.jsx:286–304` — `validLinkedMaps` is re-probed only when `pois`/`campaignName` change; deleting the TARGET map mutates neither, and no map-list SSE event invalidates the Set. `POILayer.jsx` `isEnterable` then keeps rendering the chip; the Enter click (`HexMap.jsx:343`) trusts the stale Set.
- Resurrection producer: `src/components/map/hooks/useMapLoader.js:70` — on 404 the loader logs "falling through to fresh map" and mounts a fresh document; the indoor editor's open-time persistence (the same lane that legitimately auto-saves on create) then PUTs it back to disk. (Hex side logs its own fallthrough at `hex-map/hooks/useMapLoader.js:397`.)

## Suggested fix

Check freshness at the click seam rather than render time: in the POI-enter handler, `await mapsService.loadMapData(campaign, poi.linkedMap)` (or consult the map list cache) — on failure show a named refusal ("Linked map no longer exists") and clear `poi.linkedMap` + persist, which also drops the chip. Additionally, invalidate the `validLinkedMaps` Set when a maps-list delete/replaced SSE event lands, so the chip retires proactively. The fresh-map fallthrough should not auto-Persist a document whose load 404'd unless the user explicitly edits (distinguish "new map" from "named target missing").

## Severity

**Data integrity risk** — a deleted campaign map silently reappears as a malformed (nameless, typeless) file that the UI then lists and can open; combined with zero feedback, a GM can believe a dungeon was destroyed while clicks alone resurrect a corrupt copy of it.
