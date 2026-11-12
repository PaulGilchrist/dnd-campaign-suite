# Bug: Room-Adjacent generator "Room Size" and "Corridor Length" controls are inert

## Summary
In the Generate Dungeon Map modal's **Room Adjacent** mode, the Room Size (Cramped/Standard/Spacious) and Corridor Length (Compact/Moderate/Sprawling) option buttons visibly select but have **zero effect on the generated map**: two generations that differ only in one of these controls are byte-for-byte identical in walls, placedItems, fog and terrain. First logged as an improvement-backlog entry on 2026-11-12 (fix-run); re-verified live the same day via controlled probe and escalated per the inert-control rule.

## Steps to reproduce
1. On localhost, in **test-campaign** → Maps view → click `Generate Dungeon` (Indoor radio active).
2. Click mode button `Room Adjacent`. Set Grid Size `20`, Seed `42`, leave Room Count at default 8, click the Room Size option `Cramped`, press `Generate`. Map `qa-adj-cram` lands and the modal closes.
3. Repeat with the identical inputs except Room Size = `Spacious`. Map `qa-adj-spc` lands.
4. Repeat with Seed 42, Spacious, Corridor Length = `Sprawling (long halls)`. Map `qa-adj-spraw` lands.
5. Compare the three files in `public/campaigns/test-campaign/maps/`: normalize each doc to `{walls, placedItems→(x,y,type), terrain, fog}` and compare JSON.

## Expected behavior
Room Size should scale room spans (the modal computes `minRoom`/`maxRoom` at 0.7×/1.3× and passes them as `opts.minRoom`/`opts.maxRoom`), and Corridor Length should change corridor carving.

## Actual behavior
`qa-adj-cram` and `qa-adj-spc` have **identical normalized content** (same 247-cell layout, same furniture placements), and `qa-adj-spc` ≡ `qa-adj-spraw`. Control probe: Room Count 3 vs 20 (same seed) DOES change the output, proving the comparison method detects real deltas — so the zero-delta on these two controls is genuine deadness, not a hashing artifact.

## Likely location
Confident (code census): `src/services/maps/adjacentDungeonGenerator.js` `generateAdjacentDungeon()` (~lines 501–530) **never reads** `opts.minRoom` / `opts.maxRoom` / `opts.corridorLength` — it recomputes `minRoom`/`maxRoom` internally from `gridSize` (lines 513–515; the 2026-11-12 small-grid fix `3d81a8e6e` clamped these internal floors but did not wire the opts). `src/components/maps-manager/GenerateDungeonModal.jsx` (adjacent branch, lines 74–89) computes `sizeMultiplier` and passes `minRoom`/`maxRoom`/`corridorLength` into the call, which are silently ignored. (An earlier backlog note also observed Room Count is only partially honored — the placement loop gives up on overshoot.)

## Suggested fix
In `generateAdjacentDungeon`, consume the passed options: `const minRoom = clamp(opts.minRoom ?? <internal default>, 2, roomMaxSpan)` (same for maxRoom), and thread `opts.corridorLength` into the corridor-carving step (e.g. a length budget multiplier per Compact/Moderate/Sprawling — currently corridors are purely room-adjacency/wall-follow). Add generator-level tests: same seed + `minRoom:99` must differ from default. Alternatively, if the design decision is that gridSize drives everything, remove/disable the two option groups in the modal so the UI stops lying.

## Severity
Broken feature — the controls are visible, selectable and documented by the modal copy, but produce a zero-delta output; users generating dungeons will believe room/corridor style was applied when it was not.

## Resolution
**FIXED 2026-11-12 (fix-run).** The "Likely location" guess was confirmed exactly: `generateAdjacentDungeon()` never read `opts.minRoom` / `opts.maxRoom` / `opts.corridorLength` — it recomputed `minRoom`/`maxRoom` from `gridSize` alone, and corridor carving (`connectClusters`) only ever fired for orphaned clusters, so both control groups were dead by construction.

**What changed** (`src/services/maps/adjacentDungeonGenerator.js` only — the modal was already computing and passing the options correctly):
- **Room Size:** the generator now consumes `opts.minRoom`/`opts.maxRoom`, clamped into the same `[2, roomMaxSpan]` envelope as the internal floors (`minRoom` also floors at 2, `maxRoom ≥ minRoom` enforced). Omitting the opts falls back to the legacy gridSize floors, so pre-flag default maps replay byte-identical.
- **Corridor Length:** `opts.corridorLength` maps to a room-spacing (`CORRIDOR_GAPS`: compact 1 / moderate 2 / sprawling 3). `findSharedEdge` generalized to a gap-range adjacency probe; `compact` keeps the legacy exact-1-cell shared wall + door cell (byte-identical to pre-fix output), while `moderate`/`sprawling` space rooms further apart and join them with the existing centre-to-centre L-corridor primitive (`carveCorridor`, same pattern `connectClusters` already uses) instead of a single door. Unlike the suggested fix's "length budget multiplier", no new corridor system was invented — spacing + the established corridor carver was enough. Wide gaps also accept a `[gap-1, gap+2]` spacing range so edge-clamped placements still connect: a collision sweep (grids 20/30 × 40 seeds) shows **0/80 identical pairs** across options while sprawling honestly packs fewer rooms into small grids.

**Files:**
- `src/services/maps/adjacentDungeonGenerator.js` — fix
- `src/services/maps/adjacentDungeonGenerator.room-size-corridor-options.test.js` — NEW regression test (6 its: cramped vs standard vs spacious all differ at one seed; opts == internal floors is an honest byte-identical no-op; `minRoom:99` clamps and differs from default; compact vs moderate vs sprawling all differ and compact ≡ unnamed; sprawling stays one connected dungeon; seed contract holds)

**Verification:**
- Repro re-run live in test-campaign BEFORE the fix: the three UI generations (`qa-adj-cram`/`qa-adj-spc`/`qa-adj-spraw`, grid 20 seed 42, room count 8) were one normalized md5 `16f569da…` — bug confirmed exactly as filed.
- Re-verified live AFTER the fix (fresh page, real UI, same steps): md5s `86a44896…` / `b31d4296…` / `b7e87ae1…` — all three differ, all differ from the pre-fix bytes; Room Size scales floor area (Cramped 259 walls vs Spacious 220) and Sprawling replaces door cells with carved halls (0 doors). BSP mode sanity-generated `qa-bsp-sanity` byte-stable (mode `bsp`, walls 512) — other modes untouched.
- Tests: new file 6/6; `adjacentDungeonGenerator.test.js` 18/18 (ALL legacy byte pins — flagship, layouts, g7 regression, modal-constructible sweep — preserved unchanged); `src/services/maps/` 18 files/326 tests; `src/components/maps-manager/` 10 files/167 tests. `npm run lint` zero warnings; `no-timers-guard` OK.
- Cleanup: all 4 sandbox maps API-deleted (ghost 404 each), Maps dir back to the 4 owner fixtures, change-data `{}` + log `[]` + overlays `[]` via closed-tab two-pass admin clears GET-verified; console 0 errors/0 warnings.
