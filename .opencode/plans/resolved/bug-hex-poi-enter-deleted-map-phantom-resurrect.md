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

## Resolution

FIXED 2026-10-30 (fixer subagent, live re-verified in `test-campaign`).

**What was actually wrong** (both layers confirmed against live repro + code; the guesses in "Likely location" were correct):

1. **Stale gate**: `HexMap.jsx` re-probed `validLinkedMaps` only on `pois`/`campaignName` change and ignored the `maps-list-<campaign>` SSE event the server already publishes on every map create/delete/rename/activate — so a target deleted under the mounted editor left the golden Enter chip live, and the click handler trusted the stale Set with zero validation.
2. **Resurrection producer**: the *indoor* loader (`src/components/map/hooks/useMapLoader.js`) treated a REJECTED load (server 404 `Map not found`) identically to a falsy-resolve "no document yet" answer and **immediately `PUT`** a blank `{players,walls,gridSize,placedItems}` document under the deleted map's name — that is what re-created the ghost file (the open-time direct save, plus a dirty-gate twin because the seeded baseline kept `walls` as a `Set` while the autosave builder emits an array, so the debounced pass re-PUT). The hex-side loader logs the same fallthrough but was NOT the disk writer (ghost keys were indoor-shaped; both repro PUTs carried the indoor payload).

**Fix** (three seams, mirroring the existing dirty-gate / battleMap-opts / toast patterns):

- `src/components/hex-map/HexMap.jsx`
  - **Click-seam freshness gate**: `handlePoiEnter` now re-checks the named target against the LIVE maps list (`mapsService.loadMaps`, matching `slug === toKebabCase(linkedMap)` to mirror the load URL) before navigating. Confirmed-missing ⇒ NAMED refusal toast `Linked map "X" no longer exists — Enter link cleared.` (reuses the display-only `.travel-toast` lane, generalized `arrivalToast` → `mapToast`/`showMapToast`), immediate chip retirement (ref + Set), POI self-heal via `handleUnlinkMap(poi.id)` (persisted by the existing hex autosave), and a `travel/enter_refused` audit row with `linkedMap` + `refusal:'missing'` (new opt-in `logTravel` fields, same absent-when-unused rule as `battleMap`). Unreachable list ⇒ refuse with `Could not verify linked map "X" — try again.` + `refusal:'unreachable'` row but KEEP the link — a transient blip is not proof the GM's link is dead.
  - **Proactive invalidation**: a `maps-list-<campaign>` SSE event bumps a `mapsListVersion` state that both the indoor-picker load and the linked-map validity probe depend on, so the chip retires the moment a delete/rename lands anywhere — without waiting for a click.
- `src/components/map/hooks/useMapLoader.js` (indoor)
  - A **rejected load never auto-persists**: the blank editor still mounts (loud console fallthrough kept) but the dirty baseline is seeded with the exact `buildSavePayload` the autosave effect would emit, so a zero-edit open writes NOTHING (also kills the Set-vs-array twin re-PUT). The first REAL user edit dirties it and re-creates the file through the normal debounced lane — "not auto-persist unless the user explicitly edits". The falsy-resolve create lane (legacy no-document answer; every real create flow POSTs first so its load resolves) keeps its direct save, now byte-seeded to avoid the twin.
- The hex loader (`hex-map/hooks/useMapLoader.js`) was intentionally left unchanged: its fallthrough writes a complete typed outdoor envelope, was not the demonstrated ghost writer, and its fresh-create path is entangled with the #800/#801 view-normalize dirty dance — not worth destabilizing for a lane this fix makes unreachable from the POI seam.

**Dual-ruleset check**: map loaders/POI lanes are ruleset-agnostic (single 5e/2024-shared implementation) — no 2024 twin to fix.

**Tests** (regression locks, all passing):
- NEW `src/components/hex-map/HexMap.poi-enter-stale-link.test.jsx` — 4 tests: named refusal + self-heal + chip retirement + exact `enter_refused` row (no navigation); unreachable-list keeps the link; live target still enters; maps-list SSE event retires the chip with no click.
- NEW `src/components/map/hooks/useMapLoader.rejected-load.test.js` — 3 tests: rejected load writes zero on mount/debounce/flush/unmount; explicit edit persists exactly once; falsy-resolve create lane direct-saves exactly once (no twin).
- Updated `useMapLoader.test.js` (its own header listed the :60-62 fallthrough-save as an open FIXME pin — rewritten to lock the new refusal, header updated), `HexMap.additional.test.jsx` (click seam is now async; added `toKebabCase` to the partial mapsService mock), `HexMap.test.jsx` (Subscriber pin asserts delegation through the new wrapper).
- `npx vitest run src/components/hex-map src/components/map` → 103 files / 1159 passed. Full `npx vitest run` → 2930 files / 32,334 passed, 0 failed. `npm run lint` → clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` → OK (the shared toast auto-hide timer stays in the benign display category).

**Live re-verification (test-campaign, Vite :5173; rig: hex map `QA Hex FixB` gridSize 20, party (20,10), city POI (19,10) linked `QA Room FixB`)**:
- Original repro first RE-CONFIRMED pre-fix: stale chip, real click → silent blank indoor editor, 6 console lines, ghost `qa-room-fixb` back in `GET /maps` with indoor-only keys.
- Leg A (SSE face): mounted hex editor, golden chip live → `DELETE /maps/qa-room-fixb` → chip retired **without reload or click** (first poll, ≤2ms), zero navigation.
- Leg B (click-seam face, deterministic stale): `/subscribe` route-aborted tab so the gate could not self-invalidate → deleted the room map under the mounted editor → chip stayed stale → **real mouse click** on the hit-rect center → toast `Linked map "QA Room FixB" no longer exists — Enter link cleared.`, indoor editor NEVER mounted, hex editor stayed mounted, chip gone, `GET /maps` shows NO resurrection, the hex file's POI came back WITHOUT `linkedMap` (self-heal persisted after the autosave debounce), exactly ONE log row `{type:travel, action:enter_refused, hex:{q:19,r:10}, terrain:plains, linkedMap:"QA Room FixB", refusal:missing}`.
- Control (adjacent behavior): re-seeded the link, real-clicked the chip → entered the indoor editor normally, zero toasts, GET-only traffic on the room URL (zero PUTs), zero console errors on the fresh page.
- Cleanup: both scratch maps deleted, Admin cleared change-data (`{}`) + log (`[]`) GET-verified; `maps/` disk back to baseline `battle-arena.json` + `test-map.json` (Oct-28 mtimes, byte-untouched).
