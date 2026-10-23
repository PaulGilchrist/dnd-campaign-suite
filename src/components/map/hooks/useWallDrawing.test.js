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
//   NEW #883 discipline                           -> failed-arm zero-capture + guard-order
//                                                   ledger with exact capture/release pair (#1348)
// #883/fix#53 strand class: this lane's svg was a bare vi.fn() capture pair that
// never threw, hiding the pre-fix defect (capture fired BEFORE the grid guard, and
// up/leave released captures the down never acquired -> NotFoundError in real
// browsers). Upgraded to a faithful capture-tracking element (house faithful-mock
// canon, fix#55/useZoomPan.test.js makeSvg): release throws NotFoundError unless
// that pointerId is captured.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWallDrawing from './useWallDrawing.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_NONE } from '../../../config/mapConfig.js';

const GRID = 64; // fake pixel size of one grid cell (binary-exact divisions)

// Faithful pointer-capture ledger (real Element.prototype semantics): capture arms a
// pointerId; release of an un-captured (or mismatched) pointerId throws NotFoundError.
const makeCapturingSvg = () => {
  const captured = new Set();
  return {
    captured,
    hasPointerCapture: vi.fn((id) => captured.has(id)),
    setPointerCapture: vi.fn((id) => { captured.add(id); }),
    releasePointerCapture: vi.fn((id) => {
      if (!captured.has(id)) {
        // jsdom exposes DOMException via globalThis; explicit access keeps eslint's
        // no-undef globals block untouched (test-scope edit constraint).
        throw new globalThis.DOMException(
          `Failed to execute 'releasePointerCapture': no active capture for pointerId ${id}`,
          'NotFoundError'
        );
      }
      captured.delete(id);
    }),
  };
};

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
    svgRef = { current: makeCapturingSvg() };
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
    // Outside the grid the source still preventDefaults but must NOT capture
    // before the grid guard fails — fix#53 house shape (useRuler.js:22-27
    // validate-capture-commit): a failed down that captured stranded the pointer.
    { name: 'a press outside the grid', isLocalhost: true, tool: TOOL_PAINT, onGrid: false, prevented: true, captured: false },
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

  // #883 capture discipline (fix#53 house shape — useItemDragging.js:42-47/:101-104,
  // useRuler.js:22-27 validate-capture-commit): setPointerCapture runs AFTER the
  // localhost/tool/grid guards, last before the commit; painting !== null strictly
  // implies captured; up/leave release-first-after-null-bail.
  describe('pointer capture discipline (#883)', () => {
    it('failed down (grid null): zero capture bytes, silent terminals', () => {
      getGridFromEvent.mockReturnValue(null);
      const result = getHook();
      const { setMapData, getWalls } = createMapData();
      const event = pointerAt('down', 96, 112);
      const preventedSpy = watchPreventDefault(event);

      act(() => {
        result.current.handleGridPointerDown(event, setMapData);
      });

      expect(preventedSpy).toHaveBeenCalledTimes(1); // still suppresses native drag
      expect(result.current.painting).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
      expect(getWalls()).toEqual(new Set());
      const svg = svgRef.current;
      expect(svg.setPointerCapture).not.toHaveBeenCalled();
      expect(svg.captured.has(7)).toBe(false);

      // Terminals run straight through the failed gesture: pre-fix the captured
      // down + null painting stranded live here and the second terminal threw
      // NotFoundError on the faithful mock.
      act(() => {
        result.current.handleGridPointerUp(pointerAt('up', 96, 112));
      });
      act(() => {
        result.current.handleGridPointerLeave(pointerAt('leave', 96, 112));
      });
      expect(svg.releasePointerCapture).not.toHaveBeenCalled();
      expect(svg.captured.size).toBe(0);
    });

    it('orders the grid guard before the capture and pairs capture/release exactly once (#1348)', () => {
      const result = getHook();
      const { setMapData } = createMapData();

      act(() => {
        result.current.handleGridPointerDown(pointerAt('down', 96, 112), setMapData);
      });

      const svg = svgRef.current;
      expect(result.current.painting).not.toBeNull();
      expect(svg.setPointerCapture).toHaveBeenCalledTimes(1);
      expect(svg.setPointerCapture).toHaveBeenCalledWith(7);
      expect(svg.hasPointerCapture(7)).toBe(true);
      const captureOrder = svg.setPointerCapture.mock.invocationCallOrder[0];
      expect(getGridFromEvent.mock.invocationCallOrder[0]).toBeLessThan(captureOrder);

      act(() => {
        result.current.handleGridPointerUp(pointerAt('up', 160, 112));
      });
      expect(svg.releasePointerCapture).toHaveBeenCalledTimes(1);
      expect(svg.releasePointerCapture).toHaveBeenCalledWith(7);
      expect(svg.captured.size).toBe(0);

      // Late leave after up must not double-release (painting already cleared).
      act(() => {
        result.current.handleGridPointerLeave(pointerAt('leave', 160, 112));
      });
      expect(svg.releasePointerCapture).toHaveBeenCalledTimes(1);
    });
  });
});
