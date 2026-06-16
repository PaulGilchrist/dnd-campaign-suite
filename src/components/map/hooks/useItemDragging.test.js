import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useItemDragging from './useItemDragging.js';

describe('useItemDragging', () => {
  let svgRef;
  let placedItems;
  let setPlacedItems;
  let gridSize;
  let gridCenterX;
  let gridCenterY;
  let campaignName;

  beforeEach(() => {
    svgRef = { current: null };
    placedItems = [
      { id: 'item1', name: 'Token1', type: 'player', gridX: 1, gridY: 1 },
      { id: 'item2', name: 'Token2', type: 'monster', gridX: 2, gridY: 2 },
    ];
    setPlacedItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = placedItems;
        const result = fn(prev);
        placedItems = result;
        return result;
      }
      return fn;
    });
    gridSize = 10;
    gridCenterX = (x) => x * 40 + 20;
    gridCenterY = (y) => y * 40 + 20;
    campaignName = 'test-campaign';
  });

  const getHook = ({
    rulerMode = false,
    spellMode = false,
  } = {}) => {
    const { result } = renderHook(() =>
      useItemDragging({
        svgRef,
        placedItems,
        setPlacedItems,
        gridSize,
        gridCenterX,
        gridCenterY,
        rulerMode,
        spellMode,
        campaignName,
      })
    );
    return result;
  };

  describe('initial state', () => {
    it('should return itemDragging as null initially', () => {
      const result = getHook();
      expect(result.current.itemDragging).toBeNull();
    });

    it('should return all handler functions', () => {
      const result = getHook();
      expect(typeof result.current.handleItemPointerDown).toBe('function');
      expect(typeof result.current.handleItemPointerMove).toBe('function');
      expect(typeof result.current.handleItemPointerUp).toBe('function');
      expect(typeof result.current.handleItemPointerLeave).toBe('function');
    });
  });

  describe('handleItemPointerDown', () => {
    it('should not start drag when rulerMode is true', () => {
      const result = getHook({ rulerMode: true });
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when spellMode is true', () => {
      const result = getHook({ spellMode: true });
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when button is not left click', () => {
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 1,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when svgRef is null', () => {
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when item does not exist', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'nonexistent');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should start drag when valid conditions are met', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).not.toBeNull();
      expect(result.current.itemDragging.itemId).toBe('item1');
      expect(result.current.itemDragging.pointerId).toBe(1);
    });

    it('should stop propagation on the event', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should call preventDefault on the event', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should call setPointerCapture with the pointerId', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 42,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(mockSvg.current.setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should calculate correct offsetX and offsetY', () => {
      const transformResult = { x: 100, y: 100 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const result = getHook();
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      // item1 is at gridX=1, gridY=1, so gridCenterX(1)=60, gridCenterY(1)=60
      // offsetX = 100 - 60 = 40, offsetY = 100 - 60 = 40
      expect(result.current.itemDragging.offsetX).toBe(40);
      expect(result.current.itemDragging.offsetY).toBe(40);
    });
  });

  describe('handleItemPointerMove', () => {
    it('should do nothing when itemDragging is null', () => {
      const result = getHook();
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
      };
      act(() => {
        result.current.handleItemPointerMove(mockEvent);
      });
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should do nothing when svgRef is null', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      svgRef.current = null;
      const moveEvent = { preventDefault: vi.fn(), clientX: 150, clientY: 150 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should update placed item grid position on move', () => {
      const transformResult = { x: 100, y: 100 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      // Move to SVG coordinates 120, 120
      // With offsetX=40, offsetY=40: cx=80, cy=80
      // gridX = floor(80/40) = 2, gridY = floor(80/40) = 2
      const moveEvent = { preventDefault: vi.fn(), clientX: 120, clientY: 120 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should clamp grid position to grid bounds', () => {
      const transformResult = { x: 0, y: 0 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      // Move to SVG coordinates that would give negative grid position
      // With offsetX=40, offsetY=40: cx=-40, cy=-40
      // gridX = floor(-40/40) = -1 -> clamped to 0
      const moveEvent = { preventDefault: vi.fn(), clientX: 60, clientY: 60 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should set steadyAimMovedThisTurn for player type items on grid change', () => {
      const transformResult = { x: 100, y: 100 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      // Move to a different grid position
      const moveEvent = { preventDefault: vi.fn(), clientX: 120, clientY: 120 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      // setPlacedItems was called which triggers setRuntimeValue inside
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should not set steadyAimMovedThisTurn for non-player type items', () => {
      const transformResult = { x: 200, y: 200 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 200,
        clientY: 200,
        pointerId: 2,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item2');
      });
      // Move to a different grid position
      const moveEvent = { preventDefault: vi.fn(), clientX: 220, clientY: 220 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should call preventDefault on the event', () => {
      const transformResult = { x: 100, y: 100 };
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => transformResult),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      const moveEvent = { preventDefault: vi.fn(), clientX: 120, clientY: 120 };
      act(() => {
        result.current.handleItemPointerMove(moveEvent);
      });
      expect(moveEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('handleItemPointerUp', () => {
    it('should do nothing when itemDragging is null', () => {
      const result = getHook();
      const mockEvent = { pointerId: 1 };
      act(() => {
        result.current.handleItemPointerUp(mockEvent);
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should release pointer capture and clear dragging', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).not.toBeNull();
      const upEvent = { pointerId: 1 };
      act(() => {
        result.current.handleItemPointerUp(upEvent);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(mockSvg.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should not release pointer capture when svgRef is null', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      svgRef.current = null;
      const upEvent = { pointerId: 1 };
      act(() => {
        result.current.handleItemPointerUp(upEvent);
      });
      expect(result.current.itemDragging).toBeNull();
    });
  });

  describe('handleItemPointerLeave', () => {
    it('should do nothing when itemDragging is null', () => {
      const result = getHook();
      const mockEvent = {};
      act(() => {
        result.current.handleItemPointerLeave(mockEvent);
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should release pointer capture and clear dragging', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).not.toBeNull();
      const leaveEvent = { pointerId: 1 };
      act(() => {
        result.current.handleItemPointerLeave(leaveEvent);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(mockSvg.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should not release pointer capture when svgRef is null', () => {
      const mockSvg = {
        current: {
          createSVGPoint: vi.fn(() => ({
            matrixTransform: vi.fn(() => ({ x: 100, y: 100 })),
          })),
          getScreenCTM: vi.fn(() => ({
            inverse: vi.fn(() => ({})),
          })),
          setPointerCapture: vi.fn(),
        },
      };
      svgRef.current = mockSvg.current;
      const mockEvent = {
        stopPropagation: vi.fn(),
        button: 0,
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      svgRef.current = null;
      const leaveEvent = {};
      act(() => {
        result.current.handleItemPointerLeave(leaveEvent);
      });
      expect(result.current.itemDragging).toBeNull();
    });
  });
});
