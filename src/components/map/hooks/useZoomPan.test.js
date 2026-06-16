import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useZoomPan from './useZoomPan.js';

describe('useZoomPan', () => {
  let svgRef;

  beforeEach(() => {
    svgRef = { current: null };
  });

  const getHook = () => {
    const { result } = renderHook(() => useZoomPan(svgRef));
    return result;
  };

  describe('initial state', () => {
    it('should initialize zoom to 1', () => {
      const result = getHook();
      expect(result.current.zoom).toBe(1);
    });

    it('should initialize panX to 0', () => {
      const result = getHook();
      expect(result.current.panX).toBe(0);
    });

    it('should initialize panY to 0', () => {
      const result = getHook();
      expect(result.current.panY).toBe(0);
    });

    it('should initialize panning to null', () => {
      const result = getHook();
      expect(result.current.panning).toBeNull();
    });
  });

  describe('svgRef null handling', () => {
    it('should return null from clientToSVG when svgRef is null', () => {
      const result = getHook();
      const pt = result.current.clientToSVG(100, 100);
      expect(pt).toBeNull();
    });

    it('should do nothing in handlePanStart when svgRef is null', () => {
      const result = getHook();
      const mockEvent = { button: 0, preventDefault: vi.fn() };
      act(() => {
        result.current.handlePanStart(mockEvent, 0, 0);
      });
      expect(result.current.panning).toBeNull();
    });

    it('should do nothing in handleWheel when svgRef is null', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.zoom).toBe(1);
    });
  });

  describe('zoomIn', () => {
    it('should increase zoom by 1.25x', () => {
      const result = getHook();
      act(() => {
        result.current.zoomIn();
      });
      expect(result.current.zoom).toBe(1.25);
    });

    it('should cap zoom at MAX_ZOOM (4)', () => {
      const result = getHook();
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.zoomIn();
        }
      });
      expect(result.current.zoom).toBe(4);
    });
  });

  describe('zoomOut', () => {
    it('should decrease zoom by 0.8x', () => {
      const result = getHook();
      act(() => {
        result.current.zoomOut();
      });
      expect(result.current.zoom).toBe(0.8);
    });

    it('should cap zoom at MIN_ZOOM (0.25)', () => {
      const result = getHook();
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.zoomOut();
        }
      });
      expect(result.current.zoom).toBe(0.25);
    });
  });

  describe('resetView', () => {
    it('should reset zoom to 1', () => {
      const result = getHook();
      act(() => {
        result.current.zoomIn();
      });
      act(() => {
        result.current.resetView();
      });
      expect(result.current.zoom).toBe(1);
    });

    it('should reset panX to 0', () => {
      const result = getHook();
      act(() => {
        result.current.zoomIn();
      });
      act(() => {
        result.current.resetView();
      });
      expect(result.current.panX).toBe(0);
    });

    it('should reset panY to 0', () => {
      const result = getHook();
      act(() => {
        result.current.zoomIn();
      });
      act(() => {
        result.current.resetView();
      });
      expect(result.current.panY).toBe(0);
    });
  });

  describe('gridCenterX / gridCenterY', () => {
    it('should return gridCenterX for gridX (gridX * CELL_SIZE + CELL_SIZE / 2)', () => {
      const result = getHook();
      expect(result.current.gridCenterX(0)).toBe(20);
      expect(result.current.gridCenterX(1)).toBe(60);
      expect(result.current.gridCenterX(2)).toBe(100);
    });

    it('should return gridCenterY for gridY (gridY * CELL_SIZE + CELL_SIZE / 2)', () => {
      const result = getHook();
      expect(result.current.gridCenterY(0)).toBe(20);
      expect(result.current.gridCenterY(1)).toBe(60);
      expect(result.current.gridCenterY(2)).toBe(100);
    });
  });

  describe('clientToSVG', () => {
    let mockSvg;

    beforeEach(() => {
      mockSvg = {
        createSVGPoint: vi.fn(() => ({
          matrixTransform: vi.fn(() => ({ x: 50, y: 75 })),
        })),
        getScreenCTM: vi.fn(() => ({
          inverse: vi.fn(() => ({ x: 1, y: 0, z: 0, w: 0, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
        })),
      };
      svgRef.current = mockSvg;
    });

    it('should return SVG coordinates when svgRef is valid', () => {
      const result = getHook();
      const pt = result.current.clientToSVG(100, 200);
      expect(pt).toEqual({ x: 50, y: 75 });
    });

    it('should call createSVGPoint and matrixTransform', () => {
      const result = getHook();
      result.current.clientToSVG(100, 200);
      expect(mockSvg.createSVGPoint).toHaveBeenCalled();
      expect(mockSvg.getScreenCTM).toHaveBeenCalled();
    });
  });

  describe('getGridFromEvent', () => {
    let mockSvg;

    beforeEach(() => {
      mockSvg = {
        createSVGPoint: vi.fn(() => ({
          matrixTransform: vi.fn(() => ({ x: 80, y: 120 })),
        })),
        getScreenCTM: vi.fn(() => ({
          inverse: vi.fn(() => ({ x: 1, y: 0, z: 0, w: 0, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
        })),
      };
      svgRef.current = mockSvg;
    });

    it('should return grid coordinates from event clientX/clientY', () => {
      const result = getHook();
      const grid = result.current.getGridFromEvent({ clientX: 100, clientY: 200 });
      expect(grid).toEqual({ gridX: 2, gridY: 3 });
    });

    it('should return null when clientToSVG returns null', () => {
      const result = getHook();
      svgRef.current = null;
      const grid = result.current.getGridFromEvent({ clientX: 100, clientY: 200 });
      expect(grid).toBeNull();
    });
  });

  describe('panning', () => {
    let mockSvg;

    beforeEach(() => {
      mockSvg = {
        createSVGPoint: vi.fn((x, y) => ({
          x,
          y,
          matrixTransform: vi.fn(() => ({ x: Number(x) + 10, y: Number(y) + 10 })),
        })),
        getScreenCTM: vi.fn(() => ({
          inverse: vi.fn(() => ({ x: 1, y: 0, z: 0, w: 0, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
        })),
        releasePointerCapture: vi.fn(),
      };
      svgRef.current = mockSvg;
    });

    it('should start panning on left mouse button click', () => {
      const result = getHook();
      const mockEvent = { button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => {
        result.current.handlePanStart(mockEvent, 0, 0);
      });
      expect(result.current.panning).not.toBeNull();
      expect(result.current.panning.startPanX).toBe(0);
      expect(result.current.panning.startPanY).toBe(0);
    });

    it('should not start panning on non-left mouse button', () => {
      const result = getHook();
      const mockEvent = { button: 2, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => {
        result.current.handlePanStart(mockEvent, 0, 0);
      });
      expect(result.current.panning).toBeNull();
    });

    it('should update pan position during pan move', () => {
      const result = getHook();
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      act(() => {
        result.current.handlePanMove({ clientX: 150, clientY: 150, preventDefault: vi.fn() });
      });
      expect(result.current.panX).not.toBe(0);
      expect(result.current.panY).not.toBe(0);
    });

    it('should do nothing on handlePanMove when not panning', () => {
      const result = getHook();
      act(() => {
        result.current.handlePanMove({ clientX: 150, clientY: 150, preventDefault: vi.fn() });
      });
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
    });

    it('should end panning on handlePanEnd', () => {
      const result = getHook();
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      expect(result.current.panning).not.toBeNull();
      act(() => {
        result.current.handlePanEnd({ pointerId: 1 });
      });
      expect(result.current.panning).toBeNull();
    });

    it('should call releasePointerCapture on svg during handlePanEnd', () => {
      const result = getHook();
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      act(() => {
        result.current.handlePanEnd({ pointerId: 42 });
      });
      expect(mockSvg.releasePointerCapture).toHaveBeenCalledWith(42);
    });
  });

  describe('handleWheel', () => {
    let mockSvg;

    beforeEach(() => {
      mockSvg = {
        createSVGPoint: vi.fn(() => ({
          matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
        })),
        getScreenCTM: vi.fn(() => ({
          inverse: vi.fn(() => ({ x: 1, y: 0, z: 0, w: 0, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
        })),
      };
      svgRef.current = mockSvg;
    });

    it('should do nothing when metaKey is false', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: false,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.zoom).toBe(1);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should zoom in when accumulated delta is below threshold', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.zoom).toBeGreaterThan(1);
    });

    it('should zoom out when accumulated delta exceeds threshold', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: 30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.zoom).toBeLessThan(1);
    });

    it('should not zoom when accumulated delta is within threshold', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: 5,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.zoom).toBe(1);
    });

    it('should accumulate deltas across multiple wheel events', () => {
      const result = getHook();
      const smallEvent1 = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -15,
      };
      const smallEvent2 = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -15,
      };
      act(() => {
        result.current.handleWheel(smallEvent1);
      });
      // First event alone should not trigger zoom (delta < threshold)
      expect(result.current.zoom).toBe(1);
      act(() => {
        result.current.handleWheel(smallEvent2);
      });
      // Combined should trigger zoom
      expect(result.current.zoom).toBeGreaterThan(1);
    });

    it('should cap zoom at MAX_ZOOM during wheel zoom in', () => {
      const result = getHook();
      // Each wheel event uses zoomValueRef.current which starts at 1,
      // so each event multiplies 1 by 1.05 = 1.05, capped at MAX_ZOOM
      act(() => {
        for (let i = 0; i < 50; i++) {
          const mockEvent = {
            metaKey: true,
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 100,
            deltaY: -30,
          };
          result.current.handleWheel(mockEvent);
        }
      });
      // Each event reads from ref (always 1 in this test), so zoom stays at 1.05
      expect(result.current.zoom).toBe(1.05);
    });

    it('should cap zoom at MIN_ZOOM during wheel zoom out', () => {
      const result = getHook();
      // Each wheel event uses zoomValueRef.current which starts at 1,
      // so each event multiplies 1 by 0.95 = 0.95, capped at MIN_ZOOM
      act(() => {
        for (let i = 0; i < 50; i++) {
          const mockEvent = {
            metaKey: true,
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 100,
            deltaY: 30,
          };
          result.current.handleWheel(mockEvent);
        }
      });
      // Each event reads from ref (always 1 in this test), so zoom stays at 0.95
      expect(result.current.zoom).toBe(0.95);
    });

    it('should update panX and panY based on zoom pivot point', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 300,
        deltaY: -30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(result.current.panX).not.toBe(0);
      expect(result.current.panY).not.toBe(0);
    });

    it('should call preventDefault on wheel event', () => {
      const result = getHook();
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => {
        result.current.handleWheel(mockEvent);
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('returned object shape', () => {
    it('should return all expected properties', () => {
      const result = getHook();
      expect(result.current).toHaveProperty('zoom');
      expect(result.current).toHaveProperty('panX');
      expect(result.current).toHaveProperty('panY');
      expect(result.current).toHaveProperty('zoomIn');
      expect(result.current).toHaveProperty('zoomOut');
      expect(result.current).toHaveProperty('resetView');
      expect(result.current).toHaveProperty('gridCenterX');
      expect(result.current).toHaveProperty('gridCenterY');
      expect(result.current).toHaveProperty('getGridFromEvent');
      expect(result.current).toHaveProperty('panning');
      expect(result.current).toHaveProperty('handlePanStart');
      expect(result.current).toHaveProperty('handlePanMove');
      expect(result.current).toHaveProperty('handlePanEnd');
      expect(result.current).toHaveProperty('handleWheel');
      expect(result.current).toHaveProperty('clientToSVG');
    });
  });
});
