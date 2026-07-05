// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useMapDrops from './useMapDrops.js';

describe('useMapDrops', () => {
  let getGridFromEvent;
  let setMapData;
  let setPlacedItems;
  let isLocalhost;

  const createMocks = () => {
    getGridFromEvent = vi.fn();
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = { players: [] };
        return fn(prev);
      }
      return fn;
    });
    setPlacedItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = [];
        return fn(prev);
      }
      return fn;
    });
    isLocalhost = true;
  };

  const getHook = () => {
    const { result } = renderHook(() =>
      useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems })
    );
    return result;
  };

  describe('early returns', () => {
    it('should not call setMapData or setPlacedItems when dragData is empty', () => {
      createMocks();
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => '' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should not call setMapData or setPlacedItems when grid is null', () => {
      createMocks();
      const result = getHook();
      getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });
  });

  describe('character drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add a character to map players', () => {
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      expect(setMapData).toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should not add a duplicate character', () => {
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = {
            players: [{ id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 }],
          };
          return fn(prev);
        }
        return fn;
      });
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      expect(setMapData).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('NPC drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add an NPC to placed items', () => {
      getGridFromEvent.mockReturnValue({ gridX: 3, gridY: 6 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should set visible based on isLocalhost', () => {
      getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.visible).toBe(true);
    });

    it('should set visible false when not localhost', () => {
      isLocalhost = false;
      getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.visible).toBe(false);
    });
  });

  describe('furniture drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add furniture to placed items', () => {
      getGridFromEvent.mockReturnValue({ gridX: 7, gridY: 2 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should floor grid coordinates', () => {
      getGridFromEvent.mockReturnValue({ gridX: 3.9, gridY: 7.1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.gridX).toBe(3);
      expect(newItem.gridY).toBe(7);
    });

    it('should set rotation for items that support it', () => {
      const rotationItems = ['table', 'bed', 'stairs', 'altar', 'bookshelf', 'torch', 'chair', 'arrowSlitWall'];
      for (const item of rotationItems) {
        setPlacedItems.mockClear();
        getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
        const result = getHook();
        act(() => {
          result.current.handleDrop({
            preventDefault: vi.fn(),
            dataTransfer: { getData: () => item },
          });
        });
        const [fn] = setPlacedItems.mock.calls[0];
        const newItem = fn([])[0];
        expect(newItem.rotation).toBe(0);
      }
    });

    it('should set rotation undefined for items without rotation', () => {
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'wall' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.rotation).toBe(undefined);
    });
  });
});
