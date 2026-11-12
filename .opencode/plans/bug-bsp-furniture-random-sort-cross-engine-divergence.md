# Bug: BSP dungeon furniture placement is not seed-reproducible across engines (`sort(function(){return rng()-0.5})` anti-pattern in furniturePlacer.js)

## Summary
The BSP generator's furniture lane shuffles arrays with a random comparator — `sort(function () { return rng() - 0.5; })` at three sites in `src/services/maps/furniturePlacer.js` (L102 `unique` furniture defs, L238 `chairDefs`, L511 `junctions`). A non-constant comparator makes the number of comparator calls — and therefore how many seeded RNG draws each shuffle consumes — dependent on the JS engine's `Array.prototype.sort` implementation and V8's JIT tier. The same seed + same options produce **different placedItems** between node and the browser. This is the exact anti-pattern just fixed in the Room-Adjacent generator (`bug-adjacent-generator-random-sort-irreproducible`, resolved 2026-11-12), surviving in the BSP lane because the original hunt grepped only the arrow form `sort(() => rng` and these sites use the function-expression form. Wall layout agrees cross-engine (the divergence is downstream of walls, inside furniture placement), which is why same-browser "BSP byte-law" checks passed — a page-vs-page probe can never see engine-dependent consumption.

## Steps to reproduce
Observed live 2026-11-12 by the adjacent-generator fix subagent (node vs Chromium, same module code):

1. Node: `node --input-type=module -e "import('./src/services/maps/dungeonGenerator.js').then(m => { const d = m.generateDungeon({gridSize:20,density:0.5,seed:42}); console.log(d.walls.length, d.placedItems.length); })"` → **256 walls / 32 items**.
2. Same call in a fresh Chromium page (Vite dev, cache-busted `?v=N` import of `/src/services/maps/dungeonGenerator.js`) → **256 walls / 28 items**.
3. `grep -rn "rng() - 0.5" src/` shows the three live sites in `furniturePlacer.js` (adjacentDungeonGenerator.js hits are comments/tests only).

## Expected behavior
A seeded generator is a pure function of its options: same seed + same options → byte-identical walls/placedItems, in every environment and at every warm-up state (the documented reproducibility law for the generate modals).

## Actual behavior
Furniture/chair/junction shuffle consumption counts vary with the engine's sort internals, so item count and item placement diverge node (32) vs browser (28) at seed 42/grid 20. A GM's recorded seed cannot be re-rolled faithfully across environments.

## Likely location
Confirmed by grep (needs live per-call draw-count instrumentation to confirm which of the three sites dominates): `src/services/maps/furniturePlacer.js`
- Line 102 `const shuffled = unique.slice().sort(function () { return rng() - 0.5; });`
- Line 238 `const shuffled = chairDefs.slice().sort(function () { return rng() - 0.5; });`
- Line 511 `const shuffled = junctions.slice().sort(function () { return rng() - 0.5; });`

## Suggested fix
Mirror the shipped adjacent-generator fix exactly: replace each random-comparator sort with the seeded Fisher–Yates helper `shuffle(arr, rng)` now exported from `src/services/maps/rng.js` (`shuffle(unique.slice(), rng)` etc. — Fisher–Yates consumes exactly `length - 1` draws, engine-independent). Add the same structural lock as `adjacentDungeonGenerator.seeded-shuffle.test.js` (two-probe `Array.prototype.sort` comparator-equality spy + same-session stability + fresh-module replay) co-located with `furniturePlacer.js`/`dungeonGenerator.js`, and regenerate the byte pins in `dungeonGenerator.test.js`. **NOTE:** the byte-pin re-bake intentionally changes outputs for previously-saved BSP seeds — this trade is ALREADY RATIFIED by the adjacent-lane precedent (same law, ratified 2026-11-12 in `bug-adjacent-generator-random-sort-irreproducible` resolution), so re-baking pins to the new engine-independent stream is the expected fix outcome, not a blocker.

## Severity
Data integrity risk — the seeded-reproducibility contract silently fails for BSP dungeons across environments (item lane). Lower blast radius than the adjacent bug (walls agree; only furniture diverges; no mid-session flip confirmed yet for BSP), but it poisons any node-vs-browser verification of generated maps until fixed.
