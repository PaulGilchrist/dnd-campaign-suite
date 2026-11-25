# Keyboard Camera Navigation for All Map Surfaces

Origin: owner request 2026-11-25. Goal: trackpad-friendly navigation (no mouse) while
leaving every mouse lane byte-identical (purely additive keyboard lane).

## Key model (identical on all four surfaces)

| Keys | Indoor 2D (Map.jsx) / Outdoor 2D (HexMap.jsx) | Indoor 3D (Map3D) / Outdoor 3D (HexMap3D) |
|---|---|---|
| W A S D, arrows | Pan (camera up/left = viewBox origin decreases) | Orbit: A/D yaw, W/S tilt |
| Shift + WASD/arrows | 2× pan speed | Screen-space pan (camera + target translate) |
| `+` `=` / numpad `+` | Zoom in (anchored at viewport center) | Dolly in |
| `-` `_` / numpad `-` | Zoom out | Dolly out |
| R | Reset view (`resetView`) | Top-down (`topDown()`) |

## Intuitiveness safeguards

- Window-level listeners armed while the surface is mounted — no click-to-focus ritual.
  2D lane disabled while `viewMode === '3d'` and vice-versa; 3D lane armed only when `ready`.
- Keydown ignored when: meta/ctrl/alt held; target inside input/textarea/select/
  contenteditable; target inside `[role=dialog]`/`[role=menu]` (rename editors, confirm
  modals, context-menu roving keep their keys).
- Smooth hold-to-move: pressed-key set + requestAnimationFrame pump (UI animation only —
  compliant with the no-game-timers law). dt capped at 50 ms after tab-away. Arrows/
  handled keys preventDefault so the page never scrolls.
- Constant screen speed: 2D pan delta = cssPx/s ÷ rect width → viewBox units, so holding
  a key moves the same on-screen distance at any zoom. Indoor/outdoor keyboard zoom keeps
  the viewport center fixed (wheel still anchors the cursor).
- 3D can't get lost: both scenes set `minDistance`/`maxDistance` at camera framing; the
  indoor scene gains the hex scene's `maxPolarAngle` floor-clamp; stepCamera clamps polar
  into `[0.05, maxPolarAngle]`.
- Discoverability: 3D hint chips gain `· WASD/arrows rotate · +/- zoom · Shift+WASD pan ·
  R top-down`; both 2D surfaces gain a matching muted no-print hint chip.

## Files

- NEW `src/hooks/ui/useHeldKeys.js` (+ co-located test) — pressed-set, rAF pump, guards,
  one-shot `onAction('reset')` on KeyR (ignores `e.repeat`).
- `src/components/map/hooks/useZoomPan.js` — 2nd arg `{ keyboardEnabled }`; keyboard lane
  (panBy via functional setState, center-anchored exponential zoom, R reset).
- `src/components/hex-map/hooks/useZoomPan.js` — same lane through the loader-owned
  setters; every step passes through the existing `clampPan`.
- `src/components/map/Map3D/map3dScene.js` + `src/components/hex-map/HexMap3D/hex3dScene.js`
  — new `stepCamera({ forward, strafe, zoom, pan, dt })` (plain-number vector math, no new
  imports) + distance clamps at framing; indoor also gets `maxPolarAngle`.
- `Map.jsx` (viewMode already above the hook call) / `HexMap.jsx` (viewMode state moved
  above the zoomPan call) pass `keyboardEnabled`; `Map3D.jsx`/`HexMap3D.jsx` wire
  `useHeldKeys → scene.stepCamera` + `R → topDown` and update hint text.
- CSS: hint chip styles follow the `.map3d-hint` idiom, scoped per component.

## Sign conventions (verify live)

- strafe +1 (D): panX increases; forward +1 (W): panY decreases.
- 3D: D decreases azimuth (camera orbits the view direction), W decreases polar (tilts
  toward top-down). Flip on live screenshot if it reads backwards.

## Verification

Targeted tests first, then full `npm run lint`, `npm run test:run`,
`node .opencode/plans/no-timers-guard.mjs`, then a live `test-campaign` pass on
test-map (indoor 2D+3D) and a hex map (outdoor 2D+3D): every key lane pans/orbits/zooms,
typing in a rename editor and an open dialog do NOT move the map, mouse behavior unchanged.
