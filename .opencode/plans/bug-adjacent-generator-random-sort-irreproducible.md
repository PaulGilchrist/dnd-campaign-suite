# Bug: Room-Adjacent generator is not seed-reproducible across engines/warm states (`sort(() => rng() - 0.5)` anti-pattern)

## Summary
The Room-Adjacent dungeon generator shuffles arrays with `array.sort(() => rng() - 0.5)` (three sites in `src/services/maps/adjacentDungeonGenerator.js`). A non-constant random comparator makes the number of comparator calls — and therefore how many seeded RNG draws each placement attempt consumes — dependent on the JS engine's sort implementation and even on V8's JIT tier. The same seed + same options + same code produces **different maps** between node and the browser, and can flip mid-session in one page. The documented same-seed byte-reproducibility law (TE 2026-11-12) holds for BSP and Terrain generators but is silently false for Room-Adjacent.

## Steps to reproduce
(A confirmed live 2026-11-12 via the real UI; (B) via direct module calls in node vs the page:

1. In test-campaign → Maps view → `Generate Dungeon` → mode `Room Adjacent`. Set Grid 20, Seed 42, leave Room Count 8 / Room Size Standard / Corridor `Compact (rooms adjacent)` / Layout Balanced. Generate map `qa-uf-std`.
2. Repeat the exact same inputs for `qa-uf-repro` and three more times (`qa-uf-r2a/b/c`). Disk docs: `qa-uf-std` = 237 walls, but `qa-uf-repro`/`r2a/b/c` = 213 walls — **the same UI inputs produced two different maps** (each pair internally deterministic, the value silently flipped mid-session; no page reload between runs).
3. Engine split: `node --input-type=module -e "import('./src/services/maps/adjacentDungeonGenerator.js').then(m => console.log(m.generateAdjacentDungeon({gridSize:20,density:0.5,seed:42,roomCount:8,corridorLength:'compact',layoutStyle:'balanced',minRoom:4,maxRoom:8}).walls.length))"` prints **233**; the same call in the page (fresh, cache-disabled) prints **237** cold and **213** warm. Three environments, three answers, one seed.
4. Stage instrumentation (temporary `rng.js` draw counter grouped by caller) shows the browser's `placeRooms` consuming 424 draws vs node's 364 for identical inputs; calling the generator 12× consecutively in one page, the per-call draw profile **flips mid-list** (`72:424:933` ×4 → `82:480:1172` ×8) with no code change — a V8 tier-up switching sort internals.

## Expected behavior
A seeded generator is a pure function of its options: same seed + same options → byte-identical walls/placedItems, in every environment and at every warm-up state (the law TE verified live for BSP and terrain twins the same day).

## Actual behavior
Output depends on the engine's `Array.prototype.sort` comparator-call count. Live-confirmed map hashes at seed 42/grid 20/Standard/Compact: node `233 walls`, browser-cold `237`, browser-warm `213`. The RNG *stream* is identical (mulberry32 verified byte-identical draws node vs page); only the **consumption count per placement attempt** diverges, cascading into different side choices and layouts.

## Likely location
Confident (instrumented to the exact line): `src/services/maps/adjacentDungeonGenerator.js`
- Line 119 `const sides = ['n','s','w','e'].sort(() => rng() - 0.5);` (main driver — inside the placeRooms attempt loop, so every engine-dependent extra comparator call shifts the whole downstream stream)
- Line 455 `const shuffledSec = [...secDoorCandidates].sort(() => rng() - 0.5);`
- Line 482 `const shuffledTraps = [...trapCandidates].sort(() => rng() - 0.5);`

`grep -r "sort(() => rng" src/` is clean outside this file (BSP `dungeonGenerator.js` / `hexTerrainGenerator.js` do not use random sorts — consistent with their surviving same-seed law).

## Suggested fix
Replace random-comparator sorts with a Fisher–Yates shuffle driven by the seeded rng — add `export function shuffle(arr, rng) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }` to `src/services/maps/rng.js` (look for an existing helper first) and use it at all three sites (`shuffle(['n','s','w','e'], rng)`). Fisher–Yates consumes exactly `length - 1` draws per call, independent of engine. Add a regression pin: same opts called in a fresh module instance (or a `sort` spy asserting no `sort(() => …rng…)` remains) — plus keep the existing room-size/corridor options tests. Note the fix intentionally changes outputs for previously-saved seeds; that is the honest first reproducible behavior.

## Severity
Data integrity risk — the seeded-reproducibility contract (a core promise of the generate modals, disk-verified for the other two generators the same day) silently fails for Room-Adjacent: a GM who records a seed cannot re-roll the same dungeon across a browser update, across environments, or even reliably within one long-lived page (mid-session flip observed live). QA/unit lanes (node) can never reproduce browser output.
