// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useSelectMove from './useSelectMove.js';
import { TOOL_SELECT } from '../../../config/mapConfig.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  // L5-002: clampSelectOffset reads enforcement; null ⇒ passthrough (off).
  getRuntimeValue: vi.fn(() => null),
}));

describe('useSelectMove', () => {
  const mockSvgRef = { current: null };
  const mockGetGridFromEvent = vi.fn();

  const createMockEvent = (pointerId = 1) => ({
    preventDefault: vi.fn(),
    pointerId,
  });

  const createSvgWithPointerCapture = () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    mockSvgRef.current = { setPointerCapture, releasePointerCapture };
  };

  const baseArgs = (overrides = {}) => ({
    isLocalhost: true,
    tool: TOOL_SELECT,
    getGridFromEvent: mockGetGridFromEvent,
    svgRef: mockSvgRef,
    campaignName: 'test-campaign',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSvgRef.current = null;
    mockGetGridFromEvent.mockReturnValue(null);
  });

  describe('handleSelectPointerDown', () => {
    it('should start a new selection when clicking on empty area', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.selectionRect).toEqual({
        minX: 5, maxX: 5, minY: 3, maxY: 3,
      });
      expect(result.current.selectedWalls.size).toBe(0);
      expect(result.current.selectedItems.size).toBe(0);
      expect(result.current.moveOffset).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.selectionBoundsRef.current).toBeNull();
    });

    it('should start moving when clicking on a selected wall', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectedWallsRef.current.add('5,3');
        result.current.selectionBoundsRef.current = { minX: 5, maxX: 5, minY: 3, maxY: 3 };
      });

      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
      expect(result.current.selectStart.current).toBeNull();
    });

    it('should start moving when clicking on a selected item', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectedItemsRef.current.add('item1');
        result.current.placedItemsRef.current = [{ id: 'item1', gridX: 5, gridY: 3 }];
        result.current.selectionBoundsRef.current = { minX: 5, maxX: 5, minY: 3, maxY: 3 };
      });

      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
    });

    it('should start moving when clicking within selection bounds that has active selections', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectedWallsRef.current.add('1,1');
        result.current.selectionBoundsRef.current = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      });

      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.selectStart.current).toBeNull();
    });

    it('should start a new selection when clicking within bounds but no active selections exist', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectionBoundsRef.current = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      });

      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveStartGrid.current).toBeNull();
    });

    it('should skip interaction when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), isLocalhost: false }));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });

    it('should skip interaction when tool is not TOOL_SELECT', () => {
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), tool: 'ruler' }));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
      expect(result.current.selectStart.current).toBeNull();
    });

    it('should skip pointer capture when svgRef.current is null', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      mockSvgRef.current = null;
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
    });

    it('should skip grid processing when getGridFromEvent returns null', () => {
      mockGetGridFromEvent.mockReturnValue(null);
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });
  });

  describe('handleSelectPointerMove', () => {
    it('should update selection rect when drag-selecting', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectStart.current = { gridX: 5, gridY: 3 };
      });

      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.selectionRect).toEqual({
        minX: 5, maxX: 8, minY: 3, maxY: 6,
      });
      expect(result.current.selectionRectRef.current).toEqual({
        minX: 5, maxX: 8, minY: 3, maxY: 6,
      });
    });

    it('should update move offset when dragging a selection', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.moveStartGrid.current = { gridX: 5, gridY: 3 };
      });

      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.moveOffset).toEqual({ dx: 3, dy: 3 });
      expect(result.current.moveOffsetRef.current).toEqual({ dx: 3, dy: 3 });
    });

    it('should do nothing when neither selecting nor moving', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(mockGetGridFromEvent).toHaveBeenCalled();
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      mockGetGridFromEvent.mockReturnValue(null);
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(result.current.selectionRect).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should skip interaction when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), isLocalhost: false }));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
    });

    it('should skip interaction when tool is not TOOL_SELECT', () => {
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), tool: 'ruler' }));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
    });

    it('should compute correct rect when dragging backwards (negative direction)', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectStart.current = { gridX: 8, gridY: 6 };
      });

      mockGetGridFromEvent.mockReturnValue({ gridX: 2.1, gridY: 1.9 });
      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(result.current.selectionRect).toEqual({
        minX: 2, maxX: 8, minY: 1, maxY: 6,
      });
    });
  });

  describe('handleSelectPointerUp', () => {
    it('should release pointer capture on svg', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(mockSvgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should skip pointer release when svgRef.current is null', () => {
      mockSvgRef.current = null;
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      // Should not throw, no releasePointerCapture called
    });

    it('should skip all interactions when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), isLocalhost: false }));
      const event = createMockEvent();
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should select walls within the selection rectangle', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = { minX: 2, maxX: 4, minY: 2, maxY: 4 };
        result.current.mapDataRef.current = { walls: new Set(['2,2', '3,3', '4,4', '5,5']) };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectedWalls).toEqual(new Set(['2,2', '3,3', '4,4']));
      expect(result.current.selectionBoundsRef.current).toEqual({
        minX: 2, maxX: 4, minY: 2, maxY: 4,
      });
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.selectionRectRef.current).toBeNull();
    });

    it('should select items within the selection rectangle', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = { minX: 2, maxX: 4, minY: 2, maxY: 4 };
        result.current.mapDataRef.current = { walls: new Set() };
        result.current.placedItemsRef.current = [
          { id: 'item1', gridX: 2, gridY: 2 },
          { id: 'item2', gridX: 3, gridY: 3 },
          { id: 'item3', gridX: 5, gridY: 5 },
        ];
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectedItems).toEqual(new Set(['item1', 'item2']));
    });

    it('should select nothing when no walls or items fall within the rectangle', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = { minX: 2, maxX: 4, minY: 2, maxY: 4 };
        result.current.mapDataRef.current = { walls: new Set(['10,10']) };
        result.current.placedItemsRef.current = [
          { id: 'item1', gridX: 10, gridY: 10 },
        ];
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectedWalls.size).toBe(0);
      expect(result.current.selectedItems.size).toBe(0);
    });

    it('should move selected walls and update bounds', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 2 };
        const walls = new Set(['2,2', '3,3']);
        result.current.selectedWallsRef.current = walls;
        result.current.selectedWalls = walls;
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 3, minY: 2, maxY: 3 };
      });

      let mapDataState = { walls: new Set(['2,2', '3,3', '5,5']) };
      const setMapData = vi.fn((fn) => {
        mapDataState = fn(mapDataState);
        return mapDataState;
      });
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], mapDataState, setMapData, setPlacedItems);
      });

      expect(setMapData).toHaveBeenCalled();
      // Walls moved from (2,2)->(3,4) and (3,3)->(4,5)
      expect(mapDataState.walls).toContain('3,4');
      expect(mapDataState.walls).toContain('4,5');
      expect(mapDataState.walls).not.toContain('2,2');
      expect(mapDataState.walls).not.toContain('3,3');
      // Unselected wall at (5,5) is outside dstBounds (3-4,4-5), so it stays
      expect(mapDataState.walls).toContain('5,5');
      // Selection bounds updated
      expect(result.current.selectionBoundsRef.current).toEqual({
        minX: 3, maxX: 4, minY: 4, maxY: 5,
      });
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should move selected placed items and track steady aim for player items', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 1 };
        result.current.selectedItemsRef.current = new Set(['item1']);
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 2, minY: 2, maxY: 2 };
      });

      let placedItemsState = [
        { id: 'item1', name: 'CharA', type: 'player', gridX: 2, gridY: 2 },
        { id: 'item2', name: 'CharB', type: 'monster', gridX: 3, gridY: 3 },
        { id: 'item3', name: 'CharC', type: 'player', gridX: 5, gridY: 5 },
      ];
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn((fn) => {
        placedItemsState = fn(placedItemsState);
        return placedItemsState;
      });

      act(() => {
        result.current.handleSelectPointerUp(event, placedItemsState, null, setMapData, setPlacedItems);
      });

      expect(setPlacedItems).toHaveBeenCalled();
      // Moved item
      expect(placedItemsState[0].gridX).toBe(3);
      expect(placedItemsState[0].gridY).toBe(3);
      // Unselected items unchanged
      expect(placedItemsState[1].gridX).toBe(3);
      expect(placedItemsState[1].gridY).toBe(3);
      expect(placedItemsState[2].gridX).toBe(5);
      expect(placedItemsState[2].gridY).toBe(5);
    });

    it('should reset move state even when offset is zero', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 0, dy: 0 };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should clear selection state after drag-select', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = { minX: 2, maxX: 4, minY: 2, maxY: 4 };
        result.current.mapDataRef.current = { walls: new Set() };
        result.current.placedItemsRef.current = [];
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.selectionRectRef.current).toBeNull();
    });

    it('should do nothing when neither selecting nor moving', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, vi.fn(), vi.fn());
      });

      // Should not throw, no state changes
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });
  });
});
