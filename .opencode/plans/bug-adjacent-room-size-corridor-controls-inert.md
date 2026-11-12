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
