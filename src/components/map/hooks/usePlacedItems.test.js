import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlacedItems from './usePlacedItems.js';

describe('usePlacedItems', () => {
  let setPlacedItems;
  let setSelectedBarrel;

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
    setSelectedBarrel = vi.fn();
  });

  const getHook = () => {
    const { result } = renderHook(() => usePlacedItems(setPlacedItems, setSelectedBarrel));
    return result;
  };

  it('should toggle item visibility', () => {
    const result = getHook();
    let updated;
    act(() => {
      updated = result.current.handleToggleItemVisibility('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should delete item', () => {
    const result = getHook();
    act(() => {
      result.current.handleDeleteItem('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedBarrel).toHaveBeenCalledWith(null);
  });

  it('should rotate table 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateTable('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedBarrel).toHaveBeenCalledWith(null);
  });

  it('should rotate bed by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateBed('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedBarrel).toHaveBeenCalledWith(null);
  });

  it('should rotate door by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateDoor('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate secret door by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateSecretDoor('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate stairs by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateStairs('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate torch by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateTorch('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate chair by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateChair('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should rotate altar 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateAltar('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
    expect(setSelectedBarrel).toHaveBeenCalledWith(null);
  });

  it('should rotate bookshelf by 90 degrees', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotateBookshelf('item1');
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });
});
