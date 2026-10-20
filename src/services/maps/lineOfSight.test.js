// @maintained-by-ai
// Lane: LOS ray + visibility scan (SOLE OWNER of bresenham cell sequences and
// computeVisibility blocked/clear outcomes — verified by consumer census).
// Consumers cite here, never re-drive ray math:
//   combat/lineOfSightGate.test.js:16 ..... gate lane cites "bresenham + computeVisibility cells".
//   useFogOfWar.test.js:13 ................ mocks this module; ray math cited back here.
//   combat/coverService.js, spellOverlayService.js, rules/combat/coverService.js — integration
//   bytes through bresenham stay in their own lanes (#1013 cover, #1169 wall derivation).
//   maps/reachability .... editor movement; maps/effectiveWalls #1169 .... wall derivation.
// Discipline: byte-exact Set goldens per scenario (#903/#1160 strengthened from boolean-only
// pins — goldens computed row-major from the source, incl. honest bresenham graze shadows);
// distinguishable minimal grids (#1022 — blockers offset so axis-flip fails visibly);
// walls-vs-closedDoors arg falsifier via identical goldens (#967); endpoint-vs-interior
// blocking semantics; degenerate honest (#945); multi-player union with a strict-subset
// shadow so the golden is not replicable by either player alone. Pure functions, zero mocks (#1137).
// Old->new map: 8 bresenham its -> T1 (it.each, incl. symmetry via exact reverse bytes);
// own-cell+unblocked+edge+size1+large-grid -> T2 rows; wall-blocks+door-blocks+identical+
// diagonal-blocks+off-ray+around-wall+endpoint+multi-wall-stack+see-through-walls+
// corridor -> T3 (it.each goldens); aggregation+duplicates -> T4; instanceof Set -> purged
// (vacuous, goldens prove shape); reverse-symmetry toReversed compare -> folded into T1.
import { describe, it, expect } from 'vitest';
import { bresenham, computeVisibility } from './lineOfSight.js';

const ALL25 = new Set([
  '0,0', '0,1', '0,2', '0,3', '0,4',
  '1,0', '1,1', '1,2', '1,3', '1,4',
  '2,0', '2,1', '2,2', '2,3', '2,4',
  '3,0', '3,1', '3,2', '3,3', '3,4',
  '4,0', '4,1', '4,2', '4,3', '4,4',
]);

describe('bresenham', () => {
  it.each([
    { name: 'degenerate same cell', from: [3, 3], to: [3, 3], expected: [{ x: 3, y: 3 }] },
    {
      name: 'horizontal', from: [0, 0], to: [4, 0],
      expected: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      name: 'vertical', from: [0, 0], to: [0, 4],
      expected: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }],
    },
    {
      name: 'exact diagonal advances both axes', from: [0, 0], to: [4, 4],
      expected: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }],
    },
    {
      name: 'shallow slope steps x, occasionally y', from: [0, 0], to: [3, 1],
      expected: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
    },
    {
      name: 'steep slope steps y, occasionally x', from: [0, 0], to: [1, 3],
      expected: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
    },
    {
      name: 'reversed steep slope is exact reverse bytes (direction symmetry)', from: [1, 3], to: [0, 0],
      expected: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
    },
    {
      name: 'negative coordinates', from: [-2, -1], to: [1, 2],
      expected: [{ x: -2, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }],
    },
  ])('$name', ({ from, to, expected }) => {
    expect(bresenham(from[0], from[1], to[0], to[1])).toEqual(expected);
  });
});

describe('computeVisibility', () => {
  it('returns an empty Set with no players', () => {
    expect(computeVisibility([], new Set(), new Set(), 5)).toEqual(new Set());
  });

  // Byte-exact goldens (row-major). Grazing cells inside shadow edges are the
  // pinned coarse-bresenham behavior consumers (fog, gate, cover) depend on.
  it.each([
    {
      name: 'unblocked corner player sees whole grid incl. own cell and diagonals',
      players: [{ gridX: 0, gridY: 0 }], walls: new Set(), doors: new Set(), grid: 3,
      expected: new Set(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2']),
    },
    {
      name: 'grid of size 1 yields only the own cell',
      players: [{ gridX: 0, gridY: 0 }], walls: new Set(), doors: new Set(), grid: 1,
      expected: new Set(['0,0']),
    },
    {
      name: 'player outside the grid still contributes own cell and scans in-grid targets',
      players: [{ gridX: 10, gridY: 10 }], walls: new Set(), doors: new Set(), grid: 2,
      expected: new Set(['0,0', '0,1', '1,0', '1,1', '10,10']),
    },
    {
      name: 'wall mid-ray blocks its colinear AND grazing shadow (interior-only)',
      players: [{ gridX: 0, gridY: 2 }], walls: new Set(['2,2']), doors: new Set(), grid: 5,
      expected: new Set([
        '0,0', '0,1', '0,2', '0,3', '0,4',
        '1,0', '1,1', '1,2', '1,3', '1,4',
        '2,0', '2,1', '2,2', '2,3', '2,4',
        '3,0', '3,1', '3,3', '3,4',
        '4,0', '4,4',
      ]), // shadow: 3,2 / 4,1 / 4,2 / 4,3 — 4,1 and 4,3 graze (2,2) and go with it
    },
    {
      name: 'closed door mid-ray blocks exactly like a wall (arg falsifier)',
      players: [{ gridX: 0, gridY: 2 }], walls: new Set(), doors: new Set(['2,2']), grid: 5,
      expected: new Set([
        '0,0', '0,1', '0,2', '0,3', '0,4',
        '1,0', '1,1', '1,2', '1,3', '1,4',
        '2,0', '2,1', '2,2', '2,3', '2,4',
        '3,0', '3,1', '3,3', '3,4',
        '4,0', '4,4',
      ]),
    },
    {
      name: 'wall on diagonal casts wide diagonal shadow, horizontal stays clear',
      players: [{ gridX: 0, gridY: 0 }], walls: new Set(['1,1']), doors: new Set(), grid: 5,
      expected: new Set([
        '0,0', '0,1', '0,2', '0,3', '0,4',
        '1,0', '1,1', '1,2', '1,3', '1,4',
        '2,0', '2,1', '2,4',
        '3,0', '3,1',
        '4,0', '4,1', '4,2',
      ]), // blocks 2,2 2,3 3,2 3,3 3,4 4,3 4,4 — subsumes the old 2,2/3,3/4,4 boolean pins
    },
    {
      name: 'wall directly ahead blocks the column behind it, flanks stay visible',
      players: [{ gridX: 2, gridY: 0 }], walls: new Set(['2,1']), doors: new Set(), grid: 5,
      expected: new Set([
        '0,0', '0,1', '0,2', '0,3',
        '1,0', '1,1',
        '2,0', '2,1',
        '3,0', '3,1',
        '4,0', '4,1', '4,2', '4,3',
      ]),
    },
    {
      name: 'wall off every ray blocks nothing at all',
      players: [{ gridX: 1, gridY: 2 }], walls: new Set(['3,0']), doors: new Set(), grid: 5,
      expected: ALL25,
    },
    {
      name: 'wall on the target endpoint never blocks (interior-only rule)',
      players: [{ gridX: 0, gridY: 2 }], walls: new Set(['4,2']), doors: new Set(), grid: 5,
      expected: ALL25,
    },
  ])('$name', ({ players, walls, doors, grid, expected }) => {
    expect(computeVisibility(players, walls, doors, grid)).toEqual(expected);
  });

  it('unions per-player vision (strict-subset shadow) and tolerates duplicate positions', () => {
    // A(0,1) alone loses 3,2 3,3 4,3 4,4; B(1,2) alone loses 3,1 3,2 3,3 4,1 4,2 4,3.
    // Together only the shared shadow 3,2 3,3 4,3 stays dark: 4,4 is recovered by B
    // and 3,1 4,1 4,2 by A. Golden cannot be reproduced by either player alone, so
    // any single-player (or ignore-walls) regression fails it. Duplicated A must not
    // change the result.
    const A = { gridX: 0, gridY: 1 };
    const B = { gridX: 1, gridY: 2 };
    const walls = new Set(['2,2']);
    expect(computeVisibility([A, A, B], walls, new Set(), 5)).toEqual(new Set([
      '0,0', '0,1', '0,2', '0,3', '0,4',
      '1,0', '1,1', '1,2', '1,3', '1,4',
      '2,0', '2,1', '2,2', '2,3', '2,4',
      '3,0', '3,1', '3,4',
      '4,0', '4,1', '4,2', '4,4',
    ]));
  });
});
