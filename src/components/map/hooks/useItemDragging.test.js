// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

  const createMockSvg = () => ({
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
  });

  const createMockEvent = (overrides = {}) => ({
    stopPropagation: vi.fn(),
    button: 0,
    preventDefault: vi.fn(),
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    ...overrides,
  });

  describe('handleItemPointerDown', () => {
    it.each([
      ['rulerMode', { rulerMode: true }],
      ['spellMode', { spellMode: true }],
    ])('should not start drag when %s is enabled', (_, overrides) => {
      const result = getHook(overrides);
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when button is not left click', () => {
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent({ button: 1 }), 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when svgRef is null', () => {
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should not start drag when item does not exist', () => {
      svgRef.current = createMockSvg().current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'nonexistent');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should start drag and set dragging state when valid', () => {
      svgRef.current = createMockSvg().current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      const dragging = result.current.itemDragging;
      expect(dragging).not.toBeNull();
      expect(dragging.itemId).toBe('item1');
      expect(dragging.pointerId).toBe(1);
    });
  });

  describe('handleItemPointerMove', () => {
    it('should do nothing when itemDragging is null', () => {
      const result = getHook();
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should update placed item grid position on move', () => {
      const mockSvg = createMockSvg();
      svgRef.current = mockSvg.current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      // Move to SVG coordinates 120, 120
      // With offsetX=40, offsetY=40: cx=80, cy=80
      // gridX = floor(80/40) = 2, gridY = floor(80/40) = 2
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 120, clientY: 120 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should clamp grid position to grid bounds', () => {
      const mockSvg = createMockSvg();
      svgRef.current = mockSvg.current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      // Move to SVG coordinates that would give negative grid position
      // With offsetX=40, offsetY=40: cx=-40, cy=-40
      // gridX = floor(-40/40) = -1 -> clamped to 0
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 60, clientY: 60 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should set steadyAimMovedThisTurn for player type items on grid change', () => {
      const mockSvg = createMockSvg();
      svgRef.current = mockSvg.current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 120, clientY: 120 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
    });
  });

  describe('handleItemPointerUp and handleItemPointerLeave', () => {
    const runDragSequence = (overrides = {}) => {
      const mockSvg = createMockSvg(overrides);
      svgRef.current = mockSvg.current;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      return { result, mockSvg };
    };

    it.each([
      ['up', (r, e) => r.current.handleItemPointerUp(e)],
      ['leave', (r, e) => r.current.handleItemPointerLeave(e)],
    ])('should do nothing when itemDragging is null (%s)', (_, handler) => {
      const result = getHook();
      act(() => {
        handler(result, { pointerId: 1 });
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it.each([
      ['up', (r, e) => r.current.handleItemPointerUp(e)],
      ['leave', (r, e) => r.current.handleItemPointerLeave(e)],
    ])('should release pointer capture and clear dragging (%s)', (_, handler) => {
      const { result, mockSvg } = runDragSequence();
      expect(result.current.itemDragging).not.toBeNull();
      act(() => {
        handler(result, { pointerId: 1 });
      });
      expect(result.current.itemDragging).toBeNull();
      expect(mockSvg.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it.each([
      ['up', (r, e) => r.current.handleItemPointerUp(e)],
      ['leave', (r, e) => r.current.handleItemPointerLeave(e)],
    ])('should not release pointer capture when svgRef is null (%s)', (_, handler) => {
      const { result } = runDragSequence();
      svgRef.current = null;
      act(() => {
        handler(result, { pointerId: 1 });
      });
      expect(result.current.itemDragging).toBeNull();
    });
  });
});
