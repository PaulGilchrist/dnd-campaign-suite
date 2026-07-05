// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useWallDrawing from './useWallDrawing.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_NONE } from '../../../config/mapConfig.js';

describe('useWallDrawing', () => {
  let svgRef;
  let getGridFromEvent;
  let setMapData;

  const createMocks = () => {
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    getGridFromEvent = vi.fn();
    setMapData = vi.fn((fn) => {
      const prev = { walls: new Set(['0,0', '1,1']) };
      if (typeof fn === 'function') return fn(prev);
      return fn;
    });
  };

  beforeEach(createMocks);

  const getHook = ({ isLocalhost = true, tool = TOOL_PAINT } = {}) => {
    const { result } = renderHook(() =>
      useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef })
    );
    return result;
  };

  const applySetMapData = (callArg, initialWalls = new Set(['0,0', '1,1'])) => {
    const prev = { walls: initialWalls };
    return callArg(prev);
  };

  describe('handleGridPointerDown', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook({ tool: TOOL_NONE });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not add wall if grid is null', () => {
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
      const updated = applySetMapData(callArg);
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
      const updated = applySetMapData(callArg);
      expect(updated.walls.has('0,0')).toBe(false);
    });

    it('should set painting state on pointer down', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);

      act(() => {
        result.current.handleGridPointerDown(new Event('down'), setMapData);
      });

      expect(result.current.painting).toEqual(mockGrid);
    });
  });

  describe('handleGridPointerMove', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when painting is null', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, null, TOOL_PAINT);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(new Event('move'), setMapData, { gridX: 1, gridY: 1 }, TOOL_NONE);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not add wall if grid is null', () => {
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
      const updated = applySetMapData(callArg, new Set(['0,0']));
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
      const updated = applySetMapData(callArg);
      expect(updated.walls.has('0,0')).toBe(false);
    });
  });

  describe('handleGridPointerUp', () => {
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
});
