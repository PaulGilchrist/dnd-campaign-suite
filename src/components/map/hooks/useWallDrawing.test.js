import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWallDrawing from './useWallDrawing.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_NONE } from '../../../config/mapConfig.js';

describe('useWallDrawing', () => {
  let svgRef;
  let getGridFromEvent;
  let setMapData;

  beforeEach(() => {
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    getGridFromEvent = vi.fn();
    setMapData = vi.fn((fn) => {
      const prev = { walls: new Set(['0,0', '1,1']) };
      if (typeof fn === 'function') return fn(prev);
      return fn;
    });
  });

  const getHook = ({ isLocalhost = true, tool = TOOL_PAINT } = {}) => {
    const { result } = renderHook(() =>
      useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef })
    );
    return result;
  };

  describe('painting state', () => {
    it('should initialize painting as null', () => {
      const result = getHook();
      expect(result.current.painting).toBeNull();
    });

    it('should set painting on pointer down', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(result.current.painting).toEqual(mockGrid);
    });

    it('should clear painting on pointer up', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerUp(new Event('up'));
      });

      expect(result.current.painting).toBeNull();
    });

    it('should clear painting on pointer leave', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerLeave(new Event('leave'));
      });

      expect(result.current.painting).toBeNull();
    });
  });

  describe('handleGridPointerDown', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
      expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook({ tool: TOOL_NONE });
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should prevent default event', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const event = { preventDefault: vi.fn() };

      act(() => {
        result.current.handleGridPointerDown(event, setMapData);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should capture pointer on svg', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const event = { preventDefault: vi.fn(), pointerId: 42 };

      act(() => {
        result.current.handleGridPointerDown(event, setMapData);
      });

      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not capture pointer if svgRef is null', () => {
      const nullSvgRef = { current: null };
      const result = renderHook(() =>
        useWallDrawing({ isLocalhost: true, tool: TOOL_PAINT, getGridFromEvent, svgRef: nullSvgRef })
      ).result;
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const event = { preventDefault: vi.fn(), pointerId: 42 };

      act(() => {
        result.current.handleGridPointerDown(event, setMapData);
      });

      expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
    });

    it('should not set map data if grid is null', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue(null);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should add wall key when tool is paint', () => {
      const result = getHook({ tool: TOOL_PAINT });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const prev = { walls: new Set(['0,0', '1,1']) };
      const updated = callArg(prev);
      expect(updated.walls.has('2,3')).toBe(true);
    });

    it('should delete wall key when tool is erase', () => {
      const result = getHook({ tool: TOOL_ERASE });
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const prev = { walls: new Set(['0,0', '1,1']) };
      const updated = callArg(prev);
      expect(updated.walls.has('0,0')).toBe(false);
    });
  });

  describe('handleGridPointerMove', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when painting is null', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, null, TOOL_PAINT);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_NONE);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should prevent default event', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const event = { preventDefault: vi.fn() };

      act(() => {
        result.current.handleGridPointerMove(event, setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not set map data if grid is null', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue(null);

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should add wall key when tool is paint', () => {
      const result = getHook({ tool: TOOL_PAINT });
      getGridFromEvent.mockReturnValue({ gridX: 5.7, gridY: 6.2 });

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const prev = { walls: new Set(['0,0']) };
      const updated = callArg(prev);
      expect(updated.walls.has('5,6')).toBe(true);
    });

    it('should delete wall key when tool is erase', () => {
      const result = getHook({ tool: TOOL_ERASE });
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_ERASE);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const prev = { walls: new Set(['0,0', '1,1']) };
      const updated = callArg(prev);
      expect(updated.walls.has('0,0')).toBe(false);
    });
  });

  describe('handleGridPointerUp', () => {
    it('should release pointer capture on svg', () => {
      const result = getHook();
      const event = { pointerId: 42 };

      act(() => {
        result.current.handleGridPointerUp(event);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not release pointer capture if svgRef is null', () => {
      const nullSvgRef = { current: null };
      const result = renderHook(() =>
        useWallDrawing({ isLocalhost: true, tool: TOOL_PAINT, getGridFromEvent, svgRef: nullSvgRef })
      ).result;

      act(() => {
        result.current.handleGridPointerUp(new Event('up'));
      });

      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('should clear painting state', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerUp(new Event('up'));
      });

      expect(result.current.painting).toBeNull();
    });
  });

  describe('handleGridPointerLeave', () => {
    it('should release pointer capture on svg', () => {
      const result = getHook();
      const event = { pointerId: 42 };

      act(() => {
        result.current.handleGridPointerLeave(event);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not release pointer capture if svgRef is null', () => {
      const nullSvgRef = { current: null };
      const result = renderHook(() =>
        useWallDrawing({ isLocalhost: true, tool: TOOL_PAINT, getGridFromEvent, svgRef: nullSvgRef })
      ).result;

      act(() => {
        result.current.handleGridPointerLeave(new Event('leave'));
      });

      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('should clear painting state', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerLeave(new Event('leave'));
      });

      expect(result.current.painting).toBeNull();
    });
  });

  describe('returned object', () => {
    it('should return painting state', () => {
      const result = getHook();
      expect(result.current.painting).toBeDefined();
    });

    it('should return handleGridPointerDown function', () => {
      const result = getHook();
      expect(typeof result.current.handleGridPointerDown).toBe('function');
    });

    it('should return handleGridPointerMove function', () => {
      const result = getHook();
      expect(typeof result.current.handleGridPointerMove).toBe('function');
    });

    it('should return handleGridPointerUp function', () => {
      const result = getHook();
      expect(typeof result.current.handleGridPointerUp).toBe('function');
    });

    it('should return handleGridPointerLeave function', () => {
      const result = getHook();
      expect(typeof result.current.handleGridPointerLeave).toBe('function');
    });
  });
});
