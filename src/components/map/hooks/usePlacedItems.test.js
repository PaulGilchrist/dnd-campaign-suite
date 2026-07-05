// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
          { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
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

  describe('handleToggleItemVisibility', () => {
    it('should toggle item visibility', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleItemVisibility('item1');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item1').visible).toBe(false);
    });
  });

  describe('handleDeleteItem', () => {
    it('should delete item and clear selected item', () => {
      const result = getHook();
      act(() => {
        result.current.handleDeleteItem('item1');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      expect(setSelectedItem).toHaveBeenCalledWith(null);
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item1')).toBeUndefined();
    });
  });

  describe('handleRotate', () => {
    it('should rotate item by 90 degrees', () => {
      const result = getHook();
      act(() => {
        result.current.handleRotate('item1');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item1').rotation).toBe(90);
    });

    it('should wrap rotation at 360 degrees', () => {
      const result = getHook();
      act(() => {
        result.current.handleRotate('item2');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item2').rotation).toBe(180);
    });
  });

  describe('handleToggleDoor', () => {
    it('should toggle door open/closed and clear selected item', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('item3');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      expect(setSelectedItem).toHaveBeenCalledWith(null);
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item3').open).toBe(true);
    });

    it('should not toggle non-door items', () => {
      const result = getHook();
      act(() => {
        result.current.handleToggleDoor('item1');
      });
      expect(setPlacedItems).toHaveBeenCalled();
      const callArg = setPlacedItems.mock.calls[0][0];
      const updated = callArg([
        { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
        { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
        { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      ]);
      expect(updated.find(i => i.id === 'item1').open).toBeUndefined();
    });
  });
});
