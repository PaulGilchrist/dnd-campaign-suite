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

## Resolution (FIXED — e2e-fix run 2026-11-12)

Root cause confirmed exactly as diagnosed: the three `sort(() => rng() - 0.5)` random comparators made per-shuffle RNG consumption depend on `Array.prototype.sort` internals (engine version and V8 tier), cascading into different layouts for one seed.

**One correction to the bug file:** `grep 'sort(() => rng'` looked clean outside this file only because the arrow form was grepped — `src/services/maps/furniturePlacer.js` (the BSP lane, imported by `dungeonGenerator.js`) carries the same anti-pattern in function form at L102 (torch walls), L238 (chairs), L511 (corridor traps). Live-confirmed diverging cross-engine RIGHT NOW: `generateDungeon({gridSize:20,density:0.5,seed:42})` → node 256 walls / **32** items vs Chromium 256 walls / **28** items (each environment internally stable — which is why UF's same-browser POST pairs let the BSP "law" pass). Out of scope for this bug (different byte-pinned lane, `dungeonGenerator.test.js`); needs its own tracker + fix decision.

### Changes
- `src/services/maps/rng.js` — added `export function shuffle(arr, rng)`: in-place Fisher-Yates, exactly `length - 1` draws regardless of engine (with a comment banning the random-comparator form for seeded generators).
- `src/services/maps/adjacentDungeonGenerator.js` — `shuffle` used at all three sites (placeRooms sides; secret-door candidates; trap candidates); dead random sorts deleted.
- `src/services/maps/adjacentDungeonGenerator.test.js` — byte pins regenerated for the new (now engine-independent) streams: flagship g20/42 (name/description/ASCII/roster), layout g16 table ×3, dense g30 census, degenerate g12, g7 regression. The forking branch pin moved seed 6 → 2 because the new stream makes seed 6 chain-shaped (0-1-2-3, no branch); seed 2 reproduces the exact branch topology the test claims (door-0-1/0-2/1-3).
- NEW `src/services/maps/rng.shuffle.test.js` — helper locks: exactly `length - 1` draws for sizes 0..50, in-place permutation, cross-engine anchor `shuffle(['n','s','w','e'], mulberry32(42)) === ['n','e','s','w']`.
- NEW `src/services/maps/adjacentDungeonGenerator.seeded-shuffle.test.js` — the regression: (1) a two-probe `Array.prototype.sort` spy throws-captures ANY non-constant comparator reaching sort during generation across all four layouts (kills the anti-pattern structurally, not just at these options); (2) 20× repeated calls byte-stable (mid-session flip lane); (3) fresh-module-instance replay; (4) post-fix anchor for the exact bug-modal options: **199 walls / 42 items / "The Haunted Tower of the Ancients"** — the value every environment must now agree on.

### Verification
- Pre-fix live repro (test-campaign, real UI): same modal inputs (Grid 20, Seed 42, 8 rooms, Standard/Compact/Balanced) → `qa-fix-std/repro/r3/r4` = 237 walls, `qa-fix-r5` = **213** mid-session flip, no reload; node = **233**. All three bug-file values re-observed.
- Post-fix: node = 199:42; in-page 12-call ladder + fresh-import all 199:42; UI pair `qa-fix-v1`/`qa-fix-v2` → both **199 walls / 42 items** (identical POST-to-disk outputs); Cramped control 247/53 ≠ Standard → option-consumption semantics survive.
- Tests: new files 8/8; `src/services/maps/` 21 files / 347 tests pass (incl. regenerated pins + untouched room-size-corridor relations); `src/components/maps-manager/` 10 files / 179 tests pass; full suite green (see run log). `npm run lint` EXIT 0; `no-timers-guard` OK.
- Cleanup: all 8 `qa-fix-*` sandboxes DELETEd, ghost-404 each, maps back to the 4 owner fixtures; Admin clears ran — change-data `{}`, log `[]`, overlays `[]` GET-verified.

As the fix predicted, outputs for previously-saved seeds intentionally changed (that is the first honestly-reproducible behavior); previously-saved map files on disk are untouched.

