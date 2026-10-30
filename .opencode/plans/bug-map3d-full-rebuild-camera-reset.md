# 3D map viewer tears down and rebuilds the whole scene — and resets the camera — on every overlay SSE tick / label / torch toggle

## Summary
`Map3D.jsx` rebuilds the entire 3D scene (`scene.buildMap()`) whenever *any* dependency changes — including `overlays`, `showLabels`, and `showTorch`. `buildMap()` begins with `clearMap()` (disposes floor/walls/items/players/fog/overlays) and ends with `_frameCamera()`, which hard-resets `camera.position` + `controls.target`. Result: a remote GM/ player nudging an overlay (each SSE mirror), or the local user merely toggling "Labels"/"Torch light", yanks the viewer's camera back to the default framing and re-creates every mesh — a visible full-view jump plus per-tick scene churn.

## Steps to reproduce
In test-campaign, two localhost tabs (A = viewer, B = editor):
1. Tab A: Maps → Open "Battle Arena"; arm `button[aria-label="Spell"]`; set shape Cylinder; click canvas to place.
2. Tab A: click `button[aria-label="View map in 3D"]` → 3D viewer mounts; the cylinder renders as a translucent volume (compositing itself works).
3. Tab A: right-drag on the canvas to orbit, scroll to zoom so the framing is clearly non-default.
4. Tab B: arm Spell → in the Active list click the row's × to remove the cylinder (or place/move any overlay).
5. Watch Tab A at the moment the mirror lands.
6. Extra local leg: with the 3D view still mounted on A, orbit away from default again, then click the `Labels` checkbox in the 3D toolbar.

## Expected behavior
Overlays are an additive sub-layer: an add/update/remove should build/dispose only overlay meshes, preserving the user's camera. Labels/Torch toggles should only apply `scene.setToggles(...)` (already called separately) without a rebuild.

## Actual behavior
- Step 5: the volume correctly disappears (live mirror works, zero reloads) **but the camera instantly snaps back to the default overview framing** — verified by screenshot diff: the post-edit frame is pixel-identical to the fresh-mount default (runAL-3d-before vs runAL-3d-after-remote-edit captures; orbit/zoom state destroyed).
- Step 6: toggling Labels off produces the same camera snap (labels vanish too).
- During a remote *drag* of an overlay, updates are debounced ~150 ms — every debounced `update` re-enters this effect, so a 2-second viewer-side remote drag = a dozen full teardown/rebuild+camera-reset cycles (each also re-awaits texture loads, though `_textureCache`/`_wallTex` make those cheap).
- No console errors; purely a view-state + perf defect.

## Likely location
Confident (read + live):
- `src/components/map/Map3D/Map3D.jsx:63-79` — the build `useEffect`'s dep array includes `overlays, showLabels, showTorch` and its body unconditionally calls `scene.buildMap(...)` (line 67), which ends in `_frameCamera()`.
- `src/components/map/Map3D/map3dScene.js` — `buildMap` (:359) starts with `clearMap()` (:350, full dispose) and ends with `this._frameCamera(gridSize)` (:383); `_frameCamera` (:158) sets `camera.position`/`controls.target` unconditionally.
- `_buildSpellOverlays` (:386) adds overlay groups into `mapGroup`, so today there is no separate overlay sublayer to patch.

## Suggested fix
- Start a dedicated `this.overlayGroup = new THREE.Group()` added to the *scene* (not `mapGroup`) in `init`, and add a `scene.updateSpellOverlays(overlays)` method that disposes only `overlayGroup`'s children and rebuilds them. Give Map3D a SECOND, small `useEffect(() => sceneRef.current?.updateSpellOverlays(overlays), [overlays])` and DROP `overlays` from the full-build dep array.
- Move `showLabels, showTorch` out of the build deps (the `setToggles` call on :66 already applies them; a buildMap after it is redundant) — or make toggles call only `setToggles` + a lightweight label refresh.
- Make `_frameCamera` idempotent-safe: skip it when the map has already been framed once for the same `gridSize`/mapData (e.g. frame only when a `framedFor` field differs), so even remaining dep changes don't yank the camera.
Investigation note: confirm `showLabels`/`showTorch` meshes are rebuilt by `setToggles` alone before removing them from the build deps (read `setToggles` in map3dScene.js).

## Severity
Minor UX issue (no data-integrity risk) — but it makes the 3D viewer unusable while anyone is actively editing overlays (constant camera jumps) and wastes a full GPU teardown/rebuild per update; easy, contained fix.

## Evidence captures (run AL 2026-10-30)
`.opencode/plans/runAL-3d-before.png` (default framing, cylinder volume composited), `runAL-3d-orbited.png` (user's orbit + zoom), `runAL-3d-after-remote-edit.png` (same moment a remote ×-remove mirrored — back to the default framing, pixel-comparable to the before shot), `runAL-3d-after-label-toggle.png` (labels off, camera snapped to default again).
