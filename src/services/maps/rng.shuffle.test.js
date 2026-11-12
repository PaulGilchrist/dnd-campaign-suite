// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle } from './rng.js';

// LANE: SEEDED SHUFFLE PRIMITIVE (rng.js shuffle). Added for the Room-Adjacent
// irreproducibility bug (bug-adjacent-generator-random-sort-irreproducible):
// `arr.sort(() => rng() - 0.5)` let Array.prototype.sort's comparator-call
// count — an engine/JIT implementation detail — decide how many seeded draws
// each shuffle consumed, so one seed produced different maps in node vs the
// browser and even flipped mid-session. Fisher-Yates consumes exactly
// length - 1 draws in every environment. Generator-level pins live in
// adjacentDungeonGenerator.seeded-shuffle.test.js — not re-tested here.

describe('rng shuffle (Fisher-Yates)', () => {
  it('consumes exactly length - 1 draws regardless of array size', () => {
    for (const length of [0, 1, 2, 3, 4, 8, 50]) {
      let draws = 0;
      const counting = () => { draws++; return 0.5; };
      shuffle(Array.from({ length }, (_, i) => i), counting);
      expect(draws).toBe(Math.max(0, length - 1));
    }
  });

  it('is an in-place permutation: same array identity, same multiset', () => {
    const src = ['n', 's', 'w', 'e', 'u'];
    const out = shuffle(src, mulberry32(7));
    expect(out).toBe(src);
    expect([...out].sort()).toEqual([...src].sort());
  });

  it('byte-anchors mulberry32(42) on [n,s,w,e] — the cross-engine stream anchor', () => {
    // The exact call the Room-Adjacent placeRooms loop makes per attempt.
    // Order is a pure function of the seeded stream, so node, Chromium and
    // any future engine must all read back these bytes.
    expect(shuffle(['n', 's', 'w', 'e'], mulberry32(42))).toEqual(['n', 'e', 's', 'w']);
  });

  it('same seed and same input replay identically; different seeds diverge', () => {
    const once = shuffle(['n', 's', 'w', 'e'], mulberry32(1337));
    const twice = shuffle(['n', 's', 'w', 'e'], mulberry32(1337));
    expect(twice).toEqual(once);
    const other = shuffle(['n', 's', 'w', 'e'], mulberry32(42));
    expect(other).not.toEqual(once);
  });
});
