# Bug: whole-doc map PUT accepts non-string `walls` rows (200), and one such row bricks the indoor map view (ErrorBoundary, no UI recovery)

## Summary

`PUT /api/campaigns/:c/maps/:slug` (GM origin) blindly accepts malformed `walls` entries — a non-string row (`5`), out-of-grid keys (`"999,999"`, `"12,0"` on a 12-grid), and duplicates — storing them verbatim with a 200. A single non-string row then crashes `GridAndWalls` (`key.split is not a function`) on every mount/echo-adoption of that map, replacing the entire map view with the ErrorBoundary fallback (`This view ran into an error and could not be displayed.`). Since the poison row is persisted to disk, re-opening or pressing “Reload the view” crashes again forever — only manual disk/PUT repair recovers. The same-day terrain-key validation improve (`31ac54316`) established the opposite convention for outdoor docs (400 with copy naming every offending key); indoor `walls` have no such gate, and the client has no defensive filter.

## Steps to reproduce

1. In `test-campaign`, create a sandbox indoor map: `POST /api/campaigns/test-campaign/maps` `{name:"zz-paint-sandbox", type:"indoor", gridSize:12}` → `PUT …/maps/zz-paint-sandbox` (whole-doc, unwrapped) with `walls: ["9,0", …]`, `players: [{id,name:"FeyRanger",gridX:2,gridY:2}]`, `revealed: []` → `PUT …/activate`.
2. As GM on localhost, open the map from Maps manager (`Open "ZZ Paint Sandbox"`) — board renders.
3. `GET` the doc, append the number `5` to `walls`, and `PUT` the whole doc back (localhost origin) → **200 `Map saved successfully`**, and a follow-up `GET` proves the number row persisted (`types` census: one `number` among the strings).
4a. Mounted-adoption leg: with the board still open on a GM tab, the malformed snapshot echoes (map-data SSE) → the view flips to `This view ran into an error and could not be displayed.` + `Reload the view`; console shows `TypeError: key.split is not a function at GridAndWalls.jsx:58` and `ErrorBoundary caught a render error`.
4b. Fresh-mount leg (cleaner): navigate away, then open the poisoned map from Maps manager → same fallback with ZERO console interaction beforehand; `rect.wall-cell` count 0, `.grid-svg` absent.
5. Press `Reload the view` while the doc is still poisoned → crashes again (the row is persisted). Repair the doc by re-PUTting walls filtered to strings, then press `Reload the view` → board recovers (11 walls render).
6. Control/related: `walls: [...valid, "999,999", "12,0", 5, "9,3"]` also PUTs 200 and round-trips verbatim (out-of-grid strings + duplicate + non-string all stored).

## Expected behavior

Either the server refuses malformed wall rows with a 400 naming every offending key (the exact convention shipped today for outdoor `terrain` in `31ac54316` improve(outdoor-terrain-key-validation)), and/or the client survives a foreign bad row (skip non-string rows at load/echo rather than crash). A map document must never be able to permanently brick its own view through an API path the server accepted.

## Actual behavior

- PUT 200; doc stores `5` / `"999,999"` / `"12,0"` / duplicate rows verbatim.
- `GridAndWalls.jsx:57` runs `key.split(',')` unguarded → `TypeError: key.split is not a function` → ErrorBoundary replaces the map view on mount and on echo adoption.
- Because poison persisted to disk, every subsequent open re-crashes; the only recovery is an out-of-band repaired PUT (verified: after re-PUTting string-only walls, `Reload the view` restores the board).
- Console (dev :5173): `%o %s %s TypeError: key.split is not a function at GridAndWalls (…/src/components/map/GridAndWalls.jsx:58:25)` + `ErrorBoundary caught a render error … componentStack … at App (src/App.jsx:778:18)`. No failed network requests — every call 200s.

## Likely location

Confident on the render site: `src/components/map/GridAndWalls.jsx:56-57` (`Array.from(walls).filter(key => isLocalhost || !fog?.has(key)).map((key) => { const [gx, gy] = key.split(',')…` — no `typeof key === 'string'` guard, and the `out-of-grid` strings render harmless only because the loop is bounded elsewhere; numeric rows defeat `.split`).
Confident on the write seam: `server/routes/maps.js` whole-doc PUT (and the create builder) has no walls-shape validation — contrast the same file’s NEW terrain-keys guard (`31ac54316`). The SSE snapshot lane (`useSSESync.js:42` `new Set(mergedField(data.walls, prev?.walls))`) also applies rows verbatim.
Note: in one controlled live probe a LAN-visitor tab mounted on the same poisoned map did NOT visibly crash on the echo (it kept rendering 11 string walls) — the visitor adoption leg is UNCONFIRMED; the two GM legs above are fully witnessed. A code read of the visitor consumer path would settle whether it silently drops non-strings or just raced my probe.

## Suggested fix

Mirror the shipped terrain precedent: in `server/routes/maps.js`, validate `walls` rows on whole-doc PUT + create — every entry must be a string matching `^\d+,\d+$` within the effective grid bounds — 400 with copy naming the offending keys (reuse/pattern-match the terrain-key validator added in `31ac54316`); consider pruning out-of-range rows the way `pruneRevealedToGrid` prunes revealed. Additionally, harden `GridAndWalls.jsx` with a cheap `.filter(k => typeof k === 'string')` so a poisoned doc can never brick the view (defense-in-depth at the render seam), same spirit as `useMapLoader.js:114` normalizing arrays→Sets. Fixing both lanes also closes the related hygiene face (out-of-grid/dup rows stored forever).

## Severity

Data-integrity risk → escalating to broken feature: one accepted malformed row permanently bricks the map view for every client that opens it (players included — the indoor board is a shared surface), with no in-app recovery path; the write gate that made this possible is GM-only today, but the exact sibling lane (terrain) was ruled worth 400-validating the same day.
