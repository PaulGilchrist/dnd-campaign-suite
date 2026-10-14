import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useItemDragging from './useItemDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

describe('useItemDragging', () => {
  // Shared mutable containers so useCallback closures always see current values.
  // The hook's useCallback captures placedItems/svgRef by reference at render time.
  // By using objects whose .current properties are reassigned, the closures
  // see updates because they reference the object, not the primitive value.
  let svgRef;
  let itemsHolder;
  let setPlacedItems;
  let gridSize;
  let gridCenterX;
  let gridCenterY;
  let setRuntimeValueSpy;

  const defaultSvgMock = (overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 100, y: 100 }),
    }),
    getScreenCTM: () => ({ inverse: () => ({}) }),
    ...overrides,
  });

  const createSvgMockWithTransform = (transformFn, overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: transformFn,
    }),
    getScreenCTM: () => ({ inverse: () => ({}) }),
    ...overrides,
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

  const getHook = ({
    rulerMode = false,
    spellMode = false,
    campaign = 'test-campaign',
  } = {}) => {
    const { result } = renderHook(() =>
      useItemDragging({
        svgRef,
        placedItems: itemsHolder.current,
        setPlacedItems,
        gridSize,
        gridCenterX,
        gridCenterY,
        rulerMode,
        spellMode,
        campaignName: campaign,
      })
    );
    return result;
  };

  const setupDrag = (itemId, svgOverrides = {}, hookOverrides = {}) => {
    const mockEvent = createMockEvent();
    svgRef.current = defaultSvgMock(svgOverrides);
    const result = getHook(hookOverrides);
    act(() => {
      result.current.handleItemPointerDown(mockEvent, itemId);
    });
    return { result, mockEvent };
  };

  beforeEach(() => {
    // svgRef is an object; handleItemPointerDown's useCallback captures this
    // object reference. Reassigning svgRef.current updates what the closure sees.
    svgRef = { current: null };

    // itemsHolder is an object; placedItems: itemsHolder.current passes the
    // CURRENT array at render time. When setPlacedItems updates itemsHolder.current,
    // subsequent renders (triggered by act) will pass the new array to useCallback.
    itemsHolder = {
      current: [
        { id: 'item1', name: 'PlayerToken', type: 'player', gridX: 1, gridY: 1 },
        { id: 'item2', name: 'MonsterToken', type: 'monster', gridX: 2, gridY: 2 },
      ],
    };

    // setPlacedItems updates itemsHolder.current so the hook sees new data on next render.
    // The mock returns a NEW array each time (like React setState), which triggers
    // the useCallback dependency to update on the next render.
    setPlacedItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const result = fn(itemsHolder.current);
        itemsHolder.current = result;
        return result;
      }
      itemsHolder.current = fn;
      return fn;
    });

    gridSize = 30;
    gridCenterX = (x) => x * CELL_SIZE + CELL_SIZE / 2;
    gridCenterY = (y) => y * CELL_SIZE + CELL_SIZE / 2;
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockReturnValue(undefined);
  });

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

  describe('mode guards (rulerMode and spellMode)', () => {
    it.each([
      ['rulerMode', { rulerMode: true }],
      ['spellMode', { spellMode: true }],
    ])('should not start drag when %s is enabled', (_, overrides) => {
      const mockEvent = createMockEvent();
      const result = getHook(overrides);
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.itemDragging).toBeNull();
    });
  });

  describe('handleItemPointerDown', () => {
    it('should call stopPropagation and preventDefault on the event', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should capture pointer on svg', () => {
      const setPointerCapture = vi.fn();
      svgRef.current = defaultSvgMock({ setPointerCapture });
      const mockEvent = createMockEvent({ pointerId: 42 });
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should set dragging state with correct properties', () => {
      svgRef.current = defaultSvgMock();
      const mockEvent = createMockEvent({ pointerId: 42 });
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      const dragging = result.current.itemDragging;
      expect(dragging).not.toBeNull();
      expect(dragging.itemId).toBe('item1');
      expect(dragging.pointerId).toBe(42);
      expect(typeof dragging.offsetX).toBe('number');
      expect(typeof dragging.offsetY).toBe('number');
    });

    it('should return early when button is not left click', () => {
      const mockEvent = createMockEvent({ button: 1 });
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
      // stopPropagation is called before the button check, but preventDefault is not
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should return early when svgRef is null', () => {
      const mockEvent = createMockEvent();
      svgRef.current = null;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should return early when ctm is null', () => {
      const mockEvent = createMockEvent();
      svgRef.current = {
        setPointerCapture: vi.fn(),
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null,
      };
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it('should return early when item does not exist', () => {
      svgRef.current = defaultSvgMock();
      const mockEvent = createMockEvent();
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'nonexistent');
      });
      expect(result.current.itemDragging).toBeNull();
    });
  });

  describe('handleItemPointerMove', () => {
    it('should update placed item grid position during drag', () => {
      const { result } = setupDrag('item1');
      // Move to SVG coordinates (150, 150) → grid cell (2, 2)
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 150, clientY: 150 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const updated = setPlacedItems.mock.calls[0][0](itemsHolder.current);
      const item = updated.find((i) => i.id === 'item1');
      expect(item.gridX).toBe(2);
      expect(item.gridY).toBe(2);
    });

    it('should clamp grid position to minimum bounds (0, 0)', () => {
      const { result } = setupDrag('item1');
      svgRef.current = createSvgMockWithTransform(() => ({ x: -100, y: -100 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: -100, clientY: -100 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const updated = setPlacedItems.mock.calls[0][0](itemsHolder.current);
      const item = updated.find((i) => i.id === 'item1');
      expect(item.gridX).toBe(0);
      expect(item.gridY).toBe(0);
    });

    it('should clamp grid position to maximum bounds (gridSize - 1)', () => {
      const { result } = setupDrag('item1');
      svgRef.current = createSvgMockWithTransform(() => ({ x: 99999, y: 99999 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 99999, clientY: 99999 });
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const updated = setPlacedItems.mock.calls[0][0](itemsHolder.current);
      const item = updated.find((i) => i.id === 'item1');
      expect(item.gridX).toBe(gridSize - 1);
      expect(item.gridY).toBe(gridSize - 1);
    });

    it('should do nothing when not dragging', () => {
      const result = getHook();
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should do nothing when svgRef is null', () => {
      const { result } = setupDrag('item1');
      svgRef.current = null;
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should do nothing when ctm is null', () => {
      const { result } = setupDrag('item1');
      svgRef.current = {
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null,
      };
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should do nothing when dragged item is not found', () => {
      itemsHolder.current = [];
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent, 'nonexistent');
      });
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should call setRuntimeValue for player items moving to a different grid cell', () => {
      const { result } = setupDrag('item1');
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 150, clientY: 150 });
      });
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'PlayerToken',
        'steadyAimMovedThisTurn',
        true,
        'test-campaign'
      );
    });

    it('should NOT call setRuntimeValue when grid position does not change', () => {
      setRuntimeValueSpy.mockClear();
      const { result } = setupDrag('item1');
      svgRef.current = createSvgMockWithTransform(() => ({ x: 100, y: 100 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('should NOT call setRuntimeValue for non-player items', () => {
      setRuntimeValueSpy.mockClear();
      const { result } = setupDrag('item2');
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 150, clientY: 150 });
      });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('should use item.id when item.name is missing', () => {
      itemsHolder.current = [{ id: 'orphan-token', type: 'player', gridX: 1, gridY: 1 }];
      const { result } = setupDrag('orphan-token');
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 150, clientY: 150 });
      });
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'orphan-token',
        'steadyAimMovedThisTurn',
        true,
        'test-campaign'
      );
    });

    it('should NOT call setRuntimeValue when campaignName is falsy', () => {
      setRuntimeValueSpy.mockClear();
      const { result } = setupDrag('item1', {}, { campaign: null });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handleItemPointerMove({ preventDefault: vi.fn(), clientX: 150, clientY: 150 });
      });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleItemPointerUp and handleItemPointerLeave', () => {
    const runDragSequence = (overrides = {}) => {
      const mockSvg = defaultSvgMock(overrides);
      svgRef.current = mockSvg;
      const result = getHook();
      act(() => {
        result.current.handleItemPointerDown(createMockEvent(), 'item1');
      });
      return { result };
    };

    it.each([
      ['up', (r) => r.current.handleItemPointerUp(createMockEvent())],
      ['leave', (r) => r.current.handleItemPointerLeave({ pointerId: 1 })],
    ])('should do nothing when not dragging (%s)', (_, handler) => {
      const result = getHook();
      act(() => {
        handler(result);
      });
      expect(result.current.itemDragging).toBeNull();
    });

    it.each([
      ['up', (r) => r.current.handleItemPointerUp(createMockEvent())],
      ['leave', (r) => r.current.handleItemPointerLeave({ pointerId: 1 })],
    ])('should release pointer capture and clear dragging (%s)', (_, handler) => {
      const releasePointerCapture = vi.fn();
      const { result } = runDragSequence({ releasePointerCapture });
      expect(result.current.itemDragging).not.toBeNull();
      act(() => {
        handler(result);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it.each([
      ['up', (r) => r.current.handleItemPointerUp(createMockEvent())],
      ['leave', (r) => r.current.handleItemPointerLeave({ pointerId: 1 })],
    ])('should not release pointer capture when svgRef is null (%s)', (_, handler) => {
      const { result } = runDragSequence();
      svgRef.current = null;
      act(() => {
        handler(result);
      });
      expect(result.current.itemDragging).toBeNull();
    });
  });
});
