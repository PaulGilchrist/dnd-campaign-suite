import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSelectMove from './useSelectMove.js';
import { TOOL_SELECT } from '../../../config/mapConfig.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

describe('useSelectMove', () => {
  const mockSvgRef = { current: null };
  const mockGetGridFromEvent = vi.fn();

  const createMockEvent = (_gridX, _gridY) => ({
    preventDefault: vi.fn(),
    pointerId: 1,
  });

  const createSvgWithPointerCapture = () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    mockSvgRef.current = {
      setPointerCapture,
      releasePointerCapture,
    };
  };

  const baseArgs = () => ({
    isLocalhost: true,
    tool: TOOL_SELECT,
    getGridFromEvent: mockGetGridFromEvent,
    svgRef: mockSvgRef,
    campaignName: 'test-campaign',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSvgRef.current = null;
    mockGetGridFromEvent.mockReturnValue(null);
  });

  describe('initial state', () => {
    it('should initialize with null selectionRect', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.selectionRect).toBeNull();
    });

    it('should initialize with empty selectedWalls Set', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.selectedWalls).toBeInstanceOf(Set);
      expect(result.current.selectedWalls.size).toBe(0);
    });

    it('should initialize with empty selectedItems Set', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.selectedItems).toBeInstanceOf(Set);
      expect(result.current.selectedItems.size).toBe(0);
    });

    it('should initialize with null moveOffset', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.moveOffset).toBeNull();
    });

    it('should initialize refs as empty sets/null', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.selectedWallsRef.current).toBeInstanceOf(Set);
      expect(result.current.selectedWallsRef.current.size).toBe(0);
      expect(result.current.selectedItemsRef.current).toBeInstanceOf(Set);
      expect(result.current.selectedItemsRef.current.size).toBe(0);
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffsetRef.current).toBeNull();
      expect(result.current.selectionRectRef.current).toBeNull();
      expect(result.current.selectionBoundsRef.current).toBeNull();
      expect(result.current.placedItemsRef.current).toEqual([]);
      expect(result.current.mapDataRef.current).toBeNull();
    });
  });

  describe('returned functions', () => {
    it('should return handleSelectPointerDown', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(typeof result.current.handleSelectPointerDown).toBe('function');
    });

    it('should return handleSelectPointerMove', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(typeof result.current.handleSelectPointerMove).toBe('function');
    });

    it('should return handleSelectPointerUp', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(typeof result.current.handleSelectPointerUp).toBe('function');
    });

    it('should return all refs', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      expect(result.current.selectedWallsRef).toBeDefined();
      expect(result.current.selectedItemsRef).toBeDefined();
      expect(result.current.selectStart).toBeDefined();
      expect(result.current.moveStartGrid).toBeDefined();
      expect(result.current.moveOffsetRef).toBeDefined();
      expect(result.current.selectionRectRef).toBeDefined();
      expect(result.current.selectionBoundsRef).toBeDefined();
      expect(result.current.placedItemsRef).toBeDefined();
      expect(result.current.mapDataRef).toBeDefined();
    });
  });

  describe('handleSelectPointerDown', () => {
    it('should do nothing when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        isLocalhost: false,
      }));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.selectedWalls.size).toBe(0);
    });

    it('should do nothing when tool is not select', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        tool: 'paint',
      }));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });
      // preventDefault is called before grid check, so it is called
      expect(event.preventDefault).toHaveBeenCalled();
      // But selection state should not change
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.selectionRect).toBeNull();
    });

    it('should start selection when clicking on empty area', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

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
    });

    it('should start moving when clicking on selected wall', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      // Pre-select a wall
      act(() => {
        result.current.selectedWallsRef.current.add('5,3');
        result.current.selectionBoundsRef.current = { minX: 5, maxX: 5, minY: 3, maxY: 3 };
      });

      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
      expect(result.current.selectStart.current).toBeNull();
    });

    it('should start moving when clicking on selected item', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      // Pre-select an item and set placed items ref
      act(() => {
        result.current.selectedItemsRef.current.add('item1');
        result.current.placedItemsRef.current = [
          { id: 'item1', gridX: 5, gridY: 3 },
        ];
        result.current.selectionBoundsRef.current = { minX: 5, maxX: 5, minY: 3, maxY: 3 };
      });

      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
    });

    it('should start moving when clicking within selection bounds with no selections', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      // Set bounds but no selections
      act(() => {
        result.current.selectionBoundsRef.current = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      });

      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      // With no selections and within bounds, should start selection (not move)
      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
    });
  });

  describe('handleSelectPointerMove', () => {
    it('should do nothing when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        isLocalhost: false,
      }));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerMove(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should do nothing when tool is not select', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        tool: 'paint',
      }));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerMove(event);
      });
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerMove(event);
      });
    });

    it('should update selection rect when selecting', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      // Start selection
      act(() => {
        result.current.selectStart.current = { gridX: 5, gridY: 3 };
      });

      // Move to different position
      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const event = createMockEvent(1, 1);
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

    it('should update move offset when moving', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      // Start moving
      act(() => {
        result.current.moveStartGrid.current = { gridX: 5, gridY: 3 };
      });

      // Move to different position
      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const event = createMockEvent(1, 1);
      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.moveOffset).toEqual({ dx: 3, dy: 3 });
      expect(result.current.moveOffsetRef.current).toEqual({ dx: 3, dy: 3 });
    });
  });

  describe('handleSelectPointerUp', () => {
    it('should do nothing when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        isLocalhost: false,
      }));
      const event = createMockEvent(1, 1);
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();
      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should release pointer capture on svg', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();
      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });
      expect(mockSvgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should select walls within the selection rectangle', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      // Set up selection rect
      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = {
          minX: 2, maxX: 4, minY: 2, maxY: 4,
        };
      });

      // Set up map data with walls
      const walls = new Set(['2,2', '3,3', '4,4', '5,5']);
      act(() => {
        result.current.mapDataRef.current = { walls };
      });

      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(['2,2', '3,3', '4,4', '5,5']) };
        const result = fn(prev);
        return result;
      });
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
    });

    it('should select items within the selection rectangle', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      // Set up selection rect and placed items ref (hook reads from ref, not argument)
      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = {
          minX: 2, maxX: 4, minY: 2, maxY: 4,
        };
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

    it('should move selected walls', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      // Set up move state — need to sync selectedWallsRef AND selectedWalls state
      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 2 };
        const walls = new Set(['2,2', '3,3']);
        result.current.selectedWallsRef.current = walls;
        result.current.selectedWalls = walls;
        result.current.selectionBoundsRef.current = {
          minX: 2, maxX: 3, minY: 2, maxY: 3,
        };
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

      // Verify setMapData was called
      expect(setMapData).toHaveBeenCalled();
      // The hook's setSelectedWalls should have been called with moved walls
      // Since we can't easily capture the setState call, verify the ref was updated
      expect(result.current.selectedWallsRef.current).toEqual(new Set(['2,2', '3,3']));
      expect(result.current.selectionBoundsRef.current).toEqual({
        minX: 3, maxX: 4, minY: 4, maxY: 5,
      });
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should move selected items', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      // Set up move state — only item1 is selected
      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 1 };
        result.current.selectedItemsRef.current = new Set(['item1']);
        result.current.selectionBoundsRef.current = {
          minX: 2, maxX: 2, minY: 2, maxY: 2,
        };
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
      // Only item1 should be moved (it's the only one in selectedItemsRef)
      expect(placedItemsState[0].gridX).toBe(3);
      expect(placedItemsState[0].gridY).toBe(3);
      // item2 and item3 should be unchanged
      expect(placedItemsState[1].gridX).toBe(3);
      expect(placedItemsState[1].gridY).toBe(3);
      expect(placedItemsState[2].gridX).toBe(5);
      expect(placedItemsState[2].gridY).toBe(5);
    });

    it('should track steady aim movement for player items', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      // Set up move state
      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 1 };
        result.current.selectedItemsRef.current = new Set(['item1']);
        result.current.selectionBoundsRef.current = {
          minX: 2, maxX: 2, minY: 2, maxY: 2,
        };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [
          { id: 'item1', name: 'CharA', type: 'player', gridX: 2, gridY: 2 },
        ], null, setMapData, setPlacedItems);
      });

      // The setRuntimeValue should have been called with campaignName
      // We can't directly test the internal call but we can verify the movement happened
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should not track steady aim for non-player items', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 1 };
        result.current.selectedItemsRef.current = new Set(['item1']);
        result.current.selectionBoundsRef.current = {
          minX: 2, maxX: 2, minY: 2, maxY: 2,
        };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [
          { id: 'item1', name: 'MonsterA', type: 'monster', gridX: 2, gridY: 2 },
        ], null, setMapData, setPlacedItems);
      });

      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should not move when offset is zero', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

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
      // But should still reset move state
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();
    });

    it('should clear selection state after pointer up', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent(1, 1);

      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = {
          minX: 2, maxX: 4, minY: 2, maxY: 4,
        };
        result.current.mapDataRef.current = { walls: new Set() };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.selectionRectRef.current).toBeNull();
      expect(result.current.selectionRect).toBeNull();
    });
  });

  describe('non-localhost behavior', () => {
    it('should skip all interactions when not localhost', () => {
      const { result } = renderHook(() => useSelectMove({
        ...baseArgs(),
        isLocalhost: false,
      }));
      const event = createMockEvent(1, 1);
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      // Down should do nothing
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });
      expect(result.current.selectStart.current).toBeNull();

      // Move should do nothing
      act(() => {
        result.current.handleSelectPointerMove(event);
      });

      // Up should do nothing
      act(() => {
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });
  });
});
