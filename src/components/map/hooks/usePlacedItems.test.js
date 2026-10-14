import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlacedItems from './usePlacedItems.js';

describe('usePlacedItems', () => {
  let placedItemsState;
  let setPlacedItems;
  let setSelectedItem;

  beforeEach(() => {
    placedItemsState = [
      { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
    ];
    vi.clearAllMocks();
    setPlacedItems = vi.fn((fn) => {
      placedItemsState = fn(placedItemsState);
      return placedItemsState;
    });
    setSelectedItem = vi.fn();
  });

  const getHook = () => {
    const { result } = renderHook(() => usePlacedItems(setPlacedItems, setSelectedItem));
    return result;
  };

  describe('returned interface', () => {
    it('returns an object with exactly 4 handler functions', () => {
      const result = getHook();
      expect(Object.keys(result.current)).toEqual([
        'handleToggleItemVisibility',
        'handleDeleteItem',
        'handleToggleDoor',
        'handleRotate',
      ]);
    });
  });

  describe('handleToggleItemVisibility', () => {
    it('toggles visible from true to false', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleItemVisibility('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item1').visible).toBe(false);
    });

    it('toggles visible from false to true', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleItemVisibility('item2');
      });
      expect(placedItemsState.find(i => i.id === 'item2').visible).toBe(true);
    });

    it('does not affect other items when toggling', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleItemVisibility('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item2').visible).toBe(false);
      expect(placedItemsState.find(i => i.id === 'item3').visible).toBeUndefined();
    });

    it('does nothing when item id does not exist', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleItemVisibility('nonexistent');
      });
      expect(placedItemsState).toHaveLength(3);
      expect(placedItemsState.find(i => i.id === 'item1').visible).toBe(true);
    });
  });

  describe('handleDeleteItem', () => {
    it('removes the item and clears selected item', () => {
      const result = getHook();
      act(() => {
        result.current.handleDeleteItem('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item1')).toBeUndefined();
      expect(setSelectedItem).toHaveBeenCalledWith(null);
    });

    it('leaves other items intact', () => {
      const result = getHook();
      act(() => {
        result.current.handleDeleteItem('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item2')).toBeDefined();
      expect(placedItemsState.find(i => i.id === 'item3')).toBeDefined();
    });

    it('does nothing when item id does not exist', () => {
      const result = getHook();
      act(() => {
        result.current.handleDeleteItem('nonexistent');
      });
      expect(placedItemsState).toHaveLength(3);
      expect(setSelectedItem).toHaveBeenCalledWith(null);
    });

    it('results in empty array when deleting the last item', () => {
      const { result } = renderHook(() => usePlacedItems(
        vi.fn((fn) => { placedItemsState = fn(placedItemsState); return placedItemsState; }),
        vi.fn(),
      ));
      act(() => {
        result.current.handleDeleteItem('item1');
        result.current.handleDeleteItem('item2');
        result.current.handleDeleteItem('item3');
      });
      expect(placedItemsState).toEqual([]);
    });
  });

  describe('handleRotate', () => {
    it('rotates item by 90 degrees', () => {
      const result = getHook();
      act(() => {
        result.current.handleRotate('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item1').rotation).toBe(90);
    });

    it('wraps from 270 to 0 after four rotations', () => {
      const { result } = renderHook(() => usePlacedItems(
        vi.fn((fn) => { placedItemsState = fn(placedItemsState); return placedItemsState; }),
        vi.fn(),
      ));
      act(() => {
        result.current.handleRotate('item1');
        result.current.handleRotate('item1');
        result.current.handleRotate('item1');
        result.current.handleRotate('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item1').rotation).toBe(0);
    });

    it('defaults rotation to 0 when property is missing', () => {
      const { result } = renderHook(() => usePlacedItems(
        vi.fn((fn) => {
          placedItemsState = [
            { id: 'item-no-rot', gridX: 1, gridY: 1 },
          ];
          placedItemsState = fn(placedItemsState);
          return placedItemsState;
        }),
        vi.fn(),
      ));
      act(() => {
        result.current.handleRotate('item-no-rot');
      });
      expect(placedItemsState[0].rotation).toBe(90);
    });

    it('does not affect other items when rotating', () => {
      const result = getHook();
      act(() => {
        result.current.handleRotate('item1');
      });
      expect(placedItemsState.find(i => i.id === 'item2').rotation).toBe(90);
      expect(placedItemsState.find(i => i.id === 'item3').rotation).toBe(0);
    });

    it('does nothing when item id does not exist', () => {
      const result = getHook();
      act(() => {
        result.current.handleRotate('nonexistent');
      });
      expect(placedItemsState.find(i => i.id === 'item1').rotation).toBe(0);
    });
  });

  describe('handleToggleDoor', () => {
    it('toggles door open from false to true', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('item3');
      });
      expect(placedItemsState.find(i => i.id === 'item3').open).toBe(true);
      expect(setSelectedItem).toHaveBeenCalledWith(null);
    });

    it('toggles door open from true to false', () => {
      const { result } = renderHook(() => usePlacedItems(
        vi.fn((fn) => {
          placedItemsState = [
            { id: 'door1', type: 'door', open: true, rotation: 0, gridX: 1, gridY: 1 },
          ];
          placedItemsState = fn(placedItemsState);
          return placedItemsState;
        }),
        vi.fn(),
      ));
      act(() => {
        result.current.handleToggleDoor('door1');
      });
      expect(placedItemsState.find(i => i.id === 'door1').open).toBe(false);
    });

    it('does not toggle non-door items', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('item1');
      });
      expect(setSelectedItem).toHaveBeenCalledWith(null);
      expect(placedItemsState.find(i => i.id === 'item1').open).toBeUndefined();
    });

    it('does nothing when item id does not exist', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('nonexistent');
      });
      expect(setSelectedItem).toHaveBeenCalledWith(null);
    });

    it('does not affect other items when toggling door', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('item3');
      });
      expect(placedItemsState.find(i => i.id === 'item1').visible).toBe(true);
      expect(placedItemsState.find(i => i.id === 'item2').visible).toBe(false);
    });
  });
});
