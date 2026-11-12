// @maintained-by-ai
import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateDungeon } from './dungeonGenerator.js';

// LANE: SEED REPRODUCIBILITY OF THE BSP GENERATOR'S FURNITURE LANE
// (bug-bsp-furniture-random-sort-cross-engine-divergence). The torch/chair/
// corridor-junction shuffles in furniturePlacer.js used
// `sort(function () { return rng() - 0.5; })`: a non-constant comparator made
// the number of rng draws per shuffle depend on Array.prototype.sort
// internals, so the SAME seed + options produced different placedItems in
// node (32 items) vs Chromium (28) at grid 20 / seed 42 — walls agreed, the
// divergence started inside furniture. The fix shuffles via the seeded
// Fisher-Yates in rng.js — exactly length - 1 draws, engine-independent.
// Byte fixtures for the streams live in dungeonGenerator.test.js; the shuffle
// primitive is pinned in rng.shuffle.test.js — this file owns the "no random
// comparators remain + stable across repeats/fresh module instances" law.

// Exact options the bug report fed through node and the Generate Dungeon
// modal (BSP Dungeon, Grid 20, Seed 42, Density 50%).
const BUG_OPTS = { gridSize: 20, density: 0.5, seed: 42 };

const mapBytes = (map) =>
  JSON.stringify({
    name: map.name,
    description: map.description,
    walls: map.walls,
    items: map.placedItems.map(
      (i) => `${i.id}:${i.type}@${i.gridX},${i.gridY}:${i.rotation ?? ''}${i.name ? `:${i.name}` : ''}:${i.visible}`,
    ),
  });

describe('generateDungeon (BSP) furniture-lane seeded-shuffle reproducibility', () => {
  const originalSort = Array.prototype.sort;
  afterEach(() => {
    Array.prototype.sort = originalSort;
    vi.resetModules();
  });

  it('never shuffles through a non-constant (rng-driven) sort comparator', () => {
    // Structural lock on the reported anti-pattern: any comparator the
    // generator hands to Array.prototype.sort must answer the same question
    // twice the same way. `function () { return rng() - 0.5; }` fails on the
    // first pair (a seeded stream never repeats within one generation).
    // Sweeping grids/seeds exercises all three furniturePlacer shuffle sites
    // (torch defs, chair defs, corridor junctions) plus the namegen sorts.
    const seen = [];
    Array.prototype.sort = function (comparator) {
      if (typeof comparator === 'function' && this.length >= 2) {
        const first = comparator(this[0], this[1]);
        const second = comparator(this[0], this[1]);
        if (!Object.is(first, second)) {
          seen.push(this.map(String).join(','));
        }
      }
      return originalSort.call(this, comparator);
    };
    for (const gridSize of [20, 30, 40]) {
      for (const seed of [42, 7, 1337]) {
        generateDungeon({ gridSize, density: 0.5, seed });
      }
    }
    expect(seen).toEqual([]);
  });

  it('is stable across repeated calls in one session (the cross-engine proxy)', () => {
    // A random comparator lets V8's sort internals (and even JIT tier) move
    // the output mid-session; with Fisher-Yates warm-up cannot change a byte.
    const bytes = mapBytes(generateDungeon(BUG_OPTS));
    for (let i = 0; i < 20; i++) {
      expect(mapBytes(generateDungeon(BUG_OPTS))).toBe(bytes);
    }
  });

  it('replays byte-identical through a fresh module instance (cross-environment anchor)', async () => {
    const warm = mapBytes(generateDungeon(BUG_OPTS));
    vi.resetModules();
    const freshModule = await import('./dungeonGenerator.js');
    expect(mapBytes(freshModule.generateDungeon(BUG_OPTS))).toBe(warm);
  });

  it('pins the post-fix engine-independent census for the bug-report options', () => {
    // node and Chromium previously answered 32 vs 28 items for these options;
    // Fisher-Yates collapses every environment onto these bytes (browser
    // re-verification must read the same values back).
    const map = generateDungeon(BUG_OPTS);
    expect(map.walls.length).toBe(256);
    expect(map.placedItems.length).toBe(34);
    expect(map.name).toBe('The Crystal Caverns of the Dark Lord');
    expect(map.seed).toBe(42);
  });
});
