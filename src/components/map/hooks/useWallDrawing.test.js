// @maintained-by-ai
// Lane: useWallDrawing pointer contract (grid wall paint/erase).
// Owned here: cell-key writes via setMapData, painting stroke anchor, pointer
// capture acquire/release, guard order. Wall MATH (computeEffectiveWalls etc.)
// is owned by the wall services tests (#904); toolbar/tool routing matrix is
// owned by Map-tool-handlers.test.jsx (#911/#912), which mocks this hook.
//
// Old -> new map (21 tests -> 5 blocks / 11 cases):
//   down guards (localhost/tool/grid-null)      -> "refuses to write" it.each, exact full-zero bundle
//   down paint + preserve + idempotent paint    -> drag row paint (exact Set sequence)
//   down erase + preserve + idempotent erase    -> drag row erase (exact survivor sequence)
//   painting anchor / capture / preventDefault  -> folded into guard + drag assertions
//   move guards (localhost/painting/tool/grid)  -> "refuses to paint while dragging" it.each
//   up clear + release / leave clear + release  -> drag up-tail + dedicated leave test
//   svgRef-null (down/up/leave)                 -> single honest null-svg gesture
//   idempotent paint/erase                        -> removed (Set semantics, vacuous)
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWallDrawing from './useWallDrawing.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_NONE } from '../../../config/mapConfig.js';

const GRID = 64; // fake pixel size of one grid cell (binary-exact divisions)

// Stateful mapData harness (#906): update functions mutate a real Set store.
const createMapData = (initialWalls = []) => {
  let mapData = { walls: new Set(initialWalls) };
  const setMapData = vi.fn((update) => {
    mapData = update(mapData);
    return mapData;
  });
  return { setMapData, getWalls: () => mapData.walls };
};

const pointerAt = (type, x, y, id = 7) =>
  new PointerEvent(type, { pointerId: id, clientX: x, clientY: y });

const watchPreventDefault = (event) => {
  const spy = vi.fn();
  event.preventDefault = spy;
  return spy;
};

describe('useWallDrawing', () => {
  let svgRef;
  let getGridFromEvent;

  beforeEach(() => {
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    // Pixel->grid fake fixed at GRID px/cell so coordinates drive the geometry.
    getGridFromEvent = vi.fn((e) => ({ gridX: e.clientX / GRID, gridY: e.clientY / GRID }));
  });

  const getHook = ({ isLocalhost = true, tool = TOOL_PAINT } = {}) => {
    const { result } = renderHook(() =>
      useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef })
    );
    return result;
  };

  it.each([
    { name: 'a read-only client', isLocalhost: false, tool: TOOL_PAINT, onGrid: true, prevented: false, captured: false },
    { name: 'a non-wall tool', isLocalhost: true, tool: TOOL_NONE, onGrid: true, prevented: false, captured: false },
    // Outside the grid the source still preventDefaults and captures before
    // giving up on the cell; the capture is released by the up/leave tail.
    { name: 'a press outside the grid', isLocalhost: true, tool: TOOL_PAINT, onGrid: false, prevented: true, captured: true },
  ])('pointer down refuses to write for $name', ({ isLocalhost, tool, onGrid, prevented, captured }) => {
    const result = getHook({ isLocalhost, tool });
    const { setMapData, getWalls } = createMapData();
    if (!onGrid) getGridFromEvent.mockReturnValue(null);

    const event = pointerAt('down', 96, 112);
    const preventedSpy = watchPreventDefault(event);

    act(() => {
      result.current.handleGridPointerDown(event, setMapData);
    });

    expect(setMapData).not.toHaveBeenCalled();
    expect(getWalls()).toEqual(new Set());
    expect(result.current.painting).toBeNull();
    expect(preventedSpy).toHaveBeenCalledTimes(prevented ? 1 : 0);
    expect(svgRef.current.setPointerCapture).toHaveBeenCalledTimes(captured ? 1 : 0);
  });

  // Real captured gesture: down anchors the stroke, each move extends it,
  // up releases. Cells are binary-exact: (96,112)->1,1 (160,112)->2,1 (160,192)->2,3.
  it.each([
    {
      tool: TOOL_PAINT,
      initial: ['5,5'],
      trail: [
        new Set(['5,5', '1,1']),
        new Set(['5,5', '1,1', '2,1']),
        new Set(['5,5', '1,1', '2,1', '2,3']),
      ],
    },
    {
      tool: TOOL_ERASE,
      initial: ['5,5', '1,1', '2,1', '2,3'],
      trail: [
        new Set(['5,5', '2,1', '2,3']),
        new Set(['5,5', '2,3']),
        new Set(['5,5']),
      ],
    },
  ])('a full $tool drag writes the exact cell trail', ({ tool, initial, trail }) => {
    const result = getHook({ tool });
    const { setMapData, getWalls } = createMapData(initial);

    const steps = [
      { type: 'down', x: 96, y: 112 },
      { type: 'move', x: 160, y: 112 },
      { type: 'move', x: 160, y: 192 },
    ];
    steps.forEach(({ type, x, y }, i) => {
      const event = pointerAt(type, x, y);
      const preventedSpy = watchPreventDefault(event);
      act(() => {
        if (type === 'down') {
          result.current.handleGridPointerDown(event, setMapData);
        } else {
          // Feed the hook's own painting state, exactly as Map.jsx wires it.
          result.current.handleGridPointerMove(event, setMapData, result.current.painting, tool);
        }
      });
      expect(getWalls()).toEqual(trail[i]);
      expect(preventedSpy).toHaveBeenCalledTimes(1);
    });

    expect(result.current.painting).not.toBeNull();
    expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(7);

    act(() => {
      result.current.handleGridPointerUp(pointerAt('up', 160, 192));
    });

    expect(result.current.painting).toBeNull();
    expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(getWalls()).toEqual(trail[trail.length - 1]);
  });

  it.each([
    { name: 'a read-only client', isLocalhost: false, painting: { gridX: 1, gridY: 1 }, tool: TOOL_PAINT, onGrid: true },
    { name: 'no active stroke', isLocalhost: true, painting: null, tool: TOOL_PAINT, onGrid: true },
    { name: 'a non-wall tool', isLocalhost: true, painting: { gridX: 1, gridY: 1 }, tool: TOOL_NONE, onGrid: true },
    { name: 'a move outside the grid', isLocalhost: true, painting: { gridX: 1, gridY: 1 }, tool: TOOL_PAINT, onGrid: false },
  ])('pointer move refuses to paint while dragging with $name', ({ isLocalhost, painting, tool, onGrid }) => {
    const result = getHook({ isLocalhost, tool });
    const { setMapData, getWalls } = createMapData();
    if (!onGrid) getGridFromEvent.mockReturnValue(null);

    act(() => {
      result.current.handleGridPointerMove(pointerAt('move', 160, 112), setMapData, painting, tool);
    });

    expect(setMapData).not.toHaveBeenCalled();
    expect(getWalls()).toEqual(new Set());
  });

  it('pointer leave ends the stroke: releases capture, clears painting, keeps painted walls', () => {
    const result = getHook({ tool: TOOL_PAINT });
    const { setMapData, getWalls } = createMapData();

    act(() => {
      result.current.handleGridPointerDown(pointerAt('down', 96, 112), setMapData);
    });
    act(() => {
      result.current.handleGridPointerLeave(pointerAt('leave', 160, 112));
    });

    expect(result.current.painting).toBeNull();
    expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);
    // Leaving mid-stroke does not roll back the cell painted on pointer down.
    expect(getWalls()).toEqual(new Set(['1,1']));
  });

  it('survives a missing svg element across the whole gesture without capture', () => {
    svgRef.current = null;
    const result = getHook({ tool: TOOL_PAINT });
    const { setMapData, getWalls } = createMapData();

    act(() => {
      result.current.handleGridPointerDown(pointerAt('down', 96, 112), setMapData);
    });
    expect(getWalls()).toEqual(new Set(['1,1']));
    expect(result.current.painting).not.toBeNull();

    act(() => {
      result.current.handleGridPointerMove(pointerAt('move', 160, 112), setMapData, result.current.painting, TOOL_PAINT);
    });
    expect(getWalls()).toEqual(new Set(['1,1', '2,1']));

    act(() => {
      result.current.handleGridPointerUp(pointerAt('up', 160, 112));
    });
    expect(result.current.painting).toBeNull();
  });
});
