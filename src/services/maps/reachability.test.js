// @maintained-by-ai
// Lane: editor-movement flood/BFS (SOLE OWNER — verified by consumer census).
// Maps-family cite table:
//   effectiveWalls.test.js #1169 ..... wall derivation internals — consumed THROUGH
//                                      the computeMovementObstacles wrapper here, never re-driven
//   lineOfSight.test.js #1172 ........ ray/shadow bytes — cited, not re-driven
//   hexMapUtils.test.js #1170 ........ hex math — cited, not re-driven
//   generators #1167/#1168 ........... generated maps — cited; no fixed-seed tripwire needed
//                                      (no generator input consulted: hand-built grids only)
//   usePlayerDragging.test.js ........ drag UX through the wrapper (invalid flag, Shift bypass)
//   teleportService.test.js .......... delegates BFS d1 tie bytes here (pinned: +x-first)
//   useFogOfWar.test.js .............. cites here for closed-door derivation internals
// Pins: full-output exact-set goldens (#1160 — set goldens subsume has()/size() sprawl),
// asymmetric blockers so axis-flip fails (#1022), open-vs-closed door falsifier,
// terrain byte-swap falsifier via coerce table (#1036), degenerate honesty (#945),
// coercion honesty (#959). Pure functions: zero mocks (#1137). No timers, no afterEach.
// Old->new map: closedDoors empty+null -> T2, closed/open/non-door -> T1;
// obstacles walls/hidden/discovered/doors/combine -> T3; reachable flood-all/
// start-incl/not-escape/stop-at-walls/door-block -> T4+T5, clamp -> T5,
// blocked-start+invalid-grid -> T6; nearest start/nearest/beyond-invalid/clamp -> T7,
// no-valid+invalid-grid -> T8.
import { describe, it, expect } from 'vitest';
import {
    computeClosedDoors,
    computeMovementObstacles,
    computeReachable,
    findNearestValid,
} from './reachability.js';

describe('computeClosedDoors', () => {
    it('collects exactly the closed-door cells from mixed items (open, secretDoor, furniture ignored)', () => {
        // All coords distinguishable so an x/y swap in the key recipe fails.
        const doors = computeClosedDoors([
            { type: 'door', open: false, gridX: 1, gridY: 4 },
            { type: 'door', open: true, gridX: 2, gridY: 2 },   // open passes
            { type: 'secretDoor', open: false, gridX: 3, gridY: 1 }, // not a door
            { type: 'table', open: false, gridX: 4, gridY: 0 },  // ignored
        ]);
        expect(doors).toEqual(new Set(['1,4']));
    });

    it('returns an empty set for nullish or empty item lists', () => {
        expect(computeClosedDoors(null)).toEqual(new Set());
        expect(computeClosedDoors(undefined)).toEqual(new Set());
        expect(computeClosedDoors([])).toEqual(new Set());
    });
});

describe('computeMovementObstacles', () => {
    // Wall-derivation internals are owned by effectiveWalls.test.js (#1169);
    // these verify the consumer contract THROUGH the wrapper only.
    it('derives the exact obstacle set through the wrapper: painted wall, hidden secret, closed door block; discovered secret OPENING its base wall, and open door pass', () => {
        const obstacles = computeMovementObstacles(new Set(['1,1', '3,2']), [
            { type: 'secretDoor', gridX: 4, gridY: 0, visible: false }, // hidden -> obstacle
            { type: 'secretDoor', gridX: 3, gridY: 2, visible: true },   // discovered -> removes base wall '3,2' (#1169)
            { type: 'door', gridX: 2, gridY: 5, open: false },           // closed -> obstacle
            { type: 'door', gridX: 5, gridY: 2, open: true },            // open -> passes
        ]);
        expect(obstacles).toEqual(new Set(['1,1', '4,0', '2,5']));
    });

    it('returns an empty set for nullish inputs', () => {
        expect(computeMovementObstacles(null, null)).toEqual(new Set());
        expect(computeMovementObstacles(undefined, undefined)).toEqual(new Set());
    });
});

describe('computeReachable', () => {
    const GRID = 5;
    // 5x5 room split by a full wall along y=2 with a single door at (2,2).
    const walls = new Set(['0,2', '1,2', '3,2', '4,2']);
    const closedDoor = [{ type: 'door', gridX: 2, gridY: 2, open: false }];
    const openDoor = [{ type: 'door', gridX: 2, gridY: 2, open: true }];
    const topRows = new Set([0, 1].flatMap((y) => [0, 1, 2, 3, 4].map((x) => `${x},${y}`)));

    it.each([
        // Closed door partitions the room: exact top-half set, never leaks past the wall (#1017).
        ['closed', closedDoor, topRows],
        // Open door floods the whole map and stays in-bounds — exact 21-cell set
        // subsumes flood-all, start-inclusion and edge-containment goldens.
        ['open', openDoor, new Set(
            [0, 1, 2, 3, 4].flatMap((y) => [0, 1, 2, 3, 4].map((x) => `${x},${y}`))
                .filter((k) => !walls.has(k))
        )],
    ])('floods from (1,1) through the %s door chokepoint to the exact reachable set', (_mode, doorItems, expected) => {
        const obstacles = computeMovementObstacles(walls, doorItems);
        expect(computeReachable(1, 1, obstacles, GRID)).toEqual(expected);
    });

    it('clamps an out-of-bounds start and floods an asymmetric column wall (axis-flip falsifier)', () => {
        // Vertical wall column x=3 with a gap at y=4; start (-2,7) must clamp
        // to (0,4) and slip under the gap. Transposed keys yield a different set.
        const obstacles = new Set(['3,0', '3,1', '3,2', '3,3']);
        const expected = new Set(
            [0, 1, 2, 3, 4].flatMap((y) => [0, 1, 2, 3, 4].map((x) => `${x},${y}`))
                .filter((k) => !obstacles.has(k))
        );
        expect(computeReachable(-2, 7, obstacles, GRID)).toEqual(expected);
    });

    it('pins a blocked start to exactly that cell and returns empty for degenerate grids', () => {
        expect(computeReachable(2, 2, new Set(['2,2']), GRID)).toEqual(new Set(['2,2']));
        // Blocked via the wrapper too: standing on a closed door stays pinned.
        const obstacles = computeMovementObstacles(new Set(), closedDoor);
        expect(computeReachable(2, 2, obstacles, GRID)).toEqual(new Set(['2,2']));
        expect(computeReachable(1, 1, new Set(), 0)).toEqual(new Set());
        expect(computeReachable(1, 1, new Set(), null)).toEqual(new Set());
    });
});

describe('findNearestValid', () => {
    const GRID = 5;
    const validAt = (...cells) => (x, y) => cells.includes(`${x},${y}`);

    it.each([
        ['start itself is valid', 2, 2, ['2,2', '0,0'], { x: 2, y: 2 }],
        // d1 beats d2; among d1 ties +x goes first — the tie bytes teleportService delegates here.
        ['nearest wins, +x neighbor wins the d1 tie', 2, 2, ['3,2', '1,2', '2,0'], { x: 3, y: 2 }],
        ['d2 tie resolves +x-branch-first, not y-first', 2, 2, ['3,1', '1,3'], { x: 3, y: 1 }],
        ['clamps an out-of-bounds start before searching', -2, 9, ['1,4'], { x: 1, y: 4 }],
    ])('%s', (_case, sx, sy, cells, expected) => {
        expect(findNearestValid(sx, sy, validAt(...cells), GRID)).toEqual(expected);
    });

    it('returns null when nothing is valid or the grid is degenerate', () => {
        expect(findNearestValid(0, 0, () => false, GRID)).toBeNull();
        expect(findNearestValid(1, 1, () => true, 0)).toBeNull();
        expect(findNearestValid(1, 1, () => true, null)).toBeNull();
    });
});
