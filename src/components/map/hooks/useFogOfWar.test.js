// @maintained-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useFogOfWar from './useFogOfWar.js';

// useFogOfWar canonical fog-math lane: the hook's OWN contract.
// Owns (exact Set literals, authored once):
//   - gridSize / players guards -> empty or full-fog census, LOS never runs
//   - fog = every grid cell - (revealed union visible) — explored stays open
//   - wiring: derived effective walls + closed doors fed to computeVisibility
//   - live updates: player move re-fogs old cell / clears new; revealed grows
// Not owned (owner cited — do not duplicate here):
//   - line-of-sight ray math, radius census ...... services/maps/lineOfSight.test.js
//   - secret-door wall derivation internals ........ services/maps/effectiveWalls.test.js
//   - closed-door derivation internals ............ services/maps/reachability.test.js
//   - fog rect rendering ............................ FogOverlay.test.jsx (#901)
//   - items hidden under fog ...................... PlacedItems-fog.test.jsx
//   - mounted fog role bytes / revealed persistence Map.jsx:227 + Map.test.jsx
// Hex-map fog family (#790-#827) is a different geometry — not this lane.
// Mock hygiene: ONLY computeVisibility is mocked (pure, owned+tested elsewhere);
// computeEffectiveWalls/computeClosedDoors run real. Memo identity is NOT
// asserted (implementation detail, precedent #796/#797); updates proven via
// observable Set contents after rerender (#874).
// Old->new: shape test folded into fog census; no-players trio -> guard test;
// 2 fog-math tests -> 1 exact census; 5 spy-input tests -> 1 wiring test
// (it.each); 3 memo-identity tests -> 1 live-update test. 14 -> 5.

vi.mock('../../../services/maps/lineOfSight.js', () => ({
  computeVisibility: vi.fn(),
}));

import { computeVisibility } from '../../../services/maps/lineOfSight.js';

describe('useFogOfWar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [undefined, 'undefined'],
    [null, 'null'],
    [0, 'zero'],
    [-1, 'negative'],
  ])('invalid gridSize %s -> empty fog and visible, no line-of-sight computed', (_gridSize) => {
    const { result } = renderHook(() =>
      useFogOfWar([{ gridX: 1, gridY: 1 }], new Set(), [], _gridSize, [])
    );
    expect(result.current).toEqual({ fog: new Set(), visible: new Set() });
    expect(computeVisibility).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'null'],
    [[], 'empty array'],
  ])('no players (%s) -> full 3x3 fog census, empty visible, no line-of-sight computed', (players) => {
    const { result } = renderHook(() =>
      useFogOfWar(players, new Set(), [], 3, [])
    );
    expect(result.current.visible).toEqual(new Set());
    expect(result.current.fog).toEqual(new Set([
      '0,0', '0,1', '0,2',
      '1,0', '1,1', '1,2',
      '2,0', '2,1', '2,2',
    ]));
    expect(computeVisibility).not.toHaveBeenCalled();
  });

  it('fog is the exact grid minus revealed and visible; explored cells stay open off line-of-sight', () => {
    computeVisibility.mockReturnValue(new Set(['1,1', '2,1']));
    const players = [{ gridX: 1, gridY: 1 }];

    const { result } = renderHook(() =>
      useFogOfWar(players, new Set(), [], 3, ['0,2'])
    );

    // '1,1','2,1' open via line of sight; '0,2' open via persisted reveal.
    expect(result.current.visible).toEqual(new Set(['1,1', '2,1']));
    expect(result.current.fog).toEqual(new Set([
      '0,0', '0,1',
      '1,0', '1,2',
      '2,0', '2,2',
    ]));
  });

  it.each([
    {
      name: 'authored placements derive exact walls and closed doors',
      players: [{ gridX: 0, gridY: 3 }],
      walls: new Set(['0,0']),
      placedItems: [
        { type: 'door', open: false, gridX: 1, gridY: 1 },
        { type: 'door', open: true, gridX: 3, gridY: 0 },
        { type: 'secretDoor', visible: false, gridX: 2, gridY: 2 },
        { type: 'secretDoor', visible: true, gridX: 0, gridY: 0 },
      ],
      gridSize: 4,
      expectedWalls: new Set(['2,2']),
      expectedDoors: new Set(['1,1']),
    },
    {
      name: 'null walls and placedItems pass as empty Sets',
      players: [{ gridX: 1, gridY: 1 }],
      walls: null,
      placedItems: null,
      gridSize: 3,
      expectedWalls: new Set(),
      expectedDoors: new Set(),
    },
  ])('computeVisibility wiring — $name', ({ players, walls, placedItems, gridSize, expectedWalls, expectedDoors }) => {
    computeVisibility.mockReturnValue(new Set());

    renderHook(() => useFogOfWar(players, walls, placedItems, gridSize, []));

    expect(computeVisibility).toHaveBeenCalledTimes(1);
    expect(computeVisibility).toHaveBeenCalledWith(
      players, expectedWalls, expectedDoors, gridSize
    );
  });

  it('player move and revealed growth update the sets live', () => {
    computeVisibility.mockReturnValue(new Set());
    const walls = new Set();
    const placedItems = [];
    computeVisibility.mockReturnValueOnce(new Set(['1,1']));

    const { result, rerender } = renderHook(
      ({ players, revealed }) =>
        useFogOfWar(players, walls, placedItems, 3, revealed),
      { initialProps: { players: [{ gridX: 1, gridY: 1 }], revealed: [] } }
    );
    expect(result.current.fog.has('1,1')).toBe(false);

    // Move to 2,2: the vacated cell fogs again, the new cell is open.
    computeVisibility.mockReturnValueOnce(new Set(['2,2']));
    rerender({ players: [{ gridX: 2, gridY: 2 }], revealed: [] });
    expect(result.current.visible).toEqual(new Set(['2,2']));
    expect(result.current.fog).toEqual(new Set([
      '0,0', '0,1', '0,2',
      '1,0', '1,1', '1,2',
      '2,0', '2,1',
    ]));

    // Revealed memory grows: 0,0 opens even though LOS (empty) never covered it.
    rerender({ players: [{ gridX: 2, gridY: 2 }], revealed: ['0,0'] });
    expect(result.current.fog).toEqual(new Set([
      '0,1', '0,2',
      '1,0', '1,1', '1,2',
      '2,0', '2,1', '2,2',
    ]));
  });
});
