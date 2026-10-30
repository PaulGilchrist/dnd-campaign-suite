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
