// @maintained-by-ai
import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';

// LANE: SEED REPRODUCIBILITY OF THE ROOM-ADJACENT GENERATOR
// (bug-adjacent-generator-random-sort-irreproducible). The side/secret-door/
// trap shuffles used `sort(() => rng() - 0.5)`: a non-constant comparator made
// the number of rng draws per placement attempt depend on Array.prototype.sort
// internals, so the SAME seed + options produced different maps in node (233
// walls) vs Chromium-cold (237) vs Chromium-warm (213), and one long-lived
// page flipped mid-session. The fix shuffles via the seeded Fisher-Yates in
// rng.js — exactly length - 1 draws, engine-independent. Byte fixtures for the
// streams live in adjacentDungeonGenerator.test.js; the shuffle primitive is
// pinned in rng.shuffle.test.js — this file owns the "no random comparators
// remain + stable across repeats/fresh module instances" law.

// Exact options the bug report fed through the Generate Dungeon modal
// (Room Adjacent, Grid 20, Seed 42, Room Count 8, Room Size Standard,
// Corridor Compact, Layout Balanced).
const BUG_OPTS = {
  gridSize: 20,
  density: 0.5,
  seed: 42,
  roomCount: 8,
  corridorLength: 'compact',
  layoutStyle: 'balanced',
  minRoom: 4,
  maxRoom: 8,
};

const mapBytes = (map) =>
  JSON.stringify({
    name: map.name,
    description: map.description,
    walls: map.walls,
    items: map.placedItems.map(
      (i) => `${i.id}:${i.type}@${i.gridX},${i.gridY}:${i.rotation ?? ''}${i.name ?? ''}:${i.visible}`,
    ),
  });

describe('generateAdjacentDungeon seeded-shuffle reproducibility', () => {
  const originalSort = Array.prototype.sort;
  afterEach(() => {
    Array.prototype.sort = originalSort;
    vi.resetModules();
  });

  it('never shuffles through a non-constant (rng-driven) sort comparator', () => {
    // Structural lock on the reported anti-pattern: any comparator the
    // generator hands to Array.prototype.sort must answer the same question
    // twice the same way. `() => rng() - 0.5` fails on the first pair (a
    // seeded stream never repeats within one generation). Deterministic
    // comparators (assignRoomTypes' connection-count sort) pass untouched.
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
    generateAdjacentDungeon(BUG_OPTS);
    for (const layoutStyle of ['balanced', 'linear', 'forking', 'winding']) {
      generateAdjacentDungeon({ ...BUG_OPTS, layoutStyle });
    }
    expect(seen).toEqual([]);
  });

  it('is stable across repeated calls in one session (the live mid-session flip)', () => {
    // The browser repro generated the same modal inputs five times: 4 maps
    // at 237 walls, the 5th silently at 213. 20 back-to-back calls must all
    // replay byte-identical — warm-up cannot move the output.
    const bytes = mapBytes(generateAdjacentDungeon(BUG_OPTS));
    for (let i = 0; i < 20; i++) {
      expect(mapBytes(generateAdjacentDungeon(BUG_OPTS))).toBe(bytes);
    }
  });

  it('replays byte-identical through a fresh module instance (cross-environment anchor)', async () => {
    const warm = mapBytes(generateAdjacentDungeon(BUG_OPTS));
    vi.resetModules();
    const freshModule = await import('./adjacentDungeonGenerator.js');
    expect(mapBytes(freshModule.generateAdjacentDungeon(BUG_OPTS))).toBe(warm);
  });

  it('pins the post-fix engine-independent census for the bug-report options', () => {
    // node and Chromium previously answered 233/237/213 walls for these
    // options; Fisher-Yates collapses every environment onto these bytes
    // (browser re-verification must read the same values back).
    const map = generateAdjacentDungeon(BUG_OPTS);
    expect(map.walls.length).toBe(199);
    expect(map.placedItems.length).toBe(42);
    expect(map.name).toBe('The Haunted Tower of the Ancients');
    expect(map.seed).toBe(42);
  });
});
