// @maintained-by-ai
// Lane: pure hex math/layout for pointy-top axial grids (SOLE OWNER — verified by consumer census).
// Production consumers cite here for hex arithmetic and keep their own integration bytes:
//   hexTerrainGenerator.js ................. getAllHexes/hexKey/hexNeighbors consumption
//   travelService.js ....................... hexKey/hexDistance/hexNeighbors consumption
//   HexMap/TerrainLayer/HexGridLayer/PartyMarkerLayer ... render hexToPixel/hexToSVGPath bytes
//   RiverLayer/RoadLayer .test.jsx ....... pin descriptor pass-through; use this file as the
//                                          oracle for converted path bytes ("internals owned here")
//   useHexHover.test.js .................. mocks pixelToHexSnapped; snap behavior owned here
//   usePoiManagement.test.js ............. findHexPath/isRoadConnectable integration only
// Pinned: key bytes + inverse, pixel<->axial goldens (0-is-data, signed coords), cube-rounding
// incl. both correction branches, exact ordered neighbor sets, distance table, golden hexagon
// corners/path bytes, grid enumeration + dimensions, odd-r offset centers, winding-hash goldens
// (asymmetric, linear, default 5), road-connectable truth table, A* goldens (open run, cheapest
// lane around water with unknown-id ?? 2 coercion, out-of-bounds null), orderHexPath walk +
// edge shapes, descriptor bytes (multi full string / single-hex degenerate / wind0 collinearity).
// Old->new map: hexKey+parse+roundtrip -> T1; hexToPixel trio -> T2; pixelToHex pair -> T3;
// hexRound pair (vacuous self-compare cube test purged) -> T4; neighbors pair -> T5; distance
// trio (self-compare symmetry purged, folded into byte rows) -> T6; cornerOffset+corners -> T7;
// svgPath -> T8; getAllHexes pair -> T9; dims pair -> T10; offsetCenter -> T11; windingOffset
// trio -> T12; isRoadConnectable pair -> T13; findHexPath quad -> T14+T15; orderHexPath quad ->
// T16+T17; buildWindingPathDescriptor sextet -> T18-T21.
import { describe, it, expect } from 'vitest';
import {
  hexKey,
  parseHexKey,
  hexToPixel,
  pixelToHex,
  hexRound,
  pixelToHexSnapped,
  hexNeighbors,
  hexDistance,
  hexCornerOffset,
  hexCorners,
  hexToSVGPath,
  getAllHexes,
  getHexGridPixelDimensions,
  getHexCenterFromOffset,
  windingOffset,
  isRoadConnectable,
  findHexPath,
  orderHexPath,
  buildWindingPathDescriptor,
} from './hexMapUtils.js';

describe('hexMapUtils', () => {
  // T1 — key format bytes, parsed back exactly (0 is data).
  it.each([
    ['0,0', 0, 0],
    ['-1,-2', -1, -2],
    ['999,-42', 999, -42],
  ])('hexKey/parseHexKey roundtrip on "%s" <-> (%i,%i)', (key, q, r) => {
    expect(hexKey(q, r)).toBe(key);
    expect(parseHexKey(key)).toEqual({ q, r });
  });

  // T2 — pointy-top axial->pixel bytes. (q,r) chosen so an axis swap or a
  // missing r/2 shear term changes every non-origin byte.
  it.each([
    [0, 0, 30, 0, 0],
    [1, 0, 30, 51.96152422706631, 0],
    [0, 1, 30, 25.980762113533157, 45],
    [-2, 3, 20, -17.32050807568877, 90],
  ])('hexToPixel(%i,%i,size %i) lands on golden center', (q, r, size, x, y) => {
    const p = hexToPixel(q, r, size);
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(y, 9);
  });

  // T3 — pixel->axial inverse of T2 plus honest fractional coercion:
  // a point off-center stays fractional until pixelToHexSnapped rounds it.
  it.each([
    [0, 0, 30, { q: 0, r: 0 }, { q: 0, r: 0 }],
    [51.96152422706631, 0, 30, { q: 1, r: 0 }, { q: 1, r: 0 }],
    [25.980762113533157, 45, 30, { q: 0, r: 1 }, { q: 0, r: 1 }],
    [70, 50, 30, { q: 0.7915950725535715, r: 1.111111111111111 }, { q: 1, r: 1 }],
  ])('pixelToHex(%s,%s) inverts to %j and pixelToHexSnapped to %j', (x, y, size, frac, snapped) => {
    const f = pixelToHex(x, y, size);
    expect(f.q).toBeCloseTo(frac.q, 9);
    expect(f.r).toBeCloseTo(frac.r, 9);
    expect(pixelToHexSnapped(x, y, size)).toEqual(snapped);
  });

  // T4 — cube-rounding bytes: q-leg correction, r-leg correction,
  // rounding ties, and integer passthrough. Replaces the old vacuous
  // "constraint" test that self-compared s = -q-r tautologically.
  it.each([
    [0.33, 0.33, { q: 0, r: 0 }],
    [0.6, 0.3, { q: 1, r: 0 }], // q residual largest -> rq recomputed from s
    [-1.6, 0.3, { q: -1, r: 0 }], // signed q correction
    [0.3, -1.6, { q: 0, r: -1 }], // r residual largest -> rr recomputed from s
    [1.9, -0.6, { q: 2, r: -1 }], // both corrected legs nonzero
    [2, -3, { q: 2, r: -3 }], // integers pass through untouched
  ])('hexRound(%s,%s) resolves to %j', (q, r, expected) => {
    expect(hexRound(q, r)).toEqual(expected);
  });

  // T5 — neighbor ring exact ordered set (same 6 offsets shifted by origin).
  it.each([
    [0, 0, [
      { q: 1, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 1 }, { q: 0, r: -1 },
      { q: 1, r: -1 }, { q: -1, r: 1 },
    ]],
    [3, 5, [
      { q: 4, r: 5 }, { q: 2, r: 5 },
      { q: 3, r: 6 }, { q: 3, r: 4 },
      { q: 4, r: 4 }, { q: 2, r: 6 },
    ]],
  ])('hexNeighbors(%i,%i) returns the exact six', (q, r, expected) => {
    expect(hexNeighbors(q, r)).toEqual(expected);
  });

  // T6 — hex step distance bytes (order-distinct pair replaces old
  // self-comparing symmetry test).
  it.each([
    [{ q: 0, r: 0 }, { q: 0, r: 0 }, 0],
    [{ q: 0, r: 0 }, { q: 1, r: 0 }, 1],
    [{ q: 0, r: 0 }, { q: 1, r: -1 }, 1],
    [{ q: 0, r: 0 }, { q: 3, r: -2 }, 3],
    [{ q: 0, r: 0 }, { q: 5, r: 3 }, 8], // s-term dominates
    [{ q: 2, r: -1 }, { q: -3, r: 4 }, 5],
  ])('hexDistance(%j,%j) is %s steps', (a, b, d) => {
    expect(hexDistance(a, b)).toBe(d);
  });

  // T7 — golden hexagon: corner bytes at a shifted center pin both
  // hexCorners' centering and hexCornerOffset's angle recipe.
  it('hexCorners(50,50,10) traces the golden hexagon bytes', () => {
    expect(hexCorners(50, 50, 10)).toEqual([
      { x: 58.66025403784439, y: 45 },
      { x: 58.66025403784439, y: 55 },
      { x: 50, y: 60 },
      { x: 41.33974596215561, y: 55 },
      { x: 41.33974596215562, y: 45 },
      { x: 50, y: 40 },
    ]);
    // Corner 0 starts at -30deg (pointy-top, upper right); corner 5 at -90deg (bottom).
    expect(hexCornerOffset(0, 10)).toMatchObject({ x: expect.closeTo(8.660254, 6) });
    expect(hexCornerOffset(0, 10).y).toBeCloseTo(-5, 6);
    expect(hexCornerOffset(5, 10).x).toBeCloseTo(0, 6);
    expect(hexCornerOffset(5, 10).y).toBeCloseTo(-10, 6);
  });

  // T8 — SVG path bytes for the consumer <path d> contract.
  it('hexToSVGPath(50,50,10) emits the closed 1M+5L+Z byte string', () => {
    expect(hexToSVGPath(50, 50, 10)).toBe(
      'M58.66025403784439,45 L58.66025403784439,55 L50,60 L41.33974596215561,55 L41.33974596215562,45 L50,40 Z'
    );
  });

  // T9 — grid enumeration: full row-major output (non-square kills axis
  // confusion); zero dims honestly yield [].
  it.each([
    [2, 3, [
      { q: 0, r: 0 }, { q: 1, r: 0 },
      { q: 0, r: 1 }, { q: 1, r: 1 },
      { q: 0, r: 2 }, { q: 1, r: 2 },
    ]],
    [0, 5, []],
    [3, 0, []],
  ])('getAllHexes(%i,%i) enumerates row-major', (width, height, expected) => {
    expect(getAllHexes(width, height)).toEqual(expected);
  });

  // T10 — viewBox dimensions bytes (non-square grids pin the two formulas).
  it.each([
    [2, 3, 10, {
      width: 51.961524227066306, height: 50,
      offsetX: -8.660254037844386, offsetY: -10,
      centerX: 17.32050807568877, centerY: 15,
    }],
    [4, 2, 30, {
      width: 233.8268590217984, height: 105,
      offsetX: -25.980762113533157, offsetY: -30,
      centerX: 90.93266739736605, centerY: 22.5,
    }],
  ])('getHexGridPixelDimensions(%i,%i,size %i) matches golden box', (w, h, size, expected) => {
    expect(getHexGridPixelDimensions(w, h, size)).toEqual(expected);
  });

  // T11 — odd-row offset->pixel centers: even row on the grid line,
  // odd rows shifted half a column right, rows 1.5*size apart.
  it.each([
    [1, 0, 30, 51.96152422706631, 0],
    [0, 1, 30, 25.980762113533157, 45],
    [3, 2, 30, 155.88457268119893, 90],
  ])('getHexCenterFromOffset(col %i,row %i,size %i) lands on golden center', (col, row, size, x, y) => {
    const c = getHexCenterFromOffset(col, row, size);
    expect(c.x).toBeCloseTo(x, 9);
    expect(c.y).toBeCloseTo(y, 9);
  });

  // T12 — winding hash goldens: deterministic bytes, default maxOffset=5
  // is exactly half of the 10-max bytes (linearity), and the hash is
  // asymmetric under pair reversal (consistent direction per edge).
  it('windingOffset pins golden bytes, default 5, and asymmetric pair hashing', () => {
    expect(windingOffset(1, 2, 3, 4, 10)).toBe(-2.7154220039801658);
    expect(windingOffset(1, 2, 3, 4)).toBe(-1.3577110019900829);
    expect(windingOffset(0, 0, 1, 0, 10)).toBe(-0.6811606097471667);
    expect(windingOffset(1, 0, 0, 0, 10)).toBe(-3.487771458894713);
  });

  // T13 — road-connectable truth table (only city/settlement pair up).
  it.each([
    ['city', 'city', true],
    ['city', 'settlement', true],
    ['settlement', 'settlement', true],
    ['forest', 'city', false],
    ['', 'city', false],
    [undefined, 'city', false],
  ])('isRoadConnectable(%s,%s) is %s', (a, b, expected) => {
    expect(isRoadConnectable(a, b)).toBe(expected);
  });

  // T14 — A* honest shapes: same-hex degenerate, straight open run,
  // out-of-bounds end returns null.
  it.each([
    ['start equals end', { q: 3, r: 3 }, { q: 3, r: 3 }, 10, 10, {}, [{ q: 3, r: 3 }]],
    [
      'straight run on open ground', { q: 0, r: 0 }, { q: 3, r: 0 }, 10, 10, {},
      [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    ],
    ['end out of bounds', { q: 0, r: 0 }, { q: 5, r: 5 }, 3, 3, {}, null],
  ])('findHexPath: %s', (_label, start, end, cols, rows, terrain, expected) => {
    expect(findHexPath(start, end, cols, rows, terrain)).toEqual(expected);
  });

  // T15 — cost routing bytes: water blocks the direct row, the path takes
  // the cheapest lane (hills 1.5 beats swamp 2.5), and an unknown terrain
  // id ('volcano') coerces via ?? to cost 2 — cheap enough to stay on the
  // hills lane. Any cost-table or fallback change rewrites these bytes.
  it('findHexPath detours around water via the cheapest lane (unknown id coerces to cost 2)', () => {
    const terrain = {
      '1,0': 'water', '2,0': 'water',
      '0,1': 'volcano', '1,1': 'hills', '2,1': 'hills', '3,1': 'hills',
      '0,2': 'swamp', '1,2': 'swamp', '2,2': 'swamp', '3,2': 'swamp',
    };
    expect(findHexPath({ q: 0, r: 0 }, { q: 3, r: 0 }, 5, 5, terrain)).toEqual([
      { q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 0 },
    ]);
  });

  // T16 — orderHexPath walks a shuffled connected set from its first
  // inserted endpoint through every hex exactly once.
  it.each([
    [
      'L-shaped chain', [{ q: 1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 1 }],
      [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }],
    ],
    [
      'straight chain entered backwards', [{ q: 2, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }],
      [{ q: 2, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }],
    ],
  ])('orderHexPath orders %s from its first endpoint', (_label, input, expected) => {
    expect(orderHexPath(input)).toEqual(expected);
  });

  // T17 — orderHexPath edge shapes pass through untouched (length<=2
  // shortcut never re-sorts; a loop has no endpoints).
  it.each([
    ['empty', [], []],
    ['single hex', [{ q: 1, r: 1 }], [{ q: 1, r: 1 }]],
    ['unordered pair (not re-sorted)', [{ q: 1, r: 0 }, { q: 0, r: 0 }], [{ q: 1, r: 0 }, { q: 0, r: 0 }]],
    [
      'triangle loop (no endpoints)', [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
      [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
    ],
  ])('orderHexPath leaves %s as-is', (_label, input, expected) => {
    expect(orderHexPath(input)).toEqual(expected);
  });

  // T18 — descriptor is null, not throw, on falsy/empty input.
  it.each([
    ['null', null],
    ['empty array', []],
  ])('buildWindingPathDescriptor returns null for %s', (_label, input) => {
    expect(buildWindingPathDescriptor(input, 30, '#ff0000', 2)).toBeNull();
  });

  // T19 — multi-hex descriptor bytes: full path string (3 subdivisions per
  // segment + closing center, winding offsets included) and style passthrough.
  it('buildWindingPathDescriptor emits the full golden descriptor for a 3-hex run', () => {
    expect(buildWindingPathDescriptor([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }], 30, '#00ff00', 3)).toEqual({
      path: 'M0,-0.2724642438988667Q17.32050807568877,-0.2724642438988667 25.980762113533157,-0.2724642438988667Q34.64101615137754,-0.2724642438988667 43.301270189221924,-0.4363263861837219Q51.96152422706631,-0.6001885284685771 60.6217782649107,-0.6001885284685771Q69.28203230275508,-0.6001885284685771 77.94228634059947,-0.6001885284685771Q86.60254037844385,-0.6001885284685771 95.26279441628824,-0.30009426423428853Q86.60254037844385,-0.6001885284685771 103.92304845413263,0',
      fill: 'none',
      stroke: '#00ff00',
      strokeWidth: 3,
    });
  });

  // T20 — single-hex degenerate: no path to draw, rendered as a fill dot.
  it('buildWindingPathDescriptor turns a single hex into a filled dot descriptor', () => {
    expect(buildWindingPathDescriptor([{ q: 0, r: 0 }], 30, '#ff0000', 2)).toEqual({
      path: '', fill: '#ff0000', stroke: 'none', strokeWidth: 0,
    });
  });

  // T21 — windAmount behavior: 0 keeps every waypoint exactly on the
  // center line (all y bytes are 0 on this r=0 run), 10 meanders off it,
  // and the documented default is 4.
  it('buildWindingPathDescriptor windAmount 0 stays collinear, 10 meanders, default is 4', () => {
    const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const allY = (path) => path.split(',').slice(1).map((part) => parseFloat(part));
    const flat = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 0).path;
    expect(flat.startsWith('M')).toBe(true);
    expect(flat.match(/Q/g)).toHaveLength(6);
    expect(allY(flat).every((y) => y === 0)).toBe(true);
    const windy = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 10).path;
    expect(allY(windy).some((y) => y !== 0)).toBe(true);
    expect(buildWindingPathDescriptor(hexes, 30, '#ff0000', 2).path)
      .toBe(buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 4).path);
  });
});
