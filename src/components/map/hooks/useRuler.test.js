// @maintained-by-ai
// Lane: map ruler measurement state machine (#911).
// Split: useSelectMove only guards `tool: 'ruler'` (skips interaction); the
// ruler pointer state machine is owned here. Map.test.jsx mocks this hook,
// so no sibling test exercises these bytes. Feet/exact distance display is
// owned by the display layer — this hook stores floored grid cells only.
// Grid math is local (Math.floor), so the math IS the SUT: feed points,
// pin authored literal outputs (never recompute the formula, #710).
// Old->new map: 20 tests -> 8. Guards consolidated into "ignored clicks" /
// "guards" tests; pointerId capture tests folded into first-click/release;
// negative floor folded into preview; "no-op" trivia removed.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useRuler from './useRuler.js';

describe('useRuler', () => {
  const mockEvent = (pointerId = 1) => ({
    preventDefault: vi.fn(),
    pointerId,
  });

  const gridAt = (gridX, gridY) => () => ({ gridX, gridY });

  const mockSvgRef = () => ({
    current: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  });

  const down = (result, event, svgRef, getGrid, { rulerMode = true, start = result.current.rulerStart, end = result.current.rulerEnd } = {}) =>
    act(() => {
      result.current.handleRulerPointerDown(event, {
        rulerMode,
        rulerStart: start,
        rulerEnd: end,
        getGridFromEvent: getGrid,
        svgRef,
      });
    });

  const move = (result, event, getGrid, { rulerMode = true, start = result.current.rulerStart, end = result.current.rulerEnd } = {}) =>
    act(() => {
      result.current.handleRulerPointerMove(event, rulerMode, start, end, getGrid);
    });

  it('starts with ruler mode off and no measurement points', () => {
    const { result } = renderHook(() => useRuler());
    expect(result.current.rulerMode).toBe(false);
    expect(result.current.rulerStart).toBeNull();
    expect(result.current.rulerEnd).toBeNull();
    expect(result.current.rulerPreview).toBeNull();
  });

  it('disabling ruler mode clears the measurement; re-enabling starts fresh', () => {
    const { result } = renderHook(() => useRuler());
    const svgRef = mockSvgRef();

    act(() => result.current.setRulerMode(true));
    expect(result.current.rulerMode).toBe(true);

    down(result, mockEvent(), svgRef, gridAt(1.5, 2.7), { start: null });
    expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });

    move(result, mockEvent(), gridAt(4.4, 9.9));
    expect(result.current.rulerPreview).toEqual({ gridX: 4, gridY: 9 });

    act(() => result.current.setRulerMode(false));
    expect(result.current.rulerMode).toBe(false);
    expect(result.current.rulerStart).toBeNull();
    expect(result.current.rulerEnd).toBeNull();
    expect(result.current.rulerPreview).toBeNull();

    act(() => result.current.setRulerMode(true));
    expect(result.current.rulerStart).toBeNull();
    expect(result.current.rulerPreview).toBeNull();
  });

  it('first click sets start, floors coordinates, prevents default, captures the pointer', () => {
    const { result } = renderHook(() => useRuler());
    const event = mockEvent(42);
    const svgRef = mockSvgRef();

    down(result, event, svgRef, gridAt(1.9, 2.1), { start: null });

    expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
    expect(result.current.rulerEnd).toBeNull();
    expect(result.current.rulerPreview).toBeNull();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
  });

  it('ignores clicks outside ruler mode or off the grid, and still measures when the svg ref is empty', () => {
    const { result } = renderHook(() => useRuler());

    const offMode = mockEvent();
    down(result, offMode, mockSvgRef(), gridAt(1, 1), { rulerMode: false, start: null });
    expect(offMode.preventDefault).not.toHaveBeenCalled();
    expect(result.current.rulerStart).toBeNull();

    const offGrid = mockEvent();
    down(result, offGrid, mockSvgRef(), () => null, { start: null });
    expect(offGrid.preventDefault).not.toHaveBeenCalled();
    expect(result.current.rulerStart).toBeNull();

    const emptySvg = mockEvent();
    down(result, emptySvg, { current: null }, gridAt(7.2, 8.9), { start: null });
    expect(result.current.rulerStart).toEqual({ gridX: 7, gridY: 8 });
  });

  it('second click sets end; third click restarts the ruler', () => {
    const { result } = renderHook(() => useRuler());
    const svgRef = mockSvgRef();

    down(result, mockEvent(), svgRef, gridAt(1.5, 2.7), { start: null });
    down(result, mockEvent(), svgRef, gridAt(5.3, 6.8));
    expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
    expect(result.current.rulerEnd).toEqual({ gridX: 5, gridY: 6 });
    expect(result.current.rulerPreview).toBeNull();

    down(result, mockEvent(), svgRef, gridAt(10.1, 11.9));
    expect(result.current.rulerStart).toEqual({ gridX: 10, gridY: 11 });
    expect(result.current.rulerEnd).toBeNull();
    expect(result.current.rulerPreview).toBeNull();
  });

  it('pointer move previews the measured cell and ignores stale or finished states', () => {
    const { result } = renderHook(() => useRuler());

    // Guards: mode off, no start, measurement finished, off-grid — no preview.
    move(result, mockEvent(), gridAt(3, 4), { rulerMode: false, start: { gridX: 1, gridY: 1 } });
    move(result, mockEvent(), gridAt(3, 4), { start: null });
    move(result, mockEvent(), gridAt(3, 4), { start: { gridX: 1, gridY: 1 }, end: { gridX: 2, gridY: 2 } });
    move(result, mockEvent(), () => null, { start: { gridX: 1, gridY: 1 } });
    expect(result.current.rulerPreview).toBeNull();
    expect(result.current.rulerEnd).toBeNull();

    // Live preview: floors forward and negative coordinates.
    move(result, mockEvent(), gridAt(5.9, 6.1), { start: { gridX: 1, gridY: 1 } });
    expect(result.current.rulerPreview).toEqual({ gridX: 5, gridY: 6 });

    move(result, mockEvent(), gridAt(-4.2, -0.8), { start: { gridX: 1, gridY: 1 } });
    expect(result.current.rulerPreview).toEqual({ gridX: -5, gridY: -1 });
    expect(result.current.rulerEnd).toBeNull();
  });

  it('pointer up releases the pointer capture with the event pointerId', () => {
    const { result } = renderHook(() => useRuler());
    const svgRef = mockSvgRef();

    act(() => result.current.handleRulerPointerUp(mockEvent(99), true, svgRef));
    expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(99);

    act(() => result.current.handleRulerPointerUp(mockEvent(), false, svgRef));
    expect(svgRef.current.releasePointerCapture).toHaveBeenCalledTimes(1);

    // Null svg must not throw.
    expect(() => {
      act(() => result.current.handleRulerPointerUp(mockEvent(), true, { current: null }));
    }).not.toThrow();
  });

  it('resetRuler clears an active measurement but keeps ruler mode on', () => {
    const { result } = renderHook(() => useRuler());
    const svgRef = mockSvgRef();

    act(() => result.current.setRulerMode(true));
    down(result, mockEvent(), svgRef, gridAt(5, 6), { start: null });
    move(result, mockEvent(), gridAt(7.5, 8.5));
    down(result, mockEvent(), svgRef, gridAt(9.9, 0.2));
    expect(result.current.rulerEnd).toEqual({ gridX: 9, gridY: 0 });

    act(() => result.current.resetRuler());
    expect(result.current.rulerStart).toBeNull();
    expect(result.current.rulerEnd).toBeNull();
    expect(result.current.rulerPreview).toBeNull();
    expect(result.current.rulerMode).toBe(true);
  });
});
