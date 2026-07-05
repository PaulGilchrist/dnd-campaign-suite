// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
    it('should initialize zoom to 1, pan to 0, and panning to null', () => {
      const result = getHook();
      expect(result.current.zoom).toBe(1);
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
      expect(result.current.panning).toBeNull();
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
    it('should reset zoom, panX, and panY to their initial values', () => {
      const result = getHook();
      act(() => {
        result.current.zoomIn();
      });
      act(() => {
        result.current.resetView();
      });
      expect(result.current.zoom).toBe(1);
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
    });
  });

  describe('gridCenterX / gridCenterY', () => {
    it('should return grid center coordinates for a given grid position', () => {
      const result = getHook();
      expect(result.current.gridCenterX(0)).toBe(20);
      expect(result.current.gridCenterX(1)).toBe(60);
      expect(result.current.gridCenterY(0)).toBe(20);
      expect(result.current.gridCenterY(1)).toBe(60);
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

    it('should return null when svgRef is null', () => {
      svgRef.current = null;
      const result = getHook();
      const pt = result.current.clientToSVG(100, 200);
      expect(pt).toBeNull();
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

    it('should accumulate deltas across multiple wheel events to trigger zoom', () => {
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
      expect(result.current.zoom).toBe(1);
      act(() => {
        result.current.handleWheel(smallEvent2);
      });
      expect(result.current.zoom).toBeGreaterThan(1);
    });
  });
});
