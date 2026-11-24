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

## Resolution

FIXED (fix run 2026-11-24). Root cause confirmed exactly as diagnosed: the whole-doc indoor PUT and the create builder stored `walls` rows verbatim, and `GridAndWalls.jsx` (plus the 3D `_buildWalls` twin) `key.split(',')` every row — one accepted numeric row bricked the view on mount and on echo adoption, and persisted poison meant no UI recovery. The previously-UNCONFIRMED visitor adoption leg is settled by the code read: the visitor consumes the same document through the same load (`useMapLoader`) and echo (`useSSESync`) seams, so the load/echo skip now protects it too.

Fix mirrors the shipped terrain precedent (`31ac54316`) on the write seam and adds survival at the client seams:

- `server/routes/maps.js` — new `indoorWallsBoundsError(mapData)` (structured as the sibling `outdoorTerrainBoundsError`): absent/null `walls` passes; a non-array container refuses in the rivers/roads register (`rowKind` names it); every row must be a `"gx,gy"` string inside the effective grid — parse failures and out-of-range rows share ONE offending list (capped at 5, rest counted), rows echoed JSON-stringified so a numeric `5` never reads as the string `"5"`. No trustworthy grid (absent/null `gridSize` sanctioned clear) keeps the shape check but skips BOUNDS (the `pruneRevealedToGrid` asymmetry). Duplicate rows stay shape-legal (the client keys its wall layer on a Set, which dedupes them). Wired into BOTH write lanes via `refuseIndoorWallsBounds` (whole-doc PUT, checked against the EFFECTIVE post-clamp grid; indoor lane is already GM-gated so no visitor echo exists to protect; outdoor docs skip — the hex builder never stores walls) and `refuseCreateBoundsError` (POST create, terrain keys for outdoor / walls rows for indoor in one seam; refusal writes no file).
- `src/services/maps/effectiveWalls.js` — new `isWallRow` predicate (survival, not validation).
- `src/components/map/hooks/useMapLoader.js` — load seam builds the walls Set through `wallSetFromDoc` (non-string rows dropped; non-array shapes keep the old Set-constructor throw → loud rejected-load notice). The dirty baseline seeds from the FILTERED document, so a zero-edit poisoned open still writes nothing, and the next real edit's save PUT removes the poison from disk (in-app recovery).
- `src/components/map/hooks/useSSESync.js` — echo seam applies the same `isWallRow` skip to snapshot walls, so a mounted view adopts a foreign-row snapshot cleanly instead of crashing.
- `src/components/map/GridAndWalls.jsx` — render seam guards the map callback with `isWallRow` (cheap belt-and-braces at the exact witnessed crash site).
- `server/routes/maps.test.js` — two legacy fixtures pinned an object-row `walls` shape (pre-`"gx,gy"`-string era, dead since always) and were migrated to canonical strings, per the no-legacy-compat policy.

Verification:

- Repro re-run PRE-FIX on `test-campaign` (sandbox `zz-repro-sandbox`, 12-grid): poison PUT 200 + `types: ['int','str']` census; fresh mount → ErrorBoundary `This view ran into an error…`, `rect.wall-cell` 0, `.grid-svg` absent, console `TypeError: key.split is not a function at GridAndWalls.jsx:58`.
- POST-FIX server (throwaway `PORT=8181 CAMPAIGN_LOCK=test-campaign` instance, killed by PID at exit): re-PUT of the poisoned doc → **400** `Map save rejected: every wall must be a "gx,gy" cell address like "7,2" inside the map's 12×12 grid (x 0..11, y 0..11) — 5, "999,999", "12,0" are malformed or outside the grid.`, disk md5 unchanged, zero SSE publishes; POST create with `walls:["9,0",5]` → 400, no file written; clean string walls with a duplicate → 200 round-trip; LAN-Host visitor with malformed walls → 403 (authority-first untouched).
- POST-FIX client (live :5173): fresh mount on a still-poisoned doc renders (14 wall cells, `5` skipped, no ErrorBoundary); a poisoned snapshot echoed through the old-code :80 into a mounted tab is adopted live (14 cells, no crash); a valid 11-wall snapshot adopts cleanly (adjacent-leg sanity); and the tab's own autosave rewrote string-only walls to disk — disk self-heal observed via the app lane.
- Tests: new `server/routes/maps.walls-bounds-guard.test.js` (16 pins, terrain-guard harness twin) + pins added to `GridAndWalls.test.jsx`, `useSSESync.test.js`, `useMapLoader.test.js`. Touched folders (`server/routes/`, `src/components/map/`, `src/services/maps/`): 257 files / 3338 tests green. `npm run lint` exit 0 (complexity/max-params cleanups folded shared gates into helper functions). Full `npm run test:run` green. `node .opencode/plans/no-timers-guard.mjs` OK.
- Cleanup: sandbox map DELETEd (maps dir back to the 4 baseline files), Admin clear-change-data + clear-log (store `{}`, log `[]`), throwaway server killed by PID, orchestrator pair untouched.
