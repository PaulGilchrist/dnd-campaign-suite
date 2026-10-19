// @maintained-by-ai
// Lane: usePlayerDragging — mapData.players token-drag contract (Map.jsx).
//   down  → stop/prevent + setPointerCapture + drag-ghost state bytes (offset/start cell/unconstrained)
//   move  → snapped, clamped ghost-cell bytes via setMapData; runtime writes deferred to commit
//   up    → commit position write exact payload once + steadyAim stamp exactly once (#786)
//           + onTokenMoveLanded exact args once (defender-detection internals owned by
//           opportunityTrigger.test.js; items-lane parity #905) + capture release
//   leave → cancel: release + clear, zero commit writes
// #905-class pointer-capture leaks (down captures BEFORE the ctm/player guards; up releases
// AFTER them) are pinned honestly on the guard rows below — see SOURCE BUGS note there.
// Do NOT duplicate here: useItemDragging.test.js — placedItems lane (commit contract #905);
// useMapDrops.test.js — external drop-target lane; Map*.test.jsx — consume this hook fully mocked;
// movementBudget.test.js / chargeEconomy.test.js — budget clamp math (every drop here runs with
// enforcement absent ⇒ passthrough, verified implicitly by each commit row).
// Snap/reachability math is NOT mocked: pointer coords fed, exact cell bytes pinned.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlayerDragging from './usePlayerDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

const mocks = vi.hoisted(() => ({
  onTokenMoveLanded: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/opportunityTrigger.js', () => mocks);

describe('usePlayerDragging', () => {
  // Stateful harness (#906): svgRef/mapDataHolder are mutable containers so useCallback
  // closures re-read .current through renderHook's rerender(); setMapData behaves like
  // React setState (applies updater, stores result) so later calls observe fresh data.
  let svgRef;
  let mapDataHolder;
  let setMapData;
  let setRuntimeValueSpy;

  const gridSize = 30; // max clamped cell is 29
  const campaignName = 'test-campaign';
  const gridCenterX = (v) => v * CELL_SIZE + CELL_SIZE / 2;
  const gridCenterY = (v) => v * CELL_SIZE + CELL_SIZE / 2;

  // Fixed transforms keep every geometry assertion deterministic.
  const svgAt = (x, y) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x, y }) }),
    getScreenCTM: () => ({ inverse: () => ({}) }),
  });
  const svgNoCtm = () => ({ ...svgAt(0, 0), getScreenCTM: () => null });

  const mockEvent = (overrides = {}) => ({
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    pointerId: 1,
    clientX: 60,
    clientY: 80,
    ...overrides,
  });

  const getHook = (overrides = {}) =>
    renderHook(() =>
      usePlayerDragging({
        svgRef,
        mapData: mapDataHolder.current,
        gridSize,
        setMapData,
        gridCenterX,
        gridCenterY,
        rulerMode: false,
        spellMode: false,
        campaignName,
        isLocalhost: false,
        walls: new Set(),
        placedItems: [],
        ...overrides,
      })
    );

  // Press at SVG point (x,y). Default press of p1 (cell 1,2; center 60,100) at (60,80)
  // ⇒ ghost offset (0,-20) with CELL_SIZE 40.
  const press = (playerId = 'p1', { hook = {}, event = {}, x = 60, y = 80 } = {}) => {
    svgRef.current = svgAt(x, y);
    const helpers = getHook(hook);
    const ev = mockEvent({ clientX: x, clientY: y, ...event });
    act(() => {
      helpers.result.current.handlePointerDown(ev, playerId);
    });
    return { ...helpers, ev };
  };

  const moveTo = (helpers, x, y, event = {}) => {
    svgRef.current = svgAt(x, y);
    act(() => {
      helpers.result.current.handlePointerMove(mockEvent({ clientX: x, clientY: y, ...event }));
    });
    act(() => helpers.rerender());
  };

  const dropAt = (helpers, x, y, event = {}) => {
    svgRef.current = svgAt(x, y);
    act(() => {
      helpers.result.current.handlePointerUp(mockEvent({ clientX: x, clientY: y, ...event }));
    });
  };

  const fullWallX = (x) => {
    const wall = new Set();
    for (let y = 0; y < gridSize; y++) wall.add(`${x},${y}`);
    return wall;
  };

  const playerBytes = (id, name, gridX, gridY) => ({ id, name, gridX, gridY });
  const cellOf = (map, id) => {
    const p = map.players.find((c) => c.id === id);
    return { gridX: p.gridX, gridY: p.gridY };
  };

  beforeEach(() => {
    svgRef = { current: null };
    mapDataHolder = {
      current: {
        players: [
          playerBytes('p1', 'Player1', 1, 2),
          playerBytes('p2', 'Player2', 5, 5),
          playerBytes('p3', 'Player3', 10, 10),
        ],
      },
    };
    setMapData = vi.fn((fn) => {
      const next = typeof fn === 'function' ? fn(mapDataHolder.current) : fn;
      mapDataHolder.current = next;
      return next;
    });
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockReturnValue(undefined);
    setRuntimeValueSpy.mockClear();
    mocks.onTokenMoveLanded.mockClear();
  });

  it('exposes null drag state and the four pointer handlers initially', () => {
    const { result } = getHook();
    expect(result.current.dragging).toBeNull();
    expect(typeof result.current.handlePointerDown).toBe('function');
    expect(typeof result.current.handlePointerMove).toBe('function');
    expect(typeof result.current.handlePointerUp).toBe('function');
    expect(typeof result.current.handlePointerLeave).toBe('function');
  });

  describe('handlePointerDown', () => {
    it('claims the pointer and opens drag state with exact ghost bytes', () => {
      const { result, ev } = press('p1', { event: { pointerId: 42 } });
      expect(ev.stopPropagation).toHaveBeenCalled();
      expect(ev.preventDefault).toHaveBeenCalled();
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
      const d = result.current.dragging;
      expect(d).toMatchObject({
        playerId: 'p1',
        pointerId: 42,
        offsetX: 0, // point 60 - center(1) 60
        offsetY: -20, // point 80 - center(2) 100
        unconstrained: false,
        startX: 1, // turn-start cell captured at press time (L5-002)
        startY: 2,
      });
      // Open-world census: no walls ⇒ every cell walkable.
      expect(d.reachable).toBeInstanceOf(Set);
      expect(d.reachable.size).toBe(gridSize * gridSize);
    });

    it.each([
      ['rulerMode', { rulerMode: true }],
      ['spellMode', { spellMode: true }],
    ])('leaves the event untouched and starts no drag when %s is enabled', (_, overrides) => {
      svgRef.current = svgAt(60, 80);
      const ev = mockEvent();
      const { result } = getHook(overrides);
      act(() => {
        result.current.handlePointerDown(ev, 'p1');
      });
      expect(result.current.dragging).toBeNull();
      expect(ev.stopPropagation).not.toHaveBeenCalled();
      expect(ev.preventDefault).not.toHaveBeenCalled();
      expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
    });

    // SOURCE BUG (#905 class, confirmed live in player lane): setPointerCapture runs
    // BEFORE the ctm/player guards, so a failed down strands the capture with no drag
    // state. Pinned honestly at current behaviour — delete the expectCaptured:true rows
    // only when the source captures after its guards.
    it.each([
      ['svgRef is null', null, 'p1', false],
      ['getScreenCTM returns null', svgNoCtm(), 'p1', true],
      ['player id is unknown', svgAt(60, 80), 'nonexistent', true],
    ])('starts no drag and writes nothing when %s (captured=%s)', (_, svg, playerId, expectCaptured) => {
      svgRef.current = svg;
      const { result } = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent(), playerId);
      });
      expect(result.current.dragging).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
      const captured = svg ? svg.setPointerCapture.mock.calls.length > 0 : false;
      expect(captured).toBe(expectCaptured);
    });
  });

  describe('handlePointerMove', () => {
    it('writes the snapped ghost cell with exact bytes and defers runtime stamps to commit', () => {
      const helpers = press();
      moveTo(helpers, 150, 150); // cx 150→3, cy 150-(-20)=170→4
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(mapDataHolder.current.players).toEqual([
        playerBytes('p1', 'Player1', 3, 4),
        playerBytes('p2', 'Player2', 5, 5),
        playerBytes('p3', 'Player3', 10, 10),
      ]);
      // Players lane stamps steadyAim once at commit (finalizePlayerMove), not per move.
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['far off the top-left', -100, -100, 0, 0],
      ['far past the bottom-right', 99999, 99999, 29, 29],
    ])('clamps the ghost cell to exact bytes when dragged %s', (_, x, y, cellX, cellY) => {
      const helpers = press();
      moveTo(helpers, x, y);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: cellX, gridY: cellY });
    });

    it.each([
      ['no drag is active', false, () => {}],
      ['svgRef becomes null mid-drag', true, () => { svgRef.current = null; }],
      ['getScreenCTM returns null mid-drag', true, () => { svgRef.current = svgNoCtm(); }],
      ['the dragged player is removed mid-drag', true, () => { mapDataHolder.current = { players: [] }; }],
    ])('writes nothing during move when %s', (_, startDrag, mutate) => {
      const helpers = startDrag ? press() : getHook();
      mutate();
      if (startDrag) act(() => helpers.rerender());
      // Call the handler directly (not moveTo) so the mutated svg is what it sees.
      act(() => {
        helpers.result.current.handlePointerMove(mockEvent({ clientX: 150, clientY: 150 }));
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });
  });

  describe('commit (handlePointerUp)', () => {
    it('commits the exact position once, stamps steadyAim once, fires the opportunity trigger once, and releases the pointer', () => {
      const helpers = press();
      moveTo(helpers, 150, 150); // ghost now at (3,4)
      const mapAtUp = mapDataHolder.current;
      setMapData.mockClear(); // isolate the commit write from the ghost write

      dropAt(helpers, 150, 150);

      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(setMapData.mock.calls[0][0](mapAtUp).players).toEqual([
        playerBytes('p1', 'Player1', 3, 4),
        playerBytes('p2', 'Player2', 5, 5),
        playerBytes('p3', 'Player3', 10, 10),
      ]);
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(helpers.result.current.dragging).toBeNull();
      expect(setRuntimeValueSpy).toHaveBeenCalledTimes(1); // #786: exactly once per authored move
      expect(setRuntimeValueSpy).toHaveBeenCalledWith('Player1', 'steadyAimMovedThisTurn', true, campaignName);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledTimes(1);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith({
        campaignName,
        moverName: 'Player1',
        moverIsPlayer: true,
        fromCell: { gridX: 1, gridY: 2 }, // press-time cell, not the live ghost cell
        toCell: { gridX: 3, gridY: 4 },
        mapData: mapAtUp,
      });
    });

    it('does not shove a token off its own cell or fire commits when dropped in place', () => {
      mapDataHolder.current = {
        players: [
          playerBytes('p1', 'Player1', 5, 5),
          playerBytes('p2', 'Player2', 5, 6),
          playerBytes('p3', 'Player3', 6, 5),
          playerBytes('p4', 'Player4', 4, 5),
          playerBytes('p5', 'Player5', 5, 4),
        ],
      };
      const helpers = press('p1', { x: 220, y: 200 }); // cell (5,5) centre-ish

      dropAt(helpers, 220, 200);

      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 5, gridY: 5 }); // self excluded from occupancy
      expect(setRuntimeValueSpy).not.toHaveBeenCalled(); // same cell ⇒ no stamp
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(helpers.result.current.dragging).toBeNull();
    });

    it('snaps an occupied drop target to the nearest free reachable cell', () => {
      const helpers = press();
      moveTo(helpers, 220, 200); // (5,5) is reachable and walk-over during drag (ghost only)
      const mapAtUp = mapDataHolder.current;
      setMapData.mockClear();

      dropAt(helpers, 220, 200); // (5,5) is p2's cell

      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(setMapData.mock.calls[0][0](mapAtUp).players).toEqual([
        playerBytes('p1', 'Player1', 6, 5), // BFS ring order: first free neighbour
        playerBytes('p2', 'Player2', 5, 5),
        playerBytes('p3', 'Player3', 10, 10),
      ]);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(
        expect.objectContaining({ toCell: { gridX: 6, gridY: 5 } })
      );
    });

    it('falls back to player.id for both the steadyAim key and the trigger payload when name is missing', () => {
      mapDataHolder.current = { players: [{ id: 'orphan-token', gridX: 0, gridY: 0 }] };
      const helpers = press('orphan-token');
      dropAt(helpers, 150, 150); // → cell (2,2)

      expect(setRuntimeValueSpy).toHaveBeenCalledWith('orphan-token', 'steadyAimMovedThisTurn', true, campaignName);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(
        expect.objectContaining({
          moverName: 'orphan-token',
          moverIsPlayer: true,
          fromCell: { gridX: 0, gridY: 0 },
          toCell: { gridX: 2, gridY: 2 },
        })
      );
    });

    it('still commits the position but writes no runtime state when campaignName is missing', () => {
      const helpers = press('p1', { hook: { campaignName: null } });
      dropAt(helpers, 150, 150);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 3, gridY: 4 });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });

    // SOURCE BUG (#905 class): releasePointerCapture runs AFTER the ctm/player guards,
    // so a guarded pointer-up clears the drag but strands the capture. Pinned as-is.
    it.each([
      ['no drag is active', false, () => {}],
      ['getScreenCTM returns null mid-drag', true, () => { svgRef.current = svgNoCtm(); }],
      ['the dragged player is removed mid-drag', true, () => { mapDataHolder.current = { players: [] }; }],
    ])('up writes nothing, clears the drag, and leaves capture unreleased when %s', (_, startDrag, mutate) => {
      if (!startDrag) svgRef.current = svgAt(150, 150);
      const helpers = startDrag ? press() : getHook();
      mutate();
      if (startDrag) act(() => helpers.rerender());
      const upEvent = mockEvent({ clientX: 150, clientY: 150 });
      act(() => {
        helpers.result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      expect(helpers.result.current.dragging).toBeNull();
    });
  });

  describe('movement constraints (walls, closed doors, reachability)', () => {
    it('flags invalid across a wall and clears the flag on the walkable side', () => {
      const helpers = press('p1', { hook: { walls: fullWallX(3) } });
      moveTo(helpers, 260, 100); // → (6,3), across the wall
      expect(setMapData).not.toHaveBeenCalled();
      expect(helpers.result.current.dragging.invalid).toBe(true);

      moveTo(helpers, 100, 100); // → (2,3), walkable side
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 2, gridY: 3 });
      expect(helpers.result.current.dragging.invalid).toBe(false);
    });

    it.each([
      ['closed', false],
      ['open', true],
    ])('blocks movement across a %s door in a wall line', (_, open) => {
      const wall = new Set();
      for (let y = 0; y < gridSize; y++) if (y !== 2) wall.add(`3,${y}`);
      const helpers = press('p1', {
        hook: { walls: wall, placedItems: [{ type: 'door', open, gridX: 3, gridY: 2 }] },
      });
      moveTo(helpers, 220, 80); // → (5,2) across the door
      if (open) {
        expect(setMapData).toHaveBeenCalledTimes(1);
        expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 5, gridY: 2 });
      } else {
        expect(setMapData).not.toHaveBeenCalled();
        expect(helpers.result.current.dragging.invalid).toBe(true);
      }
    });

    it('lets the GM drag through walls and drop onto a wall cell while Shift is held', () => {
      const helpers = press('p1', {
        hook: { isLocalhost: true, walls: fullWallX(3) },
        event: { shiftKey: true },
      });
      expect(helpers.result.current.dragging.unconstrained).toBe(true);
      moveTo(helpers, 260, 100); // ghost past the wall
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 6, gridY: 3 });
      expect(helpers.result.current.dragging.invalid).toBeFalsy();

      setMapData.mockClear();
      dropAt(helpers, 220, 80); // drop on wall cell (5,2)
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 5, gridY: 2 });
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledTimes(1);
    });

    it('does not grant the Shift bypass to non-GM clients', () => {
      const helpers = press('p1', {
        hook: { isLocalhost: false, walls: fullWallX(3) },
        event: { shiftKey: true },
      });
      moveTo(helpers, 260, 100);
      expect(setMapData).not.toHaveBeenCalled();
      expect(helpers.result.current.dragging.invalid).toBe(true);
    });

    it('snaps a drop beyond a wall to the nearest reachable cell', () => {
      const helpers = press('p1', { hook: { walls: fullWallX(3) } });
      dropAt(helpers, 220, 80); // target (5,2) across the wall → (2,2)
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 2, gridY: 2 });
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(
        expect.objectContaining({ toCell: { gridX: 2, gridY: 2 } })
      );
    });

    it('keeps a player pinned when its own cell is blocked (legacy data)', () => {
      mapDataHolder.current = { players: [playerBytes('p1', 'Player1', 5, 5)] };
      const helpers = press('p1', { hook: { walls: new Set(['5,5']) } });
      dropAt(helpers, 500, 500); // no reachable cell besides the start
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 5, gridY: 5 });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled(); // pinned in place ⇒ no move stamp
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });
  });

  describe('handlePointerLeave', () => {
    it.each([
      ['during a drag', true],
      ['without a drag', false],
    ])('cancels cleanly with zero commit writes when leave fires %s', (_, startDrag) => {
      if (!startDrag) svgRef.current = svgAt(60, 80);
      const helpers = startDrag ? press() : getHook();
      if (startDrag) moveTo(helpers, 150, 150);
      act(() => {
        helpers.result.current.handlePointerLeave({ pointerId: 1 });
      });
      expect(helpers.result.current.dragging).toBeNull();
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
      if (startDrag) {
        expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
      } else {
        expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      }
    });
  });
});
