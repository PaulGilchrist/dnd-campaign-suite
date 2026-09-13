// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useRuler from './useRuler.js';

describe('useRuler', () => {
  const createMockEvent = (pointerId = 1) => ({
    preventDefault: vi.fn(),
    pointerId,
  });

  const createMockGetGrid = (gridX, gridY) => () => ({ gridX, gridY });

  const createMockSvgRef = () => ({
    current: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  });

  const hookFactory = () => renderHook(() => useRuler());

  describe('initial state', () => {
    it('should start with rulerMode false and all positions null', () => {
      const { result } = hookFactory();
      expect(result.current.rulerMode).toBe(false);
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('setRulerMode', () => {
    it('should toggle rulerMode to true', () => {
      const { result } = hookFactory();
      act(() => {
        result.current.setRulerMode(true);
      });
      expect(result.current.rulerMode).toBe(true);
    });

    it('should reset all positions when disabling ruler mode', () => {
      const { result } = hookFactory();
      const getGrid = createMockGetGrid(1.5, 2.7);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.setRulerMode(true);
      });
      act(() => {
        result.current.handleRulerPointerDown(
          createMockEvent(),
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: getGrid, svgRef }
        );
      });
      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          result.current.rulerStart,
          null,
          getGrid
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
      expect(result.current.rulerPreview).toEqual({ gridX: 1, gridY: 2 });

      act(() => {
        result.current.setRulerMode(false);
      });
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should not reset positions when enabling ruler mode', () => {
      const { result } = hookFactory();
      const getGrid = createMockGetGrid(3, 4);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.setRulerMode(true);
      });
      act(() => {
        result.current.handleRulerPointerDown(
          createMockEvent(),
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: getGrid, svgRef }
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 3, gridY: 4 });

      act(() => {
        result.current.setRulerMode(true);
      });
      expect(result.current.rulerStart).toEqual({ gridX: 3, gridY: 4 });
    });
  });

  describe('resetRuler', () => {
    it('should clear all position state', () => {
      const { result } = hookFactory();
      const getGrid = createMockGetGrid(5, 6);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.setRulerMode(true);
      });
      act(() => {
        result.current.handleRulerPointerDown(
          createMockEvent(),
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: getGrid, svgRef }
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          createMockEvent(),
          { rulerMode: true, rulerStart: result.current.rulerStart, rulerEnd: null, getGridFromEvent: getGrid, svgRef }
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 5, gridY: 6 });
      expect(result.current.rulerEnd).toEqual({ gridX: 5, gridY: 6 });

      act(() => {
        result.current.resetRuler();
      });
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should do nothing when already empty', () => {
      const { result } = hookFactory();
      act(() => {
        result.current.resetRuler();
      });
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('handleRulerPointerDown', () => {
    it('should do nothing when rulerMode is false', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const getGrid = createMockGetGrid(1, 1);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: false, rulerStart: null, rulerEnd: null, getGridFromEvent: getGrid, svgRef }
        );
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(result.current.rulerStart).toBeNull();
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: () => null, svgRef }
        );
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(result.current.rulerStart).toBeNull();
    });

    it('should not capture pointer when svgRef.current is null', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = { current: null };

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(1, 1), svgRef }
        );
      });

      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 1 });
    });

    it('should set rulerStart on first click with Math.floor rounding', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(1.9, 2.1), svgRef }
        );
      });

      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('should set rulerEnd on second click', () => {
      const { result } = hookFactory();
      const event1 = createMockEvent();
      const event2 = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event1,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(1.5, 2.7), svgRef }
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          event2,
          { rulerMode: true, rulerStart: result.current.rulerStart, rulerEnd: null, getGridFromEvent: createMockGetGrid(5.3, 6.8), svgRef }
        );
      });

      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
      expect(result.current.rulerEnd).toEqual({ gridX: 5, gridY: 6 });
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should reset and start new ruler on third click', () => {
      const { result } = hookFactory();
      const event1 = createMockEvent();
      const event2 = createMockEvent();
      const event3 = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event1,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(1.5, 2.7), svgRef }
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          event2,
          { rulerMode: true, rulerStart: result.current.rulerStart, rulerEnd: null, getGridFromEvent: createMockGetGrid(5.3, 6.8), svgRef }
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          event3,
          { rulerMode: true, rulerStart: result.current.rulerStart, rulerEnd: result.current.rulerEnd, getGridFromEvent: createMockGetGrid(10.1, 11.9), svgRef }
        );
      });

      expect(result.current.rulerStart).toEqual({ gridX: 10, gridY: 11 });
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should use the event pointerId for pointer capture', () => {
      const { result } = hookFactory();
      const event = createMockEvent(42);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(1, 1), svgRef }
        );
      });

      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should floor negative coordinates correctly', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerDown(
          event,
          { rulerMode: true, rulerStart: null, rulerEnd: null, getGridFromEvent: createMockGetGrid(-1.2, -3.8), svgRef }
        );
      });

      expect(result.current.rulerStart).toEqual({ gridX: -2, gridY: -4 });
    });
  });

  describe('handleRulerPointerMove', () => {
    it('should do nothing when rulerMode is false', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          false,
          { gridX: 1, gridY: 1 },
          null,
          createMockGetGrid(3, 4)
        );
      });

      expect(result.current.rulerPreview).toBeNull();
    });

    it('should do nothing when rulerStart is null', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          null,
          null,
          createMockGetGrid(3, 4)
        );
      });

      expect(result.current.rulerPreview).toBeNull();
    });

    it('should do nothing when rulerEnd is already set', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          { gridX: 1, gridY: 1 },
          { gridX: 2, gridY: 2 },
          createMockGetGrid(3, 4)
        );
      });

      expect(result.current.rulerPreview).toBeNull();
    });

    it('should update rulerPreview with Math.floor rounding', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          { gridX: 1, gridY: 1 },
          null,
          createMockGetGrid(5.9, 6.1)
        );
      });

      expect(result.current.rulerPreview).toEqual({ gridX: 5, gridY: 6 });
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          { gridX: 1, gridY: 1 },
          null,
          () => null
        );
      });

      expect(result.current.rulerPreview).toBeNull();
    });

    it('should not modify rulerEnd when updating preview', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          { gridX: 1, gridY: 1 },
          null,
          createMockGetGrid(5.9, 6.1)
        );
      });

      expect(result.current.rulerEnd).toBeNull();
    });

    it('should floor negative preview coordinates correctly', () => {
      const { result } = hookFactory();

      act(() => {
        result.current.handleRulerPointerMove(
          createMockEvent(),
          true,
          { gridX: -1, gridY: -1 },
          null,
          createMockGetGrid(-4.2, -0.8)
        );
      });

      expect(result.current.rulerPreview).toEqual({ gridX: -5, gridY: -1 });
    });
  });

  describe('handleRulerPointerUp', () => {
    it('should do nothing when rulerMode is false', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerUp(event, false, svgRef);
      });

      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('should release pointer capture on svg element', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerUp(event, true, svgRef);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should not throw when svgRef.current is null', () => {
      const { result } = hookFactory();
      const event = createMockEvent();
      const svgRef = { current: null };

      act(() => {
        result.current.handleRulerPointerUp(event, true, svgRef);
      });

      // Should not throw
      expect(svgRef.current).toBeNull();
    });

    it('should use the event pointerId for release', () => {
      const { result } = hookFactory();
      const event = createMockEvent(99);
      const svgRef = createMockSvgRef();

      act(() => {
        result.current.handleRulerPointerUp(event, true, svgRef);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(99);
    });
  });
});
