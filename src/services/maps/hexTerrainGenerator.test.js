// @maintained-by-ai
// Lane: procedural overland map generation (terrain grid + rivers) for fixed seeds.
// Flagship shape: byte-exact full-map pins for fixed seeds — terrain grids as row
// strings (legend below, consumed row-major), exact terrain census counts per type,
// exact river key arrays, and one river-continuity tripwire per output family.
// Any change to RNG order, thresholds, framing, beaches, lakes, river tracing, or
// weighting rewrites these bytes.
// Cited, not re-driven (owner lanes):
//   hexMapUtils.test.js T1 ...... hexKey key bytes (rivers are checked as terrain-key
//                                 MEMBERSHIP here; the old /^\d+,\d+$/ regex duplicate is purged #1170)
//   hexMapUtils.test.js T5 ...... hexNeighbors exact six (used here only as oracle for
//                                 the river-chain continuity tripwire, formula not re-derived)
// Seed sensitivity is pinned as distinct golden bytes across seeds (#1160: same-seed
// self-compares banned; determinism re-armed via goldens #1057). No wall-clock game
// state (#app): the only unseeded call proves the Math.random entropy fallback exists.
// Old->new map: property-shape test -> T1 exact object; keys-for-all-hexes(gs5) +
// minimum-grids -> T-min; valid-terrain-types + edge-water-frame + beaches-exist +
// non-water-interior + distribution>=4 -> T1 census (exact counts subsume presence loops
// #890); rivers-valid-keys regex + rivers-exist + rivers-reference-terrain -> T-rivers
// (exact set + membership + one adjacency tripwire #1099); deterministic-same-seed ->
// retired, goldens are the determinism pins (#1160/#1057); different-seeds -> T-seeds
// distinct bytes; no-seed-differs -> T-entropy; weights-change-distribution ->
// T-weights golden bytes (both w<1 and w>1 legs visible #1035); weights-ignore-
// non-object -> T-coerce bytes-equal-to-base; standalone invalid-inputs + plains-only +
// empty-terrain -> T-rivers-zero table; standalone valid-keys + exists-in-terrain ->
// T-downhill exact bytes; standalone consistent-self-compare -> retired (#1160).
import { describe, it, expect, vi } from 'vitest';
import { generateHexTerrain, generateRiversFromTerrain } from './hexTerrainGenerator.js';
import { TERRAIN_TYPES } from '../../config/outdoorConfig.js';
import { hexNeighbors } from './hexMapUtils.js';

const VALID_TERRAIN_IDS = new Set(TERRAIN_TYPES.map((t) => t.id));

// One char per hex terrain id; every id in the generator's output alphabet.
const LEGEND = {
  water: 'W', beach: 'b', plains: '.', forest: 'f', hills: 'h',
  mountains: 'M', swamp: 's', desert: 'd', tundra: 'T',
};

// Row-major golden grids -> the exact terrain key/value map the generator must emit.
function expandGrid(rows) {
  const terrain = {};
  rows.forEach((row, r) => {
    [...row].forEach((ch, q) => {
      const id = Object.keys(LEGEND).find((k) => LEGEND[k] === ch);
      terrain[`${q},${r}`] = id;
    });
  });
  return terrain;
}

function censusOf(rows) {
  const census = {};
  for (const row of rows) {
    for (const ch of row) {
      const id = Object.keys(LEGEND).find((k) => LEGEND[k] === ch);
      census[id] = (census[id] || 0) + 1;
    }
  }
  return census;
}

// Flagship: gridSize 10 (20 cols x 10 rows), seed 42.
const FLAG_ROWS = [
  'WWWWWWWWWWWWWWWWWWWW',
  'WbbbbbbbbbbbbbbbbbbW',
  'WbMMMMMhhhhhhhhhhhbW',
  'WbfffffhhhhhhhhhhhbW',
  'WbMffffhMMMMMMMMfhbW',
  'WbMMMhfhhhhhhhhhhhbW',
  'WbfffhhhhhhhhhhhhhbW',
  'WbfhhhhhhhhhhhhhhhbW',
  'WbbbbbbbbbbbbbbbbbbW',
  'WWWWWWWWWWWWWWWWWWWW',
];
const FLAG_TERRAIN = expandGrid(FLAG_ROWS);
const FLAG_RIVERS = ['3,5', '3,6', '3,7', '3,8', '3,9', '2,5', '3,4', '4,4', '5,3', '2,4'];

describe('hexTerrainGenerator', () => {
  describe('generateHexTerrain', () => {
    // T1 — flagship full-map bytes: exact terrain map (which pins the water edge
    // frame, every beach, the noise/threshold grid, and lake flooding), the exact
    // census per terrain type (#890), and the config-id contract. The last row/col
    // bytes exercise sampleNoiseGrid's clamps (#1035).
    it('generateHexTerrain({gridSize:10,seed:42}) pins the full map bytes, census, and config ids', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(result.terrain).toEqual(FLAG_TERRAIN);
      expect(censusOf(FLAG_ROWS)).toEqual({ water: 56, beach: 48, mountains: 17, hills: 64, forest: 15 });
      for (const type of Object.values(result.terrain)) {
        expect(VALID_TERRAIN_IDS.has(type)).toBe(true);
      }
    });

    // T-rivers — exact river set once (#1099): insertion order from moisture-sorted
    // sources, each river flowing downhill to a water-frame mouth ("3,9" / water mouth
    // included). Membership in terrain's own keys is the consumer key contract — key
    // format bytes are owned by hexMapUtils.test.js T1 (#1170), so no regex here.
    // One adjacency tripwire proves chains, not scattered dots; neighbor bytes owned
    // by hexMapUtils.test.js T5.
    it('generateHexTerrain({gridSize:10,seed:42}) emits the exact river set as connected terrain-key chains', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(result.rivers).toEqual(FLAG_RIVERS);
      for (const riverHex of result.rivers) {
        expect(FLAG_TERRAIN).toHaveProperty(riverHex);
      }
      const riverSet = new Set(result.rivers);
      const adjacencyFound = result.rivers.some((k) => {
        const [q, r] = k.split(',').map(Number);
        return hexNeighbors(q, r).some((n) => riverSet.has(`${n.q},${n.r}`));
      });
      expect(adjacencyFound).toBe(true);
    });

    // T-seeds — seed sensitivity as distinct golden bytes; each golden re-run is the
    // determinism pin (#1160 bans self-compares, #1057 re-arm). s7's river chain runs
    // off the lone ridge to the left water frame; s123 honestly produces zero rivers.
    it.each([
      [
        7,
        ['WWWWWWWWWW', 'WbbbbbbbbW', 'WbfMfhffbW', 'WbbbbbbbbW', 'WWWWWWWWWW'],
        ['3,2', '3,1', '3,0', '2,2', '1,2', '0,2', '2,1', '4,2', '4,1', '8,2', '7,3', '7,4'],
      ],
      [123, ['WWWWWWWWWW', 'WbbbbbbbbW', 'Wbhhhh.dWW', 'WbbbbbbbbW', 'WWWWWWWWWW'], []],
    ])('generateHexTerrain({gridSize:5,seed:%i}) pins distinct grid and river bytes', (seed, rows, rivers) => {
      const result = generateHexTerrain({ gridSize: 5, seed });
      expect(result.terrain).toEqual(expandGrid(rows));
      expect(result.rivers).toEqual(rivers);
    });

    // T-min — degenerate honest grids (#945): every hex is an edge, so the water
    // frame covers the whole map and no river can form, for any seed.
    it.each([
      [1, { '0,0': 'water', '1,0': 'water' }],
      [
        2,
        {
          '0,0': 'water', '1,0': 'water', '2,0': 'water', '3,0': 'water',
          '0,1': 'water', '1,1': 'water', '2,1': 'water', '3,1': 'water',
        },
      ],
    ])('generateHexTerrain({gridSize:%i}) is an all-water map with no rivers', (gridSize, terrain) => {
      expect(generateHexTerrain({ gridSize, seed: 42 })).toEqual({ terrain, rivers: [] });
    });

    // T-inval — coercion honesty (#959): only positive integers generate; 3.5 and
    // '5' prove the Number.isInteger guard (not a range clamp) rejects them.
    it.each([0, -1, -100, 3.5, '5', NaN, Infinity])(
      'generateHexTerrain({gridSize:%s}) returns the empty map', (gridSize) => {
        expect(generateHexTerrain({ gridSize })).toEqual({ terrain: {}, rivers: [] });
      }
    );

    // T-entropy — unseeded calls fall back to Math.random, so two runs differ.
    // Proves the fallback exists; not a clock.
    // WATCH#5 stabilization (fixcheck40 collision, probabilistic-by-construction):
    // free draws are NOT high-cardinality — at gridSize 4 the 32-hex map quantizes
    // through beach + lake reflood to an {water,beach} alphabet with only ~1811
    // distinct outputs across the 100000-seed space (top pattern 16.5%), so the
    // true inter-draw collision rate is ~3.2% (sum p_i^2), not ~1/100000 as first
    // estimated. Fix keeps the lane's guard INTACT — both calls stay unseeded, so
    // the Math.random fallback (hexTerrainGenerator.js:14) is still the code under
    // test — but stubs Math.random with two DISTINCT empirical constants, one per
    // draw (the fallback consumes exactly one call), making the seeds 11111 and
    // 22222 byte-pinned-proven-different (differ at 5 hexes: 2,1 / 3,1 / 5,1 /
    // 6,1 / 2,2 beach-vs-water). Zero variance by construction; test kept, not
    // deleted, because no other lane exercises the unseeded entropy path.
    it('two unseeded generateHexTerrain calls produce different maps', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      try {
        randomSpy.mockReturnValue(0.11111); // -> effectiveSeed 11111
        const r1 = generateHexTerrain({ gridSize: 4 });
        randomSpy.mockReset();
        randomSpy.mockReturnValue(0.22222); // -> effectiveSeed 22222
        const r2 = generateHexTerrain({ gridSize: 4 });
        expect(r1.terrain).not.toEqual(r2.terrain);
        // Byte-pin of the proven-difference (row-major interior, beach=B else W):
        expect(r1.terrain['2,1']).toBe('beach');
        expect(r2.terrain['2,1']).toBe('water');
      } finally {
        randomSpy.mockRestore();
      }
    });

    // T-weights — weights rewrite the map at byte level after the base map is
    // complete: {hills:0.5} shrinks hills 64->57 via neighbor replacement (w<1
    // leg), {water:1.5} spreads water onto adjacent hexes 56->77 (w>1 leg) (#1035).
    // Weights run after river tracing, so the river bytes stay identical to T1.
    it('weights {hills:0.5,water:1.5} rewrite the seed-42 map bytes but leave rivers untouched', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42, weights: { hills: 0.5, water: 1.5 } });
      const weightedRows = [
        'WWWWWWWWWWWWWWWWWWWW',
        'WWbbbbWWWbbbbbWbbbWW',
        'WWMMMMMhhbhhbWhhhhbW',
        'WbfffffhhhMhhWhhhhbW',
        'WbMffffhMMMMMMMMfhWW',
        'WbMMMhfhhhhhhhhMhhbW',
        'WWfffhhhhhhhhhhhhbWW',
        'WbfhhhhhhhhhhhhhhhWW',
        'WbbbbbbbbWWWbbWWWWWW',
        'WWWWWWWWWWWWWWWWWWWW',
      ];
      expect(result.terrain).toEqual(expandGrid(weightedRows));
      expect(censusOf(weightedRows)).toEqual({ water: 77, beach: 32, mountains: 19, hills: 57, forest: 15 });
      expect(result.rivers).toEqual(FLAG_RIVERS);
    });

    // T-coerce — invalid weights shapes are skipped byte-for-byte, not defaulted.
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty object', {}],
      ['array', []],
      ['string', 'plains'],
      ['number', 0],
    ])('weights %s leaves the seed-42 map bytes identical to the unweighted flagship', (_label, weights) => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42, weights });
      expect(result.terrain).toEqual(FLAG_TERRAIN);
    });
  });

  describe('generateRiversFromTerrain', () => {
    // T-downhill — exact traced bytes on a handcrafted grid: the mountains source
    // ('2,1', elev 0.82) flows through plains (0.50) — the unique lowest neighbor,
    // ringed by forest (0.65: above the 0.6 elevation bar but NOT a source type on
    // the moisture-null path) — and terminates by pushing the water mouth ('0,1').
    // 'volcano' shows the unknown-id elevation coercion to 0.5, never a source (#959).
    // Path length 3 clears the <3 rejection filter exactly at the seam.
    it('generateRiversFromTerrain traces the exact downhill chain mountains->plains->water', () => {
      const terrain = expandGrid([
        'ppffpv',
        'W.Mfpp',
        'pffppp',
      ]);
      terrain['5,0'] = 'volcano'; // unknown id, coerced to elev 0.5
      const rivers = generateRiversFromTerrain(terrain, 3);
      expect(rivers).toEqual(['2,1', '1,1', '0,1']);
    });

    // T-rivers-zero — honest zeros: falsy terrain/gridSize hit the guard, a valid
    // map with no mountains/hills/tundra sources (all plains = 0.50 <= 0.6) or an
    // empty map (all ids coerce to 0.50) trace nothing.
    it.each([
      ['null terrain', null, 3],
      ['undefined terrain', undefined, 3],
      ['falsy gridSize 0', { '0,0': 'mountains' }, 0],
      ['negative gridSize', { '0,0': 'mountains' }, -1],
      ['plains-only map', expandGrid(['.....', '.....', '.....', '.....']), 2],
      ['empty terrain', {}, 5],
    ])('generateRiversFromTerrain returns [] for %s', (_label, terrain, gridSize) => {
      expect(generateRiversFromTerrain(terrain, gridSize)).toEqual([]);
    });
  });
});
