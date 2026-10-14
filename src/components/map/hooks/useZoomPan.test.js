import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useZoomPan from './useZoomPan.js';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

describe('useZoomPan', () => {
  describe('initial state', () => {
    it('should initialize zoom to 1, pan to 0, and panning to null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.zoom).toBe(1);
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
      expect(result.current.panning).toBeNull();
    });
  });

  describe('zoomIn', () => {
    it('should increase zoom by 1.25x', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => { result.current.zoomIn(); });
      expect(result.current.zoom).toBe(1.25);
    });

    it('should cap zoom at MAX_ZOOM (4)', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.zoomIn();
        }
      });
      expect(result.current.zoom).toBe(MAX_ZOOM);
    });
  });

  describe('zoomOut', () => {
    it('should decrease zoom by 0.8x', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => { result.current.zoomOut(); });
      expect(result.current.zoom).toBe(0.8);
    });

    it('should cap zoom at MIN_ZOOM (0.25)', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.zoomOut();
        }
      });
      expect(result.current.zoom).toBe(MIN_ZOOM);
    });

    it('should stay at MIN_ZOOM when already at minimum', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.zoomOut();
        }
      });
      const before = result.current.zoom;
      act(() => { result.current.zoomOut(); });
      expect(result.current.zoom).toBe(before);
    });
  });

  describe('resetView', () => {
    it('should reset zoom, panX, and panY to their initial values', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => { result.current.zoomIn(); });
      expect(result.current.zoom).toBe(1.25);
      act(() => { result.current.resetView(); });
      expect(result.current.zoom).toBe(1);
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
    });

    it('should reset pan values even without prior pan', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => { result.current.zoomIn(); });
      act(() => { result.current.resetView(); });
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
    });
  });

  describe('gridCenterX / gridCenterY', () => {
    it('should return grid center coordinates for a given grid position', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.gridCenterX(0)).toBe(20);
      expect(result.current.gridCenterX(1)).toBe(60);
      expect(result.current.gridCenterY(0)).toBe(20);
      expect(result.current.gridCenterY(1)).toBe(60);
    });

    it('should compute correct centers for negative grid positions', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.gridCenterX(-1)).toBe(-20);
      expect(result.current.gridCenterY(-1)).toBe(-20);
    });

    it('should scale linearly with grid position', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.gridCenterX(5)).toBe(220);
      expect(result.current.gridCenterY(5)).toBe(220);
    });
  });

  describe('clientToSVG', () => {
    const createMockSvg = (overrides = {}) => ({
      createSVGPoint: vi.fn(() => ({
        matrixTransform: vi.fn(() => ({ x: 50, y: 75 })),
      })),
      getScreenCTM: vi.fn(() => ({
        inverse: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
      })),
      ...overrides,
    });

    it('should return SVG coordinates when svgRef is valid', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const pt = result.current.clientToSVG(100, 200);
      expect(pt).toEqual({ x: 50, y: 75 });
      expect(mockSvg.createSVGPoint).toHaveBeenCalledTimes(1);
    });

    it('should return null when svgRef is null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.clientToSVG(100, 200)).toBeNull();
    });

    it('should return null when getScreenCTM returns null', () => {
      const mockSvg = {
        createSVGPoint: vi.fn(() => ({
          matrixTransform: vi.fn(() => ({ x: 50, y: 75 })),
        })),
        getScreenCTM: vi.fn(() => null),
      };
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      expect(result.current.clientToSVG(100, 200)).toBeNull();
    });
  });

  describe('getGridFromEvent', () => {
    const createMockSvg = () => ({
      createSVGPoint: vi.fn(() => ({
        matrixTransform: vi.fn(() => ({ x: 80, y: 120 })),
      })),
      getScreenCTM: vi.fn(() => ({
        inverse: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
      })),
    });

    it('should return grid coordinates from event clientX/clientY', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const grid = result.current.getGridFromEvent({ clientX: 100, clientY: 200 });
      expect(grid).toEqual({ gridX: 2, gridY: 3 });
    });

    it('should return null when clientToSVG returns null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const grid = result.current.getGridFromEvent({ clientX: 100, clientY: 200 });
      expect(grid).toBeNull();
    });
  });

  describe('panning', () => {
    const createMockSvg = () => ({
      createSVGPoint: vi.fn((x, y) => ({
        x,
        y,
        matrixTransform: vi.fn(() => ({ x: Number(x) + 10, y: Number(y) + 10 })),
      })),
      getScreenCTM: vi.fn(() => ({
        inverse: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
      })),
      releasePointerCapture: vi.fn(),
    });

    it('should start panning on left mouse button click', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = { button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => { result.current.handlePanStart(mockEvent, 0, 0); });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.panning).not.toBeNull();
      expect(result.current.panning.startPanX).toBe(0);
      expect(result.current.panning.startPanY).toBe(0);
    });

    it('should not start panning on non-left mouse button', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = { button: 2, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => { result.current.handlePanStart(mockEvent, 0, 0); });
      expect(result.current.panning).toBeNull();
    });

    it('should not call preventDefault on non-left mouse button', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = { button: 2, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => { result.current.handlePanStart(mockEvent, 0, 0); });
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should not start panning when svgRef is null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = { button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() };
      act(() => { result.current.handlePanStart(mockEvent, 0, 0); });
      expect(result.current.panning).toBeNull();
    });

    it('should update pan position during pan move', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      act(() => {
        result.current.handlePanMove({ clientX: 150, clientY: 150, preventDefault: vi.fn() });
      });
      expect(result.current.panX).not.toBe(0);
      expect(result.current.panY).not.toBe(0);
    });

    it('should call preventDefault during pan move', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      const moveEvent = { clientX: 150, clientY: 150, preventDefault: vi.fn() };
      act(() => { result.current.handlePanMove(moveEvent); });
      expect(moveEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not change pan when not panning', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        result.current.handlePanMove({ clientX: 150, clientY: 150, preventDefault: vi.fn() });
      });
      expect(result.current.panX).toBe(0);
      expect(result.current.panY).toBe(0);
    });

    it('should end panning on handlePanEnd', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      expect(result.current.panning).not.toBeNull();
      act(() => { result.current.handlePanEnd({ pointerId: 1 }); });
      expect(result.current.panning).toBeNull();
    });

    it('should call releasePointerCapture on svg when ending pan', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => {
        result.current.handlePanStart({ button: 0, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
      });
      act(() => { result.current.handlePanEnd({ pointerId: 1 }); });
      expect(mockSvg.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should not call releasePointerCapture when svgRef is null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      act(() => { result.current.handlePanEnd({ pointerId: 1 }); });
      // Should not throw even when svgRef is null
    });
  });

  describe('handleWheel', () => {
    const createMockSvg = () => ({
      createSVGPoint: vi.fn(() => ({
        matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
      })),
      getScreenCTM: vi.fn(() => ({
        inverse: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
      })),
    });

    it('should do nothing when metaKey is false', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = {
        metaKey: false,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(mockEvent); });
      expect(result.current.zoom).toBe(1);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should do nothing when svgRef is null', () => {
      const svgRef = { current: null };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(mockEvent); });
      expect(result.current.zoom).toBe(1);
    });

    it('should call preventDefault when metaKey is true', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(mockEvent); });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should zoom in when accumulated delta is below threshold', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(mockEvent); });
      expect(result.current.zoom).toBe(1.05);
    });

    it('should zoom out when accumulated delta exceeds threshold', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const mockEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: 30,
      };
      act(() => { result.current.handleWheel(mockEvent); });
      expect(result.current.zoom).toBe(0.95);
    });

    it('should accumulate deltas across multiple wheel events to trigger zoom', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const smallEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -15,
      };
      act(() => { result.current.handleWheel(smallEvent); });
      expect(result.current.zoom).toBe(1);
      act(() => { result.current.handleWheel(smallEvent); });
      expect(result.current.zoom).toBe(1.05);
    });

    it('should not zoom when accumulated delta is below threshold', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const smallEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -10,
      };
      act(() => { result.current.handleWheel(smallEvent); });
      expect(result.current.zoom).toBe(1);
    });

    it('should clamp zoom at MAX_ZOOM when zooming in', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const zoomInEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -500,
      };
      // Each event triggers 1.05x; need ~30 events to reach 4 from 1
      for (let i = 0; i < 30; i++) {
        act(() => { result.current.handleWheel(zoomInEvent); });
      }
      expect(result.current.zoom).toBe(MAX_ZOOM);
    });

    it('should clamp zoom at MIN_ZOOM when zooming out', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const zoomOutEvent = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: 500,
      };
      // Each event triggers 0.95x; need ~51 events to reach 0.25 from 1
      for (let i = 0; i < 55; i++) {
        act(() => { result.current.handleWheel(zoomOutEvent); });
      }
      expect(result.current.zoom).toBe(MIN_ZOOM);
    });

    it('should compound zoom across consecutive gestures', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const event = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(event); });
      expect(result.current.zoom).toBe(1.05);
      act(() => { result.current.handleWheel(event); });
      expect(result.current.zoom).toBeCloseTo(1.05 * 1.05, 10);
    });

    it('should reset accumulated delta after triggering zoom', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const event = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      // First event triggers zoom
      act(() => { result.current.handleWheel(event); });
      expect(result.current.zoom).toBe(1.05);
      // Second event should start accumulating from zero again
      act(() => { result.current.handleWheel(event); });
      expect(result.current.zoom).toBeCloseTo(1.05 * 1.05, 10);
    });

    it('should update panX and panY when zooming with cursor anchoring', () => {
      const mockSvg = createMockSvg();
      const svgRef = { current: mockSvg };
      const { result } = renderHook(() => useZoomPan(svgRef));
      const event = {
        metaKey: true,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        deltaY: -30,
      };
      act(() => { result.current.handleWheel(event); });
      expect(result.current.zoom).toBe(1.05);
      expect(result.current.panX).not.toBe(0);
      expect(result.current.panY).not.toBe(0);
    });
  });
});
