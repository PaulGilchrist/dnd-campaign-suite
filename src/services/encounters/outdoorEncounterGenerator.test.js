// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { generateOutdoorEncounter } from './outdoorEncounterGenerator.js';

// LANE: HEX-ENCOUNTER GENERATION — deterministic hex-scene builder (terrain → biome props,
// seeded scatter of placedItems, marchingOrder → grid players). Consumed by
// hex-map/hooks/useEncounterGeneration.js, which MOCKS this module and pins only its call
// tuple (#1010 transport exact-if-fetch) — the generator's own bytes are owned HERE.
// Other lanes: encounterGenerator.test.js → #1076 flagship monster-suggestion RNG exemplar;
// autoEncounterService.test.js → #1073 Accept/dispatch lane. Not re-tested here.
// RNG SEAM (#1072): mulberry32 seeded by hashSeed(q, r), consumed pickWeighted → findPlacement
// per attempt. Pins are derived once from this exact algorithm (#815) — swapping the RNG,
// the seed formula, the density recipe, or ignoring q/r/gridSize breaks a pin. No wall-clock
// anywhere: output is a pure function of inputs (§ No Game Timers — encounters are never
// clock-driven). Zero mocks; no beforeEach/afterEach needed (#1007: nothing to restore).
// Range-only "different seeds differ" and same-seed self-compare assertions are banned here
// (#1076): byte-exact pins subsume them — a constant-seed bug breaks multiple distinct
// fixtures simultaneously (#1022 distinguishable fixtures: desert(-5,2), forest(1,2),
// plains(0,0), invariant forest(7,-4)).
//
// old → new map (27 its → 4 its + 2 it.each tables):
//   return-shape + parentTerrain/parentHex echoes + determinism self-compares + negative q/r
//     → byte-exact flagship desert object (every fixed key, echo bytes, negative hex)
//   forest/plains scatter + gridSize-differs its → byte-exact forest g20 roster (#815)
//   'at least 4 items' min-clamp (invisible in old fixtures) + max-60 + odd/small-grid edges
//     → exact clamp pair: plains g12 == 4 items (min clamp reached-branch, #1035; density
//       round would give 3), forest g100 == 60 (max clamp)
//   bgFill loop + fallback loop + 'one of biome types' + 'desert only' + 'water empty'
//     → it.each biome contract table over all 9 TERRAIN_TYPES ids + coercion legs
//       unknown/null/'' → plains (#959 coercion honesty)
//   6 player-positioning its → it.each exact-player-array table (center math, 3-per-row
//       wrap, id slug, empty, odd grid)
//   required-fields + unique-ids + bounds + no-overlap + clear-zone loops
//     → single placement-invariants test on dense forest g30 (the old small-grid clear-zone
//       test was vacuous: g10 places nothing at all, every cell is clear zone — honest now)

// Compact byte serializer for placed-item rosters.
const roster = (items) => items.map((i) => `${i.type}@${i.gridX},${i.gridY}`);

describe('generateOutdoorEncounter', () => {
  it('byte-exact flagship: desert g20 at hex (-5, 2) returns the full pinned scene', () => {
    // 0.015*400 = 6 items (no clamp), 50/50 boulder/bush weights land 3/3,
    // all coordinates outside the center clear zone [6..14]^2.
    expect(generateOutdoorEncounter('desert', 20, ['Finn', 'Zariel', 'Thorin', 'Lyra'], -5, 2)).toEqual({
      type: 'indoor',
      parentTerrain: 'desert',
      parentHex: { q: -5, r: 2 },
      gridSize: 20,
      walls: [],
      placedItems: [
        { id: 'boulder-0', type: 'boulder', gridX: 15, gridY: 4, visible: true },
        { id: 'bush-1', type: 'bush', gridX: 10, gridY: 18, visible: true },
        { id: 'bush-2', type: 'bush', gridX: 13, gridY: 15, visible: true },
        { id: 'bush-3', type: 'bush', gridX: 9, gridY: 2, visible: true },
        { id: 'boulder-4', type: 'boulder', gridX: 2, gridY: 10, visible: true },
        { id: 'boulder-5', type: 'boulder', gridX: 3, gridY: 1, visible: true },
      ],
      players: [
        { id: 'finn', name: 'Finn', gridX: 9, gridY: 9 },
        { id: 'zariel', name: 'Zariel', gridX: 10, gridY: 9 },
        { id: 'thorin', name: 'Thorin', gridX: 11, gridY: 9 },
        { id: 'lyra', name: 'Lyra', gridX: 9, gridY: 10 },
      ],
      fog: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      bgFill: '#C4B080',
    });
  });

  it('byte-exact forest roster: 24 items at 6% density on g20, hex (1, 2)', () => {
    // round(400 * 0.06) = 24 attempts, all placed: tree-weighted (18/24) with
    // boulders/bushes from the 60/15/25 weights, clear zone [6..14]^2 avoided.
    expect(roster(generateOutdoorEncounter('forest', 20, [], 1, 2).placedItems)).toEqual([
      'tree@14,18', 'boulder@1,6', 'tree@3,8', 'bush@9,16', 'boulder@4,6', 'tree@5,1',
      'tree@14,15', 'tree@15,12', 'boulder@17,9', 'bush@10,18', 'tree@7,1', 'tree@15,13',
      'tree@15,11', 'tree@5,10', 'tree@12,2', 'boulder@2,16', 'tree@1,17', 'tree@18,18',
      'bush@1,18', 'tree@11,17', 'tree@7,15', 'bush@14,16', 'boulder@12,4', 'boulder@2,17',
    ]);
  });

  it('clamps roster count: min 4 (plains g12, density round = 3) and max 60 (forest g100)', () => {
    // plains g12: round(144 * 0.02) = 3 → clamped up to 4, all 4 land on edge lanes.
    expect(roster(generateOutdoorEncounter('plains', 12, [], 0, 0).placedItems)).toEqual([
      'bush@5,1', 'bush@1,4', 'bush@1,6', 'bush@1,7',
    ]);
    // forest g100: round(10000 * 0.06) = 600 → clamped down to exactly 60.
    expect(generateOutdoorEncounter('forest', 100, [], 0, 0).placedItems).toHaveLength(60);
  });

  it.each([
    ['forest', '#2D5E37', ['tree', 'boulder', 'bush']],
    ['plains', '#7A9B6A', ['tree', 'boulder', 'bush']],
    ['mountains', '#6F6F62', ['boulder', 'tree', 'bush']],
    ['hills', '#6B8E50', ['boulder', 'tree', 'bush']],
    ['swamp', '#4A6B3A', ['tree', 'boulder', 'bush']],
    ['desert', '#C4B080', ['boulder', 'bush']],
    ['tundra', '#8CA0A0', ['boulder', 'bush']],
    ['beach', '#D4C080', ['boulder', 'tree', 'bush']],
    ['water', '#356090', []],
    // Coercion honesty (#959): unknown/null/'' silently fall back to the plains biome.
    ['underwater', '#7A9B6A', ['tree', 'boulder', 'bush']],
    [null, '#7A9B6A', ['tree', 'boulder', 'bush']],
    ['', '#7A9B6A', ['tree', 'boulder', 'bush']],
  ])('biome %s → bgFill %s and only item types %j', (terrainType, bgFill, allowedTypes) => {
    const result = generateOutdoorEncounter(terrainType, 20, [], 0, 0);
    expect(result.bgFill).toBe(bgFill);
    for (const item of result.placedItems) {
      expect(allowedTypes).toContain(item.type);
    }
  });

  it.each([
    [10, [], []],
    [10, ['Solo'], [{ id: 'solo', name: 'Solo', gridX: 4, gridY: 4 }]],
    [9, ['Only'], [{ id: 'only', name: 'Only', gridX: 3, gridY: 3 }]],
    [10, ['Finn', 'Zariel', 'Thorin', 'Lyra'], [
      { id: 'finn', name: 'Finn', gridX: 4, gridY: 4 },
      { id: 'zariel', name: 'Zariel', gridX: 5, gridY: 4 },
      { id: 'thorin', name: 'Thorin', gridX: 6, gridY: 4 },
      { id: 'lyra', name: 'Lyra', gridX: 4, gridY: 5 },
    ]],
    [20, ['Sir Lancelot', 'Lady Grey'], [
      { id: 'sir-lancelot', name: 'Sir Lancelot', gridX: 9, gridY: 9 },
      { id: 'lady-grey', name: 'Lady Grey', gridX: 10, gridY: 9 },
    ]],
    [20, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], [
      { id: 'a', name: 'A', gridX: 9, gridY: 9 },
      { id: 'b', name: 'B', gridX: 10, gridY: 9 },
      { id: 'c', name: 'C', gridX: 11, gridY: 9 },
      { id: 'd', name: 'D', gridX: 9, gridY: 10 },
      { id: 'e', name: 'E', gridX: 10, gridY: 10 },
      { id: 'f', name: 'F', gridX: 11, gridY: 10 },
      { id: 'g', name: 'G', gridX: 9, gridY: 11 },
    ]],
  ])('players: g%i %j lands on exact grid block', (gridSize, marchingOrder, expected) => {
    // Center block starts at floor(gridSize/2) - 1, 3 per row, ids slugged from names.
    expect(generateOutdoorEncounter('forest', gridSize, marchingOrder, 0, 0).players).toEqual(expected);
  });

  it('dense forest g30 at hex (7, -4): every item respects bounds, clear zone, and uniqueness', () => {
    const { placedItems } = generateOutdoorEncounter('forest', 30, [], 7, -4);
    expect(placedItems.length).toBeGreaterThan(0);
    expect(placedItems.length).toBeLessThanOrEqual(60);
    const coords = new Set();
    const ids = new Set();
    for (const item of placedItems) {
      expect(item.id).toMatch(/^(tree|boulder|bush)-\d+$/);
      expect(item.visible).toBe(true);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      // Built from rng() * (gridSize - 2) + 1 → strictly inside the edge ring.
      expect(item.gridX).toBeGreaterThanOrEqual(1);
      expect(item.gridX).toBeLessThanOrEqual(28);
      expect(item.gridY).toBeGreaterThanOrEqual(1);
      expect(item.gridY).toBeLessThanOrEqual(28);
      // Center clear zone: center 15 ± 4 → square [11..19]^2 excluded.
      expect(item.gridX >= 11 && item.gridX <= 19 && item.gridY >= 11 && item.gridY <= 19).toBe(false);
      const key = `${item.gridX},${item.gridY}`;
      expect(coords.has(key)).toBe(false);
      coords.add(key);
    }
  });
});
