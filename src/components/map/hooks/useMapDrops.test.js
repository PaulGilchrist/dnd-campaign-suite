import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMapDrops from './useMapDrops.js';

describe('useMapDrops', () => {
  let getGridFromEvent;
  let setMapData;
  let setPlacedItems;
  let isLocalhost;

  beforeEach(() => {
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
  });

  const getHook = () => {
    const { result } = renderHook(() =>
      useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems })
    );
    return result;
  };

  it('should return handleDrop function', () => {
    const result = getHook();
    expect(result.current.handleDrop).toBeDefined();
    expect(typeof result.current.handleDrop).toBe('function');
  });

  it('should prevent default on drop event', () => {
    const result = getHook();
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { getData: () => '' },
      });
    });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('should return early when getGridFromEvent returns null', () => {
    const result = getHook();
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { getData: () => 'table' },
      });
    });
    getGridFromEvent.mockReturnValue(null);
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).not.toHaveBeenCalled();
  });

  it('should return early when dragData is empty', () => {
    const result = getHook();
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { getData: () => '' },
      });
    });
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).not.toHaveBeenCalled();
  });

  it('should add a character to map players when dragData starts with character:', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'character:Gandalf' },
      });
    });
    expect(setMapData).toHaveBeenCalled();
    expect(setPlacedItems).not.toHaveBeenCalled();
  });

  it('should not add duplicate character to map players', () => {
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = {
          players: [
            { id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 },
          ],
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
    expect(setMapData).toHaveBeenCalled();
  });

  it('should create character entry with correct id format', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 2, gridY: 4 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'character:Test Character' },
      });
    });
    expect(setMapData).toHaveBeenCalled();
  });

  it('should add NPC when dragData is npc', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 3, gridY: 6 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'npc' },
      });
    });
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should create NPC with visible based on isLocalhost', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'npc' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should create NPC with visible false when not localhost', () => {
    isLocalhost = false;
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'npc' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should add furniture items to placed items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 7, gridY: 2 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'table' },
      });
    });
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for table items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'table' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for bed items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'bed' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for stairs items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'stairs' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for altar items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'altar' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for bookshelf items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'bookshelf' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for torch items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'torch' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for chair items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'chair' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation 0 for arrowSlitWall items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'arrowSlitWall' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should set rotation undefined for non-specified items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'wall' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should floor grid coordinates', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 3.9, gridY: 7.1 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'table' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });

  it('should not add duplicate character with different casing', () => {
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = {
          players: [
            { id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 },
          ],
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
    expect(setMapData).toHaveBeenCalled();
  });

  it('should pass type as dragData for furniture items', () => {
    const result = getHook();
    getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => 'table' },
      });
    });
    expect(setPlacedItems).toHaveBeenCalled();
  });
});
