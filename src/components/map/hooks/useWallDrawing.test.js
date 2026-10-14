import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWallDrawing from './useWallDrawing.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_NONE } from '../../../config/mapConfig.js';

describe('useWallDrawing', () => {
  let svgRef;
  let getGridFromEvent;

  beforeEach(() => {
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    getGridFromEvent = vi.fn();
  });

  const createSetMapData = (initialWalls = new Set()) => {
    const walls = new Set(initialWalls);
    const setMapData = vi.fn((fn) => {
      const result = typeof fn === 'function' ? fn({ walls: new Set(walls) }) : fn;
      if (typeof fn === 'function' && result) {
        walls.clear();
        result.walls.forEach((w) => walls.add(w));
      }
      return result;
    });
    return { setMapData, getWalls: () => new Set(walls) };
  };

  const getHook = ({ isLocalhost = true, tool = TOOL_PAINT } = {}) => {
    const { result } = renderHook(() =>
      useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef })
    );
    return result;
  };

  describe('handleGridPointerDown', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook({ tool: TOOL_NONE });
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not add wall if grid is null', () => {
      const result = getHook();
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue(null);

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should add wall key when tool is paint', () => {
      const result = getHook({ tool: TOOL_PAINT });
      const { setMapData, getWalls } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(setMapData).toHaveBeenCalled();
      expect(getWalls()).toContain('2,3');
    });

    it('should delete wall key when tool is erase', () => {
      const result = getHook({ tool: TOOL_ERASE });
      const { setMapData, getWalls } = createSetMapData(['0,0', '1,1']);
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(setMapData).toHaveBeenCalled();
      expect(getWalls()).not.toContain('0,0');
      expect(getWalls()).toContain('1,1');
    });

    it('should preserve existing walls when adding a new one', () => {
      const result = getHook({ tool: TOOL_PAINT });
      const { setMapData, getWalls } = createSetMapData(['5,5']);
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(getWalls()).toContain('5,5');
      expect(getWalls()).toContain('2,3');
    });

    it('should preserve existing walls when deleting one', () => {
      const result = getHook({ tool: TOOL_ERASE });
      const { setMapData, getWalls } = createSetMapData(['0,0', '3,3']);
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(getWalls()).not.toContain('0,0');
      expect(getWalls()).toContain('3,3');
    });

    it('should be idempotent when painting an existing wall', () => {
      const result = getHook({ tool: TOOL_PAINT });
      const { setMapData, getWalls } = createSetMapData(['2,3']);
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(getWalls()).toContain('2,3');
      expect(getWalls().size).toBe(1);
    });

    it('should be idempotent when erasing a non-existent wall', () => {
      const result = getHook({ tool: TOOL_ERASE });
      const { setMapData, getWalls } = createSetMapData(['1,1']);
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(getWalls()).toContain('1,1');
      expect(getWalls().size).toBe(1);
    });

    it('should set painting state on pointer down', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });

      expect(result.current.painting).toEqual(mockGrid);
    });

    it('should capture pointer on svg element', () => {
      const result = getHook();
      const mockEvent = new PointerEvent('down', { pointerId: 42 });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(mockEvent, setMapData);
      });

      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should call preventDefault on the event', () => {
      const result = getHook();
      const mockEvent = new PointerEvent('down', { pointerId: 1 });
      const preventDefaultSpy = vi.fn();
      mockEvent.preventDefault = preventDefaultSpy;
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(mockEvent, setMapData);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not capture pointer when svgRef.current is null', () => {
      svgRef.current = null;
      const result = getHook();
      const mockEvent = new PointerEvent('down', { pointerId: 1 });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(mockEvent, setMapData);
      });

      expect(svgRef.current).toBeNull();
    });
  });

  describe('handleGridPointerMove', () => {
    it('should not act when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          { gridX: 1, gridY: 1 },
          TOOL_PAINT
        );
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when painting is null', () => {
      const result = getHook();
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          null,
          TOOL_PAINT
        );
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not act when tool is not paint or erase', () => {
      const result = getHook();
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          { gridX: 1, gridY: 1 },
          TOOL_NONE
        );
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not add wall if grid is null', () => {
      const result = getHook();
      const { setMapData } = createSetMapData();
      getGridFromEvent.mockReturnValue(null);

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          { gridX: 1, gridY: 1 },
          TOOL_PAINT
        );
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should add wall key when tool is paint', () => {
      const result = getHook({ tool: TOOL_PAINT });
      const { setMapData, getWalls } = createSetMapData(['0,0']);
      getGridFromEvent.mockReturnValue({ gridX: 5.7, gridY: 6.2 });

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          { gridX: 1, gridY: 1 },
          TOOL_PAINT
        );
      });

      expect(getWalls()).toContain('5,6');
      expect(getWalls()).toContain('0,0');
    });

    it('should delete wall key when tool is erase', () => {
      const result = getHook({ tool: TOOL_ERASE });
      const { setMapData, getWalls } = createSetMapData(['0,0', '1,1']);
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });

      act(() => {
        result.current.handleGridPointerMove(
          new PointerEvent('move', { pointerId: 1 }),
          setMapData,
          { gridX: 1, gridY: 1 },
          TOOL_ERASE
        );
      });

      expect(getWalls()).not.toContain('0,0');
      expect(getWalls()).toContain('1,1');
    });

    it('should call preventDefault on the event', () => {
      const result = getHook();
      const mockEvent = new PointerEvent('move', { pointerId: 1 });
      const preventDefaultSpy = vi.fn();
      mockEvent.preventDefault = preventDefaultSpy;
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 3.5 });
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerMove(mockEvent, setMapData, { gridX: 1, gridY: 1 }, TOOL_PAINT);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('handleGridPointerUp', () => {
    it('should clear painting state', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerUp(new PointerEvent('up', { pointerId: 1 }));
      });

      expect(result.current.painting).toBeNull();
    });

    it('should release pointer capture on svg', () => {
      const result = getHook();
      const mockEvent = new PointerEvent('up', { pointerId: 42 });

      act(() => {
        result.current.handleGridPointerUp(mockEvent);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not throw when svgRef.current is null', () => {
      svgRef.current = null;
      const result = getHook();

      expect(() => {
        act(() => {
          result.current.handleGridPointerUp(new PointerEvent('up', { pointerId: 1 }));
        });
      }).not.toThrow();

      expect(result.current.painting).toBeNull();
    });
  });

  describe('handleGridPointerLeave', () => {
    it('should clear painting state', () => {
      const result = getHook();
      const mockGrid = { gridX: 2.5, gridY: 3.5 };
      getGridFromEvent.mockReturnValue(mockGrid);
      const { setMapData } = createSetMapData();

      act(() => {
        result.current.handleGridPointerDown(new PointerEvent('down', { pointerId: 1 }), setMapData);
      });
      expect(result.current.painting).toEqual(mockGrid);

      act(() => {
        result.current.handleGridPointerLeave(new PointerEvent('leave', { pointerId: 1 }));
      });

      expect(result.current.painting).toBeNull();
    });

    it('should release pointer capture on svg', () => {
      const result = getHook();
      const mockEvent = new PointerEvent('leave', { pointerId: 42 });

      act(() => {
        result.current.handleGridPointerLeave(mockEvent);
      });

      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not throw when svgRef.current is null', () => {
      svgRef.current = null;
      const result = getHook();

      expect(() => {
        act(() => {
          result.current.handleGridPointerLeave(new PointerEvent('leave', { pointerId: 1 }));
        });
      }).not.toThrow();

      expect(result.current.painting).toBeNull();
    });
  });

});
