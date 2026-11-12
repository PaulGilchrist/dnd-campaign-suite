# Bug: Generate Dungeon (Room Adjacent) crashes generator at small grid sizes

## Summary
`generateAdjacentDungeon` throws `TypeError: Cannot read properties of undefined (reading '1')` for many seeds at small grid sizes. The modal's `catch` surfaces the raw JS message as an inline error — the user sees a cryptic crash instead of a generated map (or an honest validation refusal).

## Steps to reproduce
1. Node probe (re-derived 2026-11-12, improve-run): call `generateAdjacentDungeon` with the exact args `GenerateDungeonModal.jsx` builds for Room-Adjacent mode at grid 7 + defaults (density 0.5, roomCount 8, corridorLength compact, layoutStyle balanced, minRoom 4, maxRoom 8) for seeds 0..59.
   - Result: **36/60 seeds throw** (first failure seed 5). Grid 30: 0/60.
2. Live: Maps → Generate Dungeon → `Room Adjacent` → name + grid 7 + a failing seed (e.g. 5) → Generate → inline error `Cannot read properties of undefined (reading '1')`, no map.

## Expected behavior
Room-Adjacent generation either succeeds for every seed the modal accepts (grid 7–100 are within the field's own gate), or the modal honestly refuses inputs it cannot support — never a raw JS exception face.

## Actual behavior
Uncaught-by-design generator crash at small grids; ~60% of seeds fail at grid 7.

## Likely location
`src/services/maps/adjacentDungeonGenerator.js:426` in `collectSecretDoorCandidates` (called from `placeSecretDoors:435` ← `generateAdjacentDungeon:547`) — reads `[x][y]`-style coordinate pairs off a room/cell structure that is undefined when rooms get squeezed at 7×7 (minRoom 4 + corridors leaves little/invalid layout space). Pre-existing law: NOT introduced by `17b84a736` (the [7,100] gate passes byte-identical args for in-range input).

## Notes
- Filed directly from the QA backlog intake bullet (`docs/app-exploration.md`, [2026-11-12 improve-run]) after a bounded node repro.
- Fix dispatched same session via `e2e-improve` flow (user directive "fix new bug").

## Resolution (2026-11-12, improve subagent) — FIXED
- Root cause (both layers): (1) generator room bounds `Math.max(4,…)`/`Math.max(8,…)` floors gave 4–8-wide rooms to a 7-wide grid; `placeRooms`' `Math.max(1,…)` clamp then produced rects hanging off the grid, and `collectSecretDoorCandidates` read `grid[y]` past the last row (TypeError reading '1'). (2) The modal built the same impossible 4–8-wide spec (its `minRoom`/`maxRoom` opts are actually DEAD — the generator recomputes from gridSize; proved by probe: `minRoom:99` changed nothing). `roomCount` overshoot needed no modal scaling: the placement loop already gives up gracefully (`failureStreak > 50`).
- Fix: clamp room spans to `gridSize - 2` in BOTH `adjacentDungeonGenerator.js` (`roomMaxSpan`) and the modal's adjacent-args; bounds-checked `isWall` seam probe in `collectSecretDoorCandidates` (mirrors `roomGenerator.js` `isOpen`); `placeTraps` gained the missing `gridSize` bounds guard. Byte-identical output for all grids ≥10 (clamp inactive; all existing golden pins pass untouched).
- Evidence: repro 36/60 → 0/60 fails; full sweep grids 7..100 × seeds 0..59 (balanced, modal args) + spot grids {7,8,10,12,15,20,30,50,100} × 4 styles × 60 seeds: 0 exceptions, 0 out-of-range wall/item coords, all deterministic; g7..16 × 60 seeds flood-fill connected. g7 honest output: one 4–5-wide seed room (7×7 geometrically cannot fit two ≥4-wide rooms + wall gap: 4+1+4 > 7).
- Tests: `adjacentDungeonGenerator.test.js` + g7/seed-5 byte pin + `it.each` modal-constructible sweep per grid (g100 case: 20s timeout under jsdom); `GenerateDungeonModal.test.jsx` + capped-tuple pins at grid 7 (grid-30 pins unchanged — cap 28 never binds). 487/487 in `src/services/maps/` + `src/components/maps-manager/`; lint 0 warnings; no-timers guard OK.
- Live (test-campaign): adjacent g7 seed5 → modal closed, row, disk 200 `{gridSize:7, generationMode:"adjacent", seed:5, walls:24, items:6}`, no banner; adjacent g30 seed42 and BSP g20 seed42 regressions generated; Cancel-with-dirty-fields created nothing; console 0 errors/0 warnings incl. fresh goto. Cleanup: 3 sandbox maps API-DELETED (ghost 404 each), maps dir back to 4 owner fixtures (battle-arena 94fcd0bf…, test-map 8e40779e…), change-data `{}` + log `[]` via closed-tab two-pass admin clear.
