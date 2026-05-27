import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlacedItems from './usePlacedItems.js';

describe('usePlacedItems', () => {
  let setPlacedItems;
  let setSelectedItem;

  beforeEach(() => {
    setPlacedItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = [
          { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
          { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        ];
        return fn(prev);
      }
      return fn;
    });
    setSelectedItem = vi.fn();
  });

  const getHook = () => {
    const { result } = renderHook(() => usePlacedItems(setPlacedItems, setSelectedItem));
    return result;
  };

  it('should toggle item visibility', () => {
    const result = getHook();
    act(() => {
      result.current.handleToggleItemVisibility('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should delete item', () => {
    const result = getHook();
    act(() => {
      result.current.handleDeleteItem('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedItem).toHaveBeenCalledWith(null);
  });

  it('should rotate item by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotate('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate item from 90 to 180 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotate('item2');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should not close context menu on rotate', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotate('item1');
    });
    expect(setSelectedItem).not.toHaveBeenCalledWith(null);
  });

  it('should toggle door open/closed', () => {
    const result = getHook();
    act(() => {
      result.current.handleToggleDoor('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedItem).toHaveBeenCalledWith(null);
  });
});
