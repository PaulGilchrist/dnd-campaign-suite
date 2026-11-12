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

## Resolution
FIXED 2026-11-12 — the black-box diagnosis was confirmed exactly.

**What was wrong:** All three live sites guessed in the bug file were real and were the whole defect: `src/services/maps/furniturePlacer.js` L102 (torch `unique` defs), L238 (`chairDefs`), L511 (corridor `junctions`) shuffled with `sort(function () { return rng() - 0.5; })`. The function-expression form had survived the original hunt's arrow-form grep. A non-constant comparator lets `Array.prototype.sort` internals decide how many seeded draws each shuffle consumes, so the same seed produced different furniture downstream of the (identical) walls. `grep -E 'sort\(\(\) =>|sort\(function *\(\) *\{'` across `src/` confirmed no other live sites remain anywhere in the app.

**Fix (mirror of the adjacent-lane fix `d88c3cfb4`):** all three sites now use the seeded Fisher–Yates helper `shuffle(arr, rng)` already exported from `src/services/maps/rng.js` (which itself was left untouched). No new helpers or architectures.

**Files changed:**
- `src/services/maps/furniturePlacer.js` — 3 sorts → `shuffle(...)`, import extended.
- `src/services/maps/dungeonGenerator.seeded-shuffle.test.js` — NEW regression pin mirroring `adjacentDungeonGenerator.seeded-shuffle.test.js`: two-probe `Array.prototype.sort` comparator-equality spy across 9 grid/seed combos (sweeps all three shuffle sites + namegen), 20× same-session byte stability, fresh-module replay, post-fix census pin (256 walls / 34 items / "The Crystal Caverns of the Dark Lord" at grid 20 seed 42).
- `src/services/maps/dungeonGenerator.test.js` — byte pins re-baked to the new engine-independent stream (ratified trade per the adjacent-lane precedent): flagship g20/s42 name/description + full 34-item roster (walls ASCII unchanged — divergence was downstream of walls), dense g30/s42 census/NPC/trap bytes, seed-0 name. The dense-g30 flood-fill now starts from the first row-major open cell instead of the entrance stairs: on that seed's new stream the stairs land on a door cell and the pre-existing dedupe (keeps last-placed) drops them — same connectivity claim, no new defect (the stairs-lose-to-door precedence is inherited behavior, as the flagship's own npc-1 comment has always documented).

**Verification:**
- Live repro pre-fix: node `generateDungeon({gridSize:20,density:0.5,seed:42})` → 256 walls / 32 items; fresh Chromium module import → 256 / 28; UI Generate Dungeon modal (BSP, grid 20, seed 42) in test-campaign → disk doc 256 / 28. Divergence confirmed in-product.
- Live re-verify post-fix: Chromium fresh imports (`?v=fix1/fix2`) and two UI generations on one page session (`qa-bsp-repro`, `qa-bsp-repro2`) ALL produce 256 walls / 34 items with wall-hash `1274:377304007` and a `diff`-clean full item-byte match against the node ground truth. Expected behavior met exactly.
- Sanity: adjacent-mode UI gen unchanged at 199 walls / 42 items (post-`d88c3cfb4` pins); terrain gen clean (grid 30 verbatim, seed 7, 1800 hexes, centre party stamp).
- Tests: new pin 4/4; `src/services/maps/` 22 files / 351 tests; `src/components/maps-manager/` + `src/services/campaign/` 30 files / 470 tests; `npm run lint` zero warnings; `no-timers-guard` OK.
- Cleanup: all 4 qa-* sandbox maps deleted via row Delete → "Yes, Delete Permanently" (ghost-404 each; maps back to the 4 owner fixtures); change-data `{}` + log `[]` closed-tab two-pass admin clears GET-verified PASS-1 and PASS-2; overlays `[]`.

