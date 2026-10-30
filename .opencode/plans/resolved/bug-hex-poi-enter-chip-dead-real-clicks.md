# bug: Outdoor hex map — the golden "Enter" chip on linked POIs is dead to real mouse clicks (pointer capture swallows the child click)

## Summary

Linked POIs (enterable when adjacent to the party) render a golden "Enter" chip with `cursor:pointer` whose navigation handler lives on a transparent hit-rect's `onClick`. A REAL mouse click on the chip or the POI icon does nothing, because the hex `<svg>` root calls `setPointerCapture(e.pointerId)` in its `onPointerDown` for every pointer, which retargets the ensuing `click` to the svg — the rect's React `onClick` never fires. A synthetic `dispatchEvent(new MouseEvent('click'))` (which skips the pointer pipeline) DOES navigate, proving the handler logic is correct and only real input is broken. The affordance is visible and looks clickable but is inert for actual users.

## Steps to reproduce

1. In `test-campaign`, create an outdoor map (`POST /maps {name,type:"outdoor",gridSize:20}` → party auto-centres at (20,10)).
2. Seed POIs on the map file: one `city` POI, and one `dungeon` POI with `linkedMap:'Battle Arena'` at (19,10) (adjacent to the party).
3. Open the map in the hex editor (GM/localhost). The linked POI shows a golden glow + "Enter" chip (adjacency gate satisfied).
4. Click the chip / POI icon with a real mouse (Playwright `page.mouse.click` at element center = genuine pointer sequence).

## Expected behavior

The click enters the linked indoor map (view switches to the Battle Arena editor) — the same outcome the `onClick` handler produces when invoked directly.

## Actual behavior

- Real clicks (2 attempts: chip centre, icon centre): zero navigation, zero console output, hex editor unchanged. The click is silently swallowed.
- Control probe: `rect.dispatchEvent(new MouseEvent('click',{bubbles:true}))` on the same transparent rect → `onPoiEnter` fires and the indoor map opens (`div.map[data-testid=map-editor]` mounts). So the enter lane works; only real pointer input is dead.
- Right-click context menu on the same POI DOES work (`contextmenu` compatibility events aren't retargeted the same way), which makes the dead left-click even more confusing.

## Likely location

Confident: `src/components/hex-map/HexMap.jsx` svg root `onPointerDown` (~:508-515) calls `svgRef.current.setPointerCapture(e.pointerId)` on EVERY pointerdown (paint branch AND the else/pan branch). Pointer capture retargets subsequent compatibility mouse events (including `click`) to the capturing element. `src/components/hex-map/POILayer.jsx:118` — the enterable branch's hit-rect relies solely on `onClick`, and nothing in the pointer-up path (`handlePoiPointerUp`, `usePoiManagement.js:79`) implements a zero-movement tap→enter.

## Suggested fix

Handle enter on the pointer seam instead of click: in `handlePoiPointerUp`/svg `onPointerUp`, if a pointerdown began on an enterable POI and no drag movement occurred, call `onPoiEnter(poi)`. Alternatively, skip `setPointerCapture` when the pointerdown targets `g.poi-item-enterable` (release capture on pointerup-before-click is browser-guaranteed only on some engines — the tap-detect route is more robust). Add a component test asserting pointerdown+pointerup with zero movement fires the enter callback.

## Severity

Broken feature — the entire POI→indoor-map navigation affordance is unreachable via real input; no data risk (nothing happens at all).

## Resolution

FIXED 2026-10-30 (fix run). Root cause confirmed as diagnosed: `HexMap.jsx` svg-root `onPointerDown` calls `setPointerCapture(e.pointerId)` for EVERY pointerdown (paint branch :511 and pan branch :514), and pointer capture retargets the ensuing compatibility `click` to the capturing `<svg>` — the enter chip's child `onClick` never sees real input. Live diagnostic pinned it byte-exactly: a `page.mouse.click` on the chip produced a window capture-phase click whose `target` was `svg.hex-svg`, while a synthetic `dispatchEvent(new MouseEvent('click'))` on the same rect navigated (control).

Fix (child-side, mirroring the house pattern — NOT the svg-side tap-detect alternative): the enterable hit-rect in `src/components/hex-map/POILayer.jsx` now `stopPropagation()`s its `onPointerDown`, so a chip press never reaches the svg capture seam. This is exactly how every other interactive svg child in the app already coexists with root gesture capture — `POIContextMenu` menu `<g>` (:132), `PartyMarkerLayer` path (:29), the indoor `useItemDragging` token handler (:22), and the sibling NON-enterable POI rect (via `handlePoiPointerDown`). With no capture armed, the browser leaves the click on the rect and the pre-existing `onClick` lane runs untouched. Additionally the hit-rect height grew 50→56: the golden badge spans cy+24..cy+38 but the old 50px rect ended at cy+32, so the bottom ~6px of the visible chip would have stayed inert (its badge `rect`/`text` have no pointer handlers and would bubble to the svg).

- svg-level capture is UNTOUCHED — canvas drag-pan verified live after the fix (viewBox changed under a real mouse drag) and POI drag + right-click ctxmenu on the same POI still work.
- Files changed: `src/components/hex-map/POILayer.jsx` (fix) + new `src/components/hex-map/POILayer.enter-click.test.jsx` (4 tests: real pointerdown→pointerup→click on the chip never reaches the svg pointerdown/capture seam yet enters exactly once; canvas press STILL captures (pan/paint preserved); hit-rect covers the full badge; non-enterable drag lane unchanged). jsdom can't retarget clicks, so the test locks the propagation CONTRACT the fix relies on, per the POIContextMenu stopPropagation precedent.
- No 2024 twin needed (pure map-UI component; the indoor twin `Map.jsx` already implements the working stopPropagation + press-recorder pattern).
- Live re-verification (test-campaign, dev :5173, GM/localhost, real `page.mouse.click`): chip-centre → enters Battle Arena (hex unmounts, `div.map` mounts); POI-icon-centre → enters; golden-badge-BOTTOM-strip (legacy dead zone) → enters. Sanity: canvas drag-pan pans, city-POI mouse-drag re-hexes, right-click menu opens (Hide/Rename/Unlink Map (Battle Arena)/Delete) and dismisses.
- Tests: `npx vitest run src/components/hex-map/POILayer.enter-click.test.jsx` 4/4; folder `npx vitest run src/components/hex-map` 39 files / 453 tests green; `npm run lint` zero warnings.
- Cleanup: QA Hex Fix map created → deleted via MapsManager modal confirm; maps roster restored to [Battle Arena, Test Map] with Battle Arena's 3 players byte-intact; Admin cleared change-data (`{}`) + campaign log (`[]`), GET-verified.
- OBSERVATION (pre-existing, NOT introduced/fixed here): every hex→indoor enter (real or synthetic — it fired on the pre-fix control too) emits a 3-line console trio: the switching commit lets the hex loader claim the NEW map name while still holding old hex bytes, queues one save, and the unmount flush PUTs the hex envelope (no `players`) to the indoor URL → server whole-map-save guard 400s it. No data damage possible (guard held: Battle Arena kept its 3 players); candidate for a separate follow-up bug.
